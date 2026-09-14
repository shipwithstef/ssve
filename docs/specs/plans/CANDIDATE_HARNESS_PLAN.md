# Candidate Harness Master Architecture Specification

**Status:** CHANGE-SET-APPROVED — G4/G5 PASS (iteration 2), focused local proof PASS
**Work item:** WI-508
**Source spec:** `docs/specs/features/candidate-reservoir.md`
**Delivery tier:** full

## Intent

Provide a portable, local-first pre-WI reservoir that imports and exports a human-readable candidate pool, verifies code grounding against the current repository, ranks with the exact `/cos` composite formula, and records explicit promote/reject decisions without touching customer databases.

## Required Architecture Boundaries

1. Operational candidate state is native Node SQLite in a local SVC state directory.
2. Git stores deterministic JSON mirrors, never the operational database.
3. Every database read/write is constrained by `project_id` and `item_scope`.
4. Project identity precedence is company-link `app_id` → Git origin → workspace basename.
5. Filesystem grounding is repository-contained and read-only.
6. Promotion is a recorded boundary to a supplied WI ID, not automatic WI creation.
7. Triage events append to the framework decision ledger only after a committed state transition.

## Required Formula

```text
Composite Score =
  (0.35 * Product_Impact)
  + (0.25 * Code_Grounding)
  + (0.20 * Growth_Flywheel)
  - (0.10 * DB_Overhead)
  - (0.10 * Security_Risk)
```

`Code_Grounding` is the live `(validCount / totalCount) * 100` result. Display rounds to two decimals; ordering uses the unrounded value.

## Required Data Contract

| Field | Source | Constraint |
|---|---|---|
| `project_id` | resolver | non-blank, normalized, scoped on every row |
| `item_scope` | mirror/candidate | non-blank; candidate override must match an allowed import scope |
| `candidate_id` | mirror | `CAND-<digits>`; unique within project/scope |
| `work_type` | mirror | controlled non-blank label |
| `target_files` | mirror | array of repository-relative strings |
| `code_grounding` | mirror metadata | declares grounding intent/notes; runtime counts are derived |
| `cos_roles` | mirror | non-empty role-label array |
| `scores` | mirror | four authored 0–100 dimensions; grounding is derived |
| `status` | SQLite/mirror | `candidate`, `promoted`, or `rejected` |
| `promoted_wi` | transition | required only for promoted status |
| `rejection_reason` | transition | required only for rejected status |

A WI token is valid only when it matches `^WI-[A-Z0-9]+(?:-[A-Z0-9]+)*$`; the harness validates token shape but intentionally does not create or query a WI.

## Required Commands

```bash
node scripts/candidate-harness.mjs --file <path> --rank
node scripts/candidate-harness.mjs --file <path> --top <N>
node scripts/candidate-harness.mjs --promote <CAND_ID> --wi <WI_ID>
node scripts/candidate-harness.mjs --reject <CAND_ID> --reason "<reason>"
```

Rank/top imports the named mirror, evaluates current filesystem grounding, writes transactional local state, prints deterministic output, and refreshes the mirror. Promote/reject resolves one project/scope candidate from local state and updates its originating mirror when available.

## Failure Contract

- Usage/schema/input failures exit non-zero with one actionable stderr message.
- Invalid input never appends a triage decision.
- A conflicting terminal transition never overwrites prior status.
- SQLite contention uses bounded waiting and fails without partial import/transition.
- Mirror export is atomic; failure preserves the prior mirror.
- Missing `node:sqlite` fails clearly before state mutation.

## Security Contract

- Reject or count invalid any absolute, escaping, NUL-containing, or external-resolving target path.
- Do not follow a symlink to establish valid grounding outside the repository.
- Parse JSON as data only; never execute candidate content.
- Emit decision rows with JSON serialization, not string interpolation.
- Never inspect `.env`, credentials, or customer databases.
- Ensure a candidate from one project/scope cannot be selected by an identical ID in another.

## Verification Contract

