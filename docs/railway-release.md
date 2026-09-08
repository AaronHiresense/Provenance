# Railway release and recovery runbook

Read this for every implementation milestone. A Git push and a live Railway release are separate operations in the verified current setup. A milestone is complete only after both are verified.

## Verified target — 8 September 2026

| Item | Value |
|---|---|
| Git remote | `https://github.com/AaronHiresense/Provenance.git` |
| Base branch | `main` |
| Initial local and remote main | `1e84f3b8b1b63279b0ceecd0ce9fe77e4673e033` |
| Railway project | `6b7e727c-b4d0-4ca5-991b-12634e353984` (`provenance`) |
| Environment | `1f2ef59c-2ee0-43a3-ba3a-358eb5b91c87` (`production`) |
| Service | `18bf1cef-e8c9-43e7-976e-410d55369437` (`provenance`) |
| Volume | `c321ec51-f85e-46f8-941f-31b92bcb8639`, mounted at `/data` |
| Registry path | `/data/mca.duckdb` |
| Live URL | https://provenance-production-8afd.up.railway.app |
| Initial active deployment | `77a13bb6-65c7-425e-8b0f-1b29bbeb6a6f`, SUCCESS, instance RUNNING |
| Builder | Dockerfile; existing Python runtime serves committed `static/` |
| Source connection | `repo: null`, `image: null`; current release was uploaded through CLI |
| Initial readiness check | Not configured |
| Initial replicas | One |

Live HTTP `/` returned 200 and `/api/cases` returned 15 cases. Live JS/CSS names matched local `static/index.html`: `index-GQ58jgFt.js`, `index-Dh7fMfLR.css`. This confirms matching frontend names, not the entire backend source revision. Source-commit provenance must be added in M0.

Railway CLI 5.6.2 was available. Authentication initially appeared Unauthorized inside the filesystem sandbox; the same read-only commands succeeded with approved elevated access to the existing local login. Reuse authorized local credentials; do not request new keys simply because sandboxed reads fail. GitHub CLI `gh` was not installed during planning.

## Release sequence

1. Read `implementation-status.md`, `git status --short`, current branch, remote main and Railway context. Preserve user changes. Work on a `codex/` feature branch. Fetch and integrate the current base before committing. Stop to resolve actual conflicts, not routine branch setup.
2. Implement one complete milestone and its acceptance tests. Rebuild the React source into `static/` for frontend changes; stage the emitted assets and index together. Review the diff and all intended files. Exclude `.env`, keys, MCA DB, operational state, original uploads and temporary outputs.
3. Run the relevant tests, full offline test/eval gates and frontend build. Use a new workspace pytest `--basetemp` when Windows system-temp permissions fail; disable pytest cache if existing cache permissions fail. Existing eval baseline: 110 tests, 15 cases; new policy may intentionally change counts/outcomes and must document why. Live-model eval is a separate labeled check.
4. Record the successful checks and release candidate in `implementation-status.md`. Commit intended paths explicitly. Push the branch and verify the remote commit. Integrate to main with a normal fast-forward or reviewed merge according to repo permissions; never force-push. Verify remote main before claiming it was updated. A feature-branch backup alone is not a completed main release.
5. Build a staging directory from the exact tracked source commit (e.g. Git archive), then generate a small release manifest containing that commit, build time and schema/policy versions. Staging prevents the current Dockerfile's `COPY . .` from including local scratch files. Verify `.dockerignore` and upload inventory. Do not upload the registry; it already exists on the volume.
6. Upload the candidate using the existing service and explicit project/environment/service IDs. Include the source commit in the deployment message. Current CLI supports `railway up --project <project> --environment <environment> --service <service> --detach -m <message>`; confirm `--help` before scripting flags. Upload new source with `up`; `restart` or ordinary `redeploy` does not upload local edits.
7. Follow that deployment ID to SUCCESS using bounded status/log checks. On failure, inspect its build/runtime logs, fix or roll back, and record the outcome. An upload URL is not proof of successful deployment.
8. Verify live `/api/runtime` reports the candidate source commit and expected schema/policy version. Check liveness, readiness, cases, a known-CIN preflight and all referenced hashed assets. Run the three demo cases in a dedicated isolated session; compare verdicts, citations and mode with local results. Verify a refresh and document-reassessment path in the actual browser. OCR releases also require one real upload/report check in the live container.
9. Verify the persistence fixture exists after a service restart/redeployment in the release that adds state. Preserve its session cookie securely outside Git. Check no production archive reset occurred.
10. Append the deployment ID, URL, revision, smoke outcomes and previous known-good deployment to the status file. Commit/push this documentation update; it needs no application redeploy. The running application commit may precede the status-only commit, and that relationship must be stated clearly.

Use the Railway skill's telemetry variables for all commands. In PowerShell, set `RAILWAY_CALLER` to `skill:use-railway@1.2.1` and `RAILWAY_AGENT_SESSION` to one stable ID per user request. Pass explicit target IDs. Show only an allowlist of safe metadata; never print all environment variables or model keys.

## Git-triggered deployment decision

Use explicit verified CLI uploads for the milestones by default; this works with the existing service and requires no new secret. Automate the sequence with a local release script in M0 so pushing without deploying cannot be mistaken for completion. GitHub source linkage or a CI deploy workflow may be added later if appropriate access exists, but only after verifying repository installation, branch, build source, tests and volume behavior. Once enabled, use one deployment path to avoid duplicate competing releases.

## Persistence and rollback

- Registry: preserve the existing DuckDB volume/file. Do not rebuild, replace or download over it during ordinary releases.
- Before the first state migration, back up existing archive data. Before later migrations, use the SQLite backup API and copy/upload metadata consistently to a private backup location on the volume. Backup version and timestamp belong in the release record; evidence contents and secrets do not.
- Make initial schema migrations additive. New code must read the old schema through the migration path; old code should tolerate new unused tables/columns. If a migration cannot be backward compatible, document a restore/forward-fix procedure before deploying it.
- Keep the previous known-good deployment ID and source commit. On failed readiness or wrong behavior, restore the previous application release using the supported Railway deployment rollback operation (verify CLI/help or dashboard capability when needed), or upload its exact tracked source commit. Verify `/api/runtime` and the existing stored case afterward.
- Application rollback does not automatically roll back the volume. Restore a data backup only when required and with explicit impact accounting; routine code rollback must preserve newer case records.
- Never delete the service, volume or global archive to get a clean demo. Use a fresh isolated session or session-scoped fixture reset.
- Do not claim zero downtime: the volume-backed single-instance service may briefly interrupt requests. Persist drafts/revisions and recover interrupted analyses.

## Evidence to record per release

`milestone`, source commit, remote branch/main commit, actual mode, reference-pack/policy/schema versions, tests/build/eval results, migration/backup identifier, Railway deployment ID and status, live runtime revision, browser/smoke checks, rollback deployment, unresolved limitations.

If a release is blocked, save and push completed source/docs, mark the milestone `implemented` or `verified locally` rather than `live`, and name the exact external blocker. Never let the next model infer deployment success from a previous Git push.
