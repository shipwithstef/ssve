# Codex Hook Configuration

## Feature Flag (Required)

Hooks are **opt-in**. Enable in `~/.codex/config.toml`:

```toml
[features]
hooks = true
```

Without this flag, hooks are ignored even if `hooks.json` exists.

## Configuration Files

Discovered in precedence order:

1. `~/.codex/hooks.json` — user-level
2. `<repo>/.codex/hooks.json` — repository-level

**All matching files load.** Higher-precedence layers do NOT replace lower-precedence hooks — they add. Multiple hooks for the same event run concurrently.

For svc, this additive behavior makes a direct shared Stop plus a Codex firewall unsafe: both can run with no ordering guarantee. `wire-codex-hooks.mjs` therefore prunes obsolete managed entries and refuses the effective user-plus-repository view unless exactly one svc Stop remains and it is `svc-codex-stop-firewall.mjs`.

## hooks.json Structure

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codex/hooks/session_start.py",
            "statusMessage": "Loading session notes",
            "timeout": 600
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/pre_tool_use_policy.py\"",
            "statusMessage": "Checking Bash command"
          }
        ]
      }
    ]
  }
}
```

## Hook Config Fields

| Field | Type | Notes |
|---|---|---|
| `type` | string | Only `"command"` is supported |
| `command` | string | Shell command to execute (required) |
| `matcher` | string (regex) | Optional filter; omit / `"*"` / `""` = match all |
| `statusMessage` | string | Optional UI status text shown while the hook runs |
| `timeout` | number | **Seconds**, default 600 (or use `timeoutSec` alias) |

## Matcher Semantics by Event

| Event | Matcher Field | Current Values |
|---|---|---|
| `SessionStart` | `source` | `startup`, `resume`, `clear` |
| `PreToolUse` | `tool_name` | `Bash`, `apply_patch`, `Edit`, `Write`, MCP tool names |
| `PermissionRequest` | `tool_name` | `Bash`, `apply_patch`, `Edit`, `Write`, MCP tool names |
| `PostToolUse` | `tool_name` | `Bash`, `apply_patch`, `Edit`, `Write`, MCP tool names |
| `UserPromptSubmit` | — | matcher ignored |
| `Stop` | — | matcher ignored |

## Invocation Environment

- **Working directory:** the session's `cwd`
- **Input:** JSON on stdin
- **Output:** JSON on stdout; stderr for debug
- **Exit codes:** `0` = success, `2` = block (stderr = reason), other = non-fatal failure

## Trust and concurrency

Writing `hooks.json` is only the `configured` state. Inspect Codex `/hooks` and trust the managed commands before claiming `trusted`. Prove `runtime-observed` separately with a controlled pre-load denial, post-load allowance, and foreign-session Stop allowance. Matching hooks run concurrently, so enforcement must not rely on event-local hook order.

The svc authority and skill receipts live outside the repository in a current-user `0700` runtime directory with `0600` files. The hooks reject symlinks, foreign ownership, permissive modes, stale skill hashes, and cross-worktree receipts. See `references/codex-hook-execution-integrity.md`.

## Path Resolution for Repo-Local Hooks

Use `$(git rev-parse --show-toplevel)` in the command string rather than relative paths — Codex executes the hook from the session `cwd`, which may not be the repo root.

## Windows / WSL2 Note

Codex supports native Windows execution and WSL2 execution. svc hook scripts are Node.js programs, so WSL2 sessions need Linux Node.js inside WSL; Windows `node.exe` alone is not a reliable runtime for hooks that receive Linux paths.
