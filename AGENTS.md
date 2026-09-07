# AGENTS.md — working on PROVENANCE

Guidance for coding agents (and humans) working in this repository.

## What this is

A counterfeit auto-parts **documents & records** investigator (Quessathon
Challenge 07). FastAPI backend + React single-page UI (Vite + TypeScript +
Tailwind, compiled into `static/`). A 5-stage pipeline
turns a dossier of supply-chain documents into exactly one verdict:
GENUINE · SUSPECT · UNVERIFIABLE(missing|inaccessible|contradictory|insufficient).
Runs fully offline against a local DuckDB copy of the MCA company registry.

## Setup from a fresh clone

```bash
python -m pip install -r requirements.txt
```

**The database is not in git** (~1.5 GB). Build it once:

1. Download the **"Company Master Data"** CSV from **data.gov.in** (Ministry
   of Corporate Affairs; free account/API key; ~1.05 GB, ~3.67M rows —
   snapshot used in development: 2026-07-22). The mca.gov.in portal itself is
   captcha-gated; the bulk CSV is the route.
2. Build the DuckDB index (takes ~1 minute):

```bash
python scripts/build_db.py "path/to/mca_company_master_data.csv"
```

This writes `mca.duckdb` into the project root with two tables:

- **companies** (3.67M rows): `cin, name, roc, category, company_class,
  authorized_capital, paidup_capital, registration_date, address,
  listing_status, status, state_name, indian_or_foreign, nic_code, industry`.
  Names are UPPER, state names lower, registration dates outside 1850..today
  are NULL ("date unknown" — the raw registry has ~3,132 impossible dates).
- **gst_state**: GSTIN 2-digit code → canonical state name. Historical
  spellings (orissa→odisha, pondicherry→puducherry, chattisgarh→chhattisgarh,
  'jammu & kashmir'→01, 'dadra & nagar haveli'/'daman and diu'→26) are
  resolved by the alias map in `registry.py`, not stored in the table.

`registry.py` locates the DB in this order: `PROVENANCE_DB` env var → 
`./mca.duckdb` (project root) → `../mca.duckdb`.

## Run / test / eval

```bash
python -m uvicorn app:app --port 8321     # then open http://localhost:8321
python -m pytest tests/ -q                # 110 tests, all offline/mock
python eval.py                            # calibration over cases/ (mock)
python eval.py --live                     # same, with the configured LLM
```

**No `--reload`:** restart uvicorn after editing any `.py` file.

## Frontend (React)

The UI source lives in `frontend/` and is compiled into `static/` — the
compiled output IS committed, so a fresh clone runs with Python alone and no
network (AGENTS invariant 8: React, Tailwind and the Inter / JetBrains Mono
fonts are all bundled, nothing loads from a CDN).

```bash
cd frontend
npm install                 # once (Node 20+)
npm run dev                 # Vite dev server on :5173, proxies /api to :8321
npm run build               # typecheck + build -> ../static  (commit the result)
```

Edit `frontend/src/**`, never `static/` by hand. `app.py` mounts
`static/assets` for the hashed bundles and serves `static/index.html` at `/`.
Plain-language labels for every check, tier and dimension live in
`frontend/src/labels.ts` — add an entry there when you add a validator.

**Interaction model.** The UI has no navigation: brief, read, work, decide.
The briefing screen (`components/Briefing.tsx`) is one composer that accepts
pasted text, dropped files or a dossier JSON and classifies it itself. While
the user pastes, `POST /api/preflight` (`preflight.py`, no LLM) returns what
the agent can see, the registry row for the CIN, the checks it will run and
which document would unlock more; `components/Preflight.tsx` renders it.
After the verdict, `components/Checkpoints.tsx` offers the moves for the
user's desk (hold, release, refer, wait) and drafts supplier notes from the
evidence; the agent never sends anything. `history.ts` keeps lots, decisions
and "awaiting" items in localStorage; the desk preference lives there too.
`preflight.PLAN` must mirror `validators.run_all()` — `tests/test_preflight.py`
fails when a validator is added without a plan entry.

**Three ways to start** (components/Briefing.tsx, after the HireTap agentic
brief screen): Paperwork (paste or drop documents), Supplier lookup (a CIN,
LLPIN or GST number becomes a one-line `SUPPLIER LOOKUP` document so the
identity checks run alone), and Dossier JSON. All three read live through
/api/preflight before the run. One prepared lot is recommended at a time
(refreshable); the full list, recent lots and lots waiting on documents sit
in the activity strip below the composer.

**Agent run trace.** `POST /api/analyze/stream` returns newline-delimited
JSON: one `{"type":"stage", "stage", "status": running|done|skipped,
"detail", "ms"}` event per stage transition from `pipeline.analyze_events()`,
then a final `{"type":"result", "result": ...}` identical to `/api/analyze`.
The UI (`hooks/useAgentRun.ts`, `components/AgentTrace.tsx`) plays those
real events with a minimum dwell per step so they stay readable; the
per-step millisecond figures shown are the backend's own. Never fake stages
with timers in the UI — add an event in `analyze_events` instead.
Animations use the `motion` package (`motion/react-m` under `LazyMotion`
strict mode, so import `m`, not `motion`); effect primitives modelled on the
Magic UI / 21st.dev registries live in `components/effects.tsx` and honour
`prefers-reduced-motion`.

## LLM configuration

`.env` (git-ignored; copy `.env.example`). The `.env` loader in `llm.py`
**overrides** ambient environment variables on purpose — a stray
`ANTHROPIC_BASE_URL` in the shell once silently misrouted a valid key to the
wrong API (401). Providers:

