# Decision: WI-502 durable authority

## Selected approach

**A1 staged local capability system** — one canonical operation-scope primitive, repository-shared locked/CAS controller lease, generation-bound inner-worktree delegations, and sequential parent merge.

## Confidence

High for architecture and scope; medium for cross-host containment adapters until implementation probes each host.

## Evidence chain

- Problem framing: `PROBLEM_BRIEF.md`
- Alternatives: `SOLUTION_MAP.md` (4 paradigms, 7 concrete approaches)
- Analysis: `ANALYSIS.md`
- Non-code comparison: `COMPARISON.md`
- World grounding and action gates: `docs/specs/decisions/2026-07-20-wi-502-durable-authority/SOLUTION-CONFIDENCE.md`

## Why this approach

It alone meets every OS/SB/AU/DG family while staying local-first, preserving v1 exact-byte rollback, and aligning with the current Git/Node framework.

## Why not the alternatives

- SQLite: runner-up; transactions are useful but not yet worth a new runtime/migration surface.
- Daemon/remote broker: violates local-first/no-service constraints.
- Sandbox-primary/no-shell: containment does not replace WI authority, and banning shell breaks normal execution.
- Patch-only children: retain as a host-specific fallback, not the complete requested model.

## Runner-up

Local SQLite becomes the fallback if deterministic file-CAS race fixtures fail or authority-state scale makes bounded reads untenable.

## Impact on tech design

- [x] No changes needed; exploration confirms the BASELINED design.
