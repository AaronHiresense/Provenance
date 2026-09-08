# Challenge 07 implementation plan

Status: ready for implementation after the user's model switch. Planning only completed on 8 September 2026. Read `implementation-status.md` first on resumption. Contracts live in `implementation-contracts.md`; live release procedure lives in `railway-release.md`.

## Objective and acceptance bar

Deliver a documents-and-records investigator that reconciles a specific component lot with independently held sourcing and shipment records, distinguishes legitimate changes from substitution, cites the exact conflict, states confidence, and resolves missing evidence through a versioned investigation. Preserve offline operation and the five pipeline stages in AGENTS.md.

The user has authorized implementation and pushing/deploying completed work to the existing Railway service, but explicitly requested this planning turn before switching models. Begin application changes only after that switch/continuation. The plan is the durable handoff; update its status file after every completed release or blocker.

Success means all of the following work locally and on the existing live URL:

1. A supplier with a valid identity can still receive SUSPECT because its lot conflicts with an independent dispatch record; the UI shows both records.
2. A legitimate late-added distributor reconciles through a dated, in-scope authorization and linked transfers. Name or route variation alone cannot force SUSPECT.
3. Missing independent evidence yields UNVERIFIABLE with one specific next record, not implied approval.
4. Attach that record to the same case, run a new revision, and show what changed and what still does not reconcile.
5. Reloading, duplicate requests, repeated analysis and Railway redeployment preserve case data and do not manufacture counterfeit signals.
6. PDF/image intake, review of uncertain text, cited findings, and downloadable investigation records work without runtime CDN or cloud OCR dependencies.
7. Each release has a remote Git commit, Railway deployment ID, successful smoke checks, and rollback target recorded in `implementation-status.md`.

## Scope decisions

- Keep FastAPI, React, DuckDB, the existing ledger, NDJSON stream and verdict vocabulary. Add small modules behind existing stage boundaries. No framework rewrite or new paid infrastructure is necessary.
- Use a small versioned, synthetic reference pack to demonstrate independent OEM/carrier records. Keep real MCA identity records separate and clearly labeled. Do not claim the synthetic pack is a live OEM integration.
- Add SQLite on the existing persistent volume for operational investigations and events; keep MCA DuckDB read-only. Start with one service replica and one process. A distributed database is future work.
- Model entities, consignments and events explicitly. Avoid a graph database; derive a simple chronological evidence chain from typed records.
- Keep the no-navigation briefing flow. Add evidence, revisions and attachment actions in the existing results area; maintain mobile and reduced-motion support.
- Confidence is a deterministic evidence assessment with reasons and limits, not an uncalibrated probability.
- Complete all milestones below. M0–M5 are the critical challenge path; M6 completes realistic intake; M7 supplies defensible evaluation and the final demo. Do not silently drop a milestone.

## Architecture and data flow

```text
Browser (session cookie + current draft; local preference only)
  -> intake/text/OCR review -> dossier revision -> SQLite /data/investigations.sqlite3
  -> analysis service obtains immutable revision + reference-pack version
       -> extract.py: assertions with entity/document/span provenance
       -> pipeline.py: resolve identity and read independent-record snapshot
       -> validators.py: pure checks over typed values/records
       -> ledger.py: facts, source refs, gaps, coverage
       -> reason.py: benign/malicious adjudication (external LLM only in live mode)
       -> verdict.py: policy, scope, confidence, decisive work order
       -> counterfactual.py: same policy and evidence context
  -> atomically save result + observation events -> NDJSON final result
  -> evidence view / compare revisions / human desk action / export

Read-only: MCA DuckDB; versioned reference pack; bundled fonts and assets.
Persistent writes: SQLite; private originals in /data/uploads; backup snapshots.
External calls: configured model endpoint in live mode only. No queue service.
```

Every analysis uses one immutable reference snapshot. Preflight and extraction have no archive writes. Original input survives even if parsing, a model request or persistence fails. Stream events represent actual stage work; an error ends with an explicit error event, never a fabricated result.

## Milestones, in execution order

### M0 — Reproducible releases and readiness

Files: `app.py`, `Dockerfile`, `.dockerignore`, `.gitignore`, new release/smoke helpers under `scripts/`, deployment documentation.

- Add safe `/api/health` liveness, `/api/ready` readiness and `/api/runtime` metadata. Readiness checks the registry and necessary operational storage without calling an LLM. Return no secrets or filesystem paths to public clients.
- Runtime reports source revision/build ID, actual configured processing mode, registry snapshot and capabilities. Per-result metadata reports actual fallback use separately.
- Exclude temporary tests, uploads, operational databases and backups from Git and container uploads. Keep compiled `static/` committed; the present Dockerfile does not build React.
- Add a repeatable release helper that checks a clean intended source tree, tests/builds, creates a manifest from the source revision, and uploads only a tracked-file staging copy. Define the manifest as release metadata, not a hand-edited frontend file.
- Configure Railway readiness only after testing the endpoint locally. Preserve empty-volume startup and the existing registry volume. Record deployment history and runtime revision after upload.

