# Framework Improvement: task-graph timestamp integrity

## Evidence
- **Source:** [2026-04-17-evolution.md](/workspace/seriousvibecoding/proposals/2026-04-17-evolution.md:1) plus the triggering replay in [2026-04-17-session-audit-wi-070.md](/home/svc-user/app-workspaces/example-marketplace/proposals/2026-04-17-session-audit-wi-070.md:1)
- **Finding:** task-graph persistence was treated as an audit source without any audit-grade timestamp provenance requirement; task-graph skill entrypoints still taught placeholder timestamp authoring, and tier-1 replays did not catch chronology drift across `lane-tasks-*.json` and `pipeline-decisions.jsonl` ([route-workflow/SKILL.md](/workspace/seriousvibecoding/route-workflow/SKILL.md:2416), [validate-feature/SKILL.md](/workspace/seriousvibecoding/validate-feature/SKILL.md:154), [diagnose-bug/SKILL.md](/workspace/seriousvibecoding/diagnose-bug/SKILL.md:98), [validate-framework-helper-behavior.sh](/workspace/seriousvibecoding/test-framework/evals/tier-1/validate-framework-helper-behavior.sh:93))
- **Severity:** medium

## Diagnosis
- **Root cause:** the helper layer already emitted real timestamps, but the doctrine and skill contracts did not require using those helper-generated wall-clock values as part of the audit trail. Example JSON and raw-creation instructions drifted away from the helper contract, so synthetic timestamps remained valid enough to slip through reviews and validators.
- **Category:** drift + fragility
- **Already in FRAMEWORK-STATE.md?** no (new before this loop; now recorded in Analysis History)

## Implementation
- **Route:** direct SKILL.md/doc/test edits
- **Files changed:** `route-workflow/SKILL.md`, `validate-feature/SKILL.md`, `diagnose-bug/SKILL.md`, `DOCTRINE.md`, `references/knowledge/svc/CAPABILITIES.md`, `test-framework/evals/tier-1/validate-framework-helper-behavior.sh`, `test-framework/evals/tier-1/validate-framework-self-management.sh`
- **Commits:** `ac60d61` (`improve-framework: enforce task-graph timestamp integrity`)

## Replay Verification
- **Replay target:** prove that task-graph creation, decision-log append, and task completion produce coherent chronology; prove the contract now requires helper-backed timestamp discipline
- **Result:** PASS
- **Evidence:** `bash test-framework/evals/tier-1/validate-framework-helper-behavior.sh` → `14 passed, 0 failed`; `bash test-framework/evals/tier-1/validate-framework-self-management.sh` → `215 passed, 0 failed`

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added `2026-04-17: WI-070 session replay — task-graph timestamp integrity and chronology drift`
- **Known Gaps:** none moved from deferred; this was a new gap
- **Decisions:** locked that persisted `lane-tasks-*.json` timestamps are audit-grade wall-clock evidence and helper-mediated for live top-level task mutations
- **Capabilities:** yes — continuity/task-graph rows updated in `references/knowledge/svc/CAPABILITIES.md`
