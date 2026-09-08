# Implementation contracts and verification matrix

Companion to `implementation-plan.md`. These are proposed contracts, not claims about existing code. Use additive fields/defaults during rollout; preserve existing `/api/analyze`, `/api/preflight` and NDJSON result compatibility until the frontend migration is complete.

## Evidence and entity model

`Entity`: stable `entity_id`, optional CIN/LLPIN/GSTIN, display name. Role (`manufacturer`, `distributor`, `carrier`, `recipient`) belongs to a document/event participation; one company can have multiple roles. Match valid identifiers first, then explicit source-backed aliases. Ambiguous names remain unresolved. Never select the first CIN as the identity for every document.

`Document`: existing fields plus server-assigned `document_id`, content SHA-256, media type, original filename for display, parsed pages, source kind, received time, optional supersedes-document ID. Original bytes/text remain immutable. Revision references choose active versions; prior analyses retain prior versions. A supplier's claimed correction cannot invalidate independent evidence by itself.

`Assertion`: existing fields plus stable assertion ID, entity ID when resolved, shipment ID when grounded, and source reference. A source reference contains document/record ID, page (1-based where relevant), text offsets, verified quote and grounding state (`verified`, `unlocated`, `user_confirmed`). Check offsets/quotes against actual stored text. Invalid citations cannot establish positive independent coverage. Ambiguous identifiers produce gaps rather than guessed links.

`IndependentRecord`: record ID, kind, issuer entity, recorded/effective dates, evidence provenance, dataset/version, shipment ID, lot/part, parties, quantity/unit and optional related record IDs. Kinds: `oem_dispatch`, `distributor_authorization`, `carrier_receipt`, `goods_receipt`. Missing fields are unknown, not false. An authorization includes authorizing party, distributor, part/territory scope and valid interval; retrospective authorization requires explicit effective dates.

`ReferenceSnapshot`: immutable version, provenance label (`synthetic_demo` or documented imported source), coverage statement, as-of date, records and content hash. Absence from a partial snapshot is never a dispositive contradiction. The bundled demo pack is server-controlled; no public upload endpoint writes to this store. The missing-evidence demo may attach a document containing a dispatch reference that lets the backend retrieve a matching pre-existing independent record. Attaching a purported OEM letter alone does not turn it into trusted evidence.

`Finding`: preserve direction, strength, tier and dimension enums; add stable finding ID, related entity/shipment IDs, list of source refs, structured status (`pass`, `fail`, `abstain`, `unavailable`), reference version, and machine-readable reason code. Retain existing `result` and `source_doc` strings during migration. Reuse existing source tiers: record comparisons are generally derived; source provenance stays a separate axis. A synthetic reference is never described as a verified live authority.

Stable finding identity uses check + entity + shipment + compared claim category, not array index or result text, so revisions can compare a changed outcome. Multiple findings for the same check need distinct subject keys.

## Origin checks and policy

| Check | Comparison | Failure/gap behavior |
|---|---|---|
| `lot_matches_dispatch` | Claimed lot/part versus an exactly linked dispatch | Strong derived contradiction for an unambiguous mismatch; absent/ambiguous link is a gap |
| `shipment_parties_reconcile` | Claimed source/recipient versus independent transfers | Unsupported intermediate party is a gap; explicit conflicting recipient needs reconciliation |
| `distributor_authorization_valid` | Distributor role, part/territory and effective time | Valid scoped record supports the relationship; absent record abstains; expiry/other scope alone does not prove counterfeit goods |
| `custody_sequence_reconciles` | Dispatch/receipt chain with dated events | Unknown time zones/date-only precision cannot create impossible-order accusations |
| `quantity_allocation_reconciles` | Received quantity versus independent allocations in the same unit | Sum unique allocations once; split shipments allowed; unsupported conversion abstains; verified excess is suspect |
| `source_record_conflict` | Independent records for the same exact event/lot | Conflicting credible sources -> contradictory work order; do not select whichever supports a preferred verdict |

Comparisons use exact normalized IDs and explicit links. Preserve raw values. Use Decimal for quantities, explicit units and ISO dates/timestamps with precision metadata. No fuzzy match creates strong evidence. A legitimate distributor change only resolves the corresponding relationship discrepancy.

