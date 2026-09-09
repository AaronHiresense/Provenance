"""PROVENANCE — FastAPI backend. Fully offline: serves the compiled React
single-page UI from static/ (built by `npm run build` in frontend/) and
exposes the analysis pipeline.

Run:  python -m uvicorn app:app --port 8321
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import archive
import pipeline
import preflight as preflight_mod

BASE = Path(__file__).resolve().parent
CASES_DIR = BASE / "cases"
SAMPLES_DIR = BASE / "samples"

app = FastAPI(title="PROVENANCE", docs_url=None, redoc_url=None)


def _release_metadata() -> dict:
    """Public, non-secret identity for the exact source bundle being served."""
    try:
        value = json.loads((BASE / "release.json").read_text(encoding="utf-8"))
        if isinstance(value, dict):
            return {
                "source_commit": str(value.get("source_commit") or "unknown"),
                "built_at": value.get("built_at"),
                "policy_version": str(value.get("policy_version") or "legacy-v1"),
                "schema_version": str(value.get("schema_version") or "none"),
            }
    except (OSError, ValueError):
        pass
    return {"source_commit": "development", "built_at": None,
            "policy_version": "legacy-v1", "schema_version": "none"}


def _registry_status() -> tuple[bool, Optional[str]]:
    import registry
    try:
        # Query the data, rather than treating the presence of a large file as
        # readiness. This stays local and never calls the language model.
        registry._con().execute("SELECT 1 FROM companies LIMIT 1").fetchone()
        return True, registry.snapshot_date()
    except Exception:
        return False, None


def _storage_ready() -> bool:
    """Check that future operational state has a writable home, without writes."""
    target = Path(os.environ.get("PROVENANCE_STATE_DB") or
                  (Path(os.environ["RAILWAY_VOLUME_MOUNT_PATH"]) /
                   "investigations.sqlite3")
                  if os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") else
                  (BASE / ".state" / "investigations.sqlite3"))
    parent = target.parent
    return parent.is_dir() and os.access(parent, os.W_OK)


@app.get("/api/health")
def health() -> dict:
    """Process liveness only; safe even while the registry volume is empty."""
    return {"status": "ok"}


@app.get("/api/ready")
def ready() -> dict:
    registry_ok, snapshot = _registry_status()
    storage_ok = _storage_ready()
    if not registry_ok or not storage_ok:
        raise HTTPException(503, detail={
            "status": "not_ready", "registry": registry_ok,
            "storage": storage_ok,
        })
    return {"status": "ready", "registry": True, "storage": True,
            "registry_snapshot": snapshot}


@app.get("/api/runtime")
def runtime() -> dict:
    """Capabilities and provenance, deliberately excluding keys and paths."""
    import registry
    from llm import LLMClient
    client = LLMClient()
    registry_ok, snapshot = _registry_status()
    release = _release_metadata()
    return {
        **release,
        "processing": {
            "provider": client.provider,
            "model": None if client.provider == "mock" else client.model,
            "external_model": client.provider != "mock",
        },
        "registry": {"available": registry_ok, "snapshot": snapshot},
        "capabilities": {
            "streaming_analysis": True,
            "preflight": True,
            "persistent_desk_memory": _storage_ready(),
            "pdf_or_image_intake": False,
            "independent_origin_records": False,
        },
    }

# Hashed JS/CSS/font bundles emitted by the frontend build. Guarded so the API
# still starts on a clone that has not built the UI yet.
_ASSETS = BASE / "static" / "assets"
if _ASSETS.is_dir():
    app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")

# The sample paperwork is part of the demonstration, not just a repo artefact:
# a reviewer has to be able to feed the system documents by hand to see that the
# prepared lots are not canned replays. Served read-only so the files are
# reachable from the hosted UI, not only from a clone.
if SAMPLES_DIR.is_dir():
    app.mount("/samples", StaticFiles(directory=SAMPLES_DIR), name="samples")


@app.on_event("startup")
def _banner() -> None:
    """Operator visibility: exactly which brain and which data are live."""
    import registry
    from llm import LLMClient
    c = LLMClient()
    print("=" * 62)
    print("PROVENANCE")
    print(f"  LLM engine : {c.provider}"
          + (f" ({c.model})" if c.provider != "mock" else
             " (offline — cached JSON + deterministic fallbacks)"))
    # The banner is diagnostics, not a precondition: on a hosted first boot the
    # volume can still be empty (scripts/fetch_db.py deliberately exits 0 so the
    # app comes up). Report the missing registry instead of killing startup —
    # otherwise the service crash-loops and the volume can never be populated.
    try:
        print(f"  Registry   : {registry.db_path()}")
        print(f"  Snapshot   : {registry.snapshot_date()}")
    except FileNotFoundError as exc:
        print(f"  Registry   : NOT FOUND — {exc}")
        print("  Snapshot   : unavailable until the registry is in place")
    print(f"  Cases      : {len(list(CASES_DIR.glob('*.json')))} in cases/")
    print("=" * 62)


class AnalyzeRequest(BaseModel):
    case: Optional[str] = None       # filename in cases/, e.g. "suspect_velomax"
    dossier: Optional[dict] = None   # or a raw dossier pasted in the UI
    raw_text: Optional[str] = None   # or plain pasted documents ('---' separated)
    case_id: Optional[str] = None    # label for raw_text analyses
    rules_only: bool = False


@app.get("/")
def index() -> FileResponse:
    # The asset filenames are content-hashed, so they can be cached forever —
    # but this shell names them, and a cached copy of it pins a visitor to a
    # bundle that no longer exists after a redeploy. Revalidate every time:
    # it costs one conditional request and removes the whole class of "the
    # reviewer is looking at last week's UI" failures.
    return FileResponse(BASE / "static" / "index.html",
                        headers={"Cache-Control": "no-cache"})


@app.get("/api/cases")
def list_cases() -> list:
    out = []
    for p in sorted(CASES_DIR.glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError:
            continue
        expected = d.get("expected") or {}
        out.append({"file": p.stem, "case_id": d.get("case_id", p.stem),
                    "title": d.get("title", p.stem),
                    "documents": len(d.get("documents", [])),
                    # the case's own expected verdict, shown on the case grid
                    "expected": expected.get("verdict"),
                    "aliased": bool(d.get("display_aliases"))})
    return out


@app.get("/api/samples")
def list_samples() -> list:
    """Downloadable paperwork a reviewer can feed back in by hand.

    Each set in samples/combined/ is one lot already joined the way the
    composer joins an upload, so it can be dropped straight into Paperwork
    mode. The expected verdict is carried in the folder name (the naming
    convention samples/README.md documents), which keeps this endpoint from
    having to parse that README's table.
    """
    combined = SAMPLES_DIR / "combined"
    if not combined.is_dir():
        return []
    # Words the folder names spell lowercase that should not be shown that way.
    caps = {"hsi": "HSI", "llp": "LLP", "bis": "BIS", "gst": "GST",
            "eway": "e-way", "cin": "CIN"}
    verdicts = ("genuine", "suspect", "unverifiable")
    out = []
    for p in sorted(combined.glob("*.txt")):
        # e.g. "03-suspect-teleporting-consignment" -> SUSPECT, "Teleporting
        # consignment". The verdict is dropped from the label because the UI
        # already shows it beside the name; repeating it reads as a stutter.
        parts = [s for s in p.stem.split("-") if not s.isdigit()]
        verdict = next((s.upper() for s in parts if s in verdicts), None)
        words = [caps.get(s, s) for s in parts if s not in verdicts]
        label = " ".join(words)
        if label and label[0].islower() and words[0] not in caps.values():
            label = label[0].upper() + label[1:]
        out.append({"file": p.name,
                    "url": f"/samples/combined/{p.name}",
                    "label": label or p.stem,
                    "expected": verdict,
                    "bytes": p.stat().st_size})
    return out


@app.get("/api/cases/{name}")
def get_case(name: str) -> dict:
    path = CASES_DIR / f"{Path(name).name}.json"
    if not path.exists():
        raise HTTPException(404, f"unknown case '{name}'")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def _dossier_from_request(req: AnalyzeRequest) -> dict:
    if req.raw_text is not None:
        if len(req.raw_text) > 200_000:
            raise HTTPException(422, "raw_text too large (200KB max)")
        dossier = pipeline.dossier_from_raw_text(
            req.raw_text, req.case_id or "live-case")
    elif req.dossier is not None:
        dossier = req.dossier
    elif req.case:
        dossier = get_case(req.case)
    else:
        raise HTTPException(422, "provide 'case', 'dossier', or 'raw_text'")
    if not isinstance(dossier.get("documents"), list):
        raise HTTPException(422, "dossier must contain a 'documents' list")
    return dossier


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    return pipeline.analyze(_dossier_from_request(req),
                            rules_only=req.rules_only, archive_run=True)


@app.get("/api/archive")
def archive_stats() -> dict:
    """What this desk remembers: how many dossiers it has screened, and how
    many distinct lot codes. The seen-lots archive is the only thing that can
    catch a reused dossier, so its size is part of the system's state."""
    return archive.stats()