- Pre-change exact ranking command fails with `MODULE_NOT_FOUND`.
- Focused validator covers seed schema/count, formula, precision, ties, path containment, identity fallback, import idempotency, terminal transitions, decision events, mirror atomicity, and cross-project isolation.
- Exact user top-10 command passes on the committed 50-item seed mirror.
- Aggregate Tier-1 runs before landing; promoted main replays rank/top/promote/reject with isolated temporary state.

## Architecture

The implementation is one explicit CLI module plus one focused Tier-1 validator. It uses Node's built-in SQLite API and the framework's existing atomic state-file primitives; it adds no package dependency, network path, daemon, customer database integration, or implicit WI mutation.

```text
CLI argv
   |
   v
+------------------+       +------------------+
| command parser   |------>| project resolver |
+------------------+       +------------------+
   |                          app_id -> origin -> basename
   v
+------------------+       +------------------+
| mirror validator |------>| SQLite store     |
+------------------+       | project + scope  |
   |                        +------------------+
   v                                  |
+------------------+                  v
| grounding engine |--------->+------------------+
| contained reads  |          | scoring/ranking  |
+------------------+          +------------------+
                                      |
                          +-----------+-----------+
                          v                       v
                  deterministic stdout     atomic JSON mirror

terminal command -> BEGIN IMMEDIATE -> candidate state + outbox -> COMMIT
                                      -> deduplicated JSONL append -> mirror export
```

### Components

| Component | Location | Responsibility | Change |
|---|---|---|---|
| Candidate CLI | `scripts/candidate-harness.mjs` | Parse exactly one public command, validate data, resolve identity, persist state, rank, transition, and print actionable output. | New |
| SQLite store | internal functions in the CLI | Own schema v1, scoped statements, transactions, terminal-state checks, and pending decision outbox. | New, deliberately not a premature service abstraction |
| Grounding evaluator | internal functions in the CLI | Resolve repository-relative targets without escaping the current Git root and calculate exact counts. | New |
| Mirror serializer | internal functions in the CLI using `scripts/state-io.mjs` | Emit stable key/array ordering through temp-file, fsync, and rename. | New |
| Seed pool | `docs/specs/candidates/consumer-experience-pool.json` | Provide 50 portable candidate records with real and intentionally missing grounding targets. | New |
| Focused validator | `test-framework/evals/tier-1/validate-candidate-harness.sh` | Exercise the public CLI in temporary repositories and state directories. | New |

## Project Identity

1. Discover the repository root with `git rev-parse --show-toplevel`; if unavailable, use the current working directory's real path.
2. Read `<root>/.svc/company-link.json` as JSON. A trimmed, non-empty string `app_id` wins. Invalid JSON or a non-string `app_id` is an actionable error rather than a silent identity change.
3. Otherwise read `git remote get-url origin`. Normalize SCP-like and URL remotes to a credential-free `host/path` identity, remove query/fragment/trailing slash and one `.git` suffix, lowercase the host only, and preserve path case.
4. Otherwise use the repository-root directory basename.

The executable contains no organization, user, or workspace literals. `project_id` is always bound in SQL predicates; it is never a process-global default that can broaden a query.

## Mirror Schema and Validation

The top-level object is `{ schema_version: "1.0.0", topic, project_id?, item_scope, candidates }`. The resolver is authoritative for the effective project; if a non-blank mirror `project_id` is present and differs, import fails closed. Candidate IDs match `^CAND-[0-9]{3,}$`; `work_type` and `item_scope` are trimmed non-empty labels; `target_files` is an array of unique strings; `code_grounding` is a non-null object; `cos_roles` is a non-empty unique string array; and `scores` contains only the four finite 0-100 authored dimensions.

