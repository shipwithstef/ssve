# Codex CLI Hooks

**Source:** https://developers.openai.com/codex/hooks
**Extracted:** 2026-05-01

Provides synchronous lifecycle interception for OpenAI Codex CLI via `stdin`/`stdout` JSON communication. Nearly identical in shape to Claude Code hooks.

## Capabilities

- **6 Lifecycle Events**: `SessionStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, `Stop`.
- **JSON Wire Protocol**: Hook payload on `stdin`; response JSON on `stdout`; decisions also expressible via exit code 2 + `stderr`.
- **Regex Matchers**: Filter which hooks fire per event (same shape as Claude/Kimi/Gemini).
- **Dual Decision Formats**: Supports both legacy `{decision: "block", reason}` and newer `hookSpecificOutput.permissionDecision` schema.
- **Opt-In Feature**: Enabled via `[features] hooks = true` in `~/.codex/config.toml`.
- **Precedence-Layered Config**: Loaded from `~/.codex/hooks.json` (user) AND `<repo>/.codex/hooks.json` (repo) — all matching hooks run; no replacement.
- **Concurrent Execution**: Multiple matching hooks for the same event run in parallel; no ordering guarantee.
- **Tool Matchers**: `PreToolUse`, `PermissionRequest`, and `PostToolUse` match `Bash`, `apply_patch` (also aliased as `Edit` / `Write`), and MCP tool names.
- **Windows / WSL2**: Codex can run natively on Windows or inside WSL2. svc hook scripts require Node.js in the runtime environment; WSL2 installs need Linux Node.js inside WSL, not only Windows `node.exe`.
- **Session-scoped prompt authority**: svc records a redacted session/turn authority token before Stop can delegate to the shared completion guard.
- **Composite Stop**: svc installs one effective Codex Stop firewall and rejects duplicate managed Stop paths.
- **Exact skill-load proof**: governed mutations bind the current session, worktree, task graph, task, skill path, and skill hash.

## Operational proof levels

Configuration, effective-single-Stop, `/hooks` trust, and runtime-observed traces are separate claims. Setup proves only the first two. See `references/codex-hook-execution-integrity.md` for the state machine and recovery contract.

## L3 Detail Files

- [events.md](details/events.md) — Each event's input payload schema and decision-response format
- [configuration.md](details/configuration.md) — hooks.json format, feature flag, precedence, matcher semantics
- [decision-formats.md](details/decision-formats.md) — Legacy vs hookSpecificOutput response shapes per event
