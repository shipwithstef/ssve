# Framework Improvement: Persona Trace Evidence Gate

**Status:** IMPLEMENTED
**Date:** 2026-06-05
**Evidence case:** Example Marketplace agentic assistant feature work after the persona
coverage task-graph gate
**Gap type:** feature validation / artifact traceability

## Problem

The existing persona coverage task-graph gate proves that a feature-class graph
has `build-personas` or an explicit `persona_coverage` decision. That is
necessary but not sufficient: downstream work can still pass with personas
available but not visibly used by the feature spec, journeys, UX/UI decisions,
technical trade-offs, implementation plan, E2E prioritization, or final feature
validation ledger.

The failure mode is a weak `Persona(s)` row such as `PASS`, `satisfied`,
`customer`, `admin`, or `all users`. It looks green but does not prove which
persona drove the AC or journey.

## Required Behavior

For user-facing or admin-facing feature work:

- feature specs must carry a `## Persona Trace` mapping;
- journeys must preserve concrete persona IDs/paths in headers/scenarios;
- UX/UI/tech design must map AC decisions to concrete persona pressure;
- implementation manifests must map tasks/tests back to persona-driven rules;
- E2E closeout must cite the persona source for critical tests;
- feature validation ledgers must reject weak persona cells.

Valid persona evidence is a concrete ID/path such as `P2`,
`docs/specs/personas/P2-real-time-discovery-customer.md`, `PERSONA_INDEX.md`, or
an explicit `N/A - ...` reason for system-only ACs.

## Implementation

- Added `_shared/persona-trace-contract.md`.
- Strengthened `scripts/validate-feature-closeout-ledger.mjs` so `Persona(s)`
  requires a concrete persona ID/path or an `N/A - ...` reason.
- Added tier-1 regression coverage in
  `test-framework/evals/tier-1/validate-persona-trace-feature-ledger.sh`.
- Threaded persona-trace requirements through `write-spec`, `write-journeys`,
  `design-ux`, `design-ui`, `design-tech`, `plan-changeset`, `write-e2e`, and
  `review-gate`.
- Updated `FRAMEWORK-STATE.md`, `references/knowledge/svc/CAPABILITIES.md`,
  and WI tracking.

## Acceptance Criteria

- A feature validation ledger row with `Persona(s)=PASS` fails.
- A row with `P2 ...` passes.
- A row with `docs/specs/personas/P2-...md` passes.
- A system-only row with `N/A - ...` reason passes.
- Review and producer skills tell agents where to place persona trace evidence
  before implementation and validation.

## Verification

```bash
bash test-framework/evals/tier-1/validate-persona-trace-feature-ledger.sh
bash test-framework/evals/tier-1/validate-persona-coverage-task-graph-gate.sh
bash test-framework/evals/run-all-evals.sh
```

Expected: PASS.

## Rollback

Revert the ledger validator strictness, remove the tier-1 regression, and revert
the producer-skill Persona Trace requirements. The older task-graph persona
coverage gate would remain, but downstream artifact traceability would again be
review-prose only.
