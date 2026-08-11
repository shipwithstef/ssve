# Scenario: write-e2e-spec

## Setup
A repo contains a feature spec at `docs/specs/features/feature-todo.md` with 4 acceptance criteria covering: create a todo, mark a todo complete, delete a todo, and filter by active/completed. The app is a web UI served at `http://localhost:3000`. No E2E tests exist yet.

## Invocation
"Write e2e tests for the todo feature" or "add tests for this feature"

## Expected Behavior
1. MUST produce Playwright test files (e.g., `e2e/todo.spec.js` or equivalent) with runnable test code.
2. MUST cover user-visible interactions: click, type, and assert visible state (e.g., user clicks checkbox, types into input, sees updated list).
3. MUST NOT use internal API shortcuts such as direct database inserts, REST API POSTs bypassing the UI, or programmatic state mutations that a real user cannot perform.
4. MUST map each test case to a specific acceptance criterion from `docs/specs/features/feature-todo.md`.
5. MUST avoid positional role selectors unless an adjacent `selector-exception` explains why no stable selector exists.
6. MUST run or cite `validate-e2e-selector-discipline.mjs`.

## Success Criteria
- [ ] One or more Playwright (or equivalent) test files are created.
- [ ] Tests include `click`, `type` / `fill`, and `expect` / `toBeVisible` style assertions.
- [ ] No test calls internal APIs or mutates state outside the UI.
- [ ] Each test case references a specific AC by ID or description.
- [ ] No test uses `getByRole(...).first()`, `.last()`, or `.nth()` without a `selector-exception`.

## Assertions

1. Phase receipt structure:
   `jq -e '.tasks[] | select(.skill_receipt.skill == "write-e2e") | .skill_receipt.phases_executed[] | select(.id == "P5-RuntimeVerification")' .svc/lane-tasks-*.json`

### Process Checks
```json
[
  {
    "type": "artifact_exists",
    "glob": "e2e/specs/*.spec.ts",
    "label": "Playwright spec created"
  },
  {
    "type": "artifact_regex",
    "glob": "e2e/specs/*.spec.ts",
    "regex": "(click\\(|fill\\(|type\\()",
    "label": "test uses user-visible browser interactions"
  },
  {
    "type": "artifact_regex",
    "glob": "e2e/specs/*.spec.ts",
    "regex": "AC-|acceptance criterion|@AC-",
    "label": "test maps to acceptance criteria"
  },
  {
    "type": "artifact_not_regex",
    "glob": "e2e/specs/*.spec.ts",
    "regex": "getByRole\\s*\\([^\\n]+\\)\\s*\\.\\s*(first|last|nth)\\s*\\(",
    "label": "test avoids positional role selectors"
  },
  {
    "type": "output_regex",
    "regex": "validate-e2e-selector-discipline\\.mjs",
    "label": "selector validator was cited or run"
  },
  {
    "type": "phase_receipt",
    "skill": "write-e2e",
    "phase": "P5-RuntimeVerification",
    "label": "runtime verification phase receipt exists"
  }
]
```
