# Framework Improvement: Stop hooks session-isolation for parallel execution safety

## Evidence
- **Source:** User reported critical crosstalk and state intertwining during concurrent host/session execution in the same physical repository workspace.
- **Finding:**
  1. `svc-stop-quality.js` accumulates files in a single, hardcoded shared file `.svc/svc-edited-files.json`.
  2. `svc-task-completion-guard.sh` scans and aggregates all active `.svc/lane-tasks-*.json` files instead of isolating to the active session's WI.
  3. `svc-task-completion-guard.sh` reads the global `.svc/session-contract.jsonl` tail to check execution mode, leading to race conditions where parallel sessions overwrite each other's context.
- **Severity:** High

## Diagnosis
- **Root cause:** The Stop hooks are session-agnostic. They assume a single active agent session operates on the repository at a time, resulting in shared files pollution and crosstalk when multiple sessions run concurrently.
- **Category:** fragility / concurrency
- **Already in FRAMEWORK-STATE.md?** No (New finding)

## Implementation
- **Route:** normal pipeline
- **Files planned:**
  - `hooks/svc-stop-quality.js`
  - `hooks/svc-task-completion-guard.sh`
  - `test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh`
- **Commits:** TBD

## Replay Verification
- **Replay target:** `test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh`
- **Result:** TBD
- **Evidence:** TBD

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Record Stop hook session-isolation and concurrent execution safety implementation under WI-351.
- **Known Gaps:** Move concurrent hook collision/crosstalk from gaps to fixed.
- **Decisions:** Codify that Stop/PostToolUse hooks must remain session-isolated by uniquely keying transient/accumulator state by `session_id` resolved from hook payload or host env vars.
- **Capabilities:** No capability schema change.
