"""Public operational endpoints expose health without secrets or paths."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import app


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
