# Fixture: brownfield-todo

## What This Simulates

An existing repository that has already been converted to the svc framework.
All canonical artifacts exist and are up-to-date. A completed work item
(WI-001) is recorded in `.svc/lane-tasks-WI-001.json`. The repo is in a
stable, mapped state ready for brownfield feature work.

## Intended Test Scenarios

This fixture tests the **brownfield-feature lane**:

| Skill | What It Tests |
|-------|---------------|
| `sync-spec-code` | Verifying specs match the existing code |
| `validate-feature` | Validating a new feature against existing personas/journeys |
| `write-spec` | Writing a delta spec for a new feature in an existing repo |
| `route-workflow` | Correctly routing to brownfield-feature mode when svc artifacts exist |

## Expected Pipeline Behavior

- `route-workflow` detects existing svc structure and routes to `brownfield-feature`.
- `sync-spec-code` should report no drift (code and spec are aligned).
- New feature specs should reference existing personas and journeys.
