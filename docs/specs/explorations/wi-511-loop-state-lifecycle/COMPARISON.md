# Comparison: WI-511 loop-state lifecycle

## Comparison criteria

- no new persistent state;
- eventual removal after the seven-day cutoff;
- no `.svc` scan on normal active calls;
- active-file and active-writer preservation;
- deterministic clock/error fixtures;
- owner-local rollback.

## Mechanical comparison

On the WI-511 worktree with 109 `.svc` entries, 10,000 synchronous iterations measured:

| Operation | Mean per call |
|---|---:|
| failed `lstat` of a current-state path | ~0.014 ms |
| `readdir(.svc, {withFileTypes:true})` | ~0.092 ms before per-entry checks |

The absolute numbers are host-specific and not a product benchmark. They answer the design question: a cheap cadence probe avoids at least one directory scan and all candidate metadata/lock work on normal calls.

## Falsification result

- A2 can use injected `now` in the helper for exact-cutoff fixtures.
- The hook can use current-state `mtime` without changing JSON.
- Candidate deletion can reuse `withStateLock(candidate, ..., {timeoutMs: 0})`; an active writer causes immediate skip.
- Per-file catches preserve maintenance fail-open behavior.
- The current state path is excluded before locking.

## Verdict

A2 dominates A1 on hot-path work and C1 on lifecycle coverage without adding state. No prototype source is retained because the relevant mechanisms already exist in `state-io.mjs`; implementation tests are the executable comparison.
