# Tier 2 Scenario: review-gate — Review Simple Code Change

## Skill Under Test
`review-gate`

## Setup

Use fixture: `test-framework/fixtures/brownfield-todo/`

Make a small code change and ask review-gate to evaluate it.

## Prompt

```
You are the review-gate skill for the Serious Vibe Coding framework.

Context:
- A changeset has been applied to the brownfield todo app
- The change adds a new endpoint: GET /todos/stats that returns count of completed vs pending todos
- Review this changeset against the spec at docs/specs/features/feature-todo-management.md

Your task: Run the 5-step review protocol and produce findings.
Follow the review-gate SKILL.md contract exactly.

Output: A review findings document.
```

## Expected Outputs

- Review findings document exists or is embedded in output
- Contains severity classifications (CRITICAL/HIGH/MEDIUM/LOW)
- References acceptance criteria
- Has concrete findings (or explicitly passes with zero findings)

## Assertions

1. Has severity: `grep -qi "critical\|high\|medium\|low\|severity" output.txt`
2. References AC: `grep -qi "acceptance criteria\|AC\|criteria" output.txt`
3. Has findings or PASS: `grep -qi "finding\|pass\|approve\|no issues" output.txt`
4. Phase receipt structure:
   `jq -e '.tasks[] | select(.metadata.skill == "review-gate" or .skill_receipt.skill == "review-gate") | .skill_receipt.phases_executed[]? | select(.id == "P5-GateDecisionBacklog")' .svc/lane-tasks-<WI>.json`