Done: the current app is shipped through the new procedure, live reports the expected revision, known-case preflight works, and rollback is documented. No new business policy yet.

### M1 — Evidence honesty and current policy corrections

Files: `verdict.py`, `validators.py`, `reason.py`, `frontend/src/components/VerdictCard.tsx`, `App.tsx`, `labels.ts`, related tests and pitch docs.

- Replace verdict-derived dimension badges with real finding/coverage states. BIS unavailable or a demo-table match must remain visibly distinct from live verification.
- Replace blanket offline/privacy statements with runtime mode and actual data destination. Qualify GENUINE as documentary support; make operational actions human decisions and remove automatic physical-fitment assurances.
- Add confidence for all verdicts according to the contracts. Preserve the existing UNVERIFIABLE lean separately.
- Rework e-way validity language and scope after checking current official rules: distinguish original validity from remaining validity and ordinary cargo from other categories. Missing semantics abstain. No speed/minimum-travel-time claim.
- Audit NIC, company status, dispatch state, HSN and TAC messages for unsupported leaps from mismatch to fraud. Status snapshots cannot establish status at an earlier document date; trading registration and geographic variation need role/context. Correct policy where evidence is insufficient, not only wording. Record justified changes to expected cases.
- Keep reasoning and final policy in sync. Update counterfactual context whenever decision inputs change.

Done: no badge claims a check passed merely because the verdict is green; every verdict has a bounded confidence explanation; old tests pass or expectation changes have documented evidence-based reasons. Deploy.

### M2 — Typed entities, references and three paired fixtures

Files: new `evidence.py`, `reference_store.py`, `references/demo-v1/`, `extract.py`, `ledger.py`, `preflight.py`, frontend types, cases and tests.

- Implement the contracts in `implementation-contracts.md` with additive defaults for legacy inputs. Separate entity identity from its role in a shipment. Preserve ambiguous claims instead of using the first document value globally.
- Add source references and verified text spans. Verify LLM-proposed citations against submitted text; invalid or absent spans become ungrounded claims, not reliable independent support.
- Build explicit typed relationships: OEM dispatch, distributor authorization, carrier receipt and receiving record, including lot, shipment ID, quantity/unit, parties and effective dates.
- Create three cases with the same genuine manufacturer/part: supported late distributor, recipient/lot substitution, and missing independent dispatch record. Add split-shipment, corrected-document and reanalysis fixtures alongside them.
- Serve read-only summaries/evidence only through session-scoped result references. Client JSON can never choose source tiers, insert trusted records or select arbitrary paths. Reference versions come from server configuration.

Done: fixtures parse in offline and live extraction paths, reference provenance is visible, and a forged `origin=independent` client field is rejected or ignored. Deploy additive support without prematurely changing final verdicts.

### M3 — Independent origin and custody reconciliation

Files: `validators.py`, `pipeline.py`, `preflight.py`, `reason.py`, `verdict.py`, `counterfactual.py`, `labels.ts`, tests/eval.

- Add the bounded checks in the contracts. Resolve entities by strong identifiers; fuzzy name matches create candidates, not confirmed identities.
- Run identity checks per relevant entity and custody checks per shipment. Refactor global field-drift logic so separate supplier/carrier/distributor fields are not treated as contradictions.
- Require lot-specific independent support for a new GENUINE. Identity plus consistent self-authored paperwork is insufficient. Update the legacy clean fixtures with explicit independent records where justified; document all policy/expectation changes.
- Make a valid late authorization explain only the relationship/time scope it actually covers. It cannot erase a mismatched lot, forged identifier or unrelated contradiction.
- Use a source-limited missing-record work order. Add actual reference lookup detail within the existing validate stage; preserve the five stages.
- Update `preflight.PLAN` and consumed-attribute coverage together. Counterfactual removal recomputes coverage rather than retaining a stale independent-support gate.

Done: paired cases receive correct verdicts, contradictions cite both records, missing references abstain, harmless variations remain harmless, and rules-only/full reasoning differences are accurately reported. Deploy.

### M4 — Durable investigations and correct reuse semantics

Files: new `investigations.py`, `analysis_service.py`, schema migration helper, `app.py`, `archive.py`, pipeline integration, tests; frontend API and history compatibility.

- Implement scoped sessions, immutable dossier revisions, analysis attempts, results, desk decisions and consignment observations in SQLite as specified in the contracts.
- Persist a revision before analysis; keep the model call outside write transactions. Commit result and observation effects atomically before emitting final success.
- Replace analysis-count-based reuse with distinct-shipment observations. Reanalysis of the same shipment is idempotent. Ambiguous duplicate claims request corroboration; independently conflicting allocations can create stronger findings.
- Migrate old archive entries as legacy observations of unknown shipment identity. Preserve the original archive backup; do not promote unknown identity to proof of fraud.
- Disable anonymous global archive deletion. Scope reset to the active demo session; keep operational administrative actions separate.
- Add optimistic revision checks and request idempotency. Handle multiple tabs and lost stream connections without duplicate observations or result loss.

