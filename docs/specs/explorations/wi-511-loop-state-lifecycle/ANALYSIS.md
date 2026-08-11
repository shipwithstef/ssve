# Analysis: WI-511 loop-state lifecycle

## Tradeoff matrix

| Criterion | A1 every call | A2 cadence owner | A3 inline cadence | B1 task graph | B2 reconcile | C1 command | C2 daemon |
|---|---|---|---|---|---|---|---|
| AC1 stale removal | pass | pass | pass | partial | partial | conditional | pass |
| AC2 current preserved | pass | pass | pass | context-poor | context-poor | context-poor | context-poor |
| AC3 strict cutoff | pass | pass | pass | pass | pass | pass | pass |
| AC4 type/name safety | pass | pass | pass | pass | pass | pass | pass |
| AC5 cleanup fail-open | pass | pass | pass | risks command | risks reconcile | pass | separate failure |
| AC6 hermetic proof | pass | pass | weaker | pass | pass | pass | costly |
| AC7 existing suites | hot-path risk | best | complexity risk | coupling risk | scope risk | wiring risk | ops risk |
| AC8 promoted replay | pass | pass | pass | pass | pass | pass | heavy |
| Correct lifecycle owner | pass | pass | pass | fail | fail | partial | partial |
| New persistent state | none | none | none | none | none | none | yes |

## Eliminated

- B1 fails ownership and invocation coverage.
- B2 contaminates receipt reconciliation with unrelated mutation.
- C1 does not guarantee cleanup without additional routing.
- C2 introduces disproportionate operational complexity.
- A1 performs an avoidable directory scan on every hot-path call.
- A3 makes deterministic time/error fixtures harder and enlarges the hook.

## Finalists

1. **A2 cadence-bounded owner helper** — satisfies all ACs with bounded hot-path cost.
2. **A1 every-call owner helper** — functionally sound but performs unnecessary work.
3. **C1 dedicated command** — safest hot path but unreliable lifecycle coverage without more wiring.

## Key differentiator

Can A2 avoid new state while ensuring cleanup eventually runs? Yes: current state-file `mtime` is already refreshed by every active hook call and can serve as the cadence signal.

## Runner-up value

A1 is the fallback if future evidence requires near-immediate reclamation and proves the directory scan has negligible end-to-end cost.
