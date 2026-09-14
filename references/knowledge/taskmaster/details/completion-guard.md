# TaskMaster: Completion Guard Pattern — Layer 3 Detail

## Mechanism

TaskMaster prevents premature agent stopping through a two-part contract:

1. **Done token:** `TASKMASTER_DONE::<session_id>` — the agent MUST emit this exact string on its own line when work is genuinely 100% complete
2. **Stop hook enforcement:** If the token is missing when the agent tries to stop, the stop is blocked and a compliance prompt is injected

### Claude path (Stop hook)

`check-completion.sh` runs as a Claude Code Stop hook:
- Reads the session transcript via `$INPUT` JSON (contains `session_id`, `transcript_path`, `last_assistant_message`)
- Searches for `TASKMASTER_DONE::<session_id>` in the last assistant message, then falls back to searching the last 400 lines of the transcript JSONL
- If found: `exit 0` (allow stop)
- If not found: returns `{ decision: "block", reason: "<compliance prompt>" }`
- Counter file at `/tmp/taskmaster/<session_id>` tracks how many times stop was blocked (for `TASKMASTER_MAX` limit)
- Subagent bypass: transcripts with < 20 lines auto-pass (avoids blocking short agent dispatches)

### Codex path (same-process injection)

`inject-continue-codex.sh` watches the Codex session JSONL log:
- Follows `task_complete` / `turn_complete` events
- Extracts `last_agent_message` from each event
- Checks for done token in the message
- If missing: writes a continuation prompt to `inject.*.txt` file in the emit directory
- The expect bridge (`run-codex-expect-bridge.exp`) polls the emit directory and injects the prompt into the running Codex PTY via bracketed paste
- Deduplication: tracks `turn_id` and content `cksum` signature to avoid re-injecting for the same turn
- State persistence: `--state-dir` saves injector state to `injector-state.env` for restart recovery
- Log rotation: `--follow-latest-dir` switches to newest matching log file when sessions restart

## Analysis

### What makes this effective for svc

1. **The compliance prompt is the real innovation.** It's not just "keep going" — it's a structured 7-step checklist that forces goal confrontation before allowing stop. The anti-rationalization language ("PROGRESS IS NOT COMPLETION", "DO NOT NARRATE — EXECUTE") directly addresses the failure mode we hit on WI-012 (stopping mid-lane to "recommend a fresh session").

2. **The Stop hook pattern works in Claude Code today.** `check-completion.sh` uses the exact Claude Code hooks API (`{ decision: "block", reason: "..." }`). This can be adapted for svc — when a task graph is active and not all tasks are completed, block the stop with a compliance prompt that names the remaining tasks.

3. **Subagent bypass is smart.** Short transcripts (< 20 lines) get a free pass. This prevents blocking subagent dispatches (which are supposed to be short) while still enforcing completion on main sessions.

4. **Counter with escalation (`TASKMASTER_MAX`)** provides an escape hatch. If the agent is truly stuck after N attempts, allow the stop rather than looping forever. svc currently has no such limit — the 3-attempt escalation in diagnose-bug is analogous but skill-specific.

### What doesn't apply to svc

1. **Done token as a string literal** — svc already has a richer completion signal: the task graph with all tasks `completed` + the Pillars Coverage Matrix fully filled. A flat string token would be a regression.

2. **PTY injection for Codex** — mechanical transport, not a pattern to blend. svc doesn't operate at the PTY level.

3. **Single compliance prompt for everything** — svc's per-skill self-verify checks are more precise than a one-size-fits-all prompt. But the *anti-rationalization language* should be adopted across all skills.

## L4 Pointers

- Full compliance prompt text: `taskmaster-compliance-prompt.sh` (37 lines)
- Stop hook implementation: `check-completion.sh` (119 lines)
- Codex injector with state persistence: `hooks/inject-continue-codex.sh` (414 lines)
- Install script (hooks setup): `install.sh`
