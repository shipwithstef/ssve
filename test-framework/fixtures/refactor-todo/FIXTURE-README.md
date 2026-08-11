# Fixture: refactor-todo

## What This Simulates

A brownfield svc repo where the code **works correctly** but is structurally
poor. All business logic is inlined into route handlers, validation is
duplicated across three endpoints, and a ghost `store.js` module is orphaned.

## Code Smells Present

| Smell | Location | Evidence |
|-------|----------|----------|
| Inline data access | `src/routes/todos.js` | Direct array manipulation in every handler |
| Duplicated validation | `src/routes/todos.js` | Same title validation in POST, PATCH, and bulk |
| Long functions | `src/routes/todos.js` | `router.patch` handler mixes find, validate, update, side effects |
| Multiple responsibilities | `src/routes/todos.js` | PATCH handler updates status, title, and timestamps |
| Orphaned module | `src/store.js` | Exported but never imported by routes |
| Feature envy | `src/routes/todos.js` | Route file knows how to parse `dueDate` and compute overdue |

## Intended Test Scenarios

This fixture tests the **refactor lane**:

| Skill | What It Tests |
|-------|---------------|
| `sync-spec-code` | Verifying behavior is correct before restructuring |
| `plan-changeset` | Planning a safe refactor that preserves behavior |
| `execute-changeset` | Extracting store logic, deduplicating validation, deleting dead code |
| `review-gate` | G5 review ensuring no behavioral change during refactor |

## Expected Pipeline Behavior

- `sync-spec-code` should confirm the spec matches behavior (all ACs pass functionally) but may note structural issues.
- `plan-changeset` should produce a manifest focused on restructuring, not feature work.
- No acceptance criteria should change — only code organization.
