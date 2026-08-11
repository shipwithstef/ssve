# Hook Coverage Spec — Claude Code Lifecycle Events

This document enumerates the Claude Code lifecycle hook events and svc's intended posture for each. Events with `Wired? = Yes` and posture `block` or `warn` MUST appear in `hooks/hooks.json`. The tier-1 validator `validate-hook-coverage.sh` enforces this contract.

**Postures:**
- **block** — exit non-zero on violation; agent must fix
- **warn** — print warning to stderr, never block
- **observe** — log only, no agent-visible output
- **skip** — documented but intentionally not wired

Source: Claude Code host docs (per `rules/host-capability-research.md`). Last reviewed: 2026-04-25.

## Event Coverage Table

| Event | svc posture | Wired? | Rationale |
|---|---|---|---|
| PreToolUse | block | Yes | Enforces workflow guards, bash bypass blocks, eval-gate, skill artifact authenticity |
| PostToolUse | warn | Yes | Lane-tasks validator, edit accumulator, vibe auditor, eval-gate post |
| Stop | block | Yes | svc-stop-quality + task-completion-guard |
| StopFailure | observe | No | Documented but not yet wired in svc; future log of stop hook failures |
| SessionStart | warn | Yes | Healthcheck — dangling symlinks, framework-state coherence |
| SessionEnd | observe | Yes | Append session record to `.svc/sessions/sessions.jsonl` for audit-session-execution |
| UserPromptSubmit | warn | Yes | Detect stale active-WI / lane-tasks state per prompt |
| PreCompact | observe | Yes | Snapshot active task graph + last decisions to `.svc/sessions/<ISO>.snapshot.json` |
| PostCompact | observe | No | Documented but not yet wired in svc; future post-compact recovery hook |
| Notification | observe | Yes | Append notification payloads to `.svc/sessions/notifications.jsonl` |
| SubagentStart | observe | Yes | Append `subagent_start` record to `.svc/dispatch-log.jsonl` (WI-CLN-13 / plan §4.15) |
| SubagentStop | observe | Yes | Append `subagent_stop` record to `.svc/dispatch-log.jsonl` (WI-CLN-13 / plan §4.15) |

## Documented but not yet wired

The following events are part of the Claude Code host surface but svc has not chosen a concrete posture or wiring yet. Adding a row here is the first step toward enabling enforcement; the validator does not require these to be wired (Wired? = No).

- StopFailure
- PostCompact

## How to extend

1. Add a row above (or move from the "documented but not yet wired" list).
2. If `Wired? = Yes` and posture is `block` or `warn`, add a corresponding entry to `hooks/hooks.json` with the hook's id matching `svc-<event-kebab>-<purpose>`.
3. Run `bash test-framework/evals/tier-1/validate-hook-coverage.sh` to confirm the spec → wiring contract.
