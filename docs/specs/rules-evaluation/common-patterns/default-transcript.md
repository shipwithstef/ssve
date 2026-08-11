# Default Transcript — common/patterns.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Starting implementation of new functionality
2. Designing a data access layer
3. Designing an API response envelope

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — new functionality:**
I search for existing similar implementations, check if a library solves it.
I don't have a formal "parallel agents to evaluate skeleton projects" pipeline.
I'd search manually, read docs, and propose an approach.

**Scenario 2 — data access layer:**
Repository pattern with findAll/findById/create/update/delete is what I'd
recommend. This is my default architectural suggestion for a clean data layer.

**Scenario 3 — API response envelope:**
I know several patterns: `{ data, error }`, `{ ok, data, message }`, JSend
format `{ status, data }`. I don't have a single canonical envelope shape.
I'd pick or recommend based on project conventions.
