# Implementation status and model handoff

Last planning update: 8 September 2026.

## Read first

The user asked Astra to understand the existing app, create the complete improvement plan, preserve it, and then hand implementation to a lower-cost model. They have time and want completed improvements pushed to Git and deployed to the existing live Railway app. They asked to switch models before application implementation begins. This turn prepares and remotely saves the plan; it does not implement the milestones.

Read in this order:

1. Repository `AGENTS.md` — existing architecture invariants.
2. `docs/implementation-plan.md` — objective, ordered milestones and done conditions.
3. `docs/implementation-contracts.md` — evidence, persistence, API, policy and required tests.
4. `docs/railway-release.md` — verified deployment target, release gates and recovery.

`docs/hackathon-assessment.md` is the earlier assessment; the three implementation documents above supersede its rough sequencing and estimates. The user supplied the full Challenge 07 brief in the conversation. The required behaviors are captured in the plan; do not rely on conversation memory to fill architectural gaps.

## Current baseline

- Repository: `D:\Work_Folders\Provenance`, remote `AaronHiresense/Provenance`.
- Baseline application revision: `1e84f3b8b1b63279b0ceecd0ce9fe77e4673e033`; matched remote main during planning.
- Test result: 110 passed. Successful command used `python -m pytest tests/ -q -p no:cacheprovider --basetemp=.test-tmp-hackathon-assessment-20260908`. That directory is disposable test output, not application data; do not commit/upload it.
- Offline eval: 15/15 exact verdict/subtype, 4 abstentions. Live-model eval was not rerun.
- Live URL returned HTTP 200; 15 cases; frontend bundle names matched local source-built static files. No browser interaction test was performed in planning.
- Railway production deployment `77a13bb6-65c7-425e-8b0f-1b29bbeb6a6f` was SUCCESS/RUNNING; `/data` volume READY. Model name configured as `deepseek-chat`; actual provider/fallback must be checked per result, not inferred solely from the model variable.
- Railway is CLI-uploaded, with no Git repo source currently attached. A Git push does not trigger deployment in this verified configuration.
- No application code, database data, infrastructure configuration or live deployment was changed during planning.

## Milestone ledger

| Milestone | Status | Source commit | Railway deployment | Verification |
|---|---|---|---|---|
| Planning/handoff | Committed and pushed to `codex/hackathon-plan` | `7d4e5c3` | Not an application release | Documentation consistency review; Git push succeeded |
| M0 Release/readiness | Live verified | `7d7b6b8` | `4c6ef526-0a74-4a2b-9cb0-ada0008f393f` | 114 tests; build; eval 15/15; live health/ready/runtime/cases; healthcheck configured |
| M1 Evidence honesty | Live verified | `aa97a43` | `3d105938-acc6-4720-8a9e-f3321eb030f8` | 114 tests; frontend build; eval 15/15; live health/ready/runtime/cases and exact source commit |
| M2 Entities/references | Live verified | `d0e1a80` | `256b0b51-c7f3-43a0-bfeb-55837abc4fd4` | 121 tests; frontend build; eval 21/21; live source identity and reference provenance |
| M3 Origin reconciliation | Verified locally; pending Git/Railway | pending | — | 128 tests; frontend build; eval 21/21 |
| M4 Durable investigations | Not started | — | — | — |
| M5 Evidence/reassessment UI | Not started | — | — | — |
| M6 PDF/OCR/export | Not started | — | — | — |
| M7 Evaluation/demo | Not started | — | — | — |

Update each row only with observed evidence. Use `in progress`, `implemented`, `verified locally`, `pushed`, `live verified`, or `blocked: reason`; never mark deployment complete after upload alone. Append a concise release record for each milestone, including any design deviations.

Planning source and handoff were remotely saved in commit `7d4e5c3` on
`codex/hackathon-plan`. A follow-up documentation commit records this evidence.
Check remote `main` on resumption: normal fast-forward integration is the final
planning step. No application deployment is needed for these Markdown changes;
the live baseline remains the deployment recorded above. Temporary test output
created during assessment was removed after verifying its exact workspace path.

## First implementation action

Begin M0. Inspect the current branch and remote state, create/use an implementation feature branch from the plan-containing base, and add runtime/readiness metadata and a reproducible release path. The following milestones depend on being able to identify exactly what is live.

### M0 work record — 9 September 2026

Added public liveness, readiness and safe runtime provenance endpoints; added
tracked-file Railway release staging and non-mutating live smoke tooling; and
excluded operational state, uploads, backups, release metadata and test scratch
data from source/container uploads. Local verification passed: 114 tests,
frontend typecheck/build, and 15/15 offline evaluation. Source commit and live
deployment fields remain pending until observed after commit and release.

