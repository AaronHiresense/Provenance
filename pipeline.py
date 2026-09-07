"""Glue: dossier -> extract -> validate -> ledger -> reason -> verdict.

Two entry points over the same code path:

  analyze(dossier)          -> the final result dict (tests, eval, /api/analyze)
  analyze_events(dossier)   -> a generator of stage events ending in the same
                               result, for the streaming endpoint so the UI
                               can show each agent's real progress rather
                               than a timer.
"""
from __future__ import annotations

import re
import time
from typing import Iterator, Optional

import archive
import counterfactual
import preflight
import registry
import validators
from extract import extract_assertions
from ledger import Finding
from llm import LLMClient
from reason import reason_over_ledger
from verdict import decide


def dossier_from_raw_text(text: str, case_id: str = "live-case") -> dict:
    """Wrap raw pasted document text into a dossier.

    The jury's live case arrives as documents, not our JSON — this accepts a
    plain paste. Documents are separated by a line of three or more dashes;
    a single blob becomes one document. Each document's first line is used
    as a rough type label.
    """
    import re as _re
    chunks = [c.strip() for c in _re.split(r"(?m)^\s*-{3,}\s*$", text)
              if c.strip()]
    if not chunks:
        chunks = [""]
    documents = []
    for i, chunk in enumerate(chunks, 1):
        first_line = chunk.splitlines()[0].strip() if chunk else ""
        doc_type = _re.sub(r"[^a-z0-9]+", "_", first_line.lower()).strip("_") \
            or "pasted_document"
        documents.append({
            "doc_id": f"DOC-{i}",
            "doc_type": doc_type[:40],
            "date": None,
            "text": chunk,
        })
    return {"case_id": case_id, "title": f"Live case ({len(documents)} "
            "pasted document(s))", "documents": documents}


STAGES = ("extract", "validate", "ledger", "reason", "verdict")


