# Scenario: explore-solutions-challenge

## Setup
A scaffolded repo exists with a BASELINED feature spec at `docs/specs/features/feature-user-service.md` and a completed tech design at `docs/specs/tech/feature-user-service.md`. The tech design chose SQLite as the persistent storage layer for the user-service with a single-table schema. No code has been executed yet; the repo is in the design phase.

## Invocation
"Challenge the tech design for user-service" or "explore alternatives to SQLite for user-service"

## Expected Behavior
1. MUST produce 2 or more alternative technologies to SQLite (e.g., PostgreSQL, MySQL, DynamoDB, MongoDB, or embedded alternatives).
2. MUST compare alternatives on at least 3 dimensions: scalability, complexity, and cost.
3. MUST document a trade-off recommendation with clear justification for the preferred option.
4. MUST NOT execute code, write migration scripts, or modify any source files.

## Success Criteria
- [ ] At least 2 distinct alternatives to SQLite are named and described.
- [ ] Comparison covers scalability, complexity, and cost (or equivalent 3+ dimensions).
- [ ] A recommended approach is stated with justification.
- [ ] No files in `src/` or equivalent are created or modified.
- [ ] Phase receipt structure:
  `jq -e '.tasks[] | select(.metadata.skill == "explore-solutions" or .skill_receipt.skill == "explore-solutions") | .skill_receipt.phases_executed[]? | select(.id == "P2-ParadigmResearchSolutionMap")' .svc/lane-tasks-<WI>.json`
