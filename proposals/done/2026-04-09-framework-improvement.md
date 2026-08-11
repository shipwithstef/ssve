# Framework Improvement: Helper-Layer Contract Hardening

## Evidence

- **Source:** Cross-model framework review findings supplied by the user on 2026-04-09
- **Finding:** The new helper layer under-enforced the task-state contract:
  - `scripts/task-graph.mjs:70` selected the first pending task without checking `blocked_by`
  - `scripts/task-graph.mjs:169` preserved stale `completed_at` / `skip_reason` when tasks left `completed`
  - `scripts/task-graph.mjs:60` validated only JSON shape, not duplicate ids / missing blockers / self-dependencies / cycles
  - `hooks/svc-task-completion-guard.sh:50` treated malformed hook payloads and malformed `lane-tasks.json` as soft-invalid and exited 0
  - `scripts/pipeline-log.mjs:68` accepted arbitrary `type` and `decided_by`
  - `hooks/hooks.json:24` documented a Bash here-string without clearly documenting Bash as a prerequisite
- **Severity:** HIGH overall

## Diagnosis

- **Root cause:** The runtime helpers were added to support the cross-host task-state contract, but they only covered the happy path. The framework described a dependency-aware task graph, a structured decision log, and a stop guard that enforces completion. The helpers behaved more like bootstrap utilities than contract enforcers.
- **Category:** fragility
- **Already in FRAMEWORK-STATE.md?** No. These were new helper-layer gaps, not previously listed known gaps.

## Implementation

- **Route:** Direct helper-script + eval hardening (quick-fix-style framework surgery, no new skill)
- **Files changed:**
  - `scripts/task-graph.mjs` — added graph-integrity validation (duplicate ids, missing blockers, self-dependencies, cycles), dependency-aware `next`, runtime guard for blocked `in_progress`, and completion-field cleanup on reopen
  - `hooks/svc-task-completion-guard.sh` — fail-closed behavior for malformed hook payloads / malformed task graphs, explicit `SVC_COMPLETION_FAIL_OPEN=true` escape hatch
  - `scripts/pipeline-log.mjs` — enum validation for `type` and `decided_by`
  - `hooks/hooks.json` — portable Stop-hook command, explicit Bash + Node prerequisite, fail-open env-var note
  - `test-framework/evals/tier-1/validate-framework-self-management.sh` — asserts Bash prerequisite + portable Stop-hook command
  - `test-framework/evals/tier-1/validate-framework-helper-behavior.sh` — new runtime replay for helper behavior
  - `FRAMEWORK-STATE.md` — analysis history + locked decisions updated
  - `references/knowledge/svc/CAPABILITIES.md` — helper/runtime capabilities synced
- **Commits:** Working tree changes atop `8e8c3cf` (not yet committed)

## Replay Verification

- **Replay target:** Prove the helper layer now enforces the runtime contract directly:
  1. `task-graph next` skips blocked pending tasks
  2. `task-graph validate` rejects duplicates, missing blockers, and cycles
  3. `task-graph set-status` clears completion-only fields when reopening tasks
  4. completion guard blocks malformed payloads / malformed `lane-tasks.json` by default and allows them only with `SVC_COMPLETION_FAIL_OPEN=true`
  5. pipeline-log rejects unknown enums
  6. full tier-1 suite still passes
- **Result:** **PASS**
- **Evidence:**
  - `bash test-framework/evals/tier-1/validate-framework-helper-behavior.sh` → PASS (13 checks, 0 failed)
  - `bash test-framework/evals/tier-1/validate-framework-self-management.sh` → PASS (170 checks, 0 failed)
  - `bash test-framework/evals/run-all-evals.sh` → PASS (tier-1: 9 scripts passed, 0 failed)

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add "2026-04-09: Helper-Layer Contract Hardening (dependency graph + stop guard + decision log)"
- **Known Gaps:** No existing gap moved; these were new findings
- **Decisions:** Lock helper-layer graph integrity rules and fail-closed completion-guard behavior
- **Capabilities:** Yes — update `references/knowledge/svc/CAPABILITIES.md` for dependency-safe task graphs, fail-closed Stop guard, decision-log enum enforcement, and test-framework static script count

## Status

**IMPLEMENTED** (2026-04-09, working tree atop `8e8c3cf`; replay verification passed)
