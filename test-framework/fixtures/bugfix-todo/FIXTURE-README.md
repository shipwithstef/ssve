# Fixture: bugfix-todo

## What This Simulates

A brownfield svc repo with a single, well-defined bug in the source code.
The spec at `docs/specs/features/feature-todo-management.md` correctly
describes that `POST /todos` should use `req.body.title`, but the
implementation in `src/routes/todos.js` reads `req.body.titel` (typo).

A failing test in `src/routes/todos.test.js` demonstrates the bug.

## Intended Test Scenarios

This fixture tests the **bugfix lane**:

| Skill | What It Tests |
|-------|---------------|
| `diagnose-bug` | Root-cause analysis when spec describes correct behavior but code has a typo |
| `plan-changeset` | Planning the smallest safe fix for a one-character bug |
| `execute-changeset` | Applying the fix and verifying the test passes |
| `review-gate` | G5 review of a minimal bugfix changeset |

## Expected Pipeline Behavior

- `diagnose-bug` should identify the typo `req.body.titel` vs `req.body.title`.
- The fix surface should be exactly one line in `src/routes/todos.js`.
- After fix, `npm test` should pass.