@app.delete("/api/archive")
def archive_clear() -> dict:
    """Forget every screened dossier. Exposed because desk memory changes what
    the next verdict says: a rehearsal, a demo, or a test run should be able to
    start from a clean archive rather than flag its own earlier runs."""
    path = archive.archive_path()
    try:
        if os.path.exists(path):
            os.remove(path)
        return {"cleared": True, **archive.stats()}
    except OSError as exc:
        return {"cleared": False, "error": str(exc), **archive.stats()}


@app.post("/api/preflight")
def preflight(req: AnalyzeRequest) -> dict:
    """What the agent understands before it runs: documents recognised,
    fields read offline, the registry record for the CIN, and which checks
    the dossier can support. No LLM call, so it is safe to call on every
    edit of the paste box."""
    return preflight_mod.preflight(_dossier_from_request(req))


@app.post("/api/analyze/stream")
def analyze_stream(req: AnalyzeRequest) -> StreamingResponse:
    """Same pipeline, but one newline-delimited JSON event per stage
    transition so the UI can show each agent's real progress. The last line
    carries the full result exactly as /api/analyze would return it."""
    dossier = _dossier_from_request(req)

    def lines():
        for event in pipeline.analyze_events(dossier, rules_only=req.rules_only,
                                            archive_run=True):
            yield json.dumps(event, default=str) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})
