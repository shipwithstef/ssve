# Scenario: plan-changeset manifest production

## Setup

Copy the full `examples/todo-api/` fixture tree into a temporary workspace:
- `docs/specs/vision.md`
- `docs/specs/personas/P1.md`
- `docs/specs/features/feature-todo-management.md`
- `docs/specs/journeys/J01-todo-lifecycle.feature.md`
- `docs/specs/ux/feature-todo-management.md`
- `docs/specs/ui/feature-todo-management.md`
- `docs/specs/design-system.md`

Patch the feature spec status to BASELINED:

```
sed -i 's/Status:.*/Status: BASELINED/' docs/specs/features/feature-todo-management.md
```

## Prompt

```
Use the plan-changeset skill to produce an implementation manifest for the todo management feature. The feature spec is BASELINED at docs/specs/features/feature-todo-management.md.
```

## Expected Outputs

### File Exists

- `docs/plans/manifest.md` OR `docs/plans/*/manifest.md` — manifest file created

### Content Checks

- [ ] Contains a task graph or task list (lines matching `### Task` or `| T-` or `## Task`)
- [ ] Contains AC-to-task mapping (mentions AC identifiers like `AC-1` mapped to tasks)
- [ ] Contains a simulation report section (grep for "Simulation" or "simulation")
- [ ] Manifest references the feature spec path
- [ ] Contains `**Status:** DRAFTED` or equivalent lifecycle marker
- [ ] Phase receipt structure:
  `jq -e '.tasks[] | select(.metadata.skill == "plan-changeset" or .skill_receipt.skill == "plan-changeset") | .skill_receipt.phases_executed[]? | select(.id == "P3-ManifestTaskGraphMapping")' .svc/lane-tasks-<WI>.json`

## Chain Continuation

If `--progressive` were set, the next skill would be `execute-changeset`.
