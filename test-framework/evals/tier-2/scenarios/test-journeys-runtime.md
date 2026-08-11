# Scenario: test-journeys-runtime

## Setup
A repo contains a journey document at `docs/specs/journeys/login.feature.md` with Gherkin scenarios and mapped acceptance criteria. A local server is running at `http://localhost:3000` serving the login flow. The journey scenarios describe: (1) successful login with valid credentials, (2) failed login with invalid password, (3) blocked login after 3 failed attempts.

## Invocation
"Run QA by journey for login flow" or "validate journeys"

## Expected Behavior
1. MUST verify runtime behavior at the reachable URL (`http://localhost:3000/login`).
2. MUST capture evidence for each scenario (screenshot, curl output, or structured HTTP response log).
3. MUST update AC status in the spec or journey document to reflect current test results.
4. MUST classify each acceptance criterion as PASS, FAIL, or BLOCKED with a brief rationale.
5. MUST persist `scenarios.json` with terminal statuses only: `executed`, `skipped-infeasible`, or `skipped-user-approved`.
6. MUST record `viewport_stage=desktop` for the first pass and record an S0 static/code pre-check before browser work.
7. MUST run and cite `verify-skill-contract.mjs test-journeys-closeout` and `validate-journey-execution-trace.mjs`.

## Success Criteria
- [ ] At least one HTTP request or browser interaction is executed against `localhost:3000/login`.
- [ ] Evidence (screenshot, curl output, or response log) is produced for every scenario.
- [ ] AC status fields in the journey doc or a linked report are updated.
- [ ] Every AC has a classification of PASS, FAIL, or BLOCKED.
- [ ] `docs/specs/features/test-evidence/<run>/scenarios.json` exists and no scenario remains pending.
- [ ] `docs/specs/features/test-evidence/<run>/SUMMARY.md` records `viewport_stage=desktop`, an S0 code/static pre-check, and the closeout validator command.
- [ ] Phase receipt includes runtime evidence:
  `jq -e '.tasks[] | select(.skill_receipt.skill == "test-journeys") | .skill_receipt.phases_executed[] | select(.id == "P2-RuntimeExecution")' .svc/lane-tasks-*.json`

### Process Checks
```json
[
  {
    "type": "artifact_exists",
    "glob": "docs/specs/features/test-evidence/*/scenarios.json",
    "label": "scenario inventory persisted"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/features/test-evidence/*/scenarios.json",
    "regex": "\"status\"\\s*:\\s*\"(executed|skipped-infeasible|skipped-user-approved)\"",
    "label": "scenario inventory contains terminal status"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/features/test-evidence/*/SUMMARY.md",
    "regex": "viewport_stage=desktop",
    "label": "desktop viewport stage recorded"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/features/test-evidence/*/SUMMARY.md",
    "regex": "(S0\\s+(static|code)|✅.*\\(code\\))",
    "label": "S0 static/code precheck recorded"
  },
  {
    "type": "artifact_regex",
    "glob": "docs/specs/features/test-evidence/*/SUMMARY.md",
    "regex": "verify-skill-contract\\.mjs\\s+test-journeys-closeout",
    "label": "test-journeys closeout validator recorded"
  },
  {
    "type": "phase_receipt",
    "skill": "test-journeys",
    "phase": "P2-RuntimeExecution",
    "label": "runtime execution phase receipt exists"
  }
]
```
