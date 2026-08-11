# Validating GitHub Actions Workflow Changes

Two non-obvious traps catch agents trying to verify a workflow-source change
in CI. Both produce false confidence.

## Trap 1: `gh run rerun --job <id>` re-uses the original workflow source

**`gh run rerun`** replays a job at the **original commit's workflow definition**.
If you just edited `.github/workflows/foo.yml` and want to validate the change,
re-running an old job will execute the **old** YAML. The CI will look like
your change ran. It didn't.

### Decision table

| Goal | Use | Why |
|------|-----|-----|
| Validate a workflow-source change you just pushed | `gh workflow run <workflow> --ref <branch>` | Fresh dispatch, reads the YAML at HEAD of `<branch>` |
| Re-attempt a job that failed transiently (no workflow change) | `gh run rerun --job <id>` | Replays the same source — correct here |
| Validate a change without merging | `gh workflow run` against a feature branch with `workflow_dispatch:` trigger | Same as above, just on a non-main ref |

If the workflow's `on:` block doesn't have `workflow_dispatch`, you can't fresh-dispatch
it on demand. Add it (it's free — doesn't change other triggers) or merge the change
and trigger via the workflow's normal trigger (push, PR, schedule).

## Trap 2: workflow `conclusion: success` is not "the step you care about ran"

When a workflow has many jobs and most of them get skipped (e.g., `skip-build=true`
inputs, or path-filter conditions), the top-level `conclusion` will be `success`
even if your target step didn't run, errored silently, or executed in an unexpected
branch. A workflow that finishes in 2 minutes when you expected 12 is **suspicious**,
not validated.

### Verify step-by-step, not job-by-job

```bash
RUN_ID=<id>
JOB_ID=$(gh run view "$RUN_ID" --json jobs -q '.jobs[] | select(.name == "<job-name>") | .databaseId')

# 1. Confirm the target job ran (not skipped)
gh run view "$RUN_ID" --json jobs -q '.jobs[] | {name, conclusion, startedAt, completedAt}'

# 2. Confirm the SPECIFIC step ran with the expected conclusion
gh run view "$RUN_ID" --json jobs -q ".jobs[] | select(.name == \"<job-name>\") | .steps[] | select(.name | contains(\"<step-name>\")) | {name, conclusion, number}"

# 3. Inspect that step's log for evidence the work actually happened
gh api "repos/<owner>/<repo>/actions/jobs/$JOB_ID/logs" 2>/dev/null | grep -E "<expected-output-pattern>"
```

For the seed step from WI-037: `grep -E "created=[0-9]+ already-existed=[0-9]+"`.
The grep proves the Python entered the loop and counted clients. A `conclusion: success`
on the step alone could mean "the script returned 0" — it might still have run zero
iterations.

### Heuristic — when total wall time is suspiciously short

If you expected `~15 min` but the run shows `~2 min` and `conclusion: success`,
something skipped more than you intended. Either:
- The workflow took a different path (path-filter excluded changes, condition fell through, secret missing → step skipped silently)
- The change you're validating was on a different ref than what got dispatched
- A `continue-on-error: true` step ate a real failure

Drill into the steps array before declaring victory.

## Origin

WI-037 close-out 2026-05-06:
- First retest used `gh run rerun --job` after pushing a workflow source change
  to ezbob-platform. The rerun succeeded, but it executed the OLD YAML — the
  new seed step never ran. `gh workflow run` against the feature ref produced
  a fresh dispatch that included the new step.
- The fresh dispatch returned `conclusion: success` in 2 minutes (vs the
  expected 12-15). Drilling into steps confirmed `skip-build=true` skipped 5 of
  6 jobs, but the relevant `Seed per-tenant OAuth clientAccount documents`
  step DID run and emit `created=13 already-existed=0 failed=0` in its log. The
  short wall time was a side effect of skip-build, not a missed step — but
  this could only be confirmed by inspecting the step's log, not the job conclusion.
