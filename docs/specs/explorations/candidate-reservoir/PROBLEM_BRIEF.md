# Problem Brief: Candidate Reservoir

## Problem statement

S4 Candidate Operators need to rank and terminally triage large candidate pools without creating active WIs, touching customer databases, or mixing project state. Ranking must be explainable from current filesystem evidence, and a retry across the SQLite/ledger/mirror seam must not duplicate or lose the decision.

## Upstream context

- Vision principles: progressive narrowing, local-first state, deterministic review evidence, worktree isolation.
- Persona constraints: S4 operates a CLI across many repositories and needs offline, zero-credential, Git-reviewable output (`J-FW-06`).
- Key ACs: CAND-03/05 idempotency and stability; GROUND-02/03 containment; SCORE-03/04 exactness; TRIAGE-04/05 retry-safe audit; ISOLATE-06/07 scope/concurrency.
- Journey complexity: seven paths covering rank, top-N, invalid input, two terminal actions, retry/conflict, and cross-project contention.

## Success criteria derived from ACs

### Must

- Satisfy all 31 ACs, including a native Node `DatabaseSync` path, exact score formula, live grounding ratios, and the four public commands.
- Keep every query scoped by project and item scope, with no network or customer-database access.
- Commit candidate state atomically and project its terminal decision exactly once to JSONL.
- Preserve a deterministic JSON mirror and refuse filesystem escapes after a repository/worktree move.

### Should

- Add no package lifecycle or external dependency.
- Keep cold-start and operational complexity appropriate for 50-1,000 candidates.
- Remain legible as one framework utility and one focused validator.

### Nice

- Allow reconstruction from reviewed Git mirrors after local DB loss.
- Leave a documented scaling path without implementing premature services.

## Baseline approach

One cohesive Node CLI uses project/scope-keyed native SQLite, live filesystem grounding, a pure composite function, a transactional decision outbox, and deterministic atomic JSON mirror export.

## Assumptions to challenge

1. SQLite is necessary rather than a locked JSON file.
2. A dual store is worth its projection seam.
3. An outbox is the smallest correct retry mechanism.
4. One script is clearer than multiple reusable modules.
5. Synchronous APIs remain appropriate at the expected volume.

## Constraints

Node 22+, no root package manifest, portable Bash/Node repository conventions, local-only operation, exact user CLI, full delivery tier, and a committed 50-item seed.