Done: case/revision/decision survive reload and service restart; cross-session access fails; concurrent retries converge; missing storage is visible; evaluation neither reads nor writes operational state. Deploy after backup and migration verification.

### M5 — Evidence chain, reassessment and human decisions

Files: `frontend/src/App.tsx`, `history.ts`, `api.ts`, `types.ts`, `Briefing`, `SourceDocs`, `Checkpoints`, `Findings`, new evidence-chain and revision-comparison components; UI tests.

- Reopen the original case and stored result without starting a new analysis. Migrate old local history to legacy summaries where no dossier exists; label those honestly.
- Add `Attach requested document`, immutable revision creation and explicit `Reassess`. Show the actual before/after verdict, added/changed findings and unresolved gaps.
- Show a compact chronological chain with each link labeled supported, disputed or unknown. Clicking a finding opens both cited sources with exact text/page highlights. Use a simple list/timeline, not a decorative force graph.
- Surface confidence basis, independence and source freshness alongside the verdict. Place details behind expandable sections to keep the receiving-desk flow concise.
- Keep hold/release/refer/await actions human-controlled, timestamped and tied to the analyzed revision. Reassessment never silently releases a held lot. Supplier notes remain drafts.

Done: the three-case demo can be completed entirely in the UI, including an evidence-driven verdict transition, keyboard navigation and narrow-screen use. Deploy and verify in a browser.

### M6 — PDF/image intake and portable evidence reports

Files: new `ingest.py`, upload endpoints, frontend intake/review UI, export helper, Docker dependencies and upload tests.

- Accept PDF, PNG and JPEG in addition to text/JSON. Extract text-layer PDFs locally; render scanned PDF pages and images for local Tesseract OCR. Select/pin maintained dependency versions during implementation using primary documentation; ship required binaries in the image.
- Bound uploads to 10 MB/file, 20 pages/document, 10 documents/revision, 200,000 extracted characters/revision, and one OCR job at a time per process. Return clear recoverable errors for encrypted, corrupt, unsupported or oversized files. Use MIME/content checks and generated filenames.
- Retain original pages plus extraction/confirmation provenance. Review uncertain identifiers, dates, lot codes and quantities before analysis. Human transcription confirmation improves readability, not source independence.
- Return page/text spans for findings; run the existing document sanitizer on reviewed text too. Never execute PDF scripts or retrieve remote URLs embedded in documents.
- Export versioned JSON and a printable/downloadable PDF report with verdict scope, confidence, cited evidence, unresolved checks, snapshot/reference versions, analysis revision and desk decision. Apply display aliases consistently. A content hash is an integrity reference, not a digital signature or proof of authenticity.
- Store originals outside static routes on the volume, accessible only to their owning session. Test report layout and OCR inside the built container, not only on Windows.

Done: one text PDF, one scanned PDF and one image traverse review -> investigation -> cited report on Railway; low-quality input leads to correction or abstention. Deploy.

### M7 — Independent evaluation, final demo and release reconciliation

Files: `eval.py`, `mutate.py`, holdout fixtures, benchmark/report scripts, README, demo/architecture/business/test-data notes and presentation artifacts.

- Preserve a frozen baseline report and document policy-driven differences. Inspect the mutation harness oracle; ensure it scores genuine benign variations as well as harmful changes and does not count stale mock-cache replay as successful reasoning.
- Add a held-out pack with unseen names/IDs, natural prose and scanned examples. Keep it separate from development examples and mock caches. Report synthetic provenance and labeling method; do not label it field validation.
- Report false releases, unnecessary holds/accusations, abstention, exact verdict/subtype match, extraction accuracy on critical fields, citation validity and p50/p95 latency. Report denominators by subgroup and model/fallback mode.
- Verify the live-model path on fixed cases without archiving, exposing keys, or erasing production data. A model timeout must remain visible even when deterministic fallback succeeds.
- Prepare a 5-minute core demo and a 10-minute expanded version: substitution, benign distributor change, missing-record resolution, then an unseen edit. Refresh the deck and all numeric claims from the actual final reports.
- Run final production checks and record source commit, artifact identity, deployment ID, migrations, persistence verification and rollback target.

Done: all milestones are remotely saved and live, the demo can run offline, and every claim in the submission has traceable evidence or a plainly stated limitation.

## Engineering review: approved for this staged implementation

The design avoids a distributed system and preserves pure validators. Mandatory conditions are source-bound provenance, shipment-aware idempotency, immutable revisions, session isolation, grounded citations and verified releases. These conditions are part of the milestone acceptance criteria, not optional future hardening.

Primary risks: falsely equating duplicate paperwork with fraud; treating a supplier attachment as an independent record; global first-value extraction across multiple entities; stale counterfactual coverage; model-cache replay on changed inputs; OCR mistakes becoming accusations; mutable reference data changing history; volume migration or deployment losing evidence. Contracts and tests below address each.

Estimated effort: roughly 8–12 focused engineering days including deployment and testing, with the core challenge path targeted earlier. This is a planning estimate, not a deadline commitment. Narrow implementation details if needed; preserve the acceptance bar and record any scope changes explicitly.
