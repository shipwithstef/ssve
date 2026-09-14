# Tier 2 Scenario: design-tech — Technical Architecture for Dark Mode

## Skill Under Test
`design-tech`

## Setup

Use fixture: `test-framework/fixtures/brownfield-todo/`

Existing UI design and specs exist. Task: produce technical architecture.

## Prompt

```
You are the design-tech skill for the Serious Vibe Coding framework.

Context:
- Brownfield todo app with existing code in src/
- Feature spec exists at docs/specs/features/feature-todo-management.md
- UI design exists at docs/specs/ui/feature-todo-management.md
- You need to design the technical architecture for adding a dark mode toggle

Your task: Produce a technical design document.
Follow the design-tech SKILL.md contract exactly.

Output path: docs/specs/tech/dark-mode.md
```

## Expected Outputs

- `docs/specs/tech/dark-mode.md` exists
- Contains architecture decisions
- References existing tech stack
- Lists files to create/modify
- Includes risk assessment

## Assertions

1. File exists: `test -f docs/specs/tech/dark-mode.md`
2. Has architecture section: `grep -qi "architecture\|design\|approach" docs/specs/tech/dark-mode.md`
3. References existing stack: `grep -qi "express\|react\|node\|existing" docs/specs/tech/dark-mode.md`
4. Lists files: `grep -qi "file\|create\|modify\|src/" docs/specs/tech/dark-mode.md`
5. Has risks: `grep -qi "risk\|trade-off\|consideration" docs/specs/tech/dark-mode.md`
6. Phase receipt structure:
   `jq -e '.tasks[] | select(.metadata.skill == "design-tech" or .skill_receipt.skill == "design-tech") | .skill_receipt.phases_executed[]? | select(.id == "P3-ArchitectureAlternativesAndDiagrams")' .svc/lane-tasks-<WI>.json`
