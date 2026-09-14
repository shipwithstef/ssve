# Tier 2 Scenario: execute-changeset — Fix Typo in Source

## Skill Under Test
`execute-changeset`

## Setup

Use fixture: `test-framework/fixtures/bugfix-todo/`

A diagnosis exists. Task: execute the fix.

## Prompt

```
You are the execute-changeset skill for the Serious Vibe Coding framework.

Context:
- Bug diagnosed: in src/routes/todos.js, req.body.titel should be req.body.title
- Plan exists at docs/plans/typo-fix.md
- This is a 1-line fix

Your task: Apply the fix, commit it, and verify the test passes.
Follow the execute-changeset SKILL.md contract exactly.
```

## Expected Outputs

- `src/routes/todos.js` is modified (titel → title)
- Git commit exists
- Test passes: `npm test` or equivalent exits 0

## Assertions

1. Fix applied: `grep -q "req.body.title" src/routes/todos.js`
2. Typo removed: `! grep -q "req.body.titel" src/routes/todos.js`
3. Git commit exists: `git log --oneline | grep -qi "fix\|typo\|title"`
4. Test passes (if test runner exists in fixture)
5. Phase receipt structure:
   `jq -e '.tasks[] | select(.skill_receipt.skill == "execute-changeset") | .skill_receipt.phases_executed[] | select(.id == "P2-ApplyPlan")' .svc/lane-tasks-*.json`
