# Claude Code Hook Events — Full List

**28 events total.** Source: https://code.claude.com/docs/en/hooks

## Session Lifecycle
- `SessionStart` — new session or resume. Matcher: `startup|resume|clear|compact`.
- `SessionEnd` — session terminates. Matcher: end reason (`clear|resume|logout|prompt_input_exit|other`).
- `InstructionsLoaded` — CLAUDE.md or `.claude/rules/*.md` loaded. Matcher: load reason.

## User Input
- `UserPromptSubmit` — user submits prompt before Claude processes it. **No matcher** (always fires).
- `UserPromptExpansion` — slash command expands before reaching Claude. Matcher: command name.

## Tool Events
- `PreToolUse` — before tool call executes. Matcher: `tool_name` (regex or pipe-list).
- `PermissionRequest` — permission dialog appears. Matcher: `tool_name`.
- `PermissionDenied` — tool denied by auto mode classifier. Matcher: `tool_name`.
- `PostToolUse` — after tool succeeds. Matcher: `tool_name`.
- `PostToolUseFailure` — after tool fails. Matcher: `tool_name`.
- `PostToolBatch` — after batch of parallel tools resolves. No matcher.

## Subagents
- `SubagentStart` — subagent spawned. Matcher: agent type (`Bash|Explore|Plan|custom`).
- `SubagentStop` — subagent finishes. Matcher: agent type.

## Tasks
- `TaskCreated` — via TaskCreate. No matcher.
- `TaskCompleted` — task marked completed. No matcher.

## Turn Lifecycle
- `Stop` — Claude finishes responding. No matcher.
- `StopFailure` — turn ends due to API error. Matcher: `error_type`.

## Context / Config
- `ConfigChange` — configuration file changes during session. Matcher: config source.
- `CwdChanged` — working directory changes. No matcher.
- `FileChanged` — watched file changes on disk. Matcher: literal filenames (e.g., `.envrc|.env`).
- `PreCompact` — before context compaction. Matcher: compaction trigger (`manual|auto`).
- `PostCompact` — after context compaction. Matcher: compaction trigger.

## Worktrees
- `WorktreeCreate` — worktree created via `--worktree`. No matcher.
- `WorktreeRemove` — worktree removed. No matcher.

## Notifications & Interaction
- `Notification` — Claude Code sends notification. Matcher: notification type (`permission_prompt|idle_prompt|auth_success`).
- `TeammateIdle` — agent team teammate about to go idle. No matcher.

## MCP Elicitation
- `Elicitation` — MCP server requests user input. Matcher: MCP server name.
- `ElicitationResult` — user responds to MCP elicitation. Matcher: MCP server name.

## Key Takeaway

Compared to the other hosts:
- **Kimi** (13 events) overlaps on the core: PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, Stop, StopFailure, SessionStart, SessionEnd, SubagentStart, SubagentStop, PreCompact, PostCompact, Notification — all 13 exist in Claude too.
- **Codex** (6 events) is the subset: SessionStart, PreToolUse, PermissionRequest, PostToolUse, UserPromptSubmit, Stop.
- **Gemini** (11 events) renames `Pre/Post` → `Before/After` and adds `BeforeAgent`, `AfterAgent`, `BeforeModel`, `AfterModel`, `BeforeToolSelection`.

For svc, the **portable event set** — events that fire on all four hosts (under their local names) — is:

| svc canonical | Claude | Kimi | Codex | Gemini |
|---|---|---|---|---|
| session-start | `SessionStart` | `SessionStart` | `SessionStart` | `SessionStart` |
| pre-tool-use | `PreToolUse` | `PreToolUse` | `PreToolUse` (Bash/apply_patch/MCP) | `BeforeTool` |
| post-tool-use | `PostToolUse` | `PostToolUse` | `PostToolUse` (Bash/apply_patch/MCP) | `AfterTool` |
| user-prompt-submit | `UserPromptSubmit` | `UserPromptSubmit` | `UserPromptSubmit` | n/a |
| stop | `Stop` | `Stop` | `Stop` | n/a |
| session-end | `SessionEnd` | `SessionEnd` | n/a | `SessionEnd` |

The portable set covers the 80% of hook use cases. Non-portable events are platform-specific capabilities to leverage where they exist.
