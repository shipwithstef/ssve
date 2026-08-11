# Claude Code Hooks

**Source:** https://code.claude.com/docs/en/hooks
**Last verified:** 2026-04-23

The most feature-rich hook system among the four supported svc hosts.

## Capabilities

- **28 Lifecycle Events** (not 3, not 11, not 27 — the actual count is 28). Full list in [events.md](details/events.md).
- **5 Hook Types**: `command` (shell), `http` (REST endpoint), `mcp_tool` (call an MCP tool), `prompt` (ask a Claude model to decide), `agent` (spawn a subagent). Unique to Claude — other hosts only support `command`.
- **JSON Wire Protocol**: Input JSON on stdin; output JSON on stdout when exit 0.
- **Modern Decision Format** shared with Kimi and Codex: `hookSpecificOutput.permissionDecision` with values `allow | deny | ask | defer`.
- **Legacy Format Still Supported**: top-level `{decision: "approve"|"block", reason}` maps to modern: approve→allow, block→deny.
- **Decision Merge Precedence**: `deny > defer > ask > allow` when multiple hooks return different decisions.
- **Async Hooks**: `async: true` runs in background without blocking; `asyncRewake: true` additionally wakes Claude with stderr-as-system-reminder on exit 2.
- **Rich Matcher DSL**: `*`/`""` = all; alphanumeric+pipe = exact/pipe-list; anything else = regex. Plus `if` field with permission-rule syntax (`Bash(git push *)`) for command-level narrowing on tool events.
- **Environment Variables Injected**: `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE`, `CLAUDE_CODE_REMOTE`.
- **Persistent Env via `CLAUDE_ENV_FILE`**: SessionStart/CwdChanged/FileChanged hooks can append `export X=Y` lines that become available in all subsequent Bash commands.
- **Parallel Execution with Dedup**: identical command strings / URLs auto-deduplicated.
- **Fail-Open Semantics**: non-0-non-2 exit codes continue execution; missing JSON at exit 0 allows tool.
- **Output Capping**: context-injected output (`additionalContext`, `systemMessage`, plain stdout) capped at 10,000 chars; overflow saved to file.

## Blockers vs Observers

**Can block:**
- `PreToolUse` (deny/defer)
- `PermissionRequest` (deny)
- `UserPromptSubmit`, `UserPromptExpansion` (block)
- `Stop`, `SubagentStop`, `PostToolBatch`, `PreCompact`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `ConfigChange` (block via exit 2)
- `Elicitation`, `ElicitationResult` (accept/decline/cancel)
- `WorktreeCreate` (any non-zero exit)

**Observers only (cannot block):**
- `SessionStart`, `SessionEnd`, `InstructionsLoaded`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `SubagentStart`, `CwdChanged`, `FileChanged`, `PostCompact`, `StopFailure`, `PermissionDenied`, `WorktreeRemove`

## L3 Detail Files

- [events.md](details/events.md) — All 28 events with input/output schemas
- [configuration.md](details/configuration.md) — settings.json format, hook types, matcher DSL
- [decision-format.md](details/decision-format.md) — Modern vs legacy decision shapes, merge precedence
