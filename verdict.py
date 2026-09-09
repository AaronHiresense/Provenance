"""Stage 5 — the final verdict.

GENUINE | SUSPECT | UNVERIFIABLE(missing|inaccessible|contradictory|
insufficient). An UNVERIFIABLE verdict must name the single decisive missing
artefact and an interim action. Every verdict ships with the ledger, the
reasoning trace, per-level actions (OEM / distributor / service), and an
explicit "what this system cannot determine" block.
"""
from __future__ import annotations

from ledger import Ledger, STRENGTH_RANK

# System-wide limits: always true of this system, shipped with every verdict.
STATIC_LIMITS = [
    "Whether the physical part in the box matches these documents — this "
    "system reads paper, not parts. Metallurgy, holograms, and markings need "
    "physical inspection.",
    "Whether a document image was doctored — inputs arrive as text; pixel- "
    "level forensics (fonts, scan artefacts, seal geometry) are out of scope.",
    "A first presentation of byte-perfect genuine paperwork attached to "
    "different goods — desk memory can flag later reuse, but documentary "
    "analysis cannot inspect the first physical shipment.",
    "GSTIN active/cancelled status — the checksum and state code are "
    "verified offline; whether GSTN has since cancelled the registration "
    "is not.",
    "Events after the registry snapshot date — a company registered or "
    "struck off after the MCA snapshot is assessed as unknown, not guessed.",
    "Multi-party dossiers — checks are anchored to the entity claiming the "
    "manufacturer role; secondary parties (carriers, distributors) are not "
    "independently verified.",
    "Intent — a failed check proves an inconsistency, not who created it "
    "or why.",
]

# Limits that only apply when the relevant check actually featured this case.
_CONDITIONAL_LIMITS = {
    "bis_licence_valid": (
        "Live BIS licence status — the BIS check ran against a local stub "
        "table, not the live BIS portal."),
    "nic_is_manufacturing": (
        "NIC scheme ambiguity — the registry mixes NIC-2004 and NIC-2008 "
        "classification schemes; the activity check accepts the known "
        "automotive divisions and abstains outside them."),
    "cert_date_after_incorporation": (
        "Registry data quality — the MCA registry itself contained ~3,132 "
        "rows with impossible registration dates; those are treated as "
        "'date unknown' and date checks abstain on them."),
}


def _cannot_determine(led: Ledger) -> list:
    """Static system limits + limits conditioned on this case's checks +
    this case's own abstentions — so the block changes with the evidence
    instead of reading as a fixed disclaimer."""
    ran = {f.check for f in led.findings}
    out = list(STATIC_LIMITS)
    for check, text in _CONDITIONAL_LIMITS.items():
        if check in ran:
            out.append(text)
    for f in led.findings:
        r = f.result.lower()
        if "abstain" in r or "unavailable" in r:
            out.append(f"In this case: {f.check} produced no signal "
                       f"({f.result}).")
    return out


def _dimension_status(led: Ledger) -> dict:
    """Summarise each evidence dimension from its own findings, never verdict."""
    out = {}
    for dimension in ("identity", "certification", "provenance", "custody"):
        rows = led.by_dimension(dimension)
        directional = [f for f in rows if f.direction != "neutral"]
        suspect = [f for f in directional
                   if f.direction == "supports_suspect"
                   and f.source_tier != "heuristic"]
        support = [f for f in directional
                   if f.direction == "supports_genuine"]
        unavailable = [f for f in rows if "unavailable" in f.result.lower()]
        abstain = [f for f in rows if "abstain" in f.result.lower()]
        if suspect:
            status = "contradicted"
        elif unavailable and not support:
            status = "unavailable"
        elif support and not abstain and not unavailable:
            status = "supported"
        else:
            status = "incomplete"
        out[dimension] = {
            "status": status,
            "support": len(support),
            "contradictions": len(suspect),
            "gaps": len(abstain) + len(unavailable),
        }
    return out


def _confidence(verdict: str, led: Ledger) -> dict:
    """A bounded evidence assessment, deliberately not a probability."""
    non_heuristic = [f for f in led.findings
                     if f.direction != "neutral"
                     and f.source_tier != "heuristic"]
    strong = [f for f in non_heuristic if STRENGTH_RANK[f.strength] >= 2]
    gaps = [f for f in led.findings
            if "abstain" in f.result.lower() or "unavailable" in f.result.lower()]
    if verdict == "UNVERIFIABLE":
        level = "low" if non_heuristic else "none"
        basis = ["The available records do not support a final documentary conclusion."]
    elif verdict == "SUSPECT":
        level = "high" if any(f.strength == "dispositive" for f in strong) else "medium"
        basis = [f"{len(strong)} strong or dispositive non-heuristic contradiction(s)."]
    else:
        level = "medium"
        basis = [f"{len(non_heuristic)} non-heuristic finding(s) support the documentary assessment without a governing contradiction."]
    limitations = ["Confidence applies to the documentary assessment, not the physical part."]
    if gaps:
        limitations.append(f"{len(gaps)} check(s) abstained or were unavailable.")
    limitations.append("Independent lot-origin records are not yet connected in this release.")
    return {"level": level, "scope": "documentary_assessment",
            "basis": basis, "limitations": limitations}


