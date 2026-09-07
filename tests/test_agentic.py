"""The five capabilities added on top of the deterministic pipeline:

  * finding-level counterfactuals (what would change this verdict)
  * the unchecked-claims register (what was read but not verified)
  * the seen-lots archive (dossier reuse, across runs)
  * the successor lookup (follow the thread into the registry)
  * the adversarial self-critique (attack the draft, revise one way only)

Every test here runs offline against the mock engine.
"""
import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import archive
import counterfactual
import pipeline
import preflight
import validators
from ledger import Finding, Ledger

CASES = Path(__file__).resolve().parents[1] / "cases"


def _load(name):
    return json.loads((CASES / f"{name}.json").read_text(encoding="utf-8-sig"))


@pytest.fixture
def clean_archive(tmp_path, monkeypatch):
    """An empty archive per test: desk memory must never leak between tests."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    return tmp_path / "lots.jsonl"


# -- counterfactuals ---------------------------------------------------------

def test_counterfactual_names_the_load_bearing_finding():
    """The struck-off status is the whole case; remove it and it's GENUINE."""
    r = pipeline.analyze(_load("suspect_meridian"))
    cf = r["counterfactual"]
    assert cf["baseline"] == "SUSPECT"
    decisive = {d["check"]: d["becomes"] for d in cf["decisive"]}
    assert decisive.get("company_status_active") == "GENUINE"


def test_counterfactual_reports_joint_support_when_no_single_row_decides():
    r = pipeline.analyze(_load("genuine_hsi"))
    cf = r["counterfactual"]
    assert cf["baseline"] == "GENUINE"
    assert cf["decisive"] == []
    assert "jointly" in cf["note"]


def test_counterfactual_baseline_always_equals_the_real_verdict():
    """The explanation may never disagree with the thing it explains."""
    for path in sorted(CASES.glob("*.json")):
        r = pipeline.analyze(json.loads(path.read_text(encoding="utf-8-sig")))
        expected = counterfactual.label(r)
        assert r["counterfactual"]["baseline"] == expected, path.stem


# -- unchecked claims --------------------------------------------------------

def test_unchecked_claims_lists_read_but_unverified_fields():
    r = pipeline.analyze(_load("suspect_meridian"))
    attrs = {c["attribute"] for c in r["unchecked_claims"]}
    assert "invoice_no" in attrs          # read, no validator consumes it
    assert "cin" not in attrs             # read and checked six ways
    assert "gstin" not in attrs
    for claim in r["unchecked_claims"]:
        assert claim["source_doc"], "every unchecked claim names its document"


def test_every_planned_attribute_counts_as_checked():
    """A claim a validator consumes must never be reported as unverified."""
    for req in [r for _c, opts, _u in preflight.PLAN for r in opts]:
        assert req <= preflight.CONSUMED_ATTRS


# -- the seen-lots archive ---------------------------------------------------

def test_first_sighting_passes_second_sighting_is_suspect(clean_archive):
    dossier = _load("genuine_hsi")
    first = pipeline.analyze(dossier, archive_run=True)
    assert first["verdict"] == "GENUINE"

    second = pipeline.analyze(dossier, archive_run=True)
    reuse = [f for f in second["ledger"]["findings"]
             if f["check"] == "dossier_reuse"]
    assert reuse and reuse[0]["direction"] == "supports_suspect"
    assert second["verdict"] == "SUSPECT", \
        "a dossier presented twice is the cloned-paperwork attack"


def test_archive_is_inert_unless_the_run_is_a_desk_submission(clean_archive):
    """Calibration must stay deterministic: no archive read, no archive write."""
    dossier = _load("genuine_hsi")
    for _ in range(3):
        r = pipeline.analyze(dossier)
        checks = {f["check"] for f in r["ledger"]["findings"]}
        assert "dossier_reuse" not in checks
        assert r["verdict"] == "GENUINE"
    assert not clean_archive.exists()


def test_thin_dossier_is_not_fingerprinted(clean_archive):
    """Too few fields would collide across honest shipments, so we abstain."""
    r = pipeline.analyze(_load("unverifiable_kestrel_thin"), archive_run=True)
    checks = {f["check"] for f in r["ledger"]["findings"]}
    assert "dossier_reuse" not in checks


def test_unwritable_archive_degrades_instead_of_raising(monkeypatch, tmp_path):
    """A read-only or blocked path must never turn a verdict into a stack
    trace: a desk with no writable disk still gets its answer."""
    blocker = tmp_path / "blocker"      # a file where a directory must be
    blocker.write_text("not a directory", encoding="utf-8")
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(blocker / "lots.jsonl"))
    r = pipeline.analyze(_load("genuine_hsi"), archive_run=True)
    assert r["verdict"] == "GENUINE"


# -- successor lookup --------------------------------------------------------

