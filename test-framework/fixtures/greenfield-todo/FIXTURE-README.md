# Fixture: greenfield-todo

## What This Simulates

A brand-new project with zero svc structure. The repo contains only a basic
Express server with CRUD routes for todos — no docs, no specs, no personas,
no plans, and no `.svc/` state directory.

## Intended Test Scenarios

This fixture tests the **bootstrap / greenfield lane** of the svc pipeline:

| Skill | What It Tests |
|-------|---------------|
| `write-vision` | Creating a vision document from scratch |
| `analyze-domain` | Identifying domain context for a simple REST API |
| `build-personas` | Building personas when none exist |
| `validate-feature` | Validating a new feature idea against a blank slate |
| `plan-capabilities` | Recommending tools/MCPs for a greenfield Express project |

## Expected Pipeline Behavior

- `route-workflow` should detect no svc artifacts and route to bootstrap mode.
- Skills should create `docs/specs/vision.md`, `docs/specs/personas/`, etc.
- No drift or sync concerns because there is no prior spec state.