The validator requires the input mirror to resolve to a regular file inside the repository, then parses and validates the complete mirror before opening a write transaction. Its repository-relative POSIX path is stored in `source_mirror` so terminal commands can refresh the right projection after a checkout/worktree move. Before every export, the path is re-resolved against the current real repository root and must pass lexical containment, symlink containment, and regular-file checks. Unknown fields are preserved only inside the original metadata JSON fields; imported `composite_score`, effective grounding scores/counts, and ratios are discarded. Duplicate `(item_scope, id)` pairs fail the whole import. An existing project/scope/candidate row cannot be reassigned to a different mirror: the whole import fails and its originating projection remains authoritative.

## SQLite Schema v1

The default database is `${SVC_STATE_DIR:-~/.svc}/store.db`; tests may use the explicit `SVC_CANDIDATE_DB` file override. The decision ledger defaults to `<repo>/.svc/pipeline-decisions.jsonl` and may be redirected by `SVC_CANDIDATE_DECISIONS`. Overrides must name files, not directories. Parent directories and the database are mode `0700` and `0600` where the platform supports POSIX modes.

```sql
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS candidate_schema (
  component TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  migrated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  project_id TEXT NOT NULL,
  item_scope TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  work_type TEXT NOT NULL,
  target_files_json TEXT NOT NULL,
  code_grounding_json TEXT NOT NULL,
  cos_roles_json TEXT NOT NULL,
  product_impact REAL NOT NULL CHECK(product_impact BETWEEN 0 AND 100),
  growth_flywheel REAL NOT NULL CHECK(growth_flywheel BETWEEN 0 AND 100),
  db_overhead REAL NOT NULL CHECK(db_overhead BETWEEN 0 AND 100),
  security_risk REAL NOT NULL CHECK(security_risk BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK(status IN ('candidate','promoted','rejected')),
  promoted_wi TEXT,
  rejection_reason TEXT,
  source_mirror TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(project_id, item_scope, candidate_id),
  CHECK((status='candidate' AND promoted_wi IS NULL AND rejection_reason IS NULL)
     OR (status='promoted' AND promoted_wi IS NOT NULL AND rejection_reason IS NULL)
     OR (status='rejected' AND promoted_wi IS NULL AND rejection_reason IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS candidates_lookup
  ON candidates(project_id, candidate_id, item_scope);

CREATE TABLE IF NOT EXISTS candidate_decision_outbox (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  item_scope TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('promote','reject')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  logged_at TEXT,
  FOREIGN KEY(project_id, item_scope, candidate_id)
    REFERENCES candidates(project_id, item_scope, candidate_id)
);
```

Schema initialization is an idempotent migration transaction. A stored version newer than the executable fails closed; future upgrades add explicit ordered migrations rather than dropping user data.

## Transaction and Recovery Semantics

### Import/rank

```text
read + parse + validate whole mirror
  -> BEGIN IMMEDIATE
  -> upsert candidate content within one project/scope
     (existing terminal state always wins over stale mirror state)
  -> COMMIT
  -> compute live grounding and ranking
  -> atomically export every row for that project/scope/source-mirror projection
  -> print rank rows
```

A new database may reconstruct valid terminal state from a committed mirror. Once a row exists, mirror import cannot regress or replace its terminal decision or move the row to another source mirror. Import is additive/upsert-only: it never deletes rows omitted from a mirror, cross-mirror reassignment fails transactionally, and the next export makes retained rows for that source projection visible. Deletion semantics are intentionally outside v1.

### Promote/reject

```text
resolve current project -> select by project + candidate ID
  -> require exactly one item_scope match
  -> BEGIN IMMEDIATE
  -> candidate -> requested terminal state
  -> insert deterministic event_id + payload into outbox
  -> COMMIT
  -> flush pending event to decision ledger with event_id dedupe
  -> atomically export source mirror
```

The event ID is a SHA-256 digest of schema version, project, scope, candidate, action, and terminal value. Before appending, the flusher takes the existing state-file lock and scans valid ledger rows for that event ID. A crash after append but before `logged_at` therefore heals on replay without a duplicate line. The JSONL event also uses the normal pipeline fields (`timestamp`, `run_id`, `skill`, `phase`, `type`, `decision`, `reasoning`, `decided_by`, `overrideable`) plus candidate-specific fields. The three-storage-layer handoff is specified in `docs/specs/contract-maps/candidate-triage-projection.md`.

