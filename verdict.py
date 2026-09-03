"""Stage 5 — the final verdict.

GENUINE | SUSPECT | UNVERIFIABLE(missing|inaccessible|contradictory|
insufficient). An UNVERIFIABLE verdict must name the single decisive missing
artefact and an interim action. Every verdict ships with the ledger, the
reasoning trace, per-level actions (OEM / distributor / service), and an
explicit "what this system cannot determine" block.
"""
from __future__ import annotations

from ledger import Ledger, STRENGTH_RANK

CANNOT_DETERMINE = [
    "Whether the physical part in the box matches these documents — this "
    "system reads paper, not parts. Metallurgy, holograms, and markings need "
    "physical inspection.",
    "Whether a document image was doctored — inputs arrive as text; pixel- "
    "level forensics (fonts, scan artefacts, seal geometry) are out of scope.",
    "Live BIS licence status — the BIS check runs against a local stub "
    "table, not the live BIS portal.",
    "GSTIN active/cancelled status — the checksum and state code are "
    "verified offline; whether GSTN has since cancelled the registration "
    "is not.",
    "Events after the registry snapshot date — a company registered or "
    "struck off after the MCA snapshot will be mis-assessed.",
    "Intent — a failed check proves an inconsistency, not who created it "
    "or why.",
    "Registry data quality — the authoritative MCA registry itself contained "
    "~3,132 rows with impossible registration dates (years like 1111 or "
    "9076); those were set to 'date unknown' during indexing rather than "
    "trusted or rejected, so date checks abstain on them.",
    "NIC scheme ambiguity — the registry mixes two incompatible "
    "classification schemes (NIC-2004 and NIC-2008); the activity check "
    "accepts both automotive ranges (29xx and 34xx) and may under-flag "
    "codes outside them.",
]


def decide(led: Ledger, reasoning: dict, rules_only: bool = False,
           registry_row_found: bool = True,
           has_identifier: bool = True) -> dict:
    """Combine the ledger (always) and the reasoning stage (unless
    rules_only) into exactly one verdict."""
    directional = [f for f in led.findings if f.direction != "neutral"]
    suspect = led.by_direction("supports_suspect")
    genuine = led.by_direction("supports_genuine")

    dispositive_suspect = [f for f in suspect if f.strength == "dispositive"]
    auth_suspect = [f for f in suspect if f.source_tier == "authoritative"
                    and STRENGTH_RANK[f.strength] >= 2]
    auth_contradiction = _authoritative_contradiction(led)

    verdict, subtype, missing_artefact, interim_action = None, None, None, None

    if not has_identifier:
        verdict, subtype = "UNVERIFIABLE", "missing"
        missing_artefact = ("A company identifier (CIN or LLPIN) for the "
                           "claimed manufacturer — without it no registry "
                           "anchor exists.")
        interim_action = ("Quarantine the lot and request the supplier's "
                          "certificate of incorporation before any further "
                          "movement.")
    elif not registry_row_found and not any(
            f.check != "registry_exists" for f in suspect):
        # identifier given but absent from the registry, with nothing else
        # suspicious (the registry_exists failure itself doesn't count —
        # an absent record alone is a gap, not proof of forgery)
        verdict, subtype = "UNVERIFIABLE", "missing"
        missing_artefact = ("An MCA registry record matching the quoted "
                           "CIN/LLPIN — the decisive artefact that would "
                           "anchor the issuer's identity.")
        interim_action = ("Hold the shipment and ask the supplier for their "
                          "MCA incorporation certificate; verify the CIN on "
                          "the MCA portal when connectivity allows.")
    elif dispositive_suspect:
        verdict = "SUSPECT"
    elif auth_contradiction:
        verdict, subtype = "UNVERIFIABLE", "contradictory"
        missing_artefact = ("A certified copy of the MCA master data for the "
                           "quoted CIN, to break the tie between conflicting "
                           "authoritative-tier findings.")
        interim_action = ("Escalate to the brand-protection team; treat the "
                          "lot as suspect until the registry conflict is "
                          "resolved.")
    elif auth_suspect:
        verdict = "SUSPECT"
    elif len(directional) < 3 or \
            all(f.dimension == "identity" for f in directional):
        # a real supplier identity does not certify the goods in this
        # shipment: without at least one certification/provenance/custody
        # finding, the dossier cannot support GENUINE
        verdict, subtype = "UNVERIFIABLE", "insufficient"
        missing_artefact = _most_valuable_missing(led)
        interim_action = ("Request the missing document from the supplier; "
                          "do not fit the parts to vehicles in the interim.")
    elif suspect and not rules_only and \
            reasoning.get("recommended_verdict") == "SUSPECT" and \
            any(f.source_tier != "heuristic" for f in suspect):
        # governance rule: even the reasoner cannot make heuristic-only
        # anomalies outrank authoritative support
        verdict = "SUSPECT"
    elif suspect and rules_only:
        # deterministic tiebreak without the reasoner: strong derived-tier
        # failures decide; heuristics alone cannot override support
        strong_suspect = [f for f in suspect
                          if STRENGTH_RANK[f.strength] >= 2
                          and f.source_tier in ("authoritative", "derived")]
        verdict = "SUSPECT" if strong_suspect else "GENUINE"
    elif suspect:
        # reasoner saw the conflicts and did not call it SUSPECT
        if reasoning.get("recommended_verdict") == "UNVERIFIABLE":
            verdict, subtype = "UNVERIFIABLE", "contradictory"
            amalgamated = any("amalgamat" in (f.result + f.detail).lower()
                              for f in led.findings)
            if amalgamated:
                missing_artefact = ("The NCLT scheme-of-amalgamation order "
                                   "naming the successor entity — it either "
                                   "legitimises the transition paperwork or "
                                   "exposes misuse of a defunct identity.")
                interim_action = ("Hold the lot; ask the supplier for the "
                                  "NCLT order and the successor's GST "
                                  "registration certificate, then re-run.")
            else:
                missing_artefact = ("An independent artefact (e.g. OEM "
                                   "shipping manifest) to break the "
                                   "evidence tie.")
                interim_action = ("Hold the lot pending one corroborating "
                                  "document.")
        else:
            verdict = "GENUINE"
    else:
        verdict = "GENUINE"

    # BIS-only inaccessibility note: if the only reason we can't say more is
    # the stubbed BIS lookup, surface it
    bis_unavailable = any(
        f.check == "bis_licence_valid" and "not in stub" in f.result
        for f in led.findings
    )
    if verdict == "UNVERIFIABLE" and subtype == "insufficient" and \
            bis_unavailable:
        subtype = "inaccessible"
        missing_artefact = ("Live BIS licence verification for the quoted "
                           "CM/L number — the local stub cannot confirm it.")
        interim_action = ("Verify the CM/L number on the BIS portal "
                          "(manakonline.in) when online; hold fitment until "
                          "then.")

    # UNVERIFIABLE is a work order, not a shrug: give a directional lean
    # with explicit (low) confidence instead of a bare "unknown".
    lean = None
    if verdict == "UNVERIFIABLE":
        lean = _directional_lean(led)

    result = {
        "verdict": verdict,
        "subtype": subtype,
        "missing_artefact": missing_artefact,
        "interim_action": interim_action,
        "lean": lean,
        "ledger": led.to_dict(),
        "reasoning": (None if rules_only else reasoning),
        "rules_only": rules_only,
        "actions": _actions(verdict, subtype),
        "cannot_determine": list(CANNOT_DETERMINE),
        "counts": {
            "supports_suspect": len(suspect),
            "supports_genuine": len(genuine),
            "neutral": len(led.findings) - len(directional),
        },
    }
    return result


