"""Public operational endpoints expose health without secrets or paths."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import app

CASES = Path(__file__).resolve().parents[1] / "cases"


def _load(name):
    return json.loads((CASES / f"{name}.json").read_text(encoding="utf-8-sig"))


def test_health_is_liveness_only():
    assert app.health() == {"status": "ok"}


def test_runtime_is_safe_and_describes_capabilities():
    result = app.runtime()
    assert result["processing"]["provider"] == "mock"
    assert result["processing"]["external_model"] is False
    assert "path" not in str(result).lower()
    assert "key" not in str(result).lower()
    assert result["capabilities"]["streaming_analysis"] is True
    assert result["capabilities"]["independent_origin_records"] is True
    assert result["reference_snapshot"]["provenance"] == "synthetic_demo"
    assert result["reference_snapshot"]["available"] is True


def test_ready_checks_registry_and_storage(monkeypatch):
    monkeypatch.setattr(app, "_registry_status", lambda: (True, "2026-07-22"))
    monkeypatch.setattr(app, "_storage_ready", lambda: True)
    assert app.ready()["status"] == "ready"


def test_missing_dependency_is_not_ready(monkeypatch):
    monkeypatch.setattr(app, "_registry_status", lambda: (False, None))
    monkeypatch.setattr(app, "_storage_ready", lambda: True)
    try:
        app.ready()
    except app.HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail["registry"] is False
    else:
        raise AssertionError("readiness must fail without the registry")


def test_prepared_case_clicks_never_poison_the_reuse_archive(tmp_path, monkeypatch):
    """A prepared lot (req.case) is clicked repeatedly by every visitor — by
    design, not by mistake. It must never be treated as a desk submission, or
    the second person to click 'genuine_hsi' gets SUSPECT for a case the
    product itself sells as a one-click, always-right reference."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    for _ in range(3):
        r = app.analyze(app.AnalyzeRequest(case="genuine_hsi"))
        checks = {f["check"] for f in r["ledger"]["findings"]}
        assert "dossier_reuse" not in checks
        assert r["verdict"] == "GENUINE"
    assert not (tmp_path / "lots.jsonl").exists()


def test_check_the_work_yourself_samples_never_poison_the_archive(tmp_path, monkeypatch):
    """The six downloadable 'check the work yourself' samples run through the
    raw-text path with a generic case_id — the same shape a reviewer's own
    paste uses. They must still be recognised as reference content and never
    archived, or the second visitor to click 'Run as text' gets a different
    verdict than the one the page promises."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    combined = Path(__file__).resolve().parents[1] / "samples" / "combined"
    sample_files = sorted(combined.glob("*.txt"))
    assert sample_files, "no sample fixtures found to test against"
    for path in sample_files:
        text = path.read_text(encoding="utf-8-sig")
        for _ in range(2):
            r = app.analyze(app.AnalyzeRequest(raw_text=text, case_id="live"))
            checks = {f["check"] for f in r["ledger"]["findings"]}
            assert "dossier_reuse" not in checks, path.name
    assert not (tmp_path / "lots.jsonl").exists()


def test_a_real_submission_still_triggers_reuse_detection(tmp_path, monkeypatch):
    """The archive fix must exempt prepared clicks only — a genuine desk
    submission (someone's own pasted paperwork) presented twice is still the
    cloned-paperwork attack the archive exists to catch."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    dossier = _load("genuine_hsi")
    first = app.analyze(app.AnalyzeRequest(dossier=dossier))
    assert first["verdict"] == "GENUINE"

    second = app.analyze(app.AnalyzeRequest(dossier=dossier))
    reuse = [f for f in second["ledger"]["findings"] if f["check"] == "dossier_reuse"]
    assert reuse and reuse[0]["direction"] == "supports_suspect"
    assert second["verdict"] == "SUSPECT"
