# Scenario: kimi-route-workflow-eval

## Setup
A scaffolded repo with `docs/specs/vision.md` and a `.svc/lane-tasks-WI-001.json` file in various states (empty, in-progress, completed).

## Invocation
"What should I do next?" or "route this work" or "which skill do I run?"

## Expected Behavior
1. MUST read the current lane-tasks JSON to determine pipeline state.
2. MUST route to the correct next skill based on artifact state (e.g., DRAFT → design-ux, DESIGNED → plan-changeset).
3. MUST suggest `mine-builder` on first session if `~/.svc/builder-profile.md` is missing.
4. MUST suggest `validate-feature` for raw feature ideas before any design work.

## Success Criteria
- [ ] Correct skill is suggested for each pipeline state
- [ ] Does not suggest execute-changeset when spec is still DRAFT
- [ ] Handles greenfield vs brownfield vs bugfix lane detection
- [ ] Produces a concrete next step, not a generic "continue working"
