# Decision: Secure Runtime-Root Portability

## Selected approach

**A1 — shared strict resolver plus loader preflight and exact retry.** Centralize
root classification, fall back only for unavailable XDG, preserve fail-closed
unsafe-state handling, and forward-complete the cross-file loader gap.

## Confidence

High: exact host reproduction, official standards, four current peer sources,
AC-traced analysis, and a classification prototype all converge. Implementation
and promoted real-host proof remain mandatory.

## Evidence chain

- Problem framing: `PROBLEM_BRIEF.md`
- Alternatives explored: `SOLUTION_MAP.md` (5 paradigms, 7 approaches)
- Analysis: `ANALYSIS.md` (RP criteria tradeoff matrix)
- Prototyping: `COMPARISON.md`
- System contract: `docs/specs/contract-maps/svc-runtime-root-resolution.md`
- Confidence packet: `docs/specs/decisions/2026-07-22-runtime-root-portability/SOLUTION-CONFIDENCE.md`

## Why this approach

- It alone satisfies RP-01, RP-02, and RP-03 simultaneously: automatic missing
  fallback, valid-XDG compatibility, and unsafe-root denial.
- It satisfies RP-05/RP-06 structurally by making Node and shell consume one policy.
- It satisfies RP-08/RP-09 without pretending two storage roots can share one
  atomic primitive.
- It preserves RP-13/RP-15's installed, fail-closed, no-workaround acceptance bar.

## Why not the alternatives

- **Always home:** discards valid XDG/session semantics and weakens compatibility.
- **Incident-only patch:** leaves direct policy forks and guarantees another host seam.
- **Environment commands:** workaround, not a permanent framework capability.
- **Universal temp:** appropriate for advisory data, not mutation authority.
- **Repository-local state:** authority migration and residue risk exceed this WI.
- **Daemon:** new lifecycle and install dependency for a local path-classification problem.

## Runner-up

**Universal OS temp** is the runner-up for future advisory-only coordination
files. It becomes acceptable only when loss or substitution of the state cannot
grant, transfer, or suppress mutation authority.

## Impact on tech design

- [x] No changes needed — baseline confirmed.
- [ ] Tech design revised.

The action-by-action packet already reflects the selected design. No human gate
was requested; `design_auto` continues to `plan-changeset` through the task graph.
