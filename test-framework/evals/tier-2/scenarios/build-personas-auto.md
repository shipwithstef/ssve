# Tier 2 Scenario: build-personas — Auto-Discover Personas

## Skill Under Test
`build-personas`

## Setup

Use fixture: `test-framework/fixtures/greenfield-todo/`

A plain todo app. Task: discover and build personas.

## Prompt

```
You are the build-personas skill for the Serious Vibe Coding framework.

Context:
- This is a new todo app for small teams
- Vision: docs/specs/vision.md (if exists) or README describes the product
- No personas exist yet

Your task: Build user personas for this product.
Follow the build-personas SKILL.md contract exactly. Use Mode 7 (Auto-discovery).

Output path: docs/specs/personas/
```

## Expected Outputs

- `docs/specs/personas/` directory exists
- At least one persona file created
- Each persona has name, role, goals, frustrations

## Assertions

1. Directory exists: `test -d docs/specs/personas`
2. Has persona files: `ls docs/specs/personas/*.md 2>/dev/null | wc -l` ≥ 1
3. Has structure: `grep -qi "role\|goal\|frustration\|pain point" docs/specs/personas/*.md`
4. Named personas: `grep -qi "persona\|user\|actor" docs/specs/personas/*.md`
5. Phase receipt structure: `jq -e '.tasks[] | select(.skill_receipt.skill == "build-personas") | .skill_receipt.phases_executed[] | select(.id == "P5-IndexVisionFeedback")' .svc/lane-tasks-*.json`
