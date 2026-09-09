"""Pre-flight: what the agent understands from a dossier BEFORE it runs.

Cheap and deterministic (no LLM): sanitise the documents, read the labelled
fields with the offline parser, look the company up in the registry, and
work out which checks the dossier can support and which it cannot yet. The
UI shows this as the agent's plan while the user is still assembling the
paperwork, so a missing document is caught before the run, not after.

The check list here must mirror validators.run_all(): when a validator is
added or its inputs change, update PLAN below in the same commit.
"""
from __future__ import annotations

import re

import registry
import validators
import reference_store
from extract import _fallback_extract, build_typed_evidence, sanitize_document

# Human-facing guesses of what each pasted document is, from its first line.
_KIND_PATTERNS = [
    ("certificate", r"certificate|conformity|coc\b|test report"),
    ("invoice", r"invoice|bill of supply"),
    ("dispatch note", r"dispatch|delivery challan|packing list|consignment"),
    ("e-way bill", r"e-?way"),
    ("goods receipt", r"grn|goods receipt|receiving"),
    ("bill of entry", r"bill of entry|customs"),
    ("cover letter", r"cover letter|letter"),
]


def _guess_kind(doc: dict) -> str:
    head = " ".join(doc.get("text", "").splitlines()[:2]).lower()
    typ = str(doc.get("doc_type", "")).replace("_", " ").lower()
    for kind, pat in _KIND_PATTERNS:
        if re.search(pat, head) or re.search(pat, typ):
            return kind
    return "document"


# (check, required attribute sets - any one set satisfies -, what unlocks it)
# An empty requirement list means the check always runs.
PLAN = [
    ("cin_decode", [{"cin"}], "the company's CIN or LLPIN"),
    ("registry_exists", [{"cin"}], "the company's CIN or LLPIN"),
    ("cin_vs_registry", [{"cin", "company_name"}, {"cin", "state"}, {"cin", "incorporation_date"}],
     "the CIN plus the company name, state or incorporation date"),
    ("company_status_active", [{"cin"}], "the company's CIN or LLPIN"),
    ("nic_is_manufacturing", [{"cin"}], "the company's CIN or LLPIN"),
    ("successor_registry_lookup", [{"cin"}], "the company's CIN or LLPIN"),
    ("gstin_checksum", [{"gstin"}], "a GST number"),
    ("gstin_state_matches_claim", [{"gstin", "state"}, {"gstin", "cin"}], "a GST number and the company's state"),
    ("gstin_embedded_pan", [{"gstin"}], "a GST number"),
    ("cert_date_after_incorporation", [{"cert_date", "cin"}, {"cert_date", "incorporation_date"}],
     "the certificate date and the company's CIN"),
    ("ship_date_after_mfg_date", [{"ship_date", "mfg_date"}], "manufacturing and ship dates (dispatch note)"),
    ("receive_date_after_ship_date", [{"receive_date", "ship_date"}], "the goods-receipt date and the ship date"),
    ("dispatch_state_matches_origin", [{"dispatch_state", "cin"}, {"dispatch_state", "state"}],
     "the dispatch state and the supplier's state"),
    ("bis_licence_valid", [], "a BIS licence number (CM/L) for a real result"),
    ("tac_within_5_years", [{"tac_issue_date"}], "the type-approval issue date"),
    ("eway_validity_vs_distance", [{"eway_validity_days"}], "the e-way bill validity"),
    ("route_distance_sanity", [{"route_from", "route_to", "route_distance_km"}], "route origin, destination and claimed distance"),
    ("hsn_matches_part", [{"hsn_code", "part_number"}], "the invoice HSN code and part number"),
    ("entry_port_mode_consistent", [{"entry_port", "entry_mode"}], "the port and mode of entry (bill of entry)"),
    ("spec_matches_oem_sheet", [{"part_number", "spec_standard"}], "the part number and the standard it is certified to"),
    ("lot_code_grammar", [{"lot_code"}], "a lot or batch code"),
    ("cross_doc_field_drift", [], "two or more documents for a meaningful comparison"),
    ("lot_matches_dispatch", [], "an exact OEM dispatch reference for this lot and part"),
    ("shipment_parties_reconcile", [], "linked independent transfer records"),
    ("distributor_authorization_valid", [], "a scoped distributor authorization"),
    ("custody_sequence_reconciles", [], "linked dispatch and receipt records"),
    ("quantity_allocation_reconciles", [], "quantities in the same explicit unit"),
    ("source_record_conflict", [], "independent records for the exact event"),
]

# Attributes some check actually consumes. Two are consumed without being a
# stated precondition: `pan` corroborates the PAN embedded in a GSTIN, and
# `role` is recorded at the self_reported tier by run_all itself.
CONSUMED_ATTRS = set().union(
    *[req for _c, options, _u in PLAN for req in options]) | {
        "pan", "role", "bis_licence"}
CONSUMED_ATTRS |= {"shipment_id", "dispatch_reference", "distributor",
                   "carrier", "recipient", "unit", "territory",
                   "effective_from", "effective_to"}

# Attributes we read but deliberately do not treat as checkable claims:
# they identify the paperwork rather than assert anything about the goods.
_CLERICAL_ATTRS = {"company_name", "state", "incorporation_date"}