An identical terminal replay returns success, drains/repairs any pending outbox row, and refreshes the mirror. A conflicting terminal transition exits non-zero. SQLite lock waits are bounded to five seconds and every multi-row mutation uses `BEGIN IMMEDIATE`/`COMMIT` with rollback on error.

## Grounding Trust Boundary

For each `target_files` string, the evaluator rejects NUL, absolute paths, and normalized paths beginning with `..`. It joins the target under the real repository root, uses `lstat`/`realpath`, and accepts only an existing file or directory whose real path is the root or starts with `root + path.sep`. Broken symlinks and symlinks resolving outside count invalid. It never opens target contents or mutates them.

```text
target string
  -> lexical containment
  -> lstat exists?
  -> realpath containment
  -> file or directory?
  -> valid / invalid diagnostic
```

`validCount` and `totalCount` are integer counts. Effective `code_grounding` is zero for `0 / 0`; otherwise `(validCount / totalCount) * 100`. Sorting uses the full IEEE-754 result, then candidate ID ascending. Output formatting alone rounds to two decimals.

## State Machine

```text
                    promote + WI
                 +----------------> promoted (terminal)
                 |
candidate -------+
                 |
                 +----------------> rejected (terminal)
                    reject + reason

same terminal command -> idempotent success
opposite terminal command -> fail closed
terminal mirror re-import -> terminal state preserved
```

## Feature Toggle and First-Demo Matrix

There is no external integration to toggle. The feature is invoked only by an explicit CLI command, which is its runtime enablement boundary. The database and ledger overrides are test/operations routing controls, not feature flags.

| Environment | SQLite | Git metadata | Network | Credentials |
|---|---|---|---|---|
| Local/operator | Real built-in SQLite | Real local Git | Off/not used | None |
| Tier-1 fixture | Real built-in SQLite in temp file | Temp Git repositories | Off/not used | None |
| Promotion replay | Real built-in SQLite in temp file | Promoted repository | Off/not used | None |

The complete first demo runs with zero credentials and zero network access.

## Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling curve | Paid by |
|---|---|---|---|---|---|
| Compute | One synchronous import plus filesystem metadata checks | 50-1,000 candidates, typically under 10 targets each | $0 local | Linear in candidates + declared targets | Operator hardware |
| Storage | Roughly candidate JSON size plus SQLite indexes | Under 10 MB for tens of thousands of compact candidates | $0 local | Linear in rows | Operator disk |
| Bandwidth | None | 0 bytes egress | $0 | Constant zero | N/A |
| External APIs | None | 0 calls | $0 | Constant zero | N/A |
| Background jobs | None | 0 jobs | $0 | Constant zero | N/A |

The v1 scaling trigger is a measured rank/import time above two seconds or a database above 250 MB; then pagination/batch-grounding can be designed from profiles. First month and year one remain $0 because all work uses already-installed Node, local CPU, and local disk. The red line is operator latency, not provider spend.

## Operations and Ownership

| Dimension | Answer |
|---|---|
| Owner | SVC framework maintainers |
| On-call | No paging; best-effort CLI support |
| SLA / SLO | Best effort; focused validator must pass before framework promotion |
| Error budget | N/A for a local operator tool |
| Monitoring | Exit code, stderr, displayed grounding ratios, decision ledger, and focused Tier-1 output |
| Alerting | None; command failure is synchronous and visible |
| Dashboard | None |
| Runbook | This architecture spec plus `--help`/usage output |
| Failure modes | Invalid mirror/config, unavailable SQLite, busy DB, ambiguous scope, external symlink, ledger/mirror write failure |
| Recovery | Correct input/permissions; rerun identical command; pending outbox and atomic mirror semantics repair incomplete projections |
| Backup / restore | Git mirrors back up human state; copy or remove local DB only with operator intent; re-import mirrors to reconstruct rows |
| Dependency failure impact | Missing Git remote falls back to basename; missing company link falls back to Git; missing SQLite aborts before mutation |