def _directional_lean(led: Ledger) -> dict:
    """Which way the evidence leans when it can't decide. Resolved at the
    highest tier that has directional findings — never averaged across
    tiers — and always reported at low confidence (else it would be a
    verdict, not a lean)."""
    top = led.highest_tier_with_signal()
    if top is None:
        return {"direction": "none", "confidence": "none",
                "basis": "No directional evidence at any tier."}
    at_tier = [f for f in led.findings
               if f.source_tier == top and f.direction != "neutral"]
    s = sum(STRENGTH_RANK[f.strength] + 1 for f in at_tier
            if f.direction == "supports_suspect")
    g = sum(STRENGTH_RANK[f.strength] + 1 for f in at_tier
            if f.direction == "supports_genuine")
    if s == g:
        return {"direction": "none", "confidence": "none",
                "basis": f"Evidence at the {top} tier is balanced."}
    direction = "suspect" if s > g else "genuine"
    return {"direction": direction, "confidence": "low",
            "basis": f"Weighed at the {top} tier only "
                     f"({len(at_tier)} directional finding(s)); lower tiers "
                     "not averaged in."}


def _authoritative_contradiction(led: Ledger) -> bool:
    """Strong authoritative-tier findings pointing both ways."""
    auth = [f for f in led.findings if f.source_tier == "authoritative"
            and STRENGTH_RANK[f.strength] >= 2]
    dirs = {f.direction for f in auth}
    return "supports_genuine" in dirs and "supports_suspect" in dirs


def _most_valuable_missing(led: Ledger) -> str:
    ran = {f.check for f in led.findings}
    if "registry_exists" not in ran:
        return ("The supplier's CIN/LLPIN, so the MCA registry can anchor "
                "the issuer's identity.")
    if "gstin_checksum" not in ran:
        return "The supplier's GSTIN as printed on the tax invoice."
    if "cert_date_after_incorporation" not in ran:
        return "The certificate of conformity, with its issue date."
    if "ship_date_after_mfg_date" not in ran:
        return "The dispatch note carrying manufacturing and ship dates."
    return ("At least one more independent document (invoice, certificate, "
            "or dispatch note) tied to the same lot.")


def _actions(verdict: str, subtype: str) -> dict:
    if verdict == "GENUINE":
        return {
            "oem": "Log the dossier hash in the provenance archive; no "
                   "action required.",
            "distributor": "Release the lot to inventory; keep the dossier "
                           "linked to the lot code.",
            "service": "Fit the parts normally; record the lot code against "
                       "the job card.",
        }
    if verdict == "SUSPECT":
        return {
            "oem": "Open a brand-protection case; notify legal and request "
                   "a sample of the physical lot for inspection.",
            "distributor": "Quarantine the lot, freeze payment to the "
                           "supplier, and preserve all original documents.",
            "service": "Do NOT fit these parts. Remove any already fitted "
                       "at next service and inform affected customers.",
        }
    # UNVERIFIABLE
    return {
        "oem": "Request the decisive missing artefact from the supplier "
               f"(subtype: {subtype}); re-run once received.",
        "distributor": "Hold the lot in bonded storage; do not sell or "
                       "return until re-assessed.",
        "service": "Postpone fitment; source the part from a verified "
                   "channel for time-critical repairs.",
    }
