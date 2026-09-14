# Kimi Code CLI Hooks System

**Source:** https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html
**Last verified:** 2026-04-23

## 1. Lifecycle Events (13)

Exact event names:

`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`, `Notification`

## 2. Invocation

- **Input:** JSON via stdin
- **Output:** JSON on stdout (decision) when exiting 0 with structured output
- **Exit codes:**
  - `0` — allow; stdout may carry `hookSpecificOutput` JSON for additional behavior
  - `2` — block; stderr fed to LLM as correction
  - other — allow, log stderr only

## 3. Input Payload Schema

### Common to all events
```json
{
  "session_id": "string",
  "cwd": "string",
  "hook_event_name": "string"
}
```

### Event-specific additions

| Event | Fields |
|---|---|
| `PreToolUse` | `tool_name`, `tool_input`, `tool_call_id` |
| `PostToolUse` | `tool_name`, `tool_input`, `tool_output` |
| `PostToolUseFailure` | `tool_name`, `tool_input`, `error` |
| `UserPromptSubmit` | `prompt` |
| `Stop` | `stop_hook_active` |
| `StopFailure` | `error_type`, `error_message` |
| `SessionStart` | `source` |
| `SessionEnd` | `reason` |
| `SubagentStart` | `agent_name`, `prompt` |
| `SubagentStop` | `agent_name`, `response` |
| `PreCompact` | `trigger`, `token_count` |
| `PostCompact` | `trigger`, `estimated_token_count` |
| `Notification` | `sink`, `notification_type`, `title`, `body`, `severity` |

## 4. Decision / Block Format

**Modern format** (identical to Claude Code and Codex):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "explanation"
  }
}
```

When `permissionDecision` is `"deny"`, the operation blocks and the reason is fed back to the LLM. Identical commands are auto-deduplicated across hooks registered for the same event.

## 5. Configuration

**Location:** `~/.kimi/config.toml`
**Format:** TOML with `[[hooks]]` arrays (NOT JSON like Claude/Codex/Gemini)

```toml
[[hooks]]
event = "PostToolUse"
matcher = "WriteFile|StrReplaceFile"
command = "jq -r '.tool_input.file_path' | xargs prettier --write"

[[hooks]]
event = "PreToolUse"
matcher = "WriteFile|StrReplaceFile"
command = ".kimi/hooks/protect-env.sh"
timeout = 10

[[hooks]]
event = "Notification"
matcher = "permission_prompt"
command = "osascript -e 'display notification \"Kimi needs attention\"'"

[[hooks]]
event = "Stop"
command = ".kimi/hooks/check-complete.sh"
```

## 6. Matcher Semantics

Regex filter applied to different identifiers per event:

| Event | Matcher applies to |
|---|---|
| Tool events | `tool_name` |
| `Notification` | `sink` |
| `StopFailure` | `error_type` |
| `SessionStart` | `source` |
| (others) | matcher ignored |

Empty string matches everything.

## 7. Environment Variables

Not explicitly documented by Kimi. Session ID is passed via `ContextVar` internally. Hooks must rely on the JSON payload, not env vars.

## 8. Execution Model

- **Parallel**: multiple hooks for same event run in parallel
- **Deduplication**: identical command strings auto-deduplicated
- **Timeout**: default 30 seconds, configurable via `timeout` field in `[[hooks]]` block
- **Fail-open**: all hook execution failures (timeouts, crashes, regex errors) treated as allow
- **Stop hook anti-loop**: Stop hooks can re-trigger only once; `stop_hook_active` flag set to `true` on the re-trigger prevents infinite loops

## Cross-Host Convergence

The `hookSpecificOutput.permissionDecision` decision shape is **identical** across Kimi, Claude Code, and Codex CLI. Only Gemini CLI diverges (uses `{decision:"deny"}` on stdout, exit 2 for hard block).

This means a single decision-serializer can cover 3 of 4 hosts with identical output.