def analyze_events(dossier: dict, rules_only: bool = False,
                   llm: Optional[LLMClient] = None,
                   archive_run: bool = False) -> Iterator[dict]:
    """Run the pipeline, yielding one event per stage transition.

    Event shape: {"type": "stage", "stage": <name>, "status": "running" |
    "done" | "skipped", "detail": str, "ms": int, ...counts}. The last event
    is {"type": "result", "result": <the analyze() dict>}. Every event is
    passed through the case's display aliases, so nothing on the wire names
    a real company the verdict may cast doubt on.
    """
    llm = llm or LLMClient()
    case_id = dossier.get("case_id", "unknown")
    aliases = dossier.get("display_aliases") or {}

    def ev(**kw) -> dict:
        kw.setdefault("type", "stage")
        return _apply_aliases(kw, aliases) if aliases else kw

    t0 = time.perf_counter()

    def ms() -> int:
        return int((time.perf_counter() - t0) * 1000)

    # stage 1 — extraction (with injection hygiene)
    n_docs = len(dossier.get("documents", []))
    yield ev(stage="extract", status="running", ms=ms(),
             detail=f"Reading {n_docs} document{'s' if n_docs != 1 else ''}"
                    f" with the {'language model' if llm.provider != 'mock' else 'offline extractor'}")
    assertions, injection_flags, extraction_meta = \
        extract_assertions(dossier, llm)
    yield ev(stage="extract", status="done", ms=ms(),
             detail=f"{len(assertions)} typed claims read"
                    + (f" · {len(injection_flags)} instruction-like line"
                       f"{'s' if len(injection_flags) != 1 else ''} stripped"
                       if injection_flags else ""),
             claims=len(assertions), injections=len(injection_flags),
             engine=extraction_meta["engine"])

    # stage 2 + 3 — deterministic validators fill the ledger
    yield ev(stage="validate", status="running", ms=ms(),
             detail="Checking every claim against the MCA registry, GSTN "
                    "rules and the logistics tables")
    led = validators.run_all(assertions)

    # instruction-like content inside documents is itself evidence of
    # tampering with the review process
    for flag in injection_flags:
        led.add(Finding(
            assertion=f"Document {flag['source_doc']} contains no "
                      "instructions aimed at the reviewer",
            check="injection_screen", result="fail",
            direction="supports_suspect", strength="moderate",
            source_tier="heuristic", dimension="provenance",
            detail=f"Stripped instruction-like text: \"{flag['content']}\". "
                   "Genuine supply-chain documents do not address the "
                   "reviewing system.",
        ))
    # The seen-lots archive: memory across runs, and the only thing that can
    # see a reused dossier. A calibration run is not a desk submission, so it
    # neither reads nor writes (see archive.py).
    if archive_run:
        led.extend(archive.check_and_record(assertions, case_id=case_id))

    n_bad = len(led.by_direction("supports_suspect"))
    n_good = len(led.by_direction("supports_genuine"))
    yield ev(stage="validate", status="done", ms=ms(),
             detail=f"{len(led.findings)} checks ran · {n_bad} contradict "
                    f"the records · {n_good} support them",
             checks=len(led.findings), contradict=n_bad, support=n_good)

    yield ev(stage="ledger", status="running", ms=ms(),
             detail="Writing each finding with its source, strength and "
                    "dimension")
    yield ev(stage="ledger", status="done", ms=ms(),
             detail=f"{len(led.findings)} findings on the ledger · highest "
                    f"tier with signal: {led.highest_tier_with_signal() or 'none'}",
             top_tier=led.highest_tier_with_signal())

    # stage 4 — LLM reasoning (skipped in rules-only mode)
    reasoning = {}
    if rules_only:
        yield ev(stage="reason", status="skipped", ms=ms(),
                 detail="Reasoning step skipped at your request; "
                        "deterministic rules decide alone")
    else:
        yield ev(stage="reason", status="running", ms=ms(),
                 detail=f"Weighing an innocent and a forgery reading for each "
                        f"of {n_bad} contradiction{'s' if n_bad != 1 else ''}")
        reasoning = reason_over_ledger(led, llm, case_id=case_id)
        n_c = len(reasoning.get("contradictions", []))
        ch = reasoning.get("challenge") or {}
        if ch.get("revised"):
            challenge_note = (f" · challenged its own {ch.get('from')} answer "
                              "and revised to UNVERIFIABLE")
        elif ch.get("engine") == "skipped":
            challenge_note = " · already the cautious answer, nothing to revise"
        else:
            challenge_note = " · attacked its own answer, which held"
        yield ev(stage="reason", status="done", ms=ms(),
                 detail=f"{n_c} contradiction{'s' if n_c != 1 else ''} "
                        f"argued{challenge_note} · recommends "
                        f"{reasoning.get('recommended_verdict')}"
                        + (" (deterministic fallback)"
                           if reasoning.get("engine") != "llm" else ""),
                 engine=reasoning.get("engine"),
                 challenged=bool(ch), challenge_held=ch.get("held"),
                 recommended=reasoning.get("recommended_verdict"))

    # stage 5 — verdict
    yield ev(stage="verdict", status="running", ms=ms(),
             detail="Applying the governance rules: authoritative beats "
                    "heuristic, tiers are never averaged")
    cin_assert = next((a for a in assertions if a.attribute == "cin"), None)
    row = registry.lookup_cin(
        validators.extract_identifier(cin_assert.value)) if cin_assert else None
    result = decide(
        led, reasoning, rules_only=rules_only,
        registry_row_found=row is not None,
        has_identifier=cin_assert is not None,
        registry_status=(row or {}).get("status"),
        n_documents=n_docs,
    )
    # Did the self-critique survive stage 5? The reasoner may revise its own
    # draft toward caution, but the governance rules still get the last word —
    # and when they overrule the model, that is the most informative thing on
    # the page, not something to hide.
    ch = (reasoning or {}).get("challenge")
    if ch:
        if ch.get("blocked"):
            ch["outcome"] = "blocked"
        elif not ch.get("revised"):
            ch["outcome"] = "held"
        elif result["verdict"] == "UNVERIFIABLE":
            ch["outcome"] = "upheld"
        else:
            ch["outcome"] = "overridden"
            ch["override_reason"] = (
                "The governance rules kept "
                f"{result['verdict']}: strong evidence from an authoritative "
                "record is not softened because a model can imagine an "
                "innocent story for it. Only a record that explains the "
                "contradiction can do that.")

    result["case_id"] = case_id
    result["extraction"] = extraction_meta
    result["assertions"] = [a.to_dict() for a in assertions]
    result["injection_flags"] = injection_flags
    result["registry_row"] = row
    # Claims the agent read but has no checker for. Saying so is part of the
    # verdict: silence about an unrecognised claim would read as approval.
    result["unchecked_claims"] = preflight.unchecked_claims(assertions)
    # What would have to be different for the answer to be different.
    result["counterfactual"] = counterfactual.what_would_change(
        led, reasoning, rules_only=rules_only,
        registry_row_found=row is not None,
        has_identifier=cin_assert is not None,
        registry_status=(row or {}).get("status"),
        n_documents=n_docs,
    )
    result["llm_provider"] = llm.provider
    result["llm_model"] = None if llm.provider == "mock" else llm.model
    result["elapsed_ms"] = ms()

    # Display aliasing: cases anchored to real registry records must never
    # show a real company as a counterfeiter. The pipeline runs on real
    # values (so every registry cross-check is honest); only the response
    # the audience sees is renamed. CINs stay real so the record remains
    # independently verifiable.
    if aliases:
        result = _apply_aliases(result, aliases)
        result["aliased"] = True
    else:
        result["aliased"] = False

    yield ev(stage="verdict", status="done", ms=ms(),
             detail=f"{result['verdict']}"
                    + (f" · {result['subtype']}" if result.get("subtype") else ""),
             verdict=result["verdict"], subtype=result.get("subtype"))
    yield {"type": "result", "result": result}


def analyze(dossier: dict, rules_only: bool = False,
            llm: Optional[LLMClient] = None,
            archive_run: bool = False) -> dict:
    """Run the whole pipeline and return the final result dict."""
    last = None
    for last in analyze_events(dossier, rules_only=rules_only, llm=llm,
                               archive_run=archive_run):
        pass
    assert last is not None and last["type"] == "result"
    return last["result"]


def _apply_aliases(obj, aliases: dict):
    patterns = [(re.compile(re.escape(real), re.IGNORECASE), fake)
                for real, fake in
                sorted(aliases.items(), key=lambda kv: -len(kv[0]))]

    def walk(x):
        if isinstance(x, str):
            for pat, fake in patterns:
                x = pat.sub(fake, x)
            return x
        if isinstance(x, dict):
            return {k: walk(v) for k, v in x.items()}
        if isinstance(x, list):
            return [walk(v) for v in x]
        return x

    return walk(obj)
