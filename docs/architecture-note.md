# PROVENANCE — architecture note

**Quessathon 2026 · Challenge 07 — Counterfeit Parts Verification · Team Mavericks.**
An agent that reads a part's paper trail and decides, against records we do not control,
whether the part is what its paperwork claims. One verdict — **GENUINE · SUSPECT ·
UNVERIFIABLE** — fully offline. We did not build a scenario catalogue; we built a
contradiction engine: claims are routed to checks by their **type**, never by anticipated
scenario, so an unseen case is a new combination of claims, not a missing branch.

## System flow

`dossier → 1 EXTRACT → assertions → 2 VALIDATE → findings → 3 LEDGER → 4 REASON → 5 VERDICT → verdict + work order`

| # | Stage | Kind | What it does |
|---|---|---|---|
| 1 | `extract.py` | LLM | Documents become typed assertions `{entity, attribute, value, source_doc, date}`. Document text is **data, never instructions**: instruction-like lines are stripped before the model sees them and logged as evidence. |
| 2 | `validators.py` | pure code | 25 deterministic checks against the local MCA registry: GSTIN checksum / state / PAN, CIN decode and cross-check, temporal sanity, e-way-bill validity vs distance, HSN, port/mode, BIS, TAC, lot grammar, cross-document drift, dossier reuse, and a successor lookup that goes hunting for a company no document names. |
| 3 | `ledger.py` | data | Every finding carries direction, strength (weak→dispositive), source tier (authoritative→heuristic) and dimension (identity / certification / provenance / custody). |
| 4 | `reason.py` | LLM | A benign and a malicious explanation per contradiction, resolved under fixed rules — then a second pass in which the agent attacks its own draft and may revise it. Skippable live (rules-only mode). |
| 5 | `verdict.py` | pure code | One verdict + subtype, the work order, the action for each desk, and the limits. |

**Governance floors live in code, not in the prompt:** authoritative evidence beats any number
of heuristics · tiers are never averaged · heuristics alone can never force SUSPECT · an absent
registry record is a gap, not proof. No blended score is emitted. The self-critique may move a
verdict only toward caution, and only when a non-heuristic contradiction exists — doubt
manufactured from nothing is an abstention rate, not judgement. A malformed model answer falls
back to the deterministic reasoner instead of reaching the verdict.

## Dependencies

| Dependency | What it is | If unavailable |
|---|---|---|
| **MCA registry** | 3.67M companies (data.gov.in, snapshot 2026-07-22) in a local DuckDB file, mounted from a volume | Service still boots and reports the gap; dependent checks **abstain** and the verdict degrades to UNVERIFIABLE, never to a guess |
| **LLM** (stages 1, 4) | Any Anthropic- or OpenAI-compatible endpoint (demo: DeepSeek-chat, T=0) | **Optional** — a deterministic parser and template reasoner take over; every result labels which engine ran |
| **Runtime** | Python 3.12+, FastAPI, uvicorn, duckdb — the whole of `requirements.txt` | Required. No queue, no second database, no external service |
| **Frontend** | React + Vite + TypeScript + Tailwind | **Build-time only** — the compiled bundle is committed, so a clone runs on Python alone |
| **BIS / GSTN portals** | Deliberately *not* dependencies: both are captcha-gated | Modelled as a declared local stub and surfaced as `UNVERIFIABLE (inaccessible)` |
| **Seen-lots archive** | An append-only local file of dossier fingerprints: the desk's memory, and the only thing that can see a *reused* dossier | Degrades to no finding on a read-only disk. Never consulted by a calibration run, so the offline eval stays deterministic |
| **Network** | None in the core path — no CDN, no web fonts, no live lookups | Pipeline, UI, tests and calibration all run with the cable pulled |

## Human hand-off points

1. **Briefing (in).** A person chooses what to submit — pasted paperwork, dropped files, a dossier JSON, or a bare CIN/GSTIN. Nothing is auto-ingested. Before the run, preflight reports what the agent can see, the registry row it found, the checks it will run, and which document would unlock more.
2. **Ablation.** The reviewer can switch stage 4 off and re-run the same dossier; the difference between the two answers is the model's contribution, shown rather than claimed.
3. **The verdict is a recommendation, never an action.** The system never releases, quarantines, pays or emails. It issues the move for each desk — OEM brand protection, distributor incoming-goods QA (primary), showroom / service — and a person executes it.
4. **The abstention work order.** UNVERIFIABLE names its subtype, the single decisive missing artefact, an interim action and a low-confidence lean, then **drafts** the supplier request for a human to review and send. Nothing leaves the machine.
5. **Declared limits.** Every verdict ships a case-aware *"what this system cannot determine"* block — physical part, image forensics, a cloned dossier, post-snapshot events, intent — so the human always knows what was not checked.

**Calibration.** 15/15 exact on our 15-case adversarial suite, identical on the mock and live-LLM
paths · 27% abstention · 100% accuracy when committed · rules-only 14/15, and that one divergence
is the designed demonstration of what stage 4 adds · 306 seeded mutations: 0 false GENUINEs, 0
crashes. A design-verification claim, not a field-accuracy claim.
