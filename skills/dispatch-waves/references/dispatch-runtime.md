# Dispatch Runtime Reference

`skills/dispatch-waves/SKILL.md` stays intentionally small: it owns the decision
points, commands, and self-verify checklist. Runtime depth lives here and in the
shared transport reference.

## Runtime Mechanics

- Plan first with `scripts/plan-parallel-wi-dispatch.mjs`.
- Dispatch workers only after each WI has affected-file metadata or an explicit
  unknown-scope blocker.
- Set `SVC_WORKER_WI=<WI>` for headless workers so result, progress, and edit
  rollup artifacts are written under `.svc/dispatch/`.
- Validate merge-back with `scripts/validate-parallel-merge-back.mjs` before
  mutating parent lane-task graphs.

## Shared References

- `references/parallel-dispatch-transport.md` defines transport choice,
  worker result artifacts, failure states, runtime-resource assignment, and
  orchestrator quality rollup.
