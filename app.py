"""PROVENANCE — FastAPI backend. Fully offline: serves the compiled React
single-page UI from static/ (built by `npm run build` in frontend/) and
exposes the analysis pipeline.

Run:  python -m uvicorn app:app --port 8321
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import pipeline
import preflight as preflight_mod

BASE = Path(__file__).resolve().parent
CASES_DIR = BASE / "cases"

app = FastAPI(title="PROVENANCE", docs_url=None, redoc_url=None)

# Hashed JS/CSS/font bundles emitted by the frontend build. Guarded so the API
# still starts on a clone that has not built the UI yet.
_ASSETS = BASE / "static" / "assets"
if _ASSETS.is_dir():
    app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")


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
    print(f"  Registry   : {registry.db_path()}")
    print(f"  Snapshot   : {registry.snapshot_date()}")
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
    return FileResponse(BASE / "static" / "index.html")


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
    return pipeline.analyze(_dossier_from_request(req), rules_only=req.rules_only)


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
        for event in pipeline.analyze_events(dossier, rules_only=req.rules_only):
            yield json.dumps(event, default=str) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})