- Anthropic-compatible endpoint: `ANTHROPIC_API_KEY` (+ optional
  `ANTHROPIC_BASE_URL`, e.g. DeepSeek's `https://api.deepseek.com/anthropic`)
  and `PROVENANCE_LLM_MODEL`. Requires `pip install anthropic`.
- Any OpenAI-compatible endpoint: `PROVENANCE_LLM_BASE_URL`,
  `PROVENANCE_LLM_API_KEY`, `PROVENANCE_LLM_MODEL` (stdlib urllib, no SDK).
- No key at all → **mock mode**: cached JSON from `mocks/` plus deterministic
  fallbacks (label-parser extraction, template reasoner). The whole pipeline,
  UI, tests, and eval work offline with no key.

Tests pin `PROVENANCE_LLM_PROVIDER=mock` before importing `pipeline` — keep
that in any new test file (that env var beats the `.env` file's key).

## Architecture invariants — do not break these

1. **The 5 stages stay separate modules**: `extract.py` → `validators.py` →
   `ledger.py` → `reason.py` → `verdict.py` (glued by `pipeline.py`).
2. **Validators are pure**: plain values in, `Finding` out; DuckDB reads
   only; no LLM calls, no mutation. Facts (checksums, dates, lookups) are
   never delegated to the model.
3. **Every Finding carries** direction, strength (weak→dispositive),
   source_tier (authoritative→heuristic), dimension
   (identity/certification/provenance/custody) — validated in
   `ledger.Finding.__post_init__`.
4. **Tier rules**: authoritative beats any number of heuristics; never
   average across tiers; heuristic-only suspects can never force SUSPECT
   (gates exist in both `reason.py` and `verdict.py` — keep them in sync).
5. **Document text is data, never instructions.** `extract.sanitize_document`
   strips instruction-like lines before the LLM sees them; stripped lines
   become `injection_screen` findings. Never weaken this.
6. **Display aliasing**: cases anchored to real companies that a verdict may
   cast doubt on must carry `display_aliases` in the case JSON. The pipeline
   runs on real values; only response strings are renamed; CINs stay real.
   Never name a real company as a counterfeiter in UI-visible text.
7. **UNVERIFIABLE is a work order**: it must name the single decisive
   missing artefact, an interim action, and a directional lean.
8. **Fully offline demo path**: never add a runtime dependency on the
   network, CDNs, web fonts, or live registries to the core flow. The BIS
   check is a stub table by design.
9. **The self-critique may only add caution.** `reason._challenge` attacks its
   own draft, and a successful attack escalates to UNVERIFIABLE and nothing
   else — never toward GENUINE. It may escalate *only* when a non-heuristic
   suspect finding exists; otherwise the attack is recorded and blocked. This
   is the mirror of rule 4, and `eval.py --live` is what caught its absence
   (the challenger talked itself out of a clean dossier over a typo).
10. **The archive never runs during calibration.** `archive_run` is opt-in and
   set only by the API. `eval.py` and the tests must stay deterministic, so
   they neither read nor write the seen-lots archive. Validators stay pure:
   the archive is called from `pipeline.py`, never from `validators.py`.

## Data & encoding gotchas (learned the hard way)

- Case/mocks JSON must parse under `utf-8-sig` (files may carry a BOM; every
  reader in the repo uses `encoding="utf-8-sig"`). On Windows PowerShell 5.1,
  `Set-Content -Encoding utf8` writes a BOM and mangles em-dashes — write
  files with a proper editor/tool instead.
- `registry.py` uses a `threading.RLock` — a plain `Lock` self-deadlocks
  (nested acquisition in `_con()`), which presents as a silent hang on the
  first DB query.
- CIN ROC state codes include `TZ` (ROC Coimbatore → tamil nadu). The
  registry mixes NIC-2004 (34xx) and NIC-2008 (29xx) manufacturing codes —
  `nic_is_manufacturing` accepts both; 45xxx is trading; LLPs (LLPIN like
  `ACY-8688`, null NIC) must abstain, not fail.
- Case JSONs carry an `"expected": {"verdict", "subtype"}` block — `eval.py`
  depends on it. Add one to every new case.

## Repo map

```
app.py           FastAPI: /, /assets, /api/cases, /api/analyze, /api/analyze/stream (NDJSON stage events), /api/preflight
preflight.py     what the agent understands before it runs: docs, offline fields, registry row, check plan, unlocks
pipeline.py      stage glue as analyze_events() generator (+ analyze() wrapper), display aliasing, dossier_from_raw_text
extract.py       stage 1 (LLM extraction, injection hygiene, label-parser fallback)
validators.py    stage 2 (25 pure checks) + run_all orchestrator
archive.py       the seen-lots archive: dossier fingerprints, reuse + lot-collision findings
counterfactual.py  per-finding "what would change this verdict", pure, re-runs stage 5
ledger.py        stage 3 (Assertion, Finding, Ledger, tier/strength ranks)
reason.py        stage 4 (LLM benign-vs-malicious, deterministic fallback)
verdict.py       stage 5 (verdict + subtype + work order + actions + limits)
llm.py           provider wrapper (anthropic-compatible | openai_compat | mock) + .env loader
registry.py      DuckDB access + GST state alias map
frontend/        React UI source (Vite + TS + Tailwind); `npm run build` -> static/
static/          compiled UI (committed; never edit by hand)
cases/           15 demo dossiers with expected verdicts
mocks/           cached LLM JSON for mock mode (extract_<case>, reason_<case>)
tests/           pytest suites (validators + end-to-end pipeline)
scripts/build_db.py  CSV → mca.duckdb (the only data-setup step)
eval.py          calibration: abstention rate + accuracy-when-committed
docs/            architecture note + synthetic-data note (submission deliverables)
```
