"""Stage 4 — reasoning over the ledger.

For each contradiction the reasoner generates a benign and a malicious
explanation, then resolves it under fixed rules:
  * authoritative tier beats any number of heuristics;
  * evidence is never averaged across tiers;
  * reasoning spans dimensions (an identity failure taints certification
    claims from the same entity, etc.).
Outputs exactly one recommended verdict for stage 5 to finalize.
"""
from __future__ import annotations

import json
from typing import Optional

from ledger import Ledger, TIER_RANK, STRENGTH_RANK
from llm import LLMClient

_REASON_SYSTEM = """You are the reasoning stage of a counterfeit-auto-parts
document investigator. You will receive an evidence ledger as JSON. The ledger
is your ONLY input — do not invent facts.

Rules you must follow:
1. authoritative-tier evidence beats any number of heuristic findings;
2. never average evidence across tiers — resolve each conflict at the highest
   tier that speaks to it;
3. reason across dimensions (identity, certification, provenance, custody):
   e.g. a broken identity undermines that entity's certification claims;
4. when the registry itself documents a benign mechanism for the anomalies
   (any registry-recorded succession or transition — amalgamation,
   conversion, re-registration — that would explain name, state, or GST
   changes) and no finding is dispositive, recommend UNVERIFIABLE pending
   the corroborating official artefact rather than SUSPECT;
5. heuristic-tier anomalies alone (lot-code oddities, field drift) can never
   justify SUSPECT while authoritative-tier evidence supports the documents —
   note them and recommend GENUINE.

For each contradiction (findings pointing opposite directions about related
facts) give one benign and one malicious explanation, then resolve it.

Return ONLY JSON:
{"contradictions": [{"topic": str, "benign": str, "malicious": str,
                     ...}]}
where "topic" MUST begin with the exact `check` name of the disputed finding
followed by ": " (e.g. "gstin_state_matches_claim: GSTIN state vs claim").
Full schema:
{"contradictions": [{"topic": str, "benign": str, "malicious": str,
                     "resolution": str, "resolved_direction":
                     "supports_genuine"|"supports_suspect"|"unresolved"}],
 "narrative": str,
 "recommended_verdict": "GENUINE"|"SUSPECT"|"UNVERIFIABLE"}"""


def reason_over_ledger(led: Ledger, llm: Optional[LLMClient] = None,
                       case_id: str = "unknown") -> dict:
    llm = llm or LLMClient()
    payload = llm.complete_json(
        _REASON_SYSTEM,
        "Evidence ledger:\n" + json.dumps(led.to_dict(), indent=2),
        cache_key=f"reason_{case_id}",
    )
    # Fail closed, not open: a malformed or out-of-vocabulary LLM answer must
    # never reach the verdict stage. Anything outside the three-value enum
    # falls back to the deterministic reasoner.
    if payload and payload.get("recommended_verdict") in (
            "GENUINE", "SUSPECT", "UNVERIFIABLE"):
        payload.setdefault("contradictions", [])
        payload.setdefault("narrative", "")
        payload["engine"] = "llm"
        return payload
    result = _deterministic_reasoning(led)
    result["engine"] = "deterministic_fallback"
    return result


# ---------------------------------------------------------------------------

def _deterministic_reasoning(led: Ledger) -> dict:
    """Template-based reasoning used in mock mode / when the LLM is down.
    Applies the same tier rules, with canned benign/malicious wording."""
    suspect = [f for f in led.findings if f.direction == "supports_suspect"]
    genuine = [f for f in led.findings if f.direction == "supports_genuine"]

    contradictions = []
    for s in suspect:
        opposing = [g for g in genuine if g.dimension == s.dimension]
        topic = f"{s.check}: {s.assertion}"
        benign = _benign_story(s)
        malicious = _malicious_story(s)
        if opposing:
            top_g = max(opposing, key=lambda f: (TIER_RANK[f.source_tier],
                                                 STRENGTH_RANK[f.strength]))
            s_rank = (TIER_RANK[s.source_tier], STRENGTH_RANK[s.strength])
            g_rank = (TIER_RANK[top_g.source_tier], STRENGTH_RANK[top_g.strength])
            if TIER_RANK[s.source_tier] > TIER_RANK[top_g.source_tier]:
                resolution = (f"Resolved at the {s.source_tier} tier: "
                              f"'{s.detail}' outranks lower-tier support "
                              f"such as '{top_g.check}'. Tiers are never "
                              "averaged.")
                direction = "supports_suspect"
            elif TIER_RANK[s.source_tier] < TIER_RANK[top_g.source_tier] and \
                    STRENGTH_RANK[s.strength] < STRENGTH_RANK["strong"]:
                resolution = (f"The {top_g.source_tier}-tier finding "
                              f"'{top_g.check}' outranks this "
                              f"{s.source_tier}-tier signal.")
                direction = "supports_genuine"
            elif s_rank >= g_rank:
                resolution = (f"Same tier, but the suspect finding is at "
                              f"least as strong ({s.strength} vs "
                              f"{top_g.strength}); the malicious reading "
                              "stands.")
                direction = "supports_suspect"
            else:
                resolution = "Evidence at the same tier conflicts; unresolved."
                direction = "unresolved"
        else:
            resolution = (f"No opposing evidence in the {s.dimension} "
                          "dimension; the finding stands.")
            direction = "supports_suspect"
        contradictions.append({
            "topic": topic, "benign": benign, "malicious": malicious,
            "resolution": resolution, "resolved_direction": direction,
        })

    # verdict recommendation from resolved directions, honoring tier rules
    top_tier = led.highest_tier_with_signal()
    resolved_suspect = [c for c in contradictions
                        if c["resolved_direction"] == "supports_suspect"]
    dispositive_suspect = [f for f in suspect if f.strength == "dispositive"]
    strong_auth_suspect = [f for f in suspect
                           if f.source_tier == "authoritative"
                           and STRENGTH_RANK[f.strength] >= 2]

    if not led.findings or all(f.direction == "neutral" for f in led.findings):
        verdict = "UNVERIFIABLE"
        narrative = ("The ledger contains no directional evidence; nothing "
                     "here can separate a genuine paper trail from a forged "
                     "one.")
    elif dispositive_suspect or strong_auth_suspect or (
            resolved_suspect and top_tier in ("authoritative", "derived")
            and any(f.source_tier != "heuristic" for f in suspect)):
        verdict = "SUSPECT"
        narrative = (
            f"{len(suspect)} finding(s) support suspicion, including "
            f"{len(dispositive_suspect)} dispositive and "
            f"{len(strong_auth_suspect)} strong authoritative-tier "
            "finding(s). Under the tier rule these cannot be offset by "
            f"the {len(genuine)} lower-strength supportive finding(s); "
            "cross-dimension reasoning applies — a broken identity or "
            "impossible certification date taints the remaining claims "
            "from the same entity."
        )
    elif suspect and all(f.source_tier == "heuristic" for f in suspect) and \
            any(f.source_tier in ("authoritative", "derived") for f in genuine):
        verdict = "GENUINE"
        narrative = ("Only heuristic-tier anomalies exist and they are "
                     "outranked by authoritative/derived support; "
                     "authoritative evidence beats any number of heuristics.")
    elif not suspect:
        verdict = "GENUINE"
        narrative = (f"All {len(genuine)} directional finding(s) support the "
                     "documents, anchored at the "
                     f"{top_tier or 'derived'} tier, with no contradiction "
                     "left unresolved.")
    else:
        verdict = "UNVERIFIABLE"
        narrative = ("The remaining conflicts sit at the same evidence tier "
                     "with comparable strength and cannot be resolved "
                     "without additional artefacts.")

    return {"contradictions": contradictions, "narrative": narrative,
            "recommended_verdict": verdict}