## Feasibility Matrix

| AC range | Persona pressure | Feasible? | Design proof |
|---|---|---|---|
| CAND-01..06 | S4 Candidate Operator — reproducible high-volume shortlist (`JOURNEY_INDEX.md`, J-FW-06) | Yes | Whole-input validator, transaction, stable comparator, seed schema fixture |
| GROUND-01..06 | S4 Candidate Operator — evidence that ranking reflects the checked-out code (`JOURNEY_INDEX.md`, J-FW-06) | Yes | Lexical + realpath containment and metadata-only checks |
| SCORE-01..06 | S4 Candidate Operator — explainable role-weighted comparison (`JOURNEY_INDEX.md`, J-FW-06) | Yes | Authored score validation and one pure composite function |
| TRIAGE-01..06 | S4 Candidate Operator — deliberate, retry-safe pre-WI boundary (`JOURNEY_INDEX.md`, J-FW-06) | Yes | Terminal-state transaction plus deterministic outbox event |
| ISOLATE-01..07 | S4 Candidate Operator — no cross-project contamination (`JOURNEY_INDEX.md`, J-FW-06) | Yes | Identity precedence, scoped keys/statements, overrides, busy timeout |

All 31 ACs are feasible without an upstream spec revision.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Git origin normalization collides | Cross-project identity confusion | Prefer explicit `app_id`; preserve host/port/path; fail on mirror mismatch; cross-project fixture |
| Repository/worktree moves after import | Terminal export could target stale checkout | Persist only a relative path, re-resolve under the current root, and exercise a moved-repository fixture |
| DB commits but projection write fails | SQLite and Git/ledger temporarily differ | Durable outbox, idempotent replay, atomic mirror export, visible non-zero exit |
| Human edits terminal mirror state | False terminal reconstruction after DB loss | Validate terminal invariants; treat Git review as recovery trust boundary; never overwrite an existing terminal DB row |
| Symlink escapes repository | Misleading grounding or metadata disclosure | Lexical and realpath containment; no content reads |
| Large pools block synchronously | Operator latency | Keep v1 simple; measure and introduce batching only at documented trigger |
| `.svc/company-link.json` is malformed | Identity could silently drift | Fail actionable rather than falling back |

## Adversarial Engineering Review

| Finding | Resolution |
|---|---|
| `[Layer 1] [Confidence: 10/10]` A package dependency would duplicate Node's shipped SQLite and existing atomic file helpers. | Use `DatabaseSync` and `state-io.mjs`; add no dependency. |
| `[Layer 1] [Confidence: 9/10]` A DB-only transaction cannot atomically commit a JSONL append. | Persist an outbox in the same DB transaction and dedupe projection by deterministic event ID. |
| `[Layer 3] [Confidence: 9/10]` Persisting computed grounding makes ranking stale by construction. | Persist declarations/authored scores only; recompute from filesystem per rank/top. |
| `[Layer 1] [Confidence: 9/10]` Splitting six tiny services would exceed the scope trigger and complicate a local CLI. | Keep cohesive named functions in one module; extract only when a second consumer exists. |
| `[Layer 1] [Confidence: 10/10]` A raw `path.resolve` check is insufficient against symlinks. | Require both lexical and realpath containment. |

The concern scan's `pricing-tier-touch` match is a path-name false positive on `docs/specs/plans/`; the design contains no price, entitlement, billing, tier, or paid API behavior. Motion, UI chrome, and competitive core-mechanic comparison are inapplicable. The local cross-storage projection contract is mapped separately and must pass its validator before G4.

## Rollback

Revert the harness, validator, and seed mirror together. The local `candidate_schema` component is isolated inside `store.db`; no customer or repository schema migration exists. Existing mirror JSON and decision rows remain readable evidence. Operators may retain the database or explicitly remove only their candidate rows/database after backing it up; rollback never deletes local state automatically.
