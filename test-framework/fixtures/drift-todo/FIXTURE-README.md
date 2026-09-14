# Fixture: drift-todo

## What This Simulates

A brownfield svc repo where the spec and code have diverged.

- The **spec** says todos have `priority: high|medium|low`.
- The **code** implements `urgency: 1|2|3` instead.
- The **journey** references `priority` but the API does not support it.

This is a classic spec-drift scenario: the implementation took a different
naming/typing direction than what was documented.

## Intended Test Scenarios

This fixture tests the **drift lane**:

| Skill | What It Tests |
|-------|---------------|
| `sync-spec-code` | Detecting drift between spec (priority) and code (urgency) |
| `write-journeys` | Refreshing journey files to match either the spec or the code |
| `route-workflow` | Routing to drift lane when spec/code misalignment is detected |

## Drift Details

| Artifact | Says | Actually |
|----------|------|----------|
| `docs/specs/features/feature-todo-management.md` AC-1.3 | Todo has `priority` | Code stores `urgency` |
| `docs/specs/features/feature-todo-management.md` AC-1.4 | Priority: high\|medium\|low | API accepts `urgency: 1\|2\|3` |
| `docs/specs/journeys/J01-todo-lifecycle.feature.md` | POST with `priority: high` | API ignores `priority`, uses `urgency` |
| `src/store.js` | — | Creates todos with `urgency` (default 2) |
| `src/routes/todos.js` | — | Validates `urgency` as integer 1-3 |

## Expected Pipeline Behavior

- `sync-spec-code` should flag the mismatch between `priority` (spec/journey) and `urgency` (code).
- The skill should recommend either updating the spec to match the code, or refactoring the code to match the spec.