def _benign_story(f) -> str:
    stories = {
        "gstin_checksum": "A clerk mistyped one character of the GSTIN when "
                          "preparing the paperwork.",
        "gstin_state_matches_claim": "The company recently moved its "
                                     "registered office and kept an old GST "
                                     "registration.",
        "gstin_embedded_pan": "The GSTIN was transcribed from a fax and a "
                              "character was corrupted.",
        "cin_decode": "The CIN was re-typed by hand and garbled in copying.",
        "registry_exists": "The company was registered very recently and "
                           "this registry snapshot predates it.",
        "cin_vs_registry": "The company renamed or relocated after these "
                           "documents were printed.",
        "cert_date_after_incorporation": "The certificate template carried "
                                         "over a stale date field from a "
                                         "previous job.",
        "ship_date_after_mfg_date": "Warehouse staff post-dated the "
                                    "manufacturing field or mixed up two "
                                    "date columns.",
        "company_status_active": "The status change is an administrative "
                                 "strike-off being contested.",
        "nic_is_manufacturing": "The company genuinely manufactures but "
                                "registered under a trading code for tax "
                                "convenience.",
        "bis_licence_valid": "The licence was renewed under a new number "
                             "not reflected here.",
        "tac_within_5_years": "A renewal exists but was not included in the "
                              "dossier.",
        "lot_code_grammar": "The OEM changed its lot-code format and the "
                            "grammar on file is stale.",
        "cross_doc_field_drift": "Different departments filled the forms "
                                 "from memory rather than copying.",
    }
    return stories.get(f.check, "An innocent clerical error in document "
                                "preparation.")


def _malicious_story(f) -> str:
    stories = {
        "gstin_checksum": "The GSTIN was fabricated without knowing the "
                          "check-digit algorithm.",
        "gstin_state_matches_claim": "A real GSTIN was lifted from an "
                                     "unrelated firm in another state.",
        "gstin_embedded_pan": "The forger spliced a GSTIN together around "
                              "an invented or stolen PAN.",
        "cin_decode": "The CIN is invented and does not follow the MCA "
                      "encoding.",
        "registry_exists": "The issuing company does not exist; the entire "
                           "identity is fictional.",
        "cin_vs_registry": "A real CIN was borrowed and the documents "
                           "re-badged with a different company's details.",
        "cert_date_after_incorporation": "The certificate was forged with a "
                                         "backdated issue date to fake a "
                                         "track record.",
        "ship_date_after_mfg_date": "Custody paperwork was fabricated after "
                                    "the fact and the dates don't line up.",
        "company_status_active": "A defunct company's letterhead is being "
                                 "used as a shell for counterfeit goods.",
        "nic_is_manufacturing": "A parts trader is forging manufacturer "
                                "certificates for goods it re-labels.",
        "bis_licence_valid": "Another firm's BIS licence number was copied "
                             "onto counterfeit certification.",
        "tac_within_5_years": "An expired type approval is being passed off "
                              "as current.",
        "lot_code_grammar": "Lot codes were invented without access to the "
                            "OEM's numbering system.",
        "cross_doc_field_drift": "The documents were forged separately and "
                                 "the forger failed to keep details "
                                 "consistent.",
    }
    return stories.get(f.check, "The document was fabricated and the "
                                "inconsistency is a forgery artefact.")
