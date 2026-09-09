"""Stage 2 — pure deterministic validators.

Every function takes plain values (already extracted by stage 1), touches at
most the read-only registry, and returns a Finding. No LLM, no I/O besides
DuckDB lookups, no mutation.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

import registry
from ledger import Assertion, Finding, Ledger

# ---------------------------------------------------------------------------
# helpers

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")
_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_CIN_RE = re.compile(
    r"^([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})$"
)
_LLPIN_RE = re.compile(r"^[A-Z]{3}-\d{4}$")
_B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

# ROC state codes used in CINs -> GST-style state names.
CIN_STATE_CODES = {
    "AN": "andaman and nicobar islands", "AP": "andhra pradesh",
    "AR": "arunachal pradesh", "AS": "assam", "BR": "bihar",
    "CH": "chandigarh", "CT": "chhattisgarh", "DL": "delhi",
    "DN": "dadra and nagar haveli and daman and diu",
    "DD": "dadra and nagar haveli and daman and diu",
    "GA": "goa", "GJ": "gujarat", "HP": "himachal pradesh",
    "HR": "haryana", "JH": "jharkhand", "JK": "jammu and kashmir",
    "KA": "karnataka", "KL": "kerala", "LD": "lakshadweep",
    "MH": "maharashtra", "ML": "meghalaya", "MN": "manipur",
    "MP": "madhya pradesh", "MZ": "mizoram", "NL": "nagaland",
    "OR": "odisha", "PB": "punjab", "PY": "puducherry",
    "RJ": "rajasthan", "SK": "sikkim", "TN": "tamil nadu",
    "TZ": "tamil nadu",  # ROC Coimbatore
    "TG": "telangana", "TR": "tripura", "UP": "uttar pradesh",
    "UR": "uttarakhand", "UT": "uttarakhand", "WB": "west bengal",
}

# NIC prefixes (first two digits of the 5-digit code in the CIN / registry).
# Auto components file under more divisions than motor vehicles proper:
# 22 rubber (brake linings, hoses), 25 fabricated metal, 27 electrical
# equipment, 28 machinery, 30 other transport equipment — plus the core
# NIC-2008 29xx and NIC-2004 34xx vehicle codes.
NIC_MANUFACTURING_PREFIXES = ("29", "34", "22", "25", "27", "28", "30")
NIC_TRADING_PREFIXES = ("45",)              # wholesale/retail of vehicles & parts

# OEM published spec sheets (stub): part number -> the standard the OEM
# certifies that part to. Mentors confirmed spec-on-paper checks are in
# scope: a certificate claiming a different standard than the OEM's
# published sheet is a document inconsistency, not a physical measurement.
OEM_SPEC_STUB = {
    "BC-2209": "IS 15100",   # front brake caliper assemblies
    "BC-2231": "IS 15100",
    "BC-3310": "IS 15100",
    "CP-4417": "IS 4076",    # clutch friction plates
    "BS-7702": "IS 2742",    # drum brake shoes
    "WH-5521": "IS 11829",   # wheel hub assemblies
    "GK-118": "IS 4253",     # engine gaskets
    "BL-4407": "IS 2742",    # brake linings
    "CH-0912": "IS 2465",    # cable harnesses
}


# ---- logistics physics reference tables (published rules, offline) --------
# CGST Rule 138(10): an e-way bill is valid one day per 200 km (or part
# thereof) for normal cargo. Lawful extensions exist — the validator's
# benign path says so — but forged paperwork rarely does the arithmetic.
EWAY_KM_PER_DAY = 200

# Part number -> expected HSN heading (4-digit) on the invoice.
# 8708 = parts & accessories of motor vehicles; 8484 = gaskets;
# 8544 = insulated wire/cable harnesses.
PART_HSN_STUB = {
    "BC-2209": "8708", "BC-2231": "8708", "BC-3310": "8708",
    "CP-4417": "8708", "BS-7702": "8708", "WH-5521": "8708",
    "BL-4407": "8708", "GK-118": "8484", "CH-0912": "8544",
}

# Customs station -> mode of entry. Two conflicting first-entry claims on
# one consignment are impossible; sea-then-inland movement is not (framed
# accordingly in the validator).
PORT_MODES = {
    "NHAVA SHEVA": "sea", "MUNDRA": "sea", "CHENNAI PORT": "sea",
    "KOLKATA PORT": "sea", "COCHIN PORT": "sea", "TUTICORIN": "sea",
    "DELHI AIR CARGO": "air", "MUMBAI AIR CARGO": "air",
    "CHENNAI AIR CARGO": "air", "BANGALORE AIR CARGO": "air",
    "ATTARI": "land", "PETRAPOLE": "land", "RAXAUL": "land",
}

# Approximate road distances (km) between major city pairs, order-free.
CITY_KM = {
    frozenset(("CHENNAI", "DELHI")): 2200,
    frozenset(("CHENNAI", "MUMBAI")): 1330,
    frozenset(("CHENNAI", "KOLKATA")): 1670,
    frozenset(("CHENNAI", "BANGALORE")): 350,
    frozenset(("BANGALORE", "DELHI")): 2150,
    frozenset(("COIMBATORE", "DELHI")): 2400,
    frozenset(("HYDERABAD", "DELHI")): 1580,
    frozenset(("HYDERABAD", "GURUGRAM")): 1550,
    frozenset(("MUMBAI", "DELHI")): 1420,
    frozenset(("AHMEDABAD", "CHENNAI")): 1840,
    frozenset(("KOLKATA", "DELHI")): 1500,
}


# Stub BIS licence table — replace with the live BIS lookup when available.
BIS_STUB = {
    "CM/L-7411032": {"holder": "HSI AUTOMOTIVES PRIVATE LIMITED",
                     "standard": "IS 15100", "status": "active"},
    "CM/L-5502211": {"holder": "SUNDARAM BRAKE LININGS LIMITED",
                     "standard": "IS 2742", "status": "active"},
    "CM/L-6620148": {"holder": "BONFIGLIOLI TRANSMISSIONS LIMITED",
                     "standard": "IS 2062", "status": "active"},
}


def _parse_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def is_llpin(identifier: str) -> bool:
    return bool(_LLPIN_RE.match(identifier.strip().upper()))


_IDENT_SEARCH_RE = re.compile(
    r"[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}|[A-Z]{3}-\d{4}")


def extract_identifier(value: str) -> str:
    """Pull the CIN/LLPIN out of a possibly decorated extracted value
    ('ACY-8928 (LLPIN)', 'CIN: U29309...') so lookups survive extraction
    noise. Returns the raw value when nothing identifier-shaped is found."""
    m = _IDENT_SEARCH_RE.search(str(value).upper())
    return m.group(0) if m else str(value).strip()


def gstin_check_char(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        v = _B36.index(ch)
        p = v * (1 if i % 2 == 0 else 2)
        total += p // 36 + p % 36
    return _B36[(36 - total % 36) % 36]


# ---------------------------------------------------------------------------
# validators — each returns one Finding (or a list, where noted)

def gstin_checksum(gstin: str) -> Finding:
    g = gstin.strip().upper()
    ok_format = bool(_GSTIN_RE.match(g))
    if not ok_format:
        return Finding(
            assertion=f"GSTIN '{gstin}' is well-formed",
            check="gstin_checksum", result="fail (malformed)",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="identity",
            detail="Does not match the 15-character GSTIN structure "
                   "(2-digit state, 10-char PAN, entity digit, 'Z', check char).",
        )
    expected = gstin_check_char(g[:14])
    if g[14] != expected:
        return Finding(
            assertion=f"GSTIN '{g}' checksum is valid",
            check="gstin_checksum", result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="identity",
            detail=f"Check character should be '{expected}', found '{g[14]}'. "
                   "A GSTIN that fails its own checksum was never issued by GSTN.",
        )
    return Finding(
        assertion=f"GSTIN '{g}' checksum is valid",
        check="gstin_checksum", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="identity",
        detail="Structure and mod-36 check character are internally consistent. "
               "(A forger can compute a valid checksum, hence only weak support.)",
    )


def gstin_state_matches_claim(gstin: str, claimed_state: str,
                              claimed_from: str = "the documents") -> Finding:
    g = gstin.strip().upper()
    code = g[:2]
    gst_state = registry.state_name_for_code(code)
    assertion = (f"GSTIN state code {code} matches the claimed state "
                 f"'{claimed_state}'")
    if gst_state is None:
        # Our lookup table failing to recognise a code is OUR gap, not
        # evidence against the document — abstain rather than fabricate
        # suspicion from an incomplete table.
        return Finding(
            assertion=assertion, check="gstin_state_matches_claim",
            result=f"unavailable (state code {code} not in our table)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="identity",
            detail=f"'{code}' is not in our GST state-code table (which "
                   "includes legacy codes 25 and 28); cannot verify the "
                   "state claim offline.",
        )
    if registry.states_equivalent(gst_state, claimed_state):
        return Finding(
            assertion=assertion, check="gstin_state_matches_claim",
            result="pass",
            direction="supports_genuine", strength="moderate",
            source_tier="derived", dimension="identity",
            detail=f"Code {code} = {gst_state}; matches the claim "
                   "(alias-aware comparison).",
        )
    return Finding(
        assertion=assertion, check="gstin_state_matches_claim",
        result="fail",
        direction="supports_suspect", strength="strong",
        source_tier="derived", dimension="identity",
        detail=f"GSTIN is registered in {gst_state} (code {code}) but "
               f"{claimed_from} put the company in {claimed_state}.",
    )


def gstin_embedded_pan(gstin: str, claimed_pan: Optional[str] = None) -> Finding:
    g = gstin.strip().upper()
    pan = g[2:12] if len(g) == 15 else ""
    assertion = f"PAN embedded in GSTIN ('{pan}') is structurally valid"
    if not _PAN_RE.match(pan):
        return Finding(
            assertion=assertion, check="gstin_embedded_pan", result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="identity",
            detail="Characters 3-12 of a GSTIN must be a valid PAN "
                   "(5 letters, 4 digits, 1 letter).",
        )
    issues, supports = [], []
    holder = pan[3]  # 4th char encodes holder type: C=company, F=firm/LLP, P=person…
    if holder == "C":
        supports.append("PAN holder-type 'C' (company) fits a corporate entity")
    elif holder in "FP":
        issues.append(f"PAN holder-type '{holder}' "
                      f"({'firm/LLP' if holder == 'F' else 'individual'}) does not "
                      "fit a claim of being a registered company")
    if claimed_pan:
        if claimed_pan.strip().upper() == pan:
            supports.append("embedded PAN matches the PAN stated on the documents")
        else:
            issues.append(f"embedded PAN {pan} differs from the PAN "
                          f"{claimed_pan.strip().upper()} stated on the documents")
    if issues:
        return Finding(
            assertion=assertion, check="gstin_embedded_pan", result="fail",
            direction="supports_suspect", strength="moderate",
            source_tier="derived", dimension="identity",
            detail="; ".join(issues),
        )
    return Finding(
        assertion=assertion, check="gstin_embedded_pan", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="identity",
        detail="; ".join(supports) or "Embedded PAN is structurally valid.",
    )


def cin_decode(cin: str) -> tuple:
    """Returns (Finding, decoded dict|None)."""
    c = cin.strip().upper()
    if is_llpin(c):
        return (Finding(
            assertion=f"'{c}' decodes as a company CIN",
            check="cin_decode", result="abstain (LLPIN)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="identity",
            detail="Identifier is an LLPIN (LLP), which carries no NIC/state/"
                   "year encoding. Registry lookup still applies.",
        ), {"kind": "llpin"})
    m = _CIN_RE.match(c)
    if not m:
        return (Finding(
            assertion=f"'{c}' decodes as a company CIN",
            check="cin_decode", result="fail (malformed)",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="identity",
            detail="A CIN is 21 chars: L/U + 5-digit NIC + 2-letter state + "
                   "4-digit year + 3-letter ownership + 6-digit number.",
        ), None)
    listing, nic, state_code, year, ownership, seq = m.groups()
    decoded = {
        "kind": "cin", "listed": listing == "L", "nic_code": nic,
        "state_code": state_code,
        "state_name": CIN_STATE_CODES.get(state_code),
        "year": int(year), "ownership": ownership, "seq": seq,
    }
    problems = []
    if decoded["state_name"] is None:
        problems.append(f"unknown ROC state code '{state_code}'")
    if not (1850 <= decoded["year"] <= date.today().year):
        problems.append(f"implausible incorporation year {year}")
    if problems:
        return (Finding(
            assertion=f"CIN '{c}' internal fields are plausible",
            check="cin_decode", result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="identity",
            detail="; ".join(problems),
        ), decoded)
    return (Finding(
        assertion=f"CIN '{c}' internal fields are plausible",
        check="cin_decode", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="identity",
        detail=f"NIC {nic}, state {decoded['state_name']}, year {year}, "
               f"type {ownership}.",
    ), decoded)


def registry_exists(identifier: str, row: Optional[dict],
                    claimed_incorporation=None) -> Finding:
    snap = registry.snapshot_date()
    if row is None:
        # A company claiming incorporation AFTER our snapshot date cannot be
        # in the snapshot — its absence is our data's age, not their fraud.
        claimed = _parse_date(claimed_incorporation)
        snap_d = _parse_date(snap)
        if claimed and snap_d and claimed > snap_d:
            return Finding(
                assertion=f"'{identifier}' exists in the MCA registry",
                check="registry_exists",
                result="unavailable (postdates registry snapshot)",
                direction="neutral", strength="weak",
                source_tier="authoritative", dimension="identity",
                detail=f"Claimed incorporation {claimed} is after our MCA "
                       f"snapshot ({snap}); absence from the snapshot proves "
                       "nothing either way. Verify on the MCA portal.",
            )
        return Finding(
            assertion=f"'{identifier}' exists in the MCA registry",
            check="registry_exists", result="fail (not found)",
            direction="supports_suspect", strength="strong",
            source_tier="authoritative", dimension="identity",
            detail=f"No company or LLP with this identifier in the MCA "
                   f"registry snapshot of {snap} (3.67M records).",
        )
    return Finding(
        assertion=f"'{identifier}' exists in the MCA registry",
        check="registry_exists", result="pass",
        direction="supports_genuine", strength="moderate",
        source_tier="authoritative", dimension="identity",
        detail=f"Registered as '{row['name']}' "
               f"({row.get('state_name')}, {row.get('registration_date')}); "
               f"registry snapshot: {snap}.",
    )


def cin_vs_registry(identifier: str, claims: dict, row: Optional[dict]) -> list:
    """Compare claimed name / state / incorporation date to the registry row.

    claims: {"company_name": ..., "state": ..., "incorporation_date": ...},
    any subset. Returns one Finding per comparable field.
    """
    out = []
    if row is None:
        return out

    name = claims.get("company_name")
    if name:
        same = re.sub(r"[^A-Z0-9]", "", name.upper()) == \
               re.sub(r"[^A-Z0-9]", "", (row["name"] or "").upper())
        out.append(Finding(
            assertion=f"Claimed name '{name}' matches registry name for "
                      f"{identifier}",
            check="cin_vs_registry", result="pass" if same else "fail",
            direction="supports_genuine" if same else "supports_suspect",
            strength="moderate" if same else "strong",
            source_tier="authoritative", dimension="identity",
            detail=f"Registry name: '{row['name']}'.",
        ))

    state = claims.get("state")
    if state and row.get("state_name"):
        same = registry.states_equivalent(state, row["state_name"])
        out.append(Finding(
            assertion=f"Claimed state '{state}' matches registry state for "
                      f"{identifier}",
            check="cin_vs_registry", result="pass" if same else "fail",
            direction="supports_genuine" if same else "supports_suspect",
            strength="moderate" if same else "strong",
            source_tier="authoritative", dimension="identity",
            detail=f"Registry state: '{row['state_name']}'.",
        ))

    inc = _parse_date(claims.get("incorporation_date"))
    reg = _parse_date(row.get("registration_date"))
    if inc and reg:
        same = inc == reg
        out.append(Finding(
            assertion=f"Claimed incorporation date {inc} matches registry",
            check="cin_vs_registry", result="pass" if same else "fail",
            direction="supports_genuine" if same else "supports_suspect",
            strength="moderate" if same else "strong",
            source_tier="authoritative", dimension="identity",
            detail=f"Registry registration date: {reg}.",
        ))
    return out


def cert_date_after_incorporation(cert_date, incorporation_date,
                                  corroborating_doc_date=None) -> Finding:
    cd, idate = _parse_date(cert_date), _parse_date(incorporation_date)
    assertion = (f"Certificate date {cert_date} falls after the company's "
                 f"incorporation ({incorporation_date})")
    if cd is None or idate is None:
        return Finding(
            assertion=assertion, check="cert_date_after_incorporation",
            result="abstain (unparseable date)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="certification",
            detail=f"Could not parse cert={cert_date!r} inc={incorporation_date!r}.",
        )
    if cd < idate:
        # Dispositive is the system's maximum severity — it must not hang on
        # a single extraction read. Emit dispositive only when the document's
        # own date field independently corroborates the extracted certificate
        # date; otherwise strong (still SUSPECT-driving, but survivable by
        # a re-extraction).
        doc_d = _parse_date(corroborating_doc_date)
        corroborated = doc_d is not None and abs((doc_d - cd).days) <= 3
        return Finding(
            assertion=assertion, check="cert_date_after_incorporation",
            result="fail",
            direction="supports_suspect",
            strength="dispositive" if corroborated else "strong",
            source_tier="authoritative", dimension="certification",
            detail=f"Certificate dated {cd} predates incorporation on {idate}: "
                   "the issuing company did not exist yet."
                   + ("" if corroborated else
                      " (Downgraded from dispositive to strong: the date "
                      "rests on a single extracted field without a "
                      "corroborating document date.)"),
        )
    return Finding(
        assertion=assertion, check="cert_date_after_incorporation",
        result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="certification",
        detail=f"{cd} ≥ {idate}.",
    )


def ship_date_after_mfg_date(ship_date, mfg_date) -> Finding:
    sd, md = _parse_date(ship_date), _parse_date(mfg_date)
    assertion = f"Ship date {ship_date} is on/after manufacturing date {mfg_date}"
    if sd is None or md is None:
        return Finding(
            assertion=assertion, check="ship_date_after_mfg_date",
            result="abstain (unparseable date)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="custody",
            detail=f"Could not parse ship={ship_date!r} mfg={mfg_date!r}.",
        )
    if sd < md:
        return Finding(
            assertion=assertion, check="ship_date_after_mfg_date",
            result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="custody",
            detail=f"Parts shipped {sd}, before they were supposedly made {md}.",
        )
    return Finding(
        assertion=assertion, check="ship_date_after_mfg_date", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="custody",
        detail=f"{sd} ≥ {md}.",
    )


def company_status_active(identifier: str, row: Optional[dict]) -> Finding:
    assertion = f"Company {identifier} is Active on the registry"
    if row is None or not row.get("status"):
        return Finding(
            assertion=assertion, check="company_status_active",
            result="unavailable",
            direction="neutral", strength="weak",
            source_tier="authoritative", dimension="identity",
            detail="No registry row / status to check.",
        )
    status = row["status"].strip()
    if status.lower() == "active":
        return Finding(
            assertion=assertion, check="company_status_active", result="pass",
            direction="supports_genuine", strength="moderate",
            source_tier="authoritative", dimension="identity",
            detail="Registry status: Active.",
        )
    # Succession statuses are not "dead" statuses: the entity was replaced by
    # a lawful successor, so paperwork in its name may be legitimate
    # transition documents — or misuse of a defunct identity. Only moderate
    # strength, and the detail hands the reasoner the benign mechanism.
    if status.lower() in ("amalgamated", "converted to llp"):
        return Finding(
            assertion=assertion, check="company_status_active",
            result=f"fail (status: {status})",
            direction="supports_suspect", strength="moderate",
            source_tier="authoritative", dimension="identity",
            detail=f"Registry status '{status}': the entity was succeeded by "
                   "another (merger/conversion). Documents in its name after "
                   "succession can be lawful transition paperwork or misuse "
                   "of a defunct identity — the NCLT scheme/conversion order "
                   "naming the successor would settle which.",
        )
    return Finding(
        assertion=assertion, check="company_status_active",
        result=f"fail (status: {status})",
        direction="supports_suspect", strength="strong",
        source_tier="authoritative", dimension="identity",
        detail=f"The current MCA snapshot records status '{status}', which "
               "does not support a present-day active-company claim. The "
               "snapshot does not establish the historical status on an "
               "earlier document date.",
    )


def nic_is_manufacturing(identifier: str, nic_code: Optional[str]) -> Finding:
    assertion = (f"Registered activity of {identifier} (NIC {nic_code}) is "
                 "auto-component manufacturing")
    if is_llpin(identifier) or not nic_code:
        return Finding(
            assertion=assertion, check="nic_is_manufacturing",
            result="abstain",
            direction="neutral", strength="weak",
            source_tier="authoritative", dimension="identity",
            detail="LLPs (LLPIN identifiers) and rows without an NIC code "
                   "carry no activity classification — abstaining, not guessing.",
        )
    nic = str(nic_code).strip()
    if nic.startswith(NIC_MANUFACTURING_PREFIXES):
        scheme = ("NIC-2008 29xx" if nic.startswith("29")
                  else "NIC-2004 34xx" if nic.startswith("34")
                  else "manufacturing division " + nic[:2] + "xx")
        return Finding(
            assertion=assertion, check="nic_is_manufacturing", result="pass",
            direction="supports_genuine", strength="moderate",
            source_tier="authoritative", dimension="identity",
            detail=f"NIC {nic} ({scheme}) is consistent with auto-component "
                   "manufacturing.",
        )
    if nic.startswith(NIC_TRADING_PREFIXES):
        return Finding(
            assertion=assertion, check="nic_is_manufacturing", result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="authoritative", dimension="identity",
            detail=f"NIC {nic} (45xxx) records trade of vehicles/parts, not "
                   "manufacturing. The claimed manufacturer role therefore "
                   "needs an explanation or independent production record.",
        )
    # An NIC outside the known auto ranges is not, by itself, evidence of
    # forgery — NIC classification is coarse and companies diversify. Abstain
    # with a note instead of manufacturing suspicion from our own whitelist.
    return Finding(
        assertion=assertion, check="nic_is_manufacturing",
        result=f"abstain (NIC {nic} outside known auto ranges)",
        direction="neutral", strength="weak",
        source_tier="authoritative", dimension="identity",
        detail=f"NIC {nic} is neither a recognised manufacturing division "
               "(22/25/27/28/29/30/34) nor parts trading (45xxx); the "
               "classification alone cannot confirm or deny manufacturing.",
    )


def bis_licence_valid(licence_no: Optional[str],
                      claimed_holder: Optional[str] = None) -> Finding:
    assertion = f"BIS licence '{licence_no}' is valid and matches the holder"
    if not licence_no:
        return Finding(
            assertion="A BIS licence number is present",
            check="bis_licence_valid", result="unavailable",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="certification",
            detail="No BIS licence cited in the dossier.",
        )
    rec = BIS_STUB.get(licence_no.strip().upper())
    if rec is None:
        return Finding(
            assertion=assertion, check="bis_licence_valid",
            result="unavailable (not in stub table)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="certification",
            detail="Licence not in the local stub; the live BIS lookup is not "
                   "wired yet, so this is inaccessible — not a failure.",
        )
    if claimed_holder and re.sub(r"[^A-Z0-9]", "", claimed_holder.upper()) != \
            re.sub(r"[^A-Z0-9]", "", rec["holder"].upper()):
        return Finding(
            assertion=assertion, check="bis_licence_valid", result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="certification",
            detail=f"Licence belongs to '{rec['holder']}', not "
                   f"'{claimed_holder}'.",
        )
    if rec["status"] != "active":
        return Finding(
            assertion=assertion, check="bis_licence_valid",
            result=f"fail (status {rec['status']})",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="certification",
            detail=f"Licence status: {rec['status']}.",
        )
    return Finding(
        assertion=assertion, check="bis_licence_valid", result="pass",
        direction="supports_genuine", strength="moderate",
        source_tier="derived", dimension="certification",
        detail=f"Stub record: holder '{rec['holder']}', {rec['standard']}, "
               "active.",
    )


def tac_within_5_years(tac_issue_date, reference_date=None) -> Finding:
    issued = _parse_date(tac_issue_date)
    ref = _parse_date(reference_date) or date.today()
    assertion = (f"Type Approval Certificate issued {tac_issue_date} is within "
                 f"its 5-year validity as of {ref}")
    if issued is None:
        return Finding(
            assertion=assertion, check="tac_within_5_years",
            result="abstain (unparseable date)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="certification",
            detail=f"Could not parse {tac_issue_date!r}.",
        )
    if issued > ref:
        return Finding(
            assertion=assertion, check="tac_within_5_years", result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="certification",
            detail=f"TAC dated {issued} is in the future relative to {ref}.",
        )
    age_days = (ref - issued).days
    if age_days > 5 * 365 + 1:
        return Finding(
            assertion=assertion, check="tac_within_5_years", result="fail",
            direction="supports_suspect", strength="moderate",
            source_tier="derived", dimension="certification",
            detail=f"TAC is {age_days // 365} years old; type approvals lapse "
                   "after 5 years without renewal.",
        )
    return Finding(
        assertion=assertion, check="tac_within_5_years", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="certification",
        detail=f"TAC age: {age_days} days.",
    )


_LOT_RE = re.compile(r"^([A-Z]{2,4})-(\d{6})-(\d{3,5})$")


# Registry statuses that mean "this entity was replaced", not "this entity is
# dead". They are the only ones for which hunting a successor makes sense.
SUCCESSION_STATUSES = ("amalgamated", "converted to llp")

_CORP_SUFFIX = re.compile(
    r"\b(private|public|limited|ltd|llp|pvt|company|co|and|&)\b", re.I)


def _name_stem(name: str) -> str:
    """The distinctive part of a company name, minus corporate furniture."""
    stem = _CORP_SUFFIX.sub(" ", str(name or ""))
    stem = re.sub(r"[^A-Za-z ]", " ", stem)
    return " ".join(stem.split()).upper()


def successor_registry_lookup(identifier: str, row: Optional[dict],
                              candidate_names: Optional[list] = None,
                              gstin_state: Optional[str] = None) -> Finding:
    """Follow the thread: when the registry says an entity was succeeded,
    go and look for the successor.

    This is the one check that consults a record no document names. A
    succession status is the registry documenting a benign mechanism for name,
    state and GST drift — but the mechanism only holds if a successor actually
    exists. So we take every other company name the dossier mentions, plus the
    stem of the registered name, and search the 3.67M-row registry for it.

    Both outcomes are informative and neither is proof:

      * a successor that exists, is Active, and sits in the state the GSTIN
        points to corroborates the amalgamation reading;
      * a successor named on the invoice with **no** registry record at all
        leaves the succession undocumented outside the dossier's own say-so.

    Direction stays neutral either way. An absent registry record is a gap and
    not evidence of forgery (the same governance rule that governs
    `registry_exists`), and a present one is corroboration, not the NCLT order.
    """
    assertion = (f"The successor to {identifier} can be found in the registry")
    status = (row or {}).get("status", "") or ""
    if not row or status.strip().lower() not in SUCCESSION_STATUSES:
        return Finding(
            assertion=assertion, check="successor_registry_lookup",
            result="abstain (no recorded succession)",
            direction="neutral", strength="weak",
            source_tier="authoritative", dimension="identity",
            detail="The registry does not record this entity as succeeded, "
                   "so there is no successor to look for.",
        )

    registered = str(row.get("name") or "")
    names = []
    for n in (candidate_names or []):
        n = str(n or "").strip()
        if n and _name_stem(n) != _name_stem(registered) and n not in names:
            names.append(n)

    # Every name the dossier offers, then the registered stem as a fallback.
    for name in names:
        hits = registry.search_name(_name_stem(name) or name, limit=5)
        active = [h for h in hits
                  if (h.get("status") or "").strip().lower() == "active"]
        if active:
            hit = active[0]
            state_note = ""
            if gstin_state and hit.get("state_name"):
                same = registry.states_equivalent(gstin_state,
                                                 hit["state_name"])
                state_note = (
                    f" Its registered state ({hit['state_name']}) "
                    + ("matches the state the GSTIN points to, which is what a "
                       "post-merger GST consolidation would look like."
                       if same else
                       "does not match the state the GSTIN points to.")
                )
            return Finding(
                assertion=assertion, check="successor_registry_lookup",
                result=f"pass (candidate successor found: {hit['cin']})",
                direction="neutral", strength="moderate",
                source_tier="authoritative", dimension="identity",
                detail=f"'{name}' appears on the paperwork but not as the "
                       f"certifying entity. The registry has an Active company "
                       f"of that name: {hit['name']} ({hit['cin']}, "
                       f"{hit.get('state_name')}).{state_note} This "
                       "corroborates the succession the registry records; it "
                       "does not prove this consignment is covered by it — the "
                       "NCLT scheme order names the lawful successor.",
                source_doc="",
            )

    if names:
        return Finding(
            assertion=assertion, check="successor_registry_lookup",
            result="fail (named successor absent from the registry)",
            direction="neutral", strength="moderate",
            source_tier="authoritative", dimension="identity",
            detail=f"The registry records {identifier} as '{status}', and the "
                   f"dossier bills under {', '.join(repr(n) for n in names)} — "
                   "but no company of that name is in the registry snapshot. "
                   "The succession is therefore documented only by the dossier "
                   "itself, which is the party being checked. Treated as a gap, "
                   "not as proof: the NCLT scheme order remains the artefact "
                   "that settles it.",
            source_doc="",
        )

    return Finding(
        assertion=assertion, check="successor_registry_lookup",
        result="abstain (no successor named)",
        direction="neutral", strength="weak",
        source_tier="authoritative", dimension="identity",
        detail=f"The registry records {identifier} as '{status}', but the "
               "dossier names no other entity, so there is no successor to "
               "look up. The NCLT scheme order would name one.",
    )


def lot_code_grammar(lot_code: str, reference_date=None) -> Finding:
    """Expected grammar: PLANT(2-4 letters)-YYMMDD-SEQ(3-5 digits)."""
    assertion = f"Lot code '{lot_code}' follows the PLANT-YYMMDD-SEQ grammar"
    m = _LOT_RE.match(lot_code.strip().upper())
    if not m:
        return Finding(
            assertion=assertion, check="lot_code_grammar", result="fail",
            direction="supports_suspect", strength="moderate",
            source_tier="heuristic", dimension="provenance",
            detail="Counterfeit lots frequently carry invented codes that "
                   "don't parse under the OEM's published grammar.",
        )
    yymmdd = m.group(2)
    try:
        embedded = datetime.strptime(yymmdd, "%y%m%d").date()
    except ValueError:
        return Finding(
            assertion=assertion, check="lot_code_grammar",
            result="fail (embedded date invalid)",
            direction="supports_suspect", strength="moderate",
            source_tier="heuristic", dimension="provenance",
            detail=f"'{yymmdd}' is not a real calendar date.",
        )
    ref = _parse_date(reference_date) or date.today()
    if embedded > ref:
        return Finding(
            assertion=assertion, check="lot_code_grammar",
            result="fail (future date)",
            direction="supports_suspect", strength="moderate",
            source_tier="heuristic", dimension="provenance",
            detail=f"Embedded production date {embedded} is in the future.",
        )
    return Finding(
        assertion=assertion, check="lot_code_grammar", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="heuristic", dimension="provenance",
        detail=f"Plant '{m.group(1)}', production date {embedded}, "
               f"sequence {m.group(3)}.",
    )


def spec_matches_oem_sheet(part_number: str,
                           claimed_standard: str) -> Finding:
    """Claimed spec on the certificate vs the OEM's published spec sheet —
    a documents check (mentor-confirmed in scope); physical measurement
    stays out of scope."""
    part = str(part_number).strip().upper()
    published = OEM_SPEC_STUB.get(part)
    claimed = str(claimed_standard).strip().upper().replace("  ", " ")
    assertion = (f"Certificate's claimed standard '{claimed_standard}' "
                 f"matches the OEM's published sheet for part {part}")
    if published is None:
        return Finding(
            assertion=assertion, check="spec_matches_oem_sheet",
            result="unavailable (part not in OEM sheet stub)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="certification",
            detail=f"No published OEM sheet for {part} in the local stub; "
                   "cannot compare specs offline.",
        )
    if claimed.replace(" ", "") == published.upper().replace(" ", ""):
        return Finding(
            assertion=assertion, check="spec_matches_oem_sheet",
            result="pass",
            direction="supports_genuine", strength="moderate",
            source_tier="derived", dimension="certification",
            detail=f"OEM sheet for {part}: {published}.",
        )
    return Finding(
        assertion=assertion, check="spec_matches_oem_sheet",
        result="fail",
        direction="supports_suspect", strength="strong",
        source_tier="derived", dimension="certification",
        detail=f"The OEM's published sheet certifies {part} to {published}, "
               f"but the certificate claims '{claimed_standard}'. A forger "
               "cloning paperwork without the OEM's spec sheet gets exactly "
               "this wrong.",
    )


def _norm_city(name: str) -> str:
    return re.sub(r"[^A-Z]", "", str(name).upper().split(",")[0].strip()
                  .replace("GURGAON", "GURUGRAM"))


def _route_km(route_from, route_to, claimed_km=None):
    """Best distance estimate: claimed value if parseable, else city table."""
    if claimed_km is not None:
        try:
            return float(str(claimed_km).lower().replace("km", "").strip()), "claimed"
        except ValueError:
            pass
    if route_from and route_to:
        km = CITY_KM.get(frozenset((_norm_city(route_from), _norm_city(route_to))))
        if km:
            return float(km), "city table"
    return None, None


def eway_validity_vs_distance(validity_days, route_from=None, route_to=None,
                              claimed_km=None) -> Finding:
    """Compare claimed original validity with Rule 138(10) for ordinary cargo.

    This is a document-consistency check, not a travel-time or speed test.
    Callers must supply original validity days; remaining validity and special
    cargo categories are outside this bounded rule and should abstain upstream.
    """
    km, src = _route_km(route_from, route_to, claimed_km)
    assertion = (f"E-way bill validity ({validity_days} day(s)) covers the "
                 f"declared journey"
                 + (f" {route_from} → {route_to}" if route_from else ""))
    try:
        days = float(str(validity_days).lower().replace("days", "")
                     .replace("day", "").strip())
    except (ValueError, TypeError):
        days = None
    if days is None or km is None:
        return Finding(
            assertion=assertion, check="eway_validity_vs_distance",
            result="abstain (validity or distance unavailable)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="custody",
            detail=f"validity={validity_days!r}, distance "
                   f"{'unknown route' if km is None else km}.",
        )
    import math
    required = math.ceil(km / EWAY_KM_PER_DAY)
    if days < required:
        return Finding(
            assertion=assertion, check="eway_validity_vs_distance",
            result="fail",
            direction="supports_suspect", strength="moderate",
            source_tier="derived", dimension="custody",
            detail=f"Rule 138(10): {km:.0f} km ({src}) needs "
                   f"{required} validity day(s) at {EWAY_KM_PER_DAY} km/day; "
                   f"the submitted record states {days:.0f}. This mismatch "
                   "requires the original e-way bill or extension history; "
                   "it does not measure the truck's travel time.",
        )
    return Finding(
        assertion=assertion, check="eway_validity_vs_distance", result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="custody",
        detail=f"{km:.0f} km ({src}) needs {required} day(s); bill grants "
               f"{days:.0f}.",
    )


def hsn_matches_part(part_number: str, claimed_hsn: str) -> Finding:
    """Invoice HSN heading vs the expected heading for this part family —
    mis-declared HSN is a customs / anti-dumping-evasion signature."""
    part = str(part_number).strip().upper()
    expected = PART_HSN_STUB.get(part)
    claimed4 = re.sub(r"[^0-9]", "", str(claimed_hsn))[:4]
    assertion = (f"Invoice HSN '{claimed_hsn}' matches the expected heading "
                 f"for part {part}")
    if expected is None or len(claimed4) < 4:
        return Finding(
            assertion=assertion, check="hsn_matches_part",
            result="abstain (part or HSN not classifiable offline)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="certification",
            detail=f"expected heading {'unknown' if expected is None else expected}, "
                   f"claimed {claimed_hsn!r}.",
        )
    if claimed4 == expected:
        return Finding(
            assertion=assertion, check="hsn_matches_part", result="pass",
            direction="supports_genuine", strength="weak",
            source_tier="derived", dimension="certification",
            detail=f"Heading {claimed4} is the expected classification.",
        )
    return Finding(
        assertion=assertion, check="hsn_matches_part", result="fail",
        direction="supports_suspect", strength="strong",
        source_tier="derived", dimension="certification",
        detail=f"The bounded part-reference table maps {part} to heading "
               f"{expected}, while the invoice declares {claimed4}. Confirm "
               "the classification or obtain the supplier's classification "
               "basis; this mismatch does not establish intent.",
    )


def entry_port_mode_consistent(entry_port: str, entry_mode: str) -> Finding:
    """The declared FIRST customs entry: the named station and the declared
    mode must agree. (Sea arrival followed by inland road movement is
    lawful — this checks the entry claim against itself, not the journey.)"""
    port = str(entry_port).strip().upper()
    known = PORT_MODES.get(port)
    mode = str(entry_mode).strip().lower()
    assertion = (f"Declared entry mode '{entry_mode}' is consistent with "
                 f"entry station '{entry_port}'")
    if known is None or not mode:
        return Finding(
            assertion=assertion, check="entry_port_mode_consistent",
            result="abstain (station not in offline table)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="custody",
            detail=f"'{entry_port}' is not in the local customs-station table.",
        )
    if known in mode:
        return Finding(
            assertion=assertion, check="entry_port_mode_consistent",
            result="pass",
            direction="supports_genuine", strength="weak",
            source_tier="derived", dimension="custody",
            detail=f"{port} is a {known} station.",
        )
    return Finding(
        assertion=assertion, check="entry_port_mode_consistent",
        result="fail",
        direction="supports_suspect", strength="strong",
        source_tier="derived", dimension="custody",
        detail=f"{port} is a {known} station, but the documents declare "
               f"'{entry_mode}' for the same first entry — one consignment "
               "cannot enter the country two different ways.",
    )


def route_distance_sanity(route_from: str, route_to: str,
                          claimed_km) -> Finding:
    """Claimed route distance vs the city-pair table, ±20% tolerance."""
    table_km = CITY_KM.get(frozenset((_norm_city(route_from),
                                      _norm_city(route_to))))
    assertion = (f"Claimed distance {claimed_km} for {route_from} → "
                 f"{route_to} is plausible")
    try:
        claimed = float(str(claimed_km).lower().replace("km", "").strip())
    except (ValueError, TypeError):
        claimed = None
    if table_km is None or claimed is None:
        return Finding(
            assertion=assertion, check="route_distance_sanity",
            result="abstain (route not in offline table)",
            direction="neutral", strength="weak",
            source_tier="heuristic", dimension="custody",
            detail="City pair or claimed distance not comparable offline.",
        )
    if abs(claimed - table_km) <= 0.2 * table_km:
        return Finding(
            assertion=assertion, check="route_distance_sanity", result="pass",
            direction="supports_genuine", strength="weak",
            source_tier="heuristic", dimension="custody",
            detail=f"Reference ≈{table_km} km; claimed {claimed:.0f} km.",
        )
    return Finding(
        assertion=assertion, check="route_distance_sanity", result="fail",
        direction="supports_suspect", strength="moderate",
        source_tier="heuristic", dimension="custody",
        detail=f"Reference distance ≈{table_km} km; the documents claim "
               f"{claimed:.0f} km — outside ±20%. Benign reroutes happen; "
               "invented logistics paperwork guesses distances.",
    )


def receive_date_after_ship_date(receive_date, ship_date) -> Finding:
    rd, sd = _parse_date(receive_date), _parse_date(ship_date)
    assertion = (f"Goods-receipt date {receive_date} is on/after the ship "
                 f"date {ship_date}")
    if rd is None or sd is None:
        return Finding(
            assertion=assertion, check="receive_date_after_ship_date",
            result="abstain (unparseable date)",
            direction="neutral", strength="weak",
            source_tier="derived", dimension="custody",
            detail=f"Could not parse receive={receive_date!r} ship={ship_date!r}.",
        )
    if rd < sd:
        return Finding(
            assertion=assertion, check="receive_date_after_ship_date",
            result="fail",
            direction="supports_suspect", strength="strong",
            source_tier="derived", dimension="custody",
            detail=f"Goods booked as received {rd}, before they were "
                   f"dispatched {sd} — the custody chain runs backwards.",
        )
    return Finding(
        assertion=assertion, check="receive_date_after_ship_date",
        result="pass",
        direction="supports_genuine", strength="weak",
        source_tier="derived", dimension="custody",
        detail=f"{rd} ≥ {sd}.",
    )


def dispatch_state_matches_origin(dispatch_state: str,
                                  origin_state: str) -> Finding:
    """Geography of the shipment's origin vs the supplier's registered state
    (the mentor's 'geography inconsistent with claimed origin' anomaly)."""
    assertion = (f"Dispatch origin '{dispatch_state}' is consistent with the "
                 f"supplier's state '{origin_state}'")
    if registry.states_equivalent(dispatch_state, origin_state):
        return Finding(
            assertion=assertion, check="dispatch_state_matches_origin",
            result="pass",
            direction="supports_genuine", strength="weak",
            source_tier="derived", dimension="custody",
            detail="Shipment originates in the supplier's registered state.",
        )
    return Finding(
        assertion=assertion, check="dispatch_state_matches_origin",
        result="fail",
        direction="supports_suspect", strength="moderate",
        source_tier="derived", dimension="custody",
        detail=f"Parts dispatched from {dispatch_state} but the supplier is "
               f"registered in {origin_state}. A remote warehouse is a "
               "benign explanation; goods that never saw the claimed plant "
               "is the malicious one.",
    )


def _norm_entity(entity: str) -> str:
    """Normalize an entity name so 'X PVT LTD' and 'X Private Limited' group
    together, while genuinely different parties stay apart."""
    s = re.sub(r"[^A-Z0-9 ]", "", str(entity).upper())
    s = re.sub(r"\b(PRIVATE|PVT|LIMITED|LTD|LLP|COMPANY|CO)\b", "", s)
    return re.sub(r"\s+", " ", s).strip() or "SUBJECT"


def cross_doc_field_drift(assertions: list) -> list:
    """Same attribute asserted with different values across documents, for
    the SAME entity. Grouping by (entity, attribute) prevents a two-party
    dossier (manufacturer certificate + distributor invoice) from falsely
    pairing one party's field against the other's.
    Returns one Finding per drifting attribute (empty list if none drift).
    """
    by_attr = {}
    for a in assertions:
        by_attr.setdefault((_norm_entity(a.entity), a.attribute), []).append(a)
    out = []
    for (_entity, attr), group in by_attr.items():
        values = {}
        for a in group:
            key = re.sub(r"\s+", " ", str(a.value).strip().upper())
            values.setdefault(key, []).append(a.source_doc)
        if len(values) > 1:
            desc = "; ".join(f"'{v}' in {', '.join(sorted(set(docs)))}"
                             for v, docs in values.items())
            out.append(Finding(
                assertion=f"'{attr}' is consistent across all documents",
                check="cross_doc_field_drift", result="fail",
                direction="supports_suspect", strength="moderate",
                source_tier="heuristic", dimension="provenance",
                detail=f"Field drift: {desc}. Genuine paper trails copy these "
                       "fields verbatim; forgeries retype them.",
            ))
    return out


# ---------------------------------------------------------------------------
# orchestrator

def _first(assertions: list, attribute: str) -> Optional[Assertion]:
    for a in assertions:
        if a.attribute == attribute:
            return a
    return None


def run_all(assertions: list) -> Ledger:
    """Map extracted assertions onto every applicable validator.

    Identifier assertions are picked from the manufacturer-role entity when
    one is declared (falling back to any entity), so a two-party dossier
    doesn't cross-pair one party's CIN with another's GSTIN.
    """
    led = Ledger()

    # find the entity that claims the manufacturer role, if any
    role_a = next((a for a in assertions
                   if a.attribute == "role"
                   and "manufactur" in str(a.value).lower()), None)
    preferred = _norm_entity(role_a.entity) if role_a else None

    def get(attr):
        if preferred:
            for a in assertions:
                if a.attribute == attr and _norm_entity(a.entity) == preferred:
                    return a
        return _first(assertions, attr)

    a_cin = get("cin")
    a_gstin = get("gstin")
    a_state = get("state")
    a_name = get("company_name")
    a_pan = get("pan")
    a_inc = get("incorporation_date")

    if role_a:
        # the dossier's own role claim, recorded at the self_reported tier —
        # a self-description is a claim to corroborate, not evidence
        led.add(Finding(
            assertion=f"'{role_a.entity}' describes itself as the manufacturer",
            check="role_claim_recorded", result="recorded",
            direction="neutral", strength="weak",
            source_tier="self_reported", dimension="identity",
            detail="The dossier's own role claim carries no evidentiary "
                   "weight until the registry NIC / certification checks "
                   "corroborate it.",
            source_doc=role_a.source_doc,
        ))

    row = None
    decoded = None
    if a_cin:
        ident = extract_identifier(a_cin.value)
        row = registry.lookup_cin(ident)
        fnd, decoded = cin_decode(ident)
        fnd.source_doc = a_cin.source_doc
        led.add(fnd)
        led.add(registry_exists(ident, row,
                                a_inc.value if a_inc else None))
        claims = {}
        if a_name:
            claims["company_name"] = a_name.value
        if a_state:
            claims["state"] = a_state.value
        if a_inc:
            claims["incorporation_date"] = a_inc.value
        led.extend(cin_vs_registry(ident, claims, row))
        led.add(company_status_active(ident, row))
        nic = (row or {}).get("nic_code") or (decoded or {}).get("nic_code")
        led.add(nic_is_manufacturing(ident, nic))
        # Follow the thread: a recorded succession sends the agent looking
        # for a company the documents may never name.
        if row and str(row.get("status") or "").strip().lower() \
                in SUCCESSION_STATUSES:
            other_names = []
            for a in assertions:
                if a.attribute == "company_name" and a.value not in other_names:
                    other_names.append(a.value)
            gst_state = None
            if a_gstin:
                code = str(a_gstin.value).strip()[:2]
                gst_state = registry.state_name_for_code(code)
            led.add(successor_registry_lookup(ident, row, other_names,
                                              gst_state))

    if a_gstin:
        f = gstin_checksum(a_gstin.value)
        f.source_doc = a_gstin.source_doc
        led.add(f)
        if a_state:
            claimed_state, claimed_from = a_state.value, "the documents"
        else:
            claimed_state = (row or {}).get("state_name")
            claimed_from = "the registry records"
        if claimed_state:
            f = gstin_state_matches_claim(a_gstin.value, claimed_state,
                                          claimed_from)
            f.source_doc = a_gstin.source_doc
            led.add(f)
        f = gstin_embedded_pan(a_gstin.value, a_pan.value if a_pan else None)
        f.source_doc = a_gstin.source_doc
        led.add(f)

    # incorporation date: prefer the authoritative registry over the dossier
    inc_date = (row or {}).get("registration_date") or \
               (a_inc.value if a_inc else None)
    a_cert = get("cert_date")
    if a_cert and inc_date:
        f = cert_date_after_incorporation(a_cert.value, inc_date,
                                          corroborating_doc_date=a_cert.date)
        f.source_doc = a_cert.source_doc
        led.add(f)

    a_ship, a_mfg = get("ship_date"), get("mfg_date")
    if a_ship and a_mfg:
        f = ship_date_after_mfg_date(a_ship.value, a_mfg.value)
        f.source_doc = a_ship.source_doc
        led.add(f)

    a_recv = get("receive_date")
    if a_recv and a_ship:
        f = receive_date_after_ship_date(a_recv.value, a_ship.value)
        f.source_doc = a_recv.source_doc
        led.add(f)

    a_dispatch_state = get("dispatch_state")
    origin = (row or {}).get("state_name") or (a_state.value if a_state else None)
    if a_dispatch_state and origin:
        led.add(dispatch_state_matches_origin(a_dispatch_state.value, origin))

    a_bis = get("bis_licence")
    led.add(bis_licence_valid(a_bis.value if a_bis else None,
                              a_name.value if a_name else None))

    a_tac = get("tac_issue_date")
    if a_tac:
        ref = (a_ship.value if a_ship else None) or \
              (a_cert.value if a_cert else None)
        led.add(tac_within_5_years(a_tac.value, ref))

    # logistics physics
    a_validity = get("eway_validity_days")
    a_rfrom, a_rto = get("route_from"), get("route_to")
    a_rkm = get("route_distance_km")
    if a_validity:
        f = eway_validity_vs_distance(
            a_validity.value,
            a_rfrom.value if a_rfrom else None,
            a_rto.value if a_rto else None,
            a_rkm.value if a_rkm else None)
        f.source_doc = a_validity.source_doc
        led.add(f)
    if a_rfrom and a_rto and a_rkm:
        f = route_distance_sanity(a_rfrom.value, a_rto.value, a_rkm.value)
        f.source_doc = a_rkm.source_doc
        led.add(f)
    a_hsn = get("hsn_code")
    a_part0 = get("part_number")
    if a_hsn and a_part0:
        f = hsn_matches_part(a_part0.value, a_hsn.value)
        f.source_doc = a_hsn.source_doc
        led.add(f)
    a_eport, a_emode = get("entry_port"), get("entry_mode")
    if a_eport and a_emode:
        f = entry_port_mode_consistent(a_eport.value, a_emode.value)
        f.source_doc = a_eport.source_doc
        led.add(f)

    a_part, a_spec = get("part_number"), get("spec_standard")
    if a_part and a_spec:
        f = spec_matches_oem_sheet(a_part.value, a_spec.value)
        f.source_doc = a_spec.source_doc
        led.add(f)

    a_lot = get("lot_code")
    if a_lot:
        led.add(lot_code_grammar(a_lot.value,
                                 a_ship.value if a_ship else None))

    led.extend(cross_doc_field_drift(assertions))
    return led
