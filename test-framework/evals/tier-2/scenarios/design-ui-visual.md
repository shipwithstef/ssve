# Tier 2 Scenario: design-ui — Visual Design for Dark Mode

## Skill Under Test
`design-ui`

## Setup

Use fixture: `test-framework/fixtures/brownfield-todo/`

Existing UX design exists at `docs/specs/ux/feature-todo-management.md`.
Task: produce visual design for the dark mode toggle feature.

## Prompt

```
You are the design-ui skill for the Serious Vibe Coding framework.

Context:
- Brownfield todo app with existing design system at docs/specs/design-system.md
- UX design for dark mode exists at docs/specs/ux/feature-todo-management.md (reference for structure)
- You need to produce visual design for a dark mode toggle

Your task: Produce a UI design document and update the design system if needed.
Follow the design-ui SKILL.md contract exactly.

Output path: docs/specs/ui/dark-mode.md
```

## Expected Outputs

- `docs/specs/ui/dark-mode.md` exists
- References design tokens (not ad-hoc hex values)
- Contains component specifications
- Responsive behavior documented

## Assertions

1. File exists: `test -f docs/specs/ui/dark-mode.md`
2. Uses design tokens: `grep -qi "token\|theme\|design-system" docs/specs/ui/dark-mode.md`
3. Has components: `grep -qi "component\|button\|toggle\|switch" docs/specs/ui/dark-mode.md`
4. Mentions responsive: `grep -qi "responsive\|mobile\|breakpoint" docs/specs/ui/dark-mode.md`
5. Phase receipt structure:
   `jq -e '.tasks[] | select(.metadata.skill == "design-ui" or .skill_receipt.skill == "design-ui") | .skill_receipt.phases_executed[]? | select(.id == "P3-ComponentTokenSpecification")' .svc/lane-tasks-<WI>.json`
