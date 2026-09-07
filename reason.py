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


_CHALLENGE_SYSTEM = """You are the CHALLENGER. Another reasoning pass has just
produced a draft verdict from the evidence ledger below. Your job is not to
agree with it. Your job is to construct the strongest honest case that the
draft is WRONG, using only the ledger — do not invent facts.

Ask, specifically:
* if the draft is SUSPECT: what innocent mechanism would produce this exact
  pattern of findings? Is there one the draft did not consider?
* if the draft is GENUINE: what would a competent forger have had to fake to
  produce exactly these findings, and is anything on this ledger inconsistent
  with that?
* in both cases: which single document or record, not present here, would
  settle the disagreement?

Then judge your own attack honestly. Most drafts survive; say so when they do.
A draft only fails if your attack identifies a real, unresolved alternative
that the present evidence cannot rule out.

Return ONLY JSON:
{"attack": str,            // the strongest case that the draft is wrong
 "weakest_link": str,      // the check name the draft leans on most
 "decisive_artefact": str, // the one document/record that would settle it
 "held": true|false,       // true = the draft survives your attack
 "why": str}               // one sentence on why it held or failed"""


def _challenge(led: Ledger, draft: dict, llm: LLMClient,
               case_id: str = "unknown") -> dict:
    """Attack the draft verdict, then let it revise itself — one way only.

    The challenger may move the recommendation toward caution
    (GENUINE/SUSPECT -> UNVERIFIABLE) and never away from it. That asymmetry is
    the point: a model arguing itself into more doubt costs a two-day hold, and
    a model arguing itself out of doubt costs a recall. It is enforced here in
    code, not requested in the prompt.

    A draft that is already UNVERIFIABLE is already the cautious answer, so
    there is nothing for a successful attack to move it to; we say that
    deterministically instead of spending a second model call on it.
    """
    drafted = draft.get("recommended_verdict")
    if drafted == "UNVERIFIABLE":
        return {
            "attack": "The draft already abstains and names what it is "
                      "waiting for, so the cautious direction is taken.",
            "weakest_link": "", "decisive_artefact": "",
            "held": True, "engine": "skipped",
            "why": "A challenge can only move a verdict toward caution, and "
                   "UNVERIFIABLE is already the cautious answer.",
            "revised": False,
        }

    payload = llm.complete_json(
        _CHALLENGE_SYSTEM,
        f"Draft verdict: {drafted}\n\nDraft reasoning: "
        f"{draft.get('narrative', '')}\n\nEvidence ledger:\n"
        + json.dumps(led.to_dict(), indent=2),
        cache_key=f"challenge_{case_id}",
    )
    if not payload or not isinstance(payload.get("held"), bool):
        return _deterministic_challenge(led, draft)

    payload.setdefault("attack", "")
    payload.setdefault("weakest_link", "")
    payload.setdefault("decisive_artefact", "")
    payload.setdefault("why", "")
    payload["engine"] = "llm"

    # Two governance bounds on a successful attack, both enforced here rather
    # than requested in the prompt:
    #
    # 1. It escalates to UNVERIFIABLE and can do nothing else. A challenge can
    #    never turn suspicion into approval.
    # 2. It may only escalate when there is a real contradiction to escalate
    #    about — at least one suspect finding above the heuristic tier. This
    #    is the mirror of the rule that heuristics alone can never force
    #    SUSPECT: doubt manufactured from nothing is not judgement, it is an
    #    abstention rate. Without it a model can talk itself out of any clean
    #    dossier, which is exactly what a supplier with good paperwork and bad
    #    luck would suffer.
    real_contradiction = any(
        f.direction == "supports_suspect" and f.source_tier != "heuristic"
        for f in led.findings)
    payload["revised"] = (not payload["held"]) and real_contradiction
    if not payload["held"] and not real_contradiction:
        payload["blocked"] = True
        payload["blocked_reason"] = (
            "The attack is recorded but cannot move the verdict: nothing on "
            "this ledger contradicts the documents above the heuristic tier. "
            "A challenge may add caution to real evidence, not manufacture "
            "doubt where there is none.")
    return payload


