# Framework Improvement: completion scope parity

## Evidence

- **Source:** User challenge during Example Marketplace AI content/image generation closeout on 2026-05-10.
- **Observed failure:** The implementation reached production and passed live function probes for `deal`, `event`, `standby_queue`, and `flash_offer`, but the closeout answer still risked implying the whole framework lifecycle was complete.
- **Missing framework artifacts:** No active task graph was created for the Example Marketplace closure, no focused E2E spec was added before the first closeout, no review-gate artifact was produced, and the feature work landed directly on `main` instead of through a PR/merge path.
- **Why existing guards were insufficient:** `hooks/svc-task-completion-guard.sh` blocks stops for active `.svc/lane-tasks-*.json` files, and `route-workflow/references/task-graph-protocol.md` blocks ghost skill completion inside task graphs. This incident happened before the lane graph existed, so runtime proof was able to substitute for lifecycle proof in the final claim.
- **Severity:** high

## Diagnosis

- **Root cause:** The framework has strong task-level completion rules once a lane graph exists, but it does not require a final-answer completion classification when code was changed outside a full lane path.
- **Failure mode:** Production/API validation can be real and valuable, but it is only one verification dimension. If the agent says or implies "done" without naming the remaining lane artifacts, the user receives a false framework-completion signal.
- **Category:** completion semantics / claim control / framework lifecycle enforcement
- **Already in FRAMEWORK-STATE.md?** Partially adjacent. Existing state covers task graphs, skill receipts, completion guards, and review-gate binding, but not this final-answer scope parity requirement.

## Required Improvement

Add a mandatory "completion scope" classification before any closeout that follows code changes, deployment work, or work-item closure.

The closeout classification must be exactly one of:

1. `runtime-accepted` — live behavior/probes pass, but one or more framework lifecycle artifacts are missing.
2. `framework-complete` — the relevant lane was created or retroactively reconstructed, required skills were loaded, tests/E2E/review/deploy evidence are present, and landing state is explicit.
3. `blocked` — the work cannot be safely claimed complete because required evidence cannot be obtained.

An agent may not claim `framework-complete` solely from production probes, build success, or direct commits.

## Acceptance Criteria

- `route-workflow/SKILL.md` requires completion scope classification in its output protocol for any code-mutating or deploy-affecting request.
- `route-workflow/references/task-graph-protocol.md` states that runtime/prod validation is not a substitute for task graph, E2E, review-gate, and landing evidence.
- `hooks/svc-task-completion-guard.sh` or a tier-1 validator catches final-answer language that claims framework completion while the latest session contract is end-to-end and no lane graph or closure artifact exists.
- The completion audit checklist requires explicit status for:
  - session contract
  - lane task graph
  - required skill receipts
  - focused tests or E2E
  - review-gate or explicit skip reason
  - deploy/production probe evidence
  - branch/PR/merge state
- A regression fixture models the Example Marketplace incident: production function probes pass, but E2E/review/PR evidence is absent. Expected result: `runtime-accepted`, not `framework-complete`.
- Final-answer guidance requires a plain-language distinction when scope is incomplete: "production behavior is passing; framework lifecycle closure remains open."

## File Impact

- `route-workflow/SKILL.md` — add completion-scope closeout rule.
- `route-workflow/references/task-graph-protocol.md` — add lifecycle-vs-runtime proof distinction near task completion and output protocol.
- `hooks/svc-task-completion-guard.sh` — optional mechanical guard for end-to-end sessions with missing lane closure evidence.
- `test-framework/evals/tier-1/` — add a validator or fixture-based check for completion-scope claim control.
- `references/verification-patterns.md` or equivalent — document runtime acceptance as one evidence class, not lifecycle completion.

## Rollback

Revert the skill/protocol/validator changes. No data migration is required.

## Replay Verification

- Replay the Example Marketplace AI content/image generation closeout transcript as a fixture.
- The framework must produce or require a closeout classification of `runtime-accepted`.
- The replay must fail if the answer says or implies `framework-complete` before E2E, review-gate, and landing evidence are present.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add an entry for 2026-05-10: "Completion scope parity gap logged after Example Marketplace AI content/image generation closeout. Production probes passed, but framework lifecycle artifacts were incomplete."
- **Known Gaps:** Add open gap `completion-scope-parity` until the route-workflow/protocol/validator changes land.
- **Decision to lock after implementation:** Runtime acceptance and framework completion are separate states. Production probes are necessary evidence for deploy-affecting work, but never sufficient proof of framework lifecycle completion.
