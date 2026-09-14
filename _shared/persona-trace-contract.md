# Persona Trace Contract

Feature-class work must prove that persona coverage influenced the artifacts that
drive implementation, not only that persona files exist.

## Required Trace

For user-facing or admin-facing feature work, carry concrete persona references
through the chain:

| Artifact | Required persona evidence |
|---|---|
| Feature spec | Stories name persona IDs (`P1`, `P2`, etc.) and include a `## Persona Trace` table mapping personas to stories, ACs, and non-goals. |
| Journey docs | Journey headers name persona IDs and scenario metadata preserves which persona path each scenario serves. |
| UX design | A `## Persona Trace` section maps personas to flows, emotional/trust moments, and ACs. |
| UI design | AC traceability names the persona IDs affected by each screen/component state. |
| Technical design | Feasibility decisions preserve persona pressure when trade-offs affect a user/admin path. |
| Plan manifest | The prerequisite alignment matrix maps tasks to persona-driven rules, not only AC IDs. |
| E2E | Tests cite the journey/persona source when prioritizing coverage. |
| Feature validation ledger | The `Persona(s)` column cites a concrete persona ID/path or an explicit `N/A - ...` reason. |

Weak entries such as `PASS`, `satisfied`, `customer`, or `all users` do not prove
traceability. Use `P2`, `P2 Real-Time Discovery Customer`,
`docs/specs/personas/P2-real-time-discovery-customer.md`, or
`N/A - backend-only audit metadata with no user/admin journey`.

