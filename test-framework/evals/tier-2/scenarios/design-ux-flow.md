# Tier 2 Scenario: design-ux — Brownfield Feature UX Flow

## Skill Under Test
`design-ux`

## Setup

Use fixture: `test-framework/fixtures/brownfield-todo/`

This is a brownfield todo app with existing specs, personas, and journeys.
The task is to design UX flows for adding a "dark mode toggle" feature.

## Prompt

```
You are the design-ux skill for the Serious Vibe Coding framework.

Context:
- You are working on a brownfield todo app (see docs/specs/ for existing artifacts)
- The feature spec at docs/specs/features/feature-todo-management.md describes todo CRUD
- A new feature "dark mode toggle" has been validated and spec'd
- Personas exist at docs/specs/personas/P1.md

Your task: Produce a UX design document for the dark mode toggle feature.
Follow the design-ux SKILL.md contract exactly.

Output path: docs/specs/ux/dark-mode.md
```

## Expected Outputs

- `docs/specs/ux/dark-mode.md` exists
- Contains "## Screen Inventory" section
- Contains "## State Machines" section
- Contains "## Flow Diagrams" section
- References the existing personas

## Assertions

1. File exists: `test -f docs/specs/ux/dark-mode.md`
2. Has Screen Inventory: `grep -q "## Screen Inventory" docs/specs/ux/dark-mode.md`
3. Has State Machines: `grep -q "## State Machines" docs/specs/ux/dark-mode.md`
4. Has Flow Diagrams: `grep -q "## Flow Diagrams" docs/specs/ux/dark-mode.md`
5. References personas: `grep -qi "persona\|user\|owner\|customer" docs/specs/ux/dark-mode.md`
6. Phase receipt structure:
   `jq -e '.tasks[] | select(.metadata.skill == "design-ux" or .skill_receipt.skill == "design-ux") | .skill_receipt.phases_executed[]? | select(.id == "P3-ScreenStateFlowDesign")' .svc/lane-tasks-<WI>.json`
