# Framework Improvement: Production-derived UI mock parity gate

**Status:** DONE

## Evidence

- **Source:** User report on 2026-06-02 while invoking `$route-workflow`.
- **Finding:** Mock UI evidence for existing-component changes could be generic
  and disconnected from the production component, its current state, its actual
  usages, and the intended final outcome. That made mock review a weak safety
  gate for both humans and agents.
- **Severity:** HIGH. UI changes can pass planning/review while changing the
  wrong component, omitting important states, or validating only an attractive
  standalone mock.

## Diagnosis

The framework already had adjacent protections:

- `design-ui` gathered existing UI context but did not require production-based
  mock parity for existing components.
- `track-visuals` mapped shared components and visual blast radius but did not
  consume a design-time parity ledger.
- `plan-changeset`, `review-gate`, and `test-journeys` required visual evidence
  but could still accept final-state-only screenshots or generic mock artifacts.

The missing contract was a durable ledger that starts in `design-ui` and is then
consumed by planning, visual capture, review, and journey evidence.

## Implementation

- Added the `design-ui` Production-Derived Mock Parity Gate.
- Required the ledger to include affected existing component/screen, production
  source paths, current-state evidence, intended final-state mock/evidence,
  affected usages/routes, spec ACs and journeys, required states/viewports, and
  exclusions with rationale.
- Threaded the ledger through `track-visuals` component blast-radius capture.
- Added a `plan-changeset` blocker for browser-visible MODIFY tasks lacking the
  ledger.
- Added G3/G5 `review-gate` fail conditions for missing or weak mock parity.
- Required `test-journeys` existing-component visual AC evidence to cite the
  ledger and reject final-only screenshots.
- Added `test-framework/evals/tier-1/validate-ui-mock-parity-gate.sh`.
- Updated `FRAMEWORK-STATE.md` and `references/knowledge/svc/CAPABILITIES.md`.

## Acceptance Criteria

- Existing-component/screen/shared-UI changes cannot proceed from `design-ui`
  with generic greenfield mocks.
- The affected production component must appear in current-state and
  intended-final-state evidence.
- Planning blocks browser-visible MODIFY tasks without the ledger.
- G3 fails missing parity evidence before UI design advances.
- G5 fails when execution lacks carried-through parity evidence or uses
  final-only screenshots.
- Journey visual evidence remains tied to screenshots or `track-visuals` diffs
  and cites the ledger for existing-component changes.
- Tier-1 validation fails if the gate is removed from any coupled skill.

## Replay Verification

- PASS: `bash test-framework/evals/tier-1/validate-ui-mock-parity-gate.sh`
  (`12 passed, 0 failed`)
- PASS: `bash test-framework/evals/tier-1/validate-visual-skills-have-live-evidence.sh`
- PASS: `bash test-framework/evals/tier-1/validate-design-chrome-testability.sh`
  (`5 passed, 0 failed`)
- PASS: `bash test-framework/evals/run-all-evals.sh`
  (`Tier 1 Result: 191 scripts passed, 0 failed`; tiers 1.5-3 skipped because
  `EVALS=1` was not set)

## Rollback

Remove the ledger gate from `design-ui`, remove the corresponding consumers in
`track-visuals`, `plan-changeset`, `review-gate`, and `test-journeys`, delete
the tier-1 validator, and remove the framework state/capability entries.
