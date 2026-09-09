"""Pure documentary eligibility policy shared by verdict and counterfactuals."""
from __future__ import annotations

from ledger import Ledger, STRENGTH_RANK


def genuine_eligibility(ledger: Ledger) -> dict:
    identity = any(
        f.dimension == "identity" and f.direction == "supports_genuine"
        and f.source_tier != "heuristic" for f in ledger.findings)
    dispatch = any(f.check == "lot_matches_dispatch" and f.status == "pass"
                   for f in ledger.findings)
    custody = any(f.check == "custody_sequence_reconciles" and f.status == "pass"
                  for f in ledger.findings)
    conflict = any(
        f.direction == "supports_suspect" and f.source_tier != "heuristic"
        and STRENGTH_RANK[f.strength] >= 2 for f in ledger.findings)
    record_conflict = any(f.check == "source_record_conflict" and f.status == "fail"
                          for f in ledger.findings)
    gaps = [f for f in ledger.findings
            if f.check in ("lot_matches_dispatch", "custody_sequence_reconciles")
            and f.status in ("abstain", "unavailable")]
    missing = []
    if not identity:
        missing.append("grounded manufacturer identity")
    if not dispatch:
        missing.append("independent lot/part dispatch anchor")
    if not custody:
        missing.append("linked custody record")
    return {
        "eligible": identity and dispatch and custody and not conflict
                    and not record_conflict and not gaps,
        "identity": identity, "dispatch": dispatch, "custody": custody,
        "conflict": conflict or record_conflict,
        "missing": missing,
    }
