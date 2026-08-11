# Solution Map: WI-511 loop-state lifecycle

## Paradigm A: creator-owned opportunistic maintenance

**Core bet:** The state creator has the safest namespace and invocation context.

### A1. Scan on every non-exempt call

- List `.svc`, filter exact loop-state names, lock, and delete stale files.
- Gains immediate cleanup.
- Gives up hot-path efficiency: local measurement over 10,000 iterations found `readdir(.svc)` about 0.092 ms/call for 109 entries before per-file metadata/lock work.

### A2. Cadence-bounded owner scan

- `lstat` the current state path on every call; scan only when it is missing or inactive for 24 hours.
- Gains automatic cleanup with a measured ~0.014 ms/call cadence check.
- Gives up at-most-immediate cleanup; expiry may wait until a new/resumed session.

### A3. Inline owner logic

- Put all filtering/locking/unlink code directly in `svc-loop-guard.mjs`.
- Gains one fewer module.
- Gives up unit-like clock/error injection and increases hook complexity.

## Paradigm B: central framework orchestration

**Core bet:** Existing framework commands should maintain all `.svc` state.

### B1. Task-graph cleanup

- Run pruning from `scripts/task-graph.mjs`.
- Misses hook calls outside task-graph commands and couples unrelated ownership.

### B2. Reconcile cleanup

- Run pruning from `scripts/svc-reconcile.mjs`.
- Gets a natural session-entry cadence but makes receipt reconciliation mutate unrelated hook state and cannot help repos that invoke hooks without reconcile.

## Paradigm C: explicit janitorial operation

**Core bet:** Cleanup should be separate from enforcement hot paths.

### C1. Dedicated command

- Add `scripts/prune-runtime-state.mjs` for manual/session-start use.
- Clear separation, but requires routing/wiring and can be forgotten.

### C2. Background janitor/daemon

- Periodically sweep state.
- Adds scheduling, process, state, and failure complexity larger than the leak.

## Non-obvious option

Use current-state `mtime` as the cadence marker instead of adding a new marker/cache file. The loop guard already refreshes it on active calls, so no schema or extra persistent state is required.

## Eliminated early

- Recursive or glob deletion: unsafe around live sessions and unrelated `.svc` evidence.
- Age encoded in filename: requires a naming/schema migration.
- SHA/content-based expiry: state freshness is operational time, not content identity.
