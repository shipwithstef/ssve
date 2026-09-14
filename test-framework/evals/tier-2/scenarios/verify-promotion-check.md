# Scenario: verify-promotion-check

## Setup
The `main` branch has just received a squash-merged changeset for WI-003 (dark-mode toggle). The promoted code lives in `src/components/DarkModeToggle.jsx` and `src/styles/dark.css`. The feature spec is at `docs/specs/features/feature-dark-mode.md` and the journey is at `docs/specs/journeys/J03-dark-mode.feature.md`. Tests exist at `src/components/DarkModeToggle.test.jsx`.

## Invocation
"Verify the promotion" or "run post-merge verification"

## Expected Behavior
1. MUST check that the promoted code on `main` matches the spec (correct files present, no missing exports, props align with design).
2. MUST run the test suite and report explicit pass/fail counts for tests related to the promotion.
3. MUST verify AC satisfaction by walking through each acceptance criterion in `docs/specs/features/feature-dark-mode.md` and confirming it is implemented.
4. MUST update the spec and journey state to `VERIFIED` (or equivalent status) and record the verification timestamp and outcome in `docs/logs/` or the spec itself.

## Success Criteria
- [ ] Code structure on `main` is compared against the spec and found consistent.
- [ ] Test results are reported with clear PASS / FAIL counts.
- [ ] Every AC in the feature spec is checked and marked satisfied or not.
- [ ] Spec and journey documents are updated to `VERIFIED` status with timestamp.
- [ ] Phase receipt includes promotion verification:
  `jq -e '.tasks[] | select(.skill_receipt.skill == "verify-promotion") | .skill_receipt.phases_executed[] | select(.id == "P2-SpecACVerification")' .svc/lane-tasks-*.json`
