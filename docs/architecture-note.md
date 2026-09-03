# PROVENANCE — one-page architecture note

**Challenge 07 — Counterfeit Parts Verification.** An agent that reads a
part's paper trail and decides, against records we do not control, whether
the part is what its paperwork claims.

## The design bet

We did not build a scenario catalog; we built a **contradiction engine**.
Every document is decomposed into typed assertions; every assertion is routed
to checks by its *type*, never by anticipated scenario — so the jury's unseen
case is just a new combination of claims, not a missing branch.

## Five stages

| # | Stage | Kind | What it does |
|---|-------|------|--------------|
| 1 | Extract (`extract.py`) | LLM | Documents → typed assertions {entity, attribute, value, source_doc, date}. Document text is data, never instructions: instruction-like content is stripped before the model sees it and flagged as evidence of tampering. |
| 2 | Validate (`validators.py`) | pure code | 17 deterministic checks: GSTIN checksum / state / embedded PAN, CIN decode + registry cross-check (name, state, date, status, NIC activity), temporal sanity (cert vs incorporation, ship vs mfg, receive vs ship), BIS licence, TAC validity, lot-code grammar, dispatch geography, cross-document drift. Facts are checked by code that is always right, not a model that is usually right. |
| 3 | Ledger (`ledger.py`) | data | Every finding carries **direction** (genuine/suspect/neutral), **strength** (weak→dispositive), **source tier** (authoritative→heuristic), **dimension** (identity / certification / provenance / custody). |
| 4 | Reason (`reason.py`) | LLM | For each contradiction: one benign and one malicious explanation, adjudicated under fixed rules — authoritative beats any number of heuristics; never average across tiers; reason across dimensions. |
| 5 | Verdict (`verdict.py`) | pure code | Exactly one of GENUINE · SUSPECT · UNVERIFIABLE(missing / inaccessible / contradictory / insufficient). Governance rules can override the LLM: heuristic-only anomalies cannot force SUSPECT; an absent registry record alone is a gap, not proof; identity-only evidence never certifies goods. |

## Evidence, not scores

No blended score is ever emitted. Conflicts resolve at the highest evidence
tier that speaks; the on-screen ledger shows every finding with its tier,
strength, dimension — and whether the reasoner overrode it, and why.

## Honest uncertainty

UNVERIFIABLE is a work order, not a shrug: it names the **single decisive
missing artefact** (e.g. the NCLT amalgamation order), an interim action, and
a directional lean at explicit low confidence. On our 11-case pack:
**abstention rate 36%, accuracy-when-committed 100%** (`python eval.py`).
A "what this system cannot determine" block ships with every verdict.

## Data

MCA company master data (data.gov.in, 3.67M companies) indexed locally in
DuckDB; GSTIN state-code table with historical aliases; BIS licences as a
stub table (live portal is captcha-gated — surfaced as a Known Limit, and as
the UNVERIFIABLE(inaccessible) subtype). Fully offline on stage: no wifi,
captcha, or rate-limit risk.

## Degradation & controls

- **Rules-only toggle**: run any case without stage 4 — the visible
  difference *is* the answer to "what does the LLM add over if/else".
- **LLM-down fallback**: deterministic extraction parser + template reasoner;
  the output labels which engine ran.
- **Provider-agnostic**: thin client (`llm.py`); Anthropic-compatible or
  OpenAI-compatible endpoint via `.env`, or mock.

**Per-verdict actions** are issued at three levels — OEM brand-protection,
distributor incoming-goods QA (our primary user), and showroom/service.
