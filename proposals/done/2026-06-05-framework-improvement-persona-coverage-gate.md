# Framework Improvement: Persona Coverage Task-Graph Gate

**Status:** IMPLEMENTED
**Date:** 2026-06-05
**Evidence case:** Example Marketplace WI-338 agentic assistants / business intelligence feature design
**Gap type:** task-graph validation / review-gate coverage

## Problem

Feature-class work can still be executed from a manually assembled lane task
graph that omits `build-personas`. The delivery graph compiler already inserts
`build-personas` for user/admin-facing feature work, and the feature validation
ledger checks persona mapping, but those protections do not fire when the
compiler path is bypassed or when review only sees a plain `.svc/lane-tasks`
graph.

In WI-338, persona consideration was implicit in the design package, but there
was no standalone `build-personas` task or auditable skip decision. That is not
acceptable for strategic, user-facing feature work because future reviewers
cannot prove which customer/admin personas drove acceptance, UX, E2E, and
business-impact decisions.

## Required Behavior

For feature-class task graphs created on or after 2026-06-05:

- `greenfield`, `brownfield-feature`, or delivery-graph feature work with
  `user-facing`/`admin-facing` risk must carry `build-personas`; or
- the graph must carry a top-level `persona_coverage` decision.

Valid `persona_coverage` decisions are:

- `status: satisfied` with `artifact`, `evidence`, or `decision_ref`; or
- `status: not_required` with a concrete rationale explaining why no
  user/admin persona surface exists.

Silent omission must fail validation.

## Implementation

- Added forward-looking persona coverage enforcement to
  `scripts/task-graph.mjs`.
- Documented the manual-graph fallback in
  `route-workflow/references/task-graph-protocol.md`.
- Updated `route-workflow/references/lane-model.md` so the existing compiler
  rule and the manual fallback are described together.
- Updated `review-gate/SKILL.md` so review cannot pass feature-class graphs
  without delivery graphs unless task-graph validation proves persona coverage.
- Updated `references/knowledge/svc/CAPABILITIES.md` and `FRAMEWORK-STATE.md`.
- Added `test-framework/evals/tier-1/validate-persona-coverage-task-graph-gate.sh`.

## Acceptance Criteria

- A future manual `brownfield-feature` graph with feature/spec/UX tasks but no
  `build-personas` and no `persona_coverage` fails `task-graph.mjs validate`.
- The same graph passes when it includes a `build-personas` task.
- The same graph passes when it declares existing persona evidence through
  `persona_coverage.status=satisfied`.
- Weak skip rationales fail.
- Historical pre-gate graphs remain accepted.
- Delivery-graph feature work also fails task-graph validation when persona
  coverage is silently omitted.

## Verification

```bash
bash test-framework/evals/tier-1/validate-persona-coverage-task-graph-gate.sh
```

Expected: PASS.

## Rollback

Revert the task-graph validator additions and documentation updates. The older
delivery-graph compiler behavior would remain, but manually assembled feature
graphs could again bypass persona evidence.