def unchecked_claims(assertions) -> list:
    """Claims the agent read but has no validator for.

    The honest complement to the check plan: a dossier can carry claims no
    validator consumes, and silence about them would read as approval. Each is
    surfaced with the document it came from, so an unseen document format
    degrades to "recorded, not verified" instead of vanishing.

    These are not unexamined — `cross_doc_field_drift` still checks every one
    of them for consistency wherever it appears in more than one document.
    What they lack is a check against a record outside the dossier.
    """
    out, seen = [], set()
    for a in assertions:
        attr = a.attribute
        if attr in CONSUMED_ATTRS or attr in _CLERICAL_ATTRS:
            continue
        key = (attr, str(a.value))
        if key in seen:
            continue
        seen.add(key)
        out.append({"attribute": attr, "value": str(a.value),
                    "entity": a.entity, "source_doc": a.source_doc})
    return out


# Which document typically carries the fields that are missing.
_UNLOCK_DOCS = [
    ("the certificate of conformity", {"cert_date", "bis_licence", "tac_issue_date", "spec_standard", "cin"}),
    ("the tax invoice", {"gstin", "hsn_code", "invoice_date", "part_number"}),
    ("the dispatch note", {"mfg_date", "ship_date", "lot_code", "dispatch_state"}),
    ("the e-way bill", {"eway_validity_days", "route_from", "route_to", "route_distance_km"}),
    ("the goods-receipt note", {"receive_date"}),
    ("the bill of entry", {"entry_port", "entry_mode"}),
]


def preflight(dossier: dict) -> dict:
    docs = []
    clean_docs = []
    injections = 0
    for d in dossier.get("documents", []):
        clean, flags = sanitize_document(d.get("text", ""))
        injections += len(flags)
        clean_docs.append({**d, "text": clean})
        docs.append({"doc_id": d.get("doc_id", "?"), "kind": _guess_kind(d),
                     "chars": len(d.get("text", "")), "date": d.get("date")})

    assertions = _fallback_extract(clean_docs)
    # The offline parser receives the same grounding treatment as a full run.
    from extract import _ground_assertions
    _ground_assertions(assertions, clean_docs)
    typed_evidence = build_typed_evidence(dossier, assertions)
    have = {a.attribute for a in assertions}
    claims = [a.to_dict() for a in assertions]

    def first(attr):
        return next((a.value for a in assertions if a.attribute == attr), None)

    ident = first("cin")
    registry_row = None
    if ident:
        row = registry.lookup_cin(validators.extract_identifier(ident))
        if row:
            registry_row = {"cin": row["cin"], "name": row["name"], "status": row.get("status"),
                            "state_name": row.get("state_name"),
                            "registration_date": row.get("registration_date"),
                            "nic_code": row.get("nic_code")}

    plan, missing_attrs = [], set()
    for check, options, unlock in PLAN:
        if not options:
            note = None
            if check == "bis_licence_valid" and "bis_licence" not in have:
                note = "runs, but produces no signal without a BIS licence number"
            if check == "cross_doc_field_drift" and len(docs) < 2:
                note = "runs, but needs two or more documents to compare"
            plan.append({"check": check, "will_run": True, "reason": note})
            continue
        ok = any(req <= have for req in options)
        if ok and check == "successor_registry_lookup" and (
                registry_row is None
                or str(registry_row.get("status") or "").strip().lower()
                not in validators.SUCCESSION_STATUSES):
            # only worth running when the registry records a succession
            plan.append({"check": check, "will_run": False,
                         "reason": "runs only when the registry records a "
                                   "succession (amalgamated / converted)"})
            continue
        if ok and check == "cin_vs_registry" and registry_row is None:
            # the comparison needs a registry row to compare against
            plan.append({"check": check, "will_run": False,
                         "reason": "needs a registry record for this CIN, which the snapshot does not have"})
            continue
        if ok:
            plan.append({"check": check, "will_run": True, "reason": None})
        else:
            best = min(options, key=lambda req: len(req - have))
            missing_attrs |= (best - have)
            plan.append({"check": check, "will_run": False, "reason": f"needs {unlock}"})
    if injections:
        plan.append({"check": "injection_screen", "will_run": True,
                     "reason": f"{injections} instruction-like line{'s' if injections != 1 else ''} found and stripped"})

    # Which single document would unlock the most checks
    unlocks = []
    for doc_name, fields in _UNLOCK_DOCS:
        gained = fields & missing_attrs
        if not gained:
            continue
        would_run = [c for c, options, _ in PLAN
                     if not any(req <= have for req in options)
                     and any(req <= (have | fields) for req in options)]
        if would_run:
            unlocks.append({"document": doc_name, "checks": would_run})
    unlocks.sort(key=lambda u: -len(u["checks"]))

    runnable = sum(1 for p in plan if p["will_run"])
    try:
        snapshot = reference_store.load_snapshot()
        reference = snapshot.summary()
        reference["matching_records"] = len(
            reference_store.public_evidence(snapshot, dossier))
    except (OSError, ValueError, KeyError):
        reference = {"version": reference_store.configured_version(),
                     "available": False, "matching_records": 0}

    return {
        "documents": docs,
        "claims": claims,
        "identifiers": {k: first(k) for k in ("company_name", "cin", "gstin", "lot_code", "part_number")},
        "registry": registry_row,
        "injections": injections,
        "plan": plan,
        "runnable": runnable,
        "total": len(plan),
        "unlocks": unlocks[:3],
        "unchecked_claims": unchecked_claims(assertions),
        "evidence": typed_evidence,
        "reference_snapshot": reference,
        "aliased": bool(dossier.get("display_aliases")),
    }
