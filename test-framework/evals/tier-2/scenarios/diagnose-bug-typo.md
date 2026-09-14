# Tier 2 Scenario: diagnose-bug — Find Typo Bug

## Skill Under Test
`diagnose-bug`

## Setup

Use fixture: `test-framework/fixtures/bugfix-todo/`

A bug exists where `req.body.title` was changed to `req.body.titel` in `src/routes/todos.js`.
The test at `src/routes/todos.test.js` fails.

## Prompt

```
You are the diagnose-bug skill for the Serious Vibe Coding framework.

Context:
- A bug has been reported: "Creating a todo returns 400 instead of 201"
- Test file: src/routes/todos.test.js (failing)
- Source file: src/routes/todos.js (suspected)
- Spec: docs/specs/features/feature-todo-management.md (describes correct behavior)

Your task: Produce a bug diagnosis brief.
Follow the diagnose-bug SKILL.md contract exactly.

Output path: docs/specs/bugfixes/YYYY-MM-DD-todo-creation-brief.md
```

## Expected Outputs

- Bug brief exists
- Identifies root cause (typo: `titel` instead of `title`)
- Names affected file and line
- Includes pattern scan

## Assertions

1. File exists: `test -f docs/specs/bugfixes/*-brief.md`
2. Identifies typo: `grep -qi "titel\|typo\|misspell" docs/specs/bugfixes/*-brief.md`
3. Names file: `grep -q "todos.js" docs/specs/bugfixes/*-brief.md`
4. Has root cause: `grep -qi "root cause" docs/specs/bugfixes/*-brief.md`
5. Has pattern scan: `grep -qi "pattern\|grep\|search" docs/specs/bugfixes/*-brief.md`
6. Phase receipt structure:
   `jq -e '.tasks[] | select(.skill_receipt.skill == "diagnose-bug") | .skill_receipt.phases_executed[] | select(.id == "P3-RootCause")' .svc/lane-tasks-*.json`

### Process Checks
```json
[
  {
    "type": "artifact_exists",
    "glob": "docs/specs/bugfixes/*-brief.md",
    "label": "bug diagnosis brief exists"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/bugfixes/*-brief.md",
    "regex": "req\\.body\\.titel.*req\\.body\\.title|req\\.body\\.title.*req\\.body\\.titel",
    "label": "root cause compares wrong and correct field names"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/bugfixes/*-brief.md",
    "regex": "src/routes/todos\\.js:[0-9]",
    "label": "root cause names affected file and line"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/bugfixes/*-brief.md",
    "regex": "(rg|grep|search).*(titel|title)",
    "label": "pattern scan includes concrete search command or result"
  },
  {
    "type": "phase_receipt",
    "skill": "diagnose-bug",
    "phase": "P3-RootCause",
    "label": "diagnose-bug P3 root-cause phase receipt exists"
  }
]
```
