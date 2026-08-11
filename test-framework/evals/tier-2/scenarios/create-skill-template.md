# Scenario: create-skill-template

## Setup
<!-- Describe the fixture state or scaffold needed -->
Scaffold an empty skill directory `skills/python-api-testing/` or point at an existing skill that needs improvement. Ensure the directory has no `SKILL.md` file. Optionally seed a `references/` subdirectory to test that the skill can handle optional auxiliary directories.

## Invocation
<!-- The exact prompt or command sent to the agent -->
"Create a skill for Python API testing" or "Optimize the evaluate-rule skill."

## Expected Behavior
<!-- 4 assertions with MUST-level specificity -->
1. The agent MUST produce a valid `SKILL.md` with complete YAML frontmatter containing `name`, `description`, `inputs`, `outputs`, and `chain` fields.
2. The agent MUST record a `P3-SkillDraftFrontmatterAndBody` phase receipt in the task graph:
   `jq -e '.tasks[] | select(.metadata.skill == "create-skill" or .skill_receipt.skill == "create-skill") | .skill_receipt.phases_executed[]? | select(.id == "P3-SkillDraftFrontmatterAndBody")' .svc/lane-tasks-<WI>.json`
3. The agent MUST include a Self-Verify table with `# | Check | How | PASS/FAIL` columns and at least three data rows.
4. The agent MUST keep the `SKILL.md` body under 500 lines; any content exceeding the limit MUST be redirected to `references/` or `scripts/`.
5. The agent MUST include a Pipeline Continuation section describing how to update `.svc/lane-tasks-<WI>.json`.

## Success Criteria
<!-- Pass/fail checklist -->
- [ ] `SKILL.md` exists at the expected path with YAML frontmatter delimited by `---`
- [ ] Frontmatter contains `name`, `description`, `inputs`, `outputs`, and `chain` keys
- [ ] Task graph contains a `P3-SkillDraftFrontmatterAndBody` phase receipt
- [ ] Self-Verify table has PASS/FAIL rows and is parseable as a markdown table
- [ ] Total line count of `SKILL.md` is `< 500`
- [ ] Pipeline Continuation section references `.svc/lane-tasks-*.json`
