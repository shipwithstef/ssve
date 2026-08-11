# TaskMaster (blader/taskmaster) — Layer 2 Capabilities

**Source:** https://github.com/blader/taskmaster
**Version:** 4.2.0
**Extracted:** 2026-04-09
**What it is:** A completion guard for coding agents. Prevents premature agent stopping by requiring an explicit, machine-parseable done signal (`TASKMASTER_DONE::<session_id>`) before a session can end.

**Not to be confused with:** `eyaltoledano/claude-task-master` (a different, larger project focused on AI-driven task breakdown with MCP server + tasks.json).

## Core Philosophy

"Progress is not completion." The agent must not be allowed to stop based on a convincing summary alone. Completion must be explicit and machine-checkable.

Four principles:
1. **Evidence over narrative** — machine-parseable done signal, not prose
2. **Same-session recovery** — when a turn is incomplete, continue in the same session, don't restart
3. **Goal re-anchoring** — compliance prompt forces the model back to the user's actual request
4. **Automation-safe signaling** — deterministic token for CI/wrapper flows

## Architecture

| Component | Path | Purpose |
|---|---|---|
| Completion checker | `check-completion.sh` | Claude Stop hook — reads transcript, checks for done token, blocks stop if missing |
| Compliance prompt | `taskmaster-compliance-prompt.sh` | Shared anti-stopping prompt — 7-step checklist that forces goal confrontation |
| Codex injector | `hooks/inject-continue-codex.sh` | Watches session log, injects continuation prompt into same PTY if done token missing |
| Expect bridge | `hooks/run-codex-expect-bridge.exp` | PTY injection transport for Codex |
| Codex wrapper | `run-taskmaster-codex.sh` | Launches Codex with session logging + injector |
| Installer | `install.sh` | Auto-detects Codex/Claude, installs hooks |

## Dual-Platform Support

- **Claude path:** Stop hook (`check-completion.sh`) blocks the `Stop` event. Returns `{ decision: "block", reason: "<compliance prompt>" }` if done token not found in transcript.
- **Codex path:** Wrapper (`run-taskmaster-codex.sh`) + queue-emitter injector (`inject-continue-codex.sh`) + expect bridge. Watches JSONL session log for `task_complete` / `turn_complete` events. On missing done token, writes `inject.*.txt` files consumed by the expect bridge which injects them into the running PTY.

## The Compliance Prompt (key innovation)

7-step checklist injected when the agent tries to stop prematurely:

1. **Goal confrontation** (forced first) — "What is the user's stated goal? Is it achieved RIGHT NOW? Yes or no."
2. **Re-read original messages** — list every discrete request, confirm each fully addressed
3. **Check the task list** — any task not completed? Do it now.
4. **Check the plan** — including verification steps (builds, tests, lints)
5. **Check for errors or incomplete work** — fix anything broken
6. **Check for loose ends** — TODOs, placeholder code, missing tests
7. **Check for blockers** — "do NOT give up. You are a world-class engineer. Solve it."

Anti-rationalization rules:
- "Diminishing returns" is NOT a valid stop reason
- "Would require broader architectural changes" is narrating, not doing
- "DO NOT NARRATE — EXECUTE"
- "PROGRESS IS NOT COMPLETION"
- Honesty check: "did you actually TRY, or are you rationalizing?"

## Configuration

- `TASKMASTER_MAX` (default 0 = unlimited): max stop-block warnings before allowing stop
- Subagent bypass: transcripts < 20 lines are auto-allowed (not blocked)

## Key Patterns for svc Blend Analysis

| Pattern | How TaskMaster does it | Relevance to svc |
|---|---|---|
| **Completion enforcement** | Done token + Stop hook blocking | svc has no completion enforcement — agents can stop mid-lane |
| **Goal re-anchoring** | 7-step compliance prompt on premature stop | svc's Output Protocol suggests next step but doesn't block stopping |
| **Same-session recovery** | Codex injector continues in same PTY | svc writes .continue-here.md but starts new sessions |
| **Anti-rationalization** | Explicit rules against "progress is not completion" | svc has no anti-rationalization rules in its protocols |
| **Subagent bypass** | Short transcripts (< 20 lines) pass through | svc has no subagent distinction in task completion |
| **Counter/escalation** | TASKMASTER_MAX limits blocks | svc has no escalation when skills fail repeatedly |

## What TaskMaster Does NOT Have

- No file-based task persistence (it's a completion guard, not a task manager)
- No task dependencies or DAG
- No output-to-file pattern
- No token efficiency strategies (compliance prompt is injected in full each time)
- No MCP integration
- No next-task resolution

## Files Manifest (all read)

| File | Read? | Notes |
|---|---|---|
| README.md | ✅ | Full project overview |
| SKILL.md | ✅ | Codex-focused skill definition |
| docs/SPEC.md | ✅ | Product + technical specification |
| check-completion.sh | ✅ | Claude Stop hook implementation |
| taskmaster-compliance-prompt.sh | ✅ | The 7-step compliance prompt (key innovation) |
| hooks/inject-continue-codex.sh | ✅ | Codex session log watcher + queue emitter |
| hooks/run-codex-expect-bridge.exp | skipped | Expect script — mechanical PTY injection |
| run-taskmaster-codex.sh | skipped | Codex launcher — wraps the above |
| install.sh / uninstall.sh | skipped | Install scripts — mechanical |
| tests/*.sh | skipped | Test scripts — mechanical |
