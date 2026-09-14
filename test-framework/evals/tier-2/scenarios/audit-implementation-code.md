# Scenario: audit-implementation-code

## Setup
A worktree branch `feature-auth-validation` exists with implemented code for WI-001. The repo contains a feature spec at `docs/specs/features/feature-auth-validation.md` with acceptance criteria requiring input validation on the login endpoint. The implementation at `src/routes/auth.js` is missing the email-format validation check (a known bug injected for this scenario). The spec AC-2 explicitly states: "Reject malformed email addresses with 400 Bad Request."

## Invocation
"Audit the implementation for WI-001" or "check correctness before landing"

## Expected Behavior
1. MUST identify the validation gap in `src/routes/auth.js` where email-format validation is absent.
2. MUST reference spec AC-2 that is violated by the missing validation.
3. MUST produce evidence-graded findings with at least one HIGH or MEDIUM grading for the validation gap.
4. MUST output an audit report to `docs/logs/audit-WI-001.md` (or embedded equivalent log path).

## Success Criteria
- [ ] Audit explicitly names the missing input validation in `src/routes/auth.js`.
- [ ] AC-2 from the feature spec is cited as the violated requirement.
- [ ] Findings include evidence grades (HIGH / MEDIUM / LOW).
- [ ] Audit report is persisted to `docs/logs/` or a clearly referenced log file.
- [ ] Phase receipt structure:
  `jq -e '.tasks[] | select(.metadata.skill == "audit-implementation" or .skill_receipt.skill == "audit-implementation") | .skill_receipt.phases_executed[]? | select(.id == "P5-FindingsConvergenceReport")' .svc/lane-tasks-<WI>.json`