def _deterministic_challenge(led: Ledger, draft: dict) -> dict:
    """The offline challenger: same shape, no model, always reproducible."""
    drafted = draft.get("recommended_verdict")
    if drafted == "UNVERIFIABLE":
        # same rule as the model path: caution is already the destination
        return {
            "attack": "The draft already abstains and names what it is "
                      "waiting for, so the cautious direction is taken.",
            "weakest_link": "", "decisive_artefact": "",
            "held": True, "engine": "skipped",
            "why": "A challenge can only move a verdict toward caution, and "
                   "UNVERIFIABLE is already the cautious answer.",
            "revised": False,
        }
    suspect = [f for f in led.findings if f.direction == "supports_suspect"]
    strongest = max(suspect,
                    key=lambda f: (TIER_RANK[f.source_tier],
                                   STRENGTH_RANK[f.strength]),
                    default=None)
    if drafted == "SUSPECT" and strongest is not None:
        attack = (f"The case rests on '{strongest.check}' at the "
                  f"{strongest.source_tier} tier. If that single record is "
                  "stale or mis-keyed, the pattern collapses into ordinary "
                  "administrative untidiness.")
        why = (f"It holds: {strongest.source_tier}-tier evidence at "
               f"{strongest.strength} strength is not displaced by the "
               "possibility of an error, only by a record that contradicts it.")
        artefact = ("A certified copy of the MCA master data for the quoted "
                    "CIN, dated after this dossier.")
    elif drafted == "GENUINE":
        attack = ("Every check that passed could be reproduced by a forger "
                  "who copied a real supplier's identity wholesale; the "
                  "ledger cannot see goods, only paper.")
        why = ("It holds on the evidence present: nothing here contradicts "
               "the trail. The residual risk is dossier reuse, which is "
               "stated as a limit rather than resolved.")
        artefact = ("The OEM's production record for this lot, or an earlier "
                    "sighting of the same dossier at this desk.")
    else:
        attack = "No directional evidence to attack."
        why = "Nothing to revise."
        artefact = ""
    return {"attack": attack, "weakest_link":
            strongest.check if strongest is not None else "",
            "decisive_artefact": artefact, "held": True,
            "why": why, "engine": "deterministic_fallback", "revised": False}


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
        result = payload
    else:
        result = _deterministic_reasoning(led)
        result["engine"] = "deterministic_fallback"

    # Stage 4b — the agent attacks its own draft, and may revise it one way.
    if result["engine"] == "llm":
        challenge = _challenge(led, result, llm, case_id=case_id)
    else:
        challenge = _deterministic_challenge(led, result)
    if challenge.get("revised"):
        challenge["from"] = result["recommended_verdict"]
        result["recommended_verdict"] = "UNVERIFIABLE"
    result["challenge"] = challenge
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
        "eway_validity_vs_distance": "The transporter lawfully extended the "
                                     "bill under Rule 138(10) and the "
                                     "extension record wasn't attached.",
        "hsn_matches_part": "A billing clerk reused a template line with "
                            "last consignment's HSN code.",
        "entry_port_mode_consistent": "A freight forwarder's template "
                                      "carried a stale port field.",
        "route_distance_sanity": "The truck took a genuine diversion "
                                 "(floods, tolls) and the paperwork "
                                 "recorded the odometer honestly.",
        "spec_matches_oem_sheet": "The OEM revised the applicable standard "
                                  "and the sheet on file is stale.",
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
        "eway_validity_vs_distance": "The e-way bill was fabricated after "
                                     "the fact by someone who never ran "
                                     "the Rule 138(10) arithmetic — the "
                                     "goods never made this journey.",
        "hsn_matches_part": "The HSN was deliberately mis-declared to dodge "
                            "duty scrutiny or anti-dumping checks on this "
                            "part family.",
        "entry_port_mode_consistent": "Two import stories were papered for "
                                      "one consignment — the entry record "
                                      "is invented.",
        "route_distance_sanity": "The logistics leg was invented and the "
                                 "forger guessed the distance.",
        "spec_matches_oem_sheet": "The certificate was cloned without the "
                                  "OEM's spec sheet, and the forger "
                                  "guessed the standard wrong.",
    }
    return stories.get(f.check, "The document was fabricated and the "
                                "inconsistency is a forgery artefact.")
