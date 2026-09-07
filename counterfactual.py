"""What would change this verdict?

A finding-level counterfactual. For every non-neutral row on the ledger we
re-run stage 5 with that row removed and record the verdicts that change.

Three properties make this honest rather than decorative:

  * it is computed by the **same** governance rules that produced the verdict
    (`verdict.decide`), not by a separate explanation model, so it can never
    disagree with the thing it explains;
  * it is pure and offline — no LLM, no re-extraction, milliseconds per row;
  * the reasoner's adjudication is held fixed, which is stated in the payload:
    the question answered is "holding the deliberation constant, which single
    piece of evidence is load-bearing?"

When no single finding changes the answer, that is itself the finding: the
verdict rests on several rows jointly, and the payload says so.
"""
from __future__ import annotations

from typing import Optional

from ledger import Ledger
from verdict import decide


def label(result: dict) -> str:
    """'SUSPECT' / 'UNVERIFIABLE (contradictory)' — how a verdict reads."""
    v = result.get("verdict")
    sub = result.get("subtype")
    return f"{v} ({sub})" if sub else str(v)


def what_would_change(led: Ledger, reasoning: dict, *,
                      rules_only: bool = False,
                      registry_row_found: bool = True,
                      has_identifier: bool = True,
                      registry_status: Optional[str] = None,
                      n_documents: Optional[int] = None) -> dict:
    """Per-finding counterfactual over the ledger that produced the verdict."""
    ctx = dict(rules_only=rules_only,
               registry_row_found=registry_row_found,
               has_identifier=has_identifier,
               registry_status=registry_status,
               n_documents=n_documents)

    baseline = label(decide(led, reasoning, **ctx))

    decisive = []
    for i, f in enumerate(led.findings):
        if f.direction == "neutral":
            continue
        reduced = Ledger(findings=[g for j, g in enumerate(led.findings)
                                   if j != i])
        alt = label(decide(reduced, reasoning, **ctx))
        if alt != baseline:
            decisive.append({
                "check": f.check,
                "assertion": f.assertion,
                "result": f.result,
                "direction": f.direction,
                "strength": f.strength,
                "source_tier": f.source_tier,
                "becomes": alt,
            })

    n_directional = len([f for f in led.findings if f.direction != "neutral"])
    if decisive:
        note = ("Each row below is load-bearing: remove it and the verdict "
                "changes. Everything else on the ledger could be struck out "
                "one at a time without moving the answer.")
    else:
        note = (f"No single finding decides this. The verdict rests on "
                f"{n_directional} directional findings jointly — striking out "
                f"any one of them leaves it at {baseline}.")

    return {
        "baseline": baseline,
        "decisive": decisive,
        "considered": n_directional,
        "note": note,
        "method": ("Stage 5 re-run with one finding removed at a time, on the "
                   "same governance rules, with the reasoner's adjudication "
                   "held fixed. Pure code, offline."),
    }