GENUINE requires grounded identity, an independent lot/part dispatch anchor, sufficient linked custody support for the claimed shipment, and no unresolved strong non-heuristic contradiction or decisive evidence gap. Encode the gate once in pure policy used by final verdict and counterfactuals. Derive its coverage from the provided ledger/evidence, so removing a supporting finding can remove eligibility. Preserve authoritative precedence, heuristic caps and caution-only challenge rules.

Legacy prepared genuine cases may gain explicit synthetic origin references; cases without origin coverage must change to UNVERIFIABLE/insufficient. Do not preserve a historical expected verdict by inventing evidence. Record every expected-label change and rationale.

Confidence object: `level: high|medium|low|none`, `scope: documentary_assessment`, `basis: string[]`, `limitations: string[]`, coverage by dimension, and provenance classification. No percentage.

- `none`: insufficient grounded directional evidence.
- `low`: an UNVERIFIABLE directional lean or materially ambiguous extraction/source linkage.
- `medium`: supported documentary verdict with known coverage/source limits; synthetic-reference-dependent demos are capped here.
- `high`: decisive, grounded, non-heuristic evidence with verified source provenance and no material conflicting evidence for the conclusion. Implement only criteria backed by tests; do not elevate by finding count. High confidence in a contradiction is not confidence that a physical part is counterfeit.

Dimension status: `supported|contradicted|incomplete|unavailable|not_applicable`; explain the deciding findings and source scope. Stub support retains its demo provenance visibly. Work orders have one decisive requested record, interim desk action and low-confidence lean as applicable.

## Operational persistence and API

SQLite path: `PROVENANCE_STATE_DB`, else volume `/data/investigations.sqlite3`, else local ignored state directory. Use WAL, foreign keys, busy timeout and short explicit transactions. Use the SQLite backup API for backups; copying a live main database file alone is insufficient. Deploy one process/replica until concurrency/storage design changes.

Tables: `schema_migrations`; `sessions` (hashed opaque tokens); `investigations` (owner, shipment, current revision); `documents`; `revisions` (parent, immutable input snapshot, reference version); `revision_documents`; `analysis_attempts` (idempotency key, state, result, policy/model versions); `desk_decisions`; `consignment_observations` (unique owner/shipment/event key). Store file content outside the web root using generated IDs; original user filenames are labels only.

Anonymous demo visitors receive an unguessable HttpOnly SameSite cookie, Secure in hosted mode. Check ownership on every case, document, export and mutation route; check origin for mutations. Keep demo sessions isolated; do not expose global lot history. Session cookie lifetime must cover the hackathon, e.g. 30 days, with explicit export for portability. This is a bounded demo session model, not enterprise account management. No public reference-store editing or global data-reset endpoint.

| Route | Contract |
|---|---|
| `POST /api/investigations` | Create case + revision 1; accept exactly one existing input mode; return case/revision IDs |
| `GET /api/investigations` | List owned summaries, bounded pagination |
| `GET /api/investigations/{id}` | Owned case, revision summaries, most recent saved result and desk decision |
| `GET /api/investigations/{id}/revisions/{revision}` | Immutable submitted evidence and saved analyses |
| `POST /api/investigations/{id}/revisions` | Base revision + added/replaced documents; 409 for stale base; never overwrite history |
| `POST /api/investigations/{id}/analyses/stream` | Revision ID + idempotency key + rules mode; exactly one saved result per request key |
| `GET /api/investigations/{id}/analyses/{attempt}` | Recover status/result after disconnect |
| `POST /api/investigations/{id}/decisions` | Revision/analysis ID + desk action + optional note; record human choice |
| `POST /api/documents/intake` | Session-owned upload, extracted pages and warnings; unsupported/limit errors are explicit |
| `GET /api/documents/{id}` | Owned original/text preview; no arbitrary path access |
| `GET /api/investigations/{id}/export?revision=N&format=json|pdf` | Versioned report with scoped evidence and aliases |

Final route signatures can follow existing conventions, but record deviations before using them in frontend code. Validate all input modes equally (including nested JSON), reject conflicting input modes, and set bounded text/document limits. Client fields cannot set source tier, ownership, trusted provenance, server revision numbers or final verdicts.

