# Decision: WI-511 loop-state lifecycle

## Selected approach

**Cadence-bounded creator-owned cleanup** — an internal helper removes exact, expired, lock-safe sibling files when the current session state is new or inactive for 24 hours.

## Confidence

High: grounded in current code, seven local precedents, a mechanical hot-path comparison, and explicit failure-case falsification.

## Evidence chain

- Problem: `PROBLEM_BRIEF.md`
- Alternatives: `SOLUTION_MAP.md` — 3 paradigms, 7 approaches
- AC analysis: `ANALYSIS.md`
- Mechanical comparison: `COMPARISON.md`
- Full confidence packet: `docs/specs/decisions/2026-07-24-wi-511-quality-preserving-optimizations/SOLUTION-CONFIDENCE.md`

## Why this approach

It is the only option that satisfies WI511-AC1 through WI511-AC8 while keeping ownership in the state creator, avoiding new persistent state, refusing active writers, and not scanning the directory on every call.

## Why not the alternatives

- **Every-call owner scan:** correct but wasteful on a hot path.
- **Inline owner logic:** reduces testability and enlarges the hook.
- **Task-graph/reconcile cleanup:** wrong owner and incomplete/contaminated invocation semantics.
- **Manual command:** no guaranteed lifecycle.
- **Daemon:** disproportionate complexity and new operational state.

## Runner-up

Every-call owner scan would be selected if later evidence requires immediate reclamation and a golden timing test proves no material latency.

## Impact on technical design

- [x] Baseline confirmed.
- [ ] Technical design revision required.
