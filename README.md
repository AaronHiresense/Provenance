# PROVENANCE

Counterfeit auto-parts **documents & records** investigator. Reads a dossier
of supply-chain documents (certificates, invoices, dispatch notes), checks
every claim against India's MCA company registry (3.67M companies, DuckDB)
and a battery of deterministic validators, then reasons to exactly one
verdict: **GENUINE · SUSPECT · UNVERIFIABLE**.

Fully offline. Python 3.12+ · FastAPI · DuckDB · React (Vite + TypeScript +
Tailwind, compiled into `static/` and committed, so running needs Python only).

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

Tests (offline, no key needed): `python -m pytest tests/ -q` · 128 passing.

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
| 2 Validate | `validators.py` | 25 pure deterministic checks: GSTIN checksum/state/embedded-PAN, CIN decode & registry cross-check, temporal sanity, NIC manufacturing vs trading, BIS stub, TAC validity, lot-code grammar, cross-document drift, **dossier reuse** (`archive.py`), and a **successor lookup** that searches the registry for a company no document names. |
| 3 Ledger | `ledger.py` | Every Finding carries direction, strength, source tier (authoritative → heuristic) and dimension (identity/certification/provenance/custody). |
| 4 Reason | `reason.py` | LLM generates benign vs malicious explanations per contradiction, then **attacks its own draft** and may revise it. Authoritative tier beats any number of heuristics, tiers are never averaged, reasoning spans dimensions. A challenge may move a verdict only toward caution, and only when a non-heuristic contradiction exists. |
| 5 Verdict | `verdict.py` | One verdict; UNVERIFIABLE names its subtype, the single decisive missing artefact and an interim action. Includes per-level actions (OEM/distributor/service), a "what this system cannot determine" block, an **unchecked-claims register** (what was read but not verified), and a **counterfactual** naming the findings that are load-bearing (`counterfactual.py`). |

## Desk memory — the seen-lots archive

Every other check looks for a *contradiction*. A byte-perfect copy of genuine
paperwork attached to counterfeit goods contains none, so `archive.py` keeps an
append-only file of dossier fingerprints and flags the same trail arriving
twice, or one lot code carrying two different trails.

- Location: `PROVENANCE_ARCHIVE` → the Railway volume → `./lot-archive.jsonl`
  (git-ignored). A read-only disk degrades to no finding, never an exception.
- **Recording is opt-in per run.** The API sets `archive_run=True`; `eval.py`
  and the tests do not, so a calibration run neither reads nor writes and the
  offline eval stays byte-for-byte deterministic.
- `GET /api/archive` reports what the desk remembers; `DELETE /api/archive`
  forgets it — a rehearsal that re-runs the same case would otherwise flag its
  own earlier run as reuse. The footer of the UI shows the count and offers it.

**The residual limit, stated on every verdict:** the archive catches the
*second* sighting. The first presentation of a clone still passes, and a clone
presented at a different desk is invisible until archives are shared.

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

You brief an investigator, not fill a form. One composer takes the
paperwork (pasted text, dropped files or a dossier JSON). As you paste, the
agent says what it can see: the documents, the company it found in the MCA
registry, the checks it will run and which document would unlock more. It
then runs in front of you and, after the verdict, proposes the next moves
for your desk (distributor, OEM or service), drafts the supplier request
for the one missing document, and keeps the lot on the briefing screen
until that document arrives. Supplier notes remain drafts. In hosted live-model
mode, sanitised document text is sent from the service to the configured model
provider; mock mode performs extraction and reasoning locally.

The verdict comes first: one plain sentence, the actions for each desk
(distributor, OEM, service), then the findings that decided it, strongest
first, with the reasoner's innocent and forgery readings one click away.
Every check is listed below that, grouped by what it examined, followed by
what this run could not check. Pick a bundled case from the grid, paste
document text, or paste a dossier JSON; flip **Skip the reasoning step** to
run stage 2 alone. Light and dark themes follow the OS setting.