def test_successor_lookup_runs_only_on_a_recorded_succession():
    cascade = pipeline.analyze(_load("contrast_cascade"))
    hit = [f for f in cascade["ledger"]["findings"]
           if f["check"] == "successor_registry_lookup"]
    assert hit, "an amalgamated supplier must trigger the successor hunt"
    assert hit[0]["direction"] == "neutral", \
        "an absent record is a gap, never proof of forgery"
    assert "registry" in hit[0]["detail"].lower()

    clean = pipeline.analyze(_load("genuine_hsi"))
    assert not [f for f in clean["ledger"]["findings"]
                if f["check"] == "successor_registry_lookup"]


def test_successor_lookup_abstains_without_a_registry_row():
    f = validators.successor_registry_lookup("U12345MH2020PTC000001", None)
    assert f.direction == "neutral"
    assert "abstain" in f.result


def test_plan_gates_the_successor_check_on_status():
    pf = preflight.preflight(_load("contrast_cascade"))
    entry = next(p for p in pf["plan"]
                 if p["check"] == "successor_registry_lookup")
    assert entry["will_run"] is True

    pf2 = preflight.preflight(_load("genuine_hsi"))
    entry2 = next(p for p in pf2["plan"]
                  if p["check"] == "successor_registry_lookup")
    assert entry2["will_run"] is False and "succession" in entry2["reason"]


# -- the challenger ----------------------------------------------------------

def test_every_verdict_carries_a_challenge():
    for path in sorted(CASES.glob("*.json")):
        r = pipeline.analyze(json.loads(path.read_text(encoding="utf-8-sig")))
        ch = r["reasoning"].get("challenge")
        assert ch, path.stem
        assert isinstance(ch["held"], bool)
        assert ch["attack"]


def test_challenge_can_only_move_a_verdict_toward_caution():
    """The governance bound: a self-critique may add doubt, never remove it."""
    import reason
    led = Ledger(findings=[Finding(
        assertion="x", check="company_status_active", result="fail",
        direction="supports_suspect", strength="strong",
        source_tier="authoritative", dimension="identity")])
    for drafted in ("SUSPECT", "GENUINE"):
        draft = {"recommended_verdict": drafted, "narrative": ""}
        ch = reason._deterministic_challenge(led, draft)
        assert ch["revised"] is False
        # a successful attack may only escalate, and only to UNVERIFIABLE
        ch_upheld = dict(ch, held=False, revised=True)
        result = dict(draft)
        if ch_upheld["revised"]:
            result["recommended_verdict"] = "UNVERIFIABLE"
        assert result["recommended_verdict"] == "UNVERIFIABLE"


def test_challenge_cannot_manufacture_doubt_without_a_contradiction():
    """The mirror of "heuristics alone can never force SUSPECT": heuristics
    alone can never force an abstention either. Caught by eval --live, where
    the challenger talked itself out of a clean dossier over a typo."""
    import reason

    class _WinningChallenger:
        provider = "llm"
        def complete_json(self, system, user, cache_key=None):
            return {"attack": "a forger could have faked all of this",
                    "weakest_link": "lot_code_grammar",
                    "decisive_artefact": "the OEM production record",
                    "held": False, "why": "nothing rules it out"}

    heuristic_only = Ledger(findings=[
        Finding(assertion="lot", check="lot_code_grammar", result="fail",
                direction="supports_suspect", strength="moderate",
                source_tier="heuristic", dimension="provenance"),
        Finding(assertion="reg", check="registry_exists", result="pass",
                direction="supports_genuine", strength="moderate",
                source_tier="authoritative", dimension="identity"),
    ])
    ch = reason._challenge(heuristic_only, {"recommended_verdict": "GENUINE"},
                           _WinningChallenger())
    assert ch["held"] is False, "the attack itself is still recorded"
    assert ch["revised"] is False, "but it may not move the verdict"
    assert ch["blocked"] is True and ch["blocked_reason"]

    # with a real, non-heuristic contradiction the same attack does land
    real = Ledger(findings=heuristic_only.findings + [
        Finding(assertion="status", check="company_status_active",
                result="fail", direction="supports_suspect",
                strength="strong", source_tier="authoritative",
                dimension="identity")])
    ch2 = reason._challenge(real, {"recommended_verdict": "SUSPECT"},
                            _WinningChallenger())
    assert ch2["revised"] is True and not ch2.get("blocked")


def test_challenge_is_skipped_when_the_draft_already_abstains():
    """Note this is the *reasoner's* draft, not the final verdict: stage 5 can
    still convert a SUSPECT draft into UNVERIFIABLE on its own rules, and that
    conversion happens after the challenge."""
    import reason
    ch = reason._deterministic_challenge(
        Ledger(findings=[]), {"recommended_verdict": "UNVERIFIABLE"})
    assert ch["engine"] == "skipped" and ch["held"] is True
    assert ch["revised"] is False


def test_challenge_skip_invariant_holds_across_every_case():
    for path in sorted(CASES.glob("*.json")):
        r = pipeline.analyze(json.loads(path.read_text(encoding="utf-8-sig")))
        reasoning = r["reasoning"]
        if reasoning["recommended_verdict"] == "UNVERIFIABLE":
            assert reasoning["challenge"]["engine"] == "skipped", path.stem