Release evidence: the first M0 upload exposed that ignored `release.json` was
omitted and correctly failed the source-identity smoke check. Commit `7d7b6b8`
renamed the generated manifest; deployment `7ee5d621-2e69-449d-8fb1-2523b38f7cdb`
then passed the exact live-commit smoke check. Railway's deployment healthcheck
was configured to `/api/ready`, producing healthcheck-gated deployment
`4c6ef526-0a74-4a2b-9cb0-ada0008f393f`, which reached SUCCESS and passed live
health, readiness, runtime-commit and cases checks. Previous known-good release:
`7ee5d621-2e69-449d-8fb1-2523b38f7cdb` (same image/source).

### M1 work record — 9 September 2026

Verdict payloads now include deterministic documentary confidence and
per-dimension status derived from the ledger. The UI reads those values instead
of deriving BIS/custody claims from the overall verdict. GENUINE and desk-action
language now preserves human and physical controls; hosted model data flow is
stated honestly. E-way validity is treated as a moderate record-consistency
signal rather than truck-speed proof, and company-status, NIC and HSN text no
longer asserts intent beyond the evidence. Local verification passed: 114 tests,
frontend typecheck/build and 15/15 offline evaluation. Source and deployment
Release `aa97a43` was pushed to `main` and deployed as
`3d105938-acc6-4720-8a9e-f3321eb030f8`. Railway reported SUCCESS with a running
instance and the `/api/ready` healthcheck. The live smoke suite passed health,
readiness, runtime identity for the full commit, and cases checks.

### M2 work record — 9 September 2026

Added additive evidence contracts for stable assertions/findings, verified
source spans, document hashes, separate entities and role participations, and
typed shipment relationships. Added a server-selected, immutable `demo-v1`
reference snapshot whose synthetic provenance and limited coverage are exposed
with every matching analysis; submitted reference versions, source tiers and
independent records are ignored. Added six HSI fixtures covering a supported
late distributor, a lot substitution, missing dispatch coverage, split
shipments, a corrected document and a later dispatch reference. The final
verdict policy is deliberately unchanged until M3: therefore the substitution
and missing-dispatch fixtures retain the legacy GENUINE expectation in M2, and
M3 must change them when independent reconciliation becomes decisive. The
corrected and reassessment inputs retain their original documents and currently
abstain as insufficient. Until M4 introduces owned sessions and immutable saved
results, matching records are returned only inside the current analysis or
preflight response; there is no reference-store listing or mutation route.
Local verification passed: 121 tests, frontend typecheck/build and 21/21 offline
evaluation. Commit `d0e1a80` was pushed to `main` and Railway deployment
`256b0b51-c7f3-43a0-bfeb-55837abc4fd4` reached SUCCESS. Live smoke checks
matched the full source commit and passed health, readiness and cases; runtime
reported reference version `demo-v1`, provenance `synthetic_demo`, and the
independent-origin capability available.

### M3 work record — 9 September 2026

Added six pure origin/custody checks for exact dispatch lot and part,
shipment parties, scoped distributor authorization, custody order, deduplicated
same-unit quantity allocation, and conflicts between independent records.
Cross-document drift is now scoped by entity and shipment, so two legitimate
allocations of one lot do not contradict each other. A single pure policy gate
now requires grounded manufacturer identity, an exact independent dispatch
anchor, linked custody and no governing conflict for GENUINE; counterfactuals
call the same gate. Findings cite both verified submitted spans and synthetic
record IDs, expose reason codes and reference version, and missing coverage
produces a specific work order rather than an accusation. The paired fixture
expectations changed as planned: the wrong linked lot is SUSPECT, the absent
dispatch is UNVERIFIABLE/insufficient, and a later exact dispatch reference is
GENUINE. Synthetic anchors for the existing prepared clean cases are explicit
in `demo-v1` and cap confidence at medium. Local verification passed: 128
tests, frontend typecheck/build, and 21/21 offline evaluation. Source and
deployment remain pending until observed.

There is no need to ask again whether to implement, commit, push or deploy ordinary milestone changes: the user already requested those actions. Preserve existing data, keep irreversible changes separate, and report concrete blockers. Never request users to paste secrets into this document.

## Resume prompt

> Implement the saved Challenge 07 plan. Read AGENTS.md and docs/implementation-status.md first, then the linked implementation contracts and Railway runbook. Start at the first unfinished milestone, preserve the five-stage offline architecture, and complete its tests, frontend build when needed, Git push, Railway deployment and live verification. Update the status document with source commits, deployment IDs, verification and remaining work after each milestone. Continue through the plan; do not treat a Git push as a live deployment. Do not lose or overwrite existing case data.

## Open assumptions to verify during implementation

- No enterprise user accounts are required for this hackathon; isolated persistent demo sessions are the chosen scope.
- Synthetic independent records are acceptable for demonstration when explicitly labeled; real OEM/carrier data integration is not claimed.
- OCR language starts with English paperwork; mixed-language support should be called out if encountered, not silently guessed.
- Existing prepared-case expectations are regression policy, not immutable ground truth; justify changes where stronger origin requirements expose gaps.
- A public internet UI requires honest hosted/model mode labeling and scoped data access before persistent uploads are enabled.
