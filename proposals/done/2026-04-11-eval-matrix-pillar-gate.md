# Framework Improvement: Task-Level Eval Matrix + Pillar Gate

**Status:** IMPLEMENTED (2026-04-11)

## Evidence

- **Source:** User-reported design discussion — framework had pillar revisit audit in diagnose-bug output but no machine enforcement that all 8 pillars were actually assessed before task close-out
- **Finding:** `diagnose-bug` Step 4.4 required the Pillar Revisit Audit in the WI file, but nothing prevented an agent from marking the task `completed` with partial or missing pillar entries. Self-verify check #4 required the audit section to exist, but could not verify that evidence was substantive.
- **Severity:** medium — created a gap between "audit section present" (what self-verify checked) and "audit actually done" (what we want)

## Diagnosis

- **Root cause:** Enforcement lived in the WI file (prose) and self-verify (text grep). Both are post-hoc and can pass with placeholder text. No hook fired at the exact moment of task completion to inspect pillar state.
- **Category:** missing capability — framework lacked task-level eval matrices and per-task hook gates
- **Already in FRAMEWORK-STATE.md?** No (new gap surfaced in conversation)

## Design Decisions

### Hook trigger: PreToolUse on TaskUpdate (not Stop hook)

Stop hook fires when the session ends. PreToolUse on `TaskUpdate(completed)` fires at the exact moment the agent tries to mark the task done — tighter, task-scoped enforcement. Both can coexist; they serve different roles (task-level gate vs session-level completion guard).

### PostToolUse on TaskUpdate(in_progress)

Fires when a task starts. Injects the eval matrix reminder immediately into agent context. For `diagnose-bug` tasks with no matrix yet: auto-initializes the 8-pillar template in `lane-tasks.json`. This means route-workflow doesn't need to be updated to include the matrix in task creation — the hook bootstraps it on first use.

### Quality modes: structural (default) vs AI

- `none` — null check only (presence gate)
- `structural` — prefix format (`UPDATED / UNCHANGED — VERIFIED / N/A —`) + evidence references enforced deterministically (default, zero cost)
- `ai` — structural first, then `claude -p` quality check to verify evidence is substantive (opt-in via `SVC_EVAL_MODE=ai`, ~$0.001/task)

`claude -p` was chosen over direct Anthropic API: already authenticated via Claude Code session, no key management, simpler code.

### Scope: TaskUpdate only

`matcher: "TaskUpdate"` means hooks fire only on task state transitions — zero overhead on Read, Edit, Grep, Bash, Skill, or any other tool.

### Token impact: minor

- Hook scripts: zero LLM tokens (shell process outside model)
- PostToolUse injection: ~150–250 tokens per `in_progress` transition (only for tasks with eval_matrix)
- PreToolUse block: ~50–100 tokens only when nulls remain (blocking message)
- Structural check: zero tokens

## Implementation

- **Route:** direct file additions + diagnose-bug contract surgery
- **Files changed:**
  - `scripts/eval-gate.mjs` — NEW: two-mode gate script (pre = completion gate, post = reminder injector). Structural + AI modes, auto-init for diagnose-bug tasks, fail-open on malformed input.
  - `hooks/hooks.json` — MODIFIED: added `svc-eval-gate-pre` (PreToolUse/TaskUpdate) and `svc-eval-gate-post` (PostToolUse/TaskUpdate) entries with installation instructions
  - `diagnose-bug/SKILL.md` — MODIFIED: added "Eval matrix sync — hooks-enforced" subsection after Step 4.4 with translation table (audit conclusion → eval_matrix value vocabulary)

## Replay Verification

- **Replay target:** tier-1 evals + mental scenario: diagnose-bug task starts → PostToolUse injects 8-pillar matrix reminder; agent tries TaskUpdate(completed) with nulls → PreToolUse blocks with list; agent fills all 8 → gate passes
- **Result:** PENDING — user will test with next work item after restarting Claude Code to reload hooks
- **Structural note:** `scripts/eval-gate.mjs` exits 0 (fail-open) when `lane-tasks.json` is absent or task has no matrix — existing lanes without eval_matrix are unaffected

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** add this entry
- **Known Gaps:** none moved (new capability, not a known gap)
- **Capabilities:** `references/knowledge/svc/CAPABILITIES.md` — add eval matrix gate to hooks section
- **Hooks count:** 2 PreToolUse → 3 PreToolUse; PostToolUse: 0 → 1
