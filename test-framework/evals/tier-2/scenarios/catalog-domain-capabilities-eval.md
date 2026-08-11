# Scenario: catalog-domain-capabilities

## Setup

Scaffold a minimal project with:
- `docs/specs/vision.md` (any product vision)
- `docs/specs/analyze-competitors.md` with 3+ direct competitors and feature lists
- `docs/specs/domain-profile.md` with industry context
- Empty `docs/specs/journeys/` and `docs/specs/features/` directories

## Invocation

"Build a capability catalog for this project" or "catalog-domain-capabilities --progressive --lane greenfield"

## Expected Behavior

1. The agent MUST produce `docs/specs/capability-catalog.md` with a classified capability matrix.
2. The agent MUST produce `docs/specs/capability-catalog.data.json` that validates against `references/schemas/capability-catalog.schema.json`.
3. The agent MUST classify each capability with all 6 dimensions: frequency, maturity, visibility, kano, convergence_velocity, mechanic_count.
4. The agent MUST compute a Build Priority Score (BPS) for every capability and emit a ranked `build_priority_ranking`.
5. The agent MUST extract mechanics per capability (not just feature names).
6. The agent MUST produce a gap report comparing existing project artifacts against the catalog.
7. The agent MUST write the knowledge layer to `references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json`.

## Success Criteria

- [ ] `docs/specs/capability-catalog.md` exists with Executive Summary, Capabilities by Category, Mechanic Reference, Gap Analysis, and Journey Scaffolding Guide sections
- [ ] `docs/specs/capability-catalog.data.json` exists and passes JSON schema validation
- [ ] ≥80% of capabilities have `mechanics[]` with length > 0
- [ ] All `universal` capabilities have `kano` and `convergence_velocity` classified
- [ ] `build_priority_ranking[]` length equals `capabilities[]` length
- [ ] `gap_report[]` is present and non-empty when project artifacts exist
- [ ] Knowledge layer file exists at `references/knowledge/domains/<domain>/CAPABILITY-CATALOG.json`
- [ ] `.version` file exists alongside knowledge layer with date

## Assertions

1. Phase receipt structure:
   `jq -e '.tasks[] | select(.skill_receipt.skill == "catalog-domain-capabilities") | .skill_receipt.phases_executed[] | select(.id == "P5-GapPriorityScoring")' .svc/lane-tasks-*.json`
