# Scenario: validate-feature validate mode

## Setup

Copy from `examples/todo-api/`:
- `docs/specs/vision.md`
- `docs/specs/personas/P1.md`

Add a feature brief for validation:

```markdown
# Feature Brief: Todo Tagging

**Source:** User request
**Confidence:** High

## Description

Allow users to add tags to their todo items for categorization and filtering.

## Evidence

- P1 persona needs organization tools
- Vision mentions minimal but complete feature set
- Tags are standard in task management

## Recommended Scope

- Add tags field to todo items
- Filter by tag in list view
- Auto-suggest existing tags
```

Write to `docs/specs/features/todo-tagging-brief.md`.

## Prompt

```
Use the validate-feature skill in validate mode to assess whether the "todo tagging" feature should ship. The brief is at docs/specs/features/todo-tagging-brief.md. Vision at docs/specs/vision.md, persona at docs/specs/personas/P1.md.
```

## Expected Outputs

### File Exists

- Output file containing the validation result (ship brief or updated brief)

### Content Checks

- [ ] Contains a ship/no-ship recommendation (grep for "Ship" or "ship" or "Recommend")
- [ ] Contains a cross-validation section (grep for "cross-validation" or "Cross-Validation" or "Evidence" or "Persona alignment")
- [ ] References the persona P1 in the analysis
- [ ] References the vision document in the analysis
- [ ] Phase receipt structure exists: `jq -e '.tasks[] | select(.skill_receipt.skill == "validate-feature") | .skill_receipt.phases_executed[] | select(.id == "P5-CrossValidationShipDecision")' .svc/lane-tasks-*.json`

## Chain Continuation

If `--progressive` were set, next skill would be `write-spec` (greenfield lane position 4).