def decide(led: Ledger, reasoning: dict, rules_only: bool = False,
           registry_row_found: bool = True,
           has_identifier: bool = True,
           registry_status: str = None,
           n_documents: int = None) -> dict:
    """Combine the ledger (always) and the reasoning stage (unless
    rules_only) into exactly one verdict."""
    directional = [f for f in led.findings if f.direction != "neutral"]
    suspect = led.by_direction("supports_suspect")
    genuine = led.by_direction("supports_genuine")

    dispositive_suspect = [f for f in suspect if f.strength == "dispositive"]
    auth_suspect = [f for f in suspect if f.source_tier == "authoritative"
                    and STRENGTH_RANK[f.strength] >= 2]
    auth_contradiction = _authoritative_contradiction(led)
    # The governance floor: strong-or-better suspect evidence from a
    # non-heuristic tier. Neither a missing identifier nor a lenient
    # reasoner can dissolve it — otherwise withholding a document would
    # earn a softer verdict than forging one.
    strong_suspect = [f for f in suspect
                     if STRENGTH_RANK[f.strength] >= 2
                     and f.source_tier in ("authoritative", "derived")]

    verdict, subtype, missing_artefact, interim_action = None, None, None, None

    if not has_identifier and not strong_suspect:
        verdict, subtype = "UNVERIFIABLE", "missing"
        missing_artefact = ("A company identifier (CIN or LLPIN) for the "
                           "claimed manufacturer — without it no registry "
                           "anchor exists.")
        interim_action = ("Quarantine the lot and request the supplier's "
                          "certificate of incorporation before any further "
                          "movement.")
    elif n_documents is not None and n_documents < 2 and not strong_suspect:
        # one document is not a paper trail: no single paper, however
        # internally consistent, can support GENUINE — and this holds
        # regardless of how generously extraction read that one paper
        verdict, subtype = "UNVERIFIABLE", "insufficient"
        missing_artefact = _most_valuable_missing(led)
        interim_action = ("Request the rest of the paper trail (invoice, "
                          "dispatch note) from the supplier; hold the lot "
                          "meanwhile.")
    elif not registry_row_found and not [
            f for f in suspect if f.check != "registry_exists"
            and f.source_tier != "heuristic"]:
        # identifier given but absent from the registry, with nothing else
        # non-heuristically suspicious (the registry_exists failure itself
        # doesn't count — an absent record alone is a gap, not proof of
        # forgery, and heuristics alone can't upgrade it)
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
    elif not strong_suspect and (lambda meaningful: len(meaningful) < 3 or all(
            f.dimension == "identity" for f in meaningful))(
            [f for f in directional if f.source_tier != "heuristic"]):
        # a real supplier identity does not certify the goods in this
        # shipment: without at least one non-heuristic certification/
        # provenance/custody finding, the dossier cannot support GENUINE.
        # Coverage is measured on non-heuristic findings only — otherwise
        # an injected hostile line (a heuristic injection_screen finding)
        # could "widen" the evidence and unlock a GENUINE (found by the
        # mutation harness).
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
        verdict = "SUSPECT" if strong_suspect else "GENUINE"
    elif suspect:
        # reasoner saw the conflicts and did not call it SUSPECT
        amalgamated = (registry_status or "").strip().lower() in (
            "amalgamated", "converted to llp")
        if reasoning.get("recommended_verdict") == "UNVERIFIABLE" and \
                strong_suspect and not amalgamated and \
                not auth_contradiction:
            # governance: the reasoner may soften STRONG evidence to
            # UNVERIFIABLE only when an authoritative record documents the
            # benign mechanism (a registry-recorded succession) or the
            # authoritative tier itself is in conflict. Unexplained strong
            # contradictions stand.
            verdict = "SUSPECT"
        elif reasoning.get("recommended_verdict") == "UNVERIFIABLE":
            verdict, subtype = "UNVERIFIABLE", "contradictory"
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
            # governance floor: the reasoner may soften strong suspect
            # evidence to UNVERIFIABLE (caution, with a work order) but can
            # never wash it all the way to GENUINE — the LLM path must never
            # be more permissive than rules-only mode
            verdict = "SUSPECT" if strong_suspect else "GENUINE"
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
        "confidence": _confidence(verdict, led),
        "dimension_status": _dimension_status(led),
        "ledger": led.to_dict(),
        "reasoning": (None if rules_only else reasoning),
        "rules_only": rules_only,
        "actions": _actions(verdict, subtype),
        "cannot_determine": _cannot_determine(led),
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
    verdict, not a lean).

    One override, per the never-average doctrine's own logic: a strong-or-
    better suspect finding at ANY non-heuristic tier caps the lean — the
    lean must never read 'genuine' beside, say, a GSTIN that failed its own
    checksum, no matter how much support sits at a higher tier."""
    strong_suspect = [f for f in led.findings
                      if f.direction == "supports_suspect"
                      and STRENGTH_RANK[f.strength] >= 2
                      and f.source_tier != "heuristic"]
    if strong_suspect:
        f = strong_suspect[0]
        return {"direction": "suspect", "confidence": "low",
                "basis": f"A {f.strength} {f.source_tier}-tier suspect "
                         f"finding ({f.check}) stands unresolved; the lean "
                         "cannot point genuine past it."}
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
            "oem": "Retain the evidence ledger and apply the normal channel "
                   "and physical-quality controls.",
            "distributor": "The documents support release to the next human "
                           "control; keep the dossier linked to the lot code.",
            "service": "Confirm the usual physical and approved-channel "
                       "controls before fitment; record the lot on the job card.",
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