Every run shows the agents working: the extraction agent, the validators,
the ledger, the reasoning agent and the verdict step light up in turn as the
backend streams real stage events (`/api/analyze/stream`), each with its own
measured time, before the verdict lands.

To change the UI, edit `frontend/src` and rebuild (`cd frontend && npm install
&& npm run build`); the compiled bundle in `static/` is committed so the demo
never needs Node or a network.

## Calibration

`python eval.py` runs every case against its expected verdict and reports
the abstention rate and accuracy-when-committed (add `--live` for the real
LLM, `--rules-only` to skip stage 4).

**What the numbers are — and aren't.** The 15-case pack is our *adversarial
regression suite*: self-authored, deliberately loaded with abstention
demonstrations and near-miss traps (a typo'd lot code that must NOT flag, an
injection dossier, a merger where the scary reading is wrong). 15/15 exact
(verdict + subtype), 27% abstention, 100% accuracy-when-committed shows the
pipeline matches its stated policy precisely — it is a design-verification
claim, not a field-accuracy claim (no labeled corpus of counterfeit
dossiers exists; that absence is part of this problem). Rules-only mode
scores 14/15: the one divergence is the merged-supplier case, where rules
alone over-accuse — which is precisely the demo of what stage 4 adds. The
**live-LLM run scores the same 15/15** (`eval.py --live`, DeepSeek,
temperature 0), so the quoted numbers cover the exact code path that runs
on stage. The real eval is the case the jury feeds it.

## Deploying to Railway

The image is deliberately thin: the 1.2 GB registry is **not** baked in and
**not** in git. It lives on a Railway volume, so the container mounts it
instead of downloading it on every boot.

```bash
railway init --name provenance
railway add --service provenance
railway link --project <project-id> --environment production --service provenance
railway volume add --mount-path /data          # -> RAILWAY_VOLUME_MOUNT_PATH=/data
railway domain                                 # public URL
```

Variables on the service (the key via stdin, so it never lands in shell
history or the process list):

```bash
printf '%s' "$KEY" | railway variable set ANTHROPIC_API_KEY --stdin --service provenance
railway variable set \
  ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic \
  PROVENANCE_LLM_MODEL=deepseek-chat \
  PROVENANCE_DB=/data/mca.duckdb --service provenance
```

Then deploy and push the registry onto the volume:

```bash
railway up --detach
railway volume files --volume provenance-volume upload ./mca.duckdb /mca.duckdb
railway redeploy                               # pick up the now-populated volume
```

Four things that bite, in the order they bite:

1. **`railway volume files` needs an SSH key.** Volume transfers tunnel over
   SSH into the *running* container, so an unregistered key fails the upload
   while still exiting 0. Register once with
   `railway ssh keys add --key ~/.ssh/id_ed25519.pub` (on Windows/PowerShell
   pass the full path — `~` is not expanded). Only the public half is sent.
2. **Deploy before you upload.** The volume is only reachable through a live
   deployment, so the first boot necessarily happens with an empty volume.
   That is why the startup banner reports a missing registry instead of
   raising — a crash-looping service can never be populated.
3. **`.env` must stay out of the image.** `llm.py` gives `.env` precedence
   *over* ambient environment variables, so a copied `.env` would silently
   override everything set in the Railway dashboard and make the key
   unrotatable from the UI. It is in `.dockerignore` for that reason.
4. **On Git Bash, prefix volume commands with `MSYS_NO_PATHCONV=1`**, or
   `/data` is rewritten into a Windows path and rejected.

`MCA_DB_URL` remains supported as the alternative to a volume:
`scripts/fetch_db.py` downloads the DB on first boot when the target is
absent. It costs a multi-minute boot on a cold volume and makes the file
publicly fetchable, so the volume upload above is the better default.

## Roadmap (known, named future work)

Durable session-scoped investigations and immutable revisions · live BIS +
GSTN integrations where connectivity exists · nightly registry sync ·
OCR/image ingestion. The current release already links typed parties,
shipments and lots to a versioned synthetic OEM/carrier reference snapshot;
that snapshot is a demo integration and is labeled as such in every result.
See `docs/business-note.md`.

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