```text
Revision: saved -> analysis running -> completed
                               \-> failed/interrupted -> explicit retry
Completed revision -> added/replaced document -> new saved revision

Desk decision: open -> awaiting | held | referred | released
Any reassessment -> new result + prior decision retained for review
Human action -> new decision record tied to the current result
```

Use existing `quarantined` for held in persisted/frontend vocabulary where possible. Verdict and desk decision are separate state. A deployment restart marks abandoned in-progress attempts interrupted; retry uses saved input. Concurrent same-key requests return the existing attempt. Same-key/different-payload is 409. A lost connection does not roll back a completed result; a final success event is sent only after persistence succeeds.

Operational observations are committed once per distinct shipment event. Re-analysis and revisions of that shipment do not count as new shipments. Legacy observations with no shipment identity remain informational. Different shipments sharing paperwork merit a reconciliation request unless independent allocation/identity evidence establishes a conflict. Scope lot keys by issuer + part + lot. Reopening a case performs a GET, not analysis.

Evaluation accepts injected reference snapshots and an in-memory/no-op operational context. Both legacy and new eval paths must perform zero operational archive/state reads/writes. New mock fixtures must be tied to document hashes or restricted to exact fixture contents: editing a case must invalidate cached extraction/reasoning keyed only by case ID.

## Required verification matrix

| Scenario | Required result |
|---|---|
| Linked clean origin/custody chain | GENUINE with exact sources and scoped confidence |
| Same identity, wrong independent lot/part | SUSPECT citing both conflicting values |
| Late distributor with valid effective authorization | Relationship reconciles; no spurious global name-drift accusation |
| Late distributor without independent corroboration | UNVERIFIABLE and specific missing record |
| Missing record later located through attached reference | New revision; evidence-driven outcome change; old result preserved |
| Supplier invents trusted-source JSON metadata | No trust elevation |
| First CIN belongs to carrier | Manufacturer identity still resolved correctly or abstains |
| Partial reference dataset has no match | Missing evidence, not proof of nonexistent shipment |
| Two independent records conflict | UNVERIFIABLE/contradictory unless separate dispositive evidence governs |
| One lot, two valid split shipments | No counterfeit flag from lot reuse alone |
| Repeat analysis/retry/same-key concurrent request | One observation and one logical attempt |
| Same idempotency key, changed input | 409; original remains unchanged |
| Corrected invoice | Preserved original, active replacement, explicit revision comparison |
| Quantity exceeds verified allocation | Exact unit/quantity conflict; duplicates counted once |
| Ambiguous units/dates/entity | Gap, not guessed strong contradiction |
| Changed input retains prepared case ID | No stale mock extraction/reasoning replay |
| LLM invents quote/document ID | Rejected grounding; visible gap; no false support |
| Prompt injection/new phrasing | Sanitization retained; validators/policy/trust metadata cannot be overridden |
| LLM timeout/malformed output | Visible fallback metadata; deterministic policy still applies |
| Missing registry/reference store | Readiness/coverage reflects unavailable state; no invented verification |
| Stream drops after result commit | GET recovers identical saved result |
| Process restart mid-analysis | Saved revision available; interrupted attempt recoverable |
| Volume unwritable/SQLite contention | No false saved-success; bounded error/retry |
| Second session requests guessed case/export ID | 404/denied with no leaked data |
| Concurrent revision writes | One revision wins; other receives 409 |
| PDF text/scanned/image | Source spans map to actual pages after review |
| Corrupt/encrypted/oversized OCR input | Actionable bounded failure; original draft preserved |
| Alias-bearing case | No original suspect company name leaks in stream, sources, compare or exports |
| Counterfactual drops origin support | Eligibility and confidence recomputed consistently |
| Deploy new frontend/backend | Runtime revision matches; referenced assets load; old optional fields tolerated |
| Redeploy with volume | Case/revision/decision/export survive |
| Eval or preflight run | No operational state side effects |

Add backend unit/integration tests and a small frontend test setup for badge mapping, history/reopen and revision state; use browser end-to-end checks for the three demo flows, reconnect and upload. Run relevant tests during changes, then full tests/build/eval once per milestone. Do not treat passing historical tests as proof of policy correctness.
