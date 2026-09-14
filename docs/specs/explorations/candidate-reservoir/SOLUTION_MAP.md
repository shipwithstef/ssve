# Solution Map: Candidate Reservoir

## Research basis

- Node's official documentation exposes synchronous file-backed `DatabaseSync` and prepared statements from Node 22.5 onward: https://nodejs.org/download/release/v22.13.0/docs/api/sqlite.html
- SQLite documents transaction commit as atomic and notes busy failures around competing writers: https://www.sqlite.org/atomiccommit.html
- SQLite documents WAL as additional shared state, so v1 can avoid WAL and its side files for this short-lived CLI: https://www.sqlite.org/tempfiles.html
- Git's official CLI exposes `git remote get-url origin`, supporting the required fallback without parsing `.git/config`: https://git-scm.com/docs/git-remote
- Repository evidence: `scripts/company-memory.mjs` already uses `DatabaseSync`; `scripts/state-io.mjs` already provides lock/fsync/rename primitives.

## Paradigm A: Transactional operational store plus review projection (baseline)

**Core bet:** mutations need database transactions, while people need Git-readable state.

### A1 — SQLite + JSON mirror + transactional outbox

- How: scoped normalized rows in SQLite; deterministic mirror; outbox projects terminal events to JSONL exactly once.
- Gains: directly satisfies ISOLATE-06/07 and TRIAGE-04/05; no dependency.
- Gives up: must specify and test projection recovery.
- Complexity: one executable, two SQLite tables plus schema row.

### A2 — SQLite source plus on-demand read-only JSON export

- How: keep only SQLite operationally; export mirror only when ranking.
- Gains: fewer writes on terminal commands.
- Gives up: terminal status in Git can remain stale, violating observable promotion/rejection expectations.
- Complexity: slightly lower than A1 but weaker projection contract.

## Paradigm B: Files are the database

**Core bet:** pool size is small enough that atomic whole-file replacement is sufficient.

### B1 — Locked JSON mirror only

- How: lock mirror, read/validate, modify, temp+fsync+rename.
- Gains: one store, perfect human readability, trivial backup.
- Gives up: the required native SQLite layer; cross-project/global lookup and concurrent multi-mirror decisions become lock choreography.
- Complexity: low initially, grows with multi-project use.

### B2 — Append-only JSONL events with materialized rank view

- How: candidate imports and decisions are immutable events; replay builds ranking and mirror.
- Gains: audit is intrinsic; crash-safe append can be simple.
- Gives up: updates require event semantics, replay validation, compaction, and corruption policy; SQLite requirement still unmet.
- Complexity: highest reasoning burden for v1.

## Paradigm C: Repository-native or centralized inventory

**Core bet:** use an existing coordination substrate rather than a local database.

### C1 — One Git file per candidate plus decision files

- How: each candidate is a tracked JSON/Markdown card; Git history is state.
- Gains: merge visibility and no projection seam.
- Gives up: 50+ file churn, no safe concurrent uncommitted mutation, active Git state pollution, and no native SQLite.
- Complexity: operationally noisy.

### C2 — Remote candidate service

- How: API owns projects, candidates, ranking, and decisions.
- Gains: organization-wide querying and dashboards.
- Gives up: violates offline, zero-credential, isolation, and open-source portability constraints.
- Complexity: service/auth/deploy/FinOps burden.

## Non-obvious options

A content-addressed immutable event pack could derive both SQLite and JSON as disposable projections. It makes audit recovery elegant, but introduces event versioning, replay/compaction, and two derived stores to solve a 50-candidate local problem. It is a useful future direction only if cross-repository synchronization becomes a real requirement.

## Eliminated early

- Supabase/customer DB: explicitly prohibited and creates schema/security coupling.
- Third-party SQLite wrapper/ORM: duplicates the requested native API and would introduce a root dependency lifecycle.
- WAL-by-default: the CLI has brief bounded writes; extra `-wal`/`-shm` residue has no measured benefit yet.
