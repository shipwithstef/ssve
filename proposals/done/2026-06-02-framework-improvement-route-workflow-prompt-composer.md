# Framework Improvement: Route-workflow prompt composer

**Status:** DONE

## Evidence

- **Source:** User report on 2026-06-02 while invoking `$route-workflow`.
- **Finding:** Human-invoked route-workflow could identify the next skill but
  still underuse the framework because the downstream model receives a thin
  route response instead of a full prompt containing the lane, evidence,
  sequence, evals, skip conditions, and completion bar.
- **Severity:** HIGH. Routing can be technically correct while the next turn
  loses the context that makes the framework powerful.

## Diagnosis

`route-workflow` mixed two modes:

- human advisory entry point: should compose a high-quality prompt for the next
  run,
- internal continuation: may resume or dispatch from an explicit task graph.

Without a mode split, a human route request could get a weak `**Next:**` answer
or a partial self-dispatch that does not carry the full framework contract into
the next model call.

## Implementation

- Added `route-workflow/references/prompt-composer.md`.
- Updated `route-workflow/SKILL.md` so human-invoked routing produces a Prompt
  Composer package and self-dispatch is limited to explicit host/platform
  autorun or internal continuation.
- Added `test-framework/evals/tier-1/validate-route-workflow-prompt-composer.sh`
  to lock the behavior.
- Updated `FRAMEWORK-STATE.md`.

## Acceptance Criteria

- Human-invoked route-workflow returns a launch-ready prompt package rather than
  a thin next-skill trailer.
- The package includes normalized intent, evidence read, lane/change type,
  delivery tier, exact skill sequence, artifacts, evals, skip conditions,
  closeout, and host capability suggestions.
- `/goal`, `/loop`, and `dispatch-waves` are suggested only when the routed
  context justifies them.
- Self-dispatch remains available only for explicit internal continuation or
  host/platform autorun contracts.
- Tier-1 validation fails if the prompt composer contract is removed.

## Replay Verification

- `bash test-framework/evals/tier-1/validate-route-workflow-prompt-composer.sh`
- `bash test-framework/evals/tier-1/validate-route-workflow-hot-path-size.sh`
- `bash test-framework/evals/run-all-evals.sh`

## Rollback

Remove the prompt-composer reference, the SKILL.md mode split, and the tier-1
validator. This returns route-workflow to next-skill advisory behavior.
