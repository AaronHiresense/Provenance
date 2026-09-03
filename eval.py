"""Calibration eval — the credibility number behind "knows what it doesn't
know".

Runs every case in cases/ against its "expected" verdict and reports:
  * abstention rate — how often the system says UNVERIFIABLE instead of
    guessing;
  * accuracy conditional on not abstaining — when it does commit to
    GENUINE/SUSPECT, how often it is right;
  * subtype accuracy for abstentions.

Runs in mock mode by default so the numbers are deterministic and free;
pass --live to use the configured LLM provider instead.

Usage:  python eval.py [--live] [--rules-only]
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if "--live" not in sys.argv:
    os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import pipeline  # noqa: E402  (after the provider env decision)

CASES = Path(__file__).resolve().parent / "cases"


def main() -> int:
    rules_only = "--rules-only" in sys.argv
    rows, correct, abstained, committed_right = [], 0, 0, 0
    committed = 0

    for p in sorted(CASES.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8-sig"))
        exp = d.get("expected")
        if not exp:
            print(f"  (skipping {p.stem}: no 'expected' block)")
            continue
        r = pipeline.analyze(d, rules_only=rules_only)
        got = (r["verdict"], r["subtype"])
        want = (exp["verdict"], exp.get("subtype"))
        ok = got == want
        correct += ok
        if r["verdict"] == "UNVERIFIABLE":
            abstained += 1
        else:
            committed += 1
            committed_right += r["verdict"] == want[0]
        rows.append((p.stem, want, got, ok))

    n = len(rows)
    print(f"\n{'case':32s} {'expected':28s} {'got':28s} ok")
    for stem, want, got, ok in rows:
        fmt = lambda t: t[0] + (f"/{t[1]}" if t[1] else "")
        print(f"{stem:32s} {fmt(want):28s} {fmt(got):28s} "
              f"{'yes' if ok else 'NO'}")

    print(f"\ncases: {n}")
    print(f"exact match (verdict+subtype): {correct}/{n} "
          f"({100 * correct / n:.0f}%)")
    print(f"abstention rate: {abstained}/{n} ({100 * abstained / n:.0f}%) — "
          "UNVERIFIABLE instead of a guess")
    if committed:
        print(f"accuracy when committed: {committed_right}/{committed} "
              f"({100 * committed_right / committed:.0f}%) — "
              "GENUINE/SUSPECT calls that were right")
    return 0 if correct == n else 1


if __name__ == "__main__":
    sys.exit(main())
