# PROVENANCE

Counterfeit auto-parts **documents & records** investigator. Reads a dossier
of supply-chain documents (certificates, invoices, dispatch notes), checks
every claim against India's MCA company registry (3.67M companies, DuckDB)
and a battery of deterministic validators, then reasons to exactly one
verdict: **GENUINE · SUSPECT · UNVERIFIABLE**.

Fully offline. Python 3.14 · FastAPI · DuckDB · vanilla HTML/JS.

## Quick start

```bash
# 1. dependencies (Python 3.11+; developed on 3.14)
python -m pip install -r requirements.txt

# 2. build the registry database — one-time, see "Data setup" below
python scripts/build_db.py "path/to/mca_company_master_data.csv"

# 3. run
python -m uvicorn app:app --port 8321
# open http://localhost:8321
```

Tests (offline, no key needed): `python -m pytest tests/ -q` · 63 passing.

## Data setup — where the registry comes from

The app needs `mca.duckdb` (~1.5 GB), which is **not in git**. It is built
from one public dataset in ~1 minute:

1. **Download the CSV**: go to **data.gov.in**, search
   **"Company Master Data"** (published by the Ministry of Corporate
   Affairs). Download the full national CSV — ~1.05 GB, ~3.67M companies
   (development snapshot: 2026-07-22). A free data.gov.in account/API key is
   required for the download. *(Why not the MCA portal directly? mca.gov.in
   lookups are captcha-gated; the bulk CSV is the reliable, automatable
   route — and it's what lets the whole demo run offline.)*

2. **Build the database**:

```bash
python scripts/build_db.py "C:\path\to\mca_company_master_data_2026-07-22.csv"
```

   This creates `mca.duckdb` in the project root with two tables:

   - **`companies`** — cleaned & typed: names uppercased, states lowercased,
     capitals cast to numbers, and registration dates outside 1850..today set
     to NULL (the raw registry ships ~3,132 rows with impossible dates like
     year 1111; we treat those as "date unknown" rather than trusting or
     rejecting them). Indexed on `cin` and `name`.
   - **`gst_state`** — GSTIN 2-digit state codes → state names. Historical
     spellings (orissa, pondicherry, chattisgarh, jammu & kashmir, the merged
     Dadra/Daman UT) are handled by the alias map in `registry.py`.

3. **Database discovery**: `registry.py` looks for the DB in this order —
   the `PROVENANCE_DB` env var → `mca.duckdb` in the project root →
   `mca.duckdb` in the parent folder. No configuration needed if you used
   the default build location.

Sanity check after building:

```bash
python -c "import duckdb; print(duckdb.connect('mca.duckdb', read_only=True).execute('SELECT count(*) FROM companies').fetchone())"
```

Expected: `(3674314,)` (exact count varies with the snapshot date).

## Architecture — 5 stages

| Stage | Module | What it does |
|---|---|---|
| 1 Extract | `extract.py` | LLM turns documents into typed assertions `{entity, attribute, value, source_doc, date}`. Document text is **data, never instructions** — instruction-like content is stripped and flagged. |
| 2 Validate | `validators.py` | Pure deterministic checks: GSTIN checksum/state/embedded-PAN, CIN decode & registry cross-check, temporal sanity (cert vs incorporation, ship vs mfg), NIC manufacturing vs trading, BIS stub, TAC validity, lot-code grammar, cross-document field drift. |
| 3 Ledger | `ledger.py` | Every Finding carries direction, strength, source tier (authoritative → heuristic) and dimension (identity/certification/provenance/custody). |
| 4 Reason | `reason.py` | LLM generates benign vs malicious explanations per contradiction; authoritative tier beats any number of heuristics, tiers are never averaged, reasoning spans dimensions. |
| 5 Verdict | `verdict.py` | One verdict; UNVERIFIABLE names its subtype, the single decisive missing artefact and an interim action. Includes per-level actions (OEM/distributor/service) and a "what this system cannot determine" block. |

## LLM

Copy `.env.example` to `.env` and uncomment one option (values in `.env`
deliberately win over ambient environment variables), then restart the
server. Three provider modes:

- **Anthropic-compatible**: set `ANTHROPIC_API_KEY` (+ optionally
  `ANTHROPIC_BASE_URL` for compatible endpoints such as DeepSeek's
  `https://api.deepseek.com/anthropic`) and `PROVENANCE_LLM_MODEL`.
  Requires `pip install anthropic`.
- **OpenAI-compatible**: set `PROVENANCE_LLM_BASE_URL`,
  `PROVENANCE_LLM_API_KEY`, `PROVENANCE_LLM_MODEL`. No extra SDK needed.
- **No key → mock mode** (the default): cached JSON from `mocks/` plus
  deterministic fallbacks (label-parser extraction, template reasoner), so
  the entire pipeline, UI, tests and eval run with no key and no network.
- Force a provider with `PROVENANCE_LLM_PROVIDER=mock|anthropic|openai_compat`.

## UI

Select a bundled case or paste a brand-new dossier JSON (live jury testing),
optionally flip **rules-only** to skip stage 4. The ledger fills in row by
row, followed by the verdict card, reasoning trace, injection warnings, and
the Known Limits panel.

## Calibration

`python eval.py` runs every case against its expected verdict and reports
the abstention rate and accuracy-when-committed (add `--live` for the real
LLM, `--rules-only` to skip stage 4).

**What the numbers are — and aren't.** The 12-case pack is our *adversarial
regression suite*: self-authored, deliberately loaded with abstention
demonstrations and near-miss traps (a typo'd lot code that must NOT flag, an
injection dossier, a merger where the scary reading is wrong). 12/12 exact
(verdict + subtype), 33% abstention, 100% accuracy-when-committed shows the
pipeline matches its stated policy precisely — it is a design-verification
claim, not a field-accuracy claim (no labeled corpus of counterfeit
dossiers exists; that absence is part of this problem). Rules-only mode
scores 11/12: the one divergence is the merged-supplier case, where rules
alone over-accuse — which is precisely the demo of what stage 4 adds. The
**live-LLM run scores the same 12/12** (`eval.py --live`, DeepSeek,
temperature 0), so the quoted numbers cover the exact code path that runs
on stage. The real eval is the case the jury feeds it.

## Roadmap (known, named future work)

Dossier-hash / lot-reuse registry (the cloned-genuine-paperwork attack —
stated as a limit on every verdict today) · live BIS + GSTN lookups where
connectivity exists · multi-party dossier verification · nightly registry
sync · OCR/image ingestion. See `docs/business-note.md`.

## Written deliverables

- `docs/architecture-note.md` — the one-page architecture note.
- `docs/synthetic-data-note.md` — how the synthetic documents are anchored
  to real registry records, and the aliasing policy.

## Sample cases

Every case is anchored to a **real MCA registry record** (a juror checking the
registry finds exactly what we claim). Cases that portray a record as suspect
carry `display_aliases`: the pipeline runs on the real values, but company
names in everything shown on screen are replaced — CINs stay real so the
record remains independently verifiable, and findings state that a record's
attributes don't support the document's claims, never that a real company is
a counterfeiter.

- `genuine_hsi.json` — established TN manufacturer (NIC 29309); clean trail.
- `genuine_bonfiglioli.json` — second genuine anchor, with BIS + TAC.
- `genuine_norde_llp.json` — an LLP: shows the abstention behaviour (LLPIN
  decode and NIC checks abstain instead of guessing).
- `suspect_velomax.json` (aliased) — June-2026 *trading* company: certificate
  predates incorporation (dispositive), GSTIN from the wrong state, ships
  before manufacture, bad lot grammar, name drift — and a prompt-injection
  attempt that gets stripped and flagged.
- `suspect_zephyr.json` (aliased) — single-contradiction case: everything
  passes except the registry says the "manufacturer" is a 45xxx trader.
- `suspect_meridian.json` (aliased) — certificate issued by a struck-off
  company.
- `unverifiable_ghost.json` — fictional company, well-formed CIN with no
  registry record: UNVERIFIABLE(missing) naming the decisive artefact, an
  interim action, and a directional lean at low confidence.
