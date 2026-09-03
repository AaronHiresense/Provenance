"""PROVENANCE — FastAPI backend. Fully offline: serves the vanilla single-page
UI from static/ and exposes the analysis pipeline.

Run:  python -m uvicorn app:app --port 8321
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import pipeline

BASE = Path(__file__).resolve().parent
CASES_DIR = BASE / "cases"

app = FastAPI(title="PROVENANCE", docs_url=None, redoc_url=None)


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
        out.append({"file": p.stem, "case_id": d.get("case_id", p.stem),
                    "title": d.get("title", p.stem),
                    "documents": len(d.get("documents", []))})
    return out


@app.get("/api/cases/{name}")
def get_case(name: str) -> dict:
    path = CASES_DIR / f"{Path(name).name}.json"
    if not path.exists():
        raise HTTPException(404, f"unknown case '{name}'")
    return json.loads(path.read_text(encoding="utf-8-sig"))


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest) -> dict:
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
    return pipeline.analyze(dossier, rules_only=req.rules_only)
