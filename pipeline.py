"""Glue: dossier -> extract -> validate -> ledger -> reason -> verdict."""
from __future__ import annotations

import re
from typing import Optional

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


def analyze(dossier: dict, rules_only: bool = False,
            llm: Optional[LLMClient] = None) -> dict:
    llm = llm or LLMClient()
    case_id = dossier.get("case_id", "unknown")

    # stage 1 — extraction (with injection hygiene)
    assertions, injection_flags, extraction_meta = \
        extract_assertions(dossier, llm)

    # stage 2 + 3 — deterministic validators fill the ledger
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

    # stage 4 — LLM reasoning (skipped in rules-only mode)
    reasoning = {}
    if not rules_only:
        reasoning = reason_over_ledger(led, llm, case_id=case_id)

    # stage 5 — verdict
    cin_assert = next((a for a in assertions if a.attribute == "cin"), None)
    row = registry.lookup_cin(
        validators.extract_identifier(cin_assert.value)) if cin_assert else None
    result = decide(
        led, reasoning, rules_only=rules_only,
        registry_row_found=row is not None,
        has_identifier=cin_assert is not None,
        registry_status=(row or {}).get("status"),
        n_documents=len(dossier.get("documents", [])),
    )
    result["case_id"] = case_id
    result["extraction"] = extraction_meta
    result["assertions"] = [a.to_dict() for a in assertions]
    result["injection_flags"] = injection_flags
    result["registry_row"] = row
    result["llm_provider"] = llm.provider
    result["llm_model"] = None if llm.provider == "mock" else llm.model

    # Display aliasing: cases anchored to real registry records must never
    # show a real company as a counterfeiter. The pipeline runs on real
    # values (so every registry cross-check is honest); only the response
    # the audience sees is renamed. CINs stay real so the record remains
    # independently verifiable.
    aliases = dossier.get("display_aliases") or {}
    if aliases:
        result = _apply_aliases(result, aliases)
        result["aliased"] = True
    else:
        result["aliased"] = False
    return result


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
