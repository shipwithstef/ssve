# Tier 2 Scenario: onboard-repo — Convert Existing Repo to svc

## Skill Under Test
`onboard-repo`

## Setup

Use fixture: `test-framework/fixtures/greenfield-todo/`

A plain todo app with no svc structure. Task: onboard it.

## Prompt

```
You are the onboard-repo skill for the Serious Vibe Coding framework.

Context:
- This is an existing todo app with code in src/ and a README
- No svc structure exists (no docs/specs/, no .svc/)
- The app has: Express server, todo CRUD routes, in-memory store

Your task: Map this repo into svc working mode.
Follow the onboard-repo SKILL.md contract exactly.
```

## Expected Outputs

- `docs/specs/project-state.md` exists
- `docs/specs/router-context.md` exists
- `docs/specs/work-items/INDEX.md` exists
- `.svc/` directory created with state files

## Assertions

1. Project state: `test -f docs/specs/project-state.md`
2. Router context: `test -f docs/specs/router-context.md`
3. Work items INDEX: `test -f docs/specs/work-items/INDEX.md`
4. svc state: `test -d .svc && test -f .svc/orchestrator-state.json`
5. Phase receipt structure:
   `jq -e '.tasks[] | select(.skill_receipt.skill == "onboard-repo") | .skill_receipt.phases_executed[] | select(.id == "P4-CoverageAuditInvocation")' .svc/lane-tasks-*.json`
