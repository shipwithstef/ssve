# Gemini CLI Hook Configuration

**Source:** https://geminicli.com/docs/hooks/
**Last verified:** 2026-04-23

## Stdout Contract (Strict)

Gemini CLI enforces a rule the other hosts do not:

> Your script **must not** print any plain text to `stdout` other than the final JSON object.

- **stdout** = JSON decision only (or nothing)
- **stderr** = all logging, debug, diagnostics
- Any non-JSON pollution on stdout breaks parsing and the hook is treated as failed

This is stricter than Claude / Kimi / Codex, which tolerate incidental stdout.

## Environment Variables

Gemini injects these into every hook process:

| Variable | Meaning |
|---|---|
| `GEMINI_PROJECT_DIR` | Project root absolute path |
| `GEMINI_PLANS_DIR` | Plans directory absolute path |
| `GEMINI_SESSION_ID` | Current session's unique ID |
| `GEMINI_CWD` | Current working directory |
| `CLAUDE_PROJECT_DIR` | **Alias** of `GEMINI_PROJECT_DIR` — explicit compatibility with Claude Code hook scripts |

The `CLAUDE_PROJECT_DIR` alias is significant: Gemini intentionally supports hook scripts written for Claude Code.

## Configuration Precedence

Loaded in this order (highest → lowest):

1. `.gemini/settings.json` — project-level
2. `~/.gemini/settings.json` — user-level
3. `/etc/gemini-cli/settings.json` — system-level
4. Extension-provided hooks

## settings.json Format

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "write_file|replace",
        "hooks": [
          {
            "name": "security-check",
            "type": "command",
            "command": "$GEMINI_PROJECT_DIR/.gemini/hooks/security.sh",
            "timeout": 5000
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
| `name` | string | Friendly identifier |
| `timeout` | number | **MILLISECONDS** (default 60000) — different from Codex/Claude which use seconds |
| `description` | string | Purpose explanation |

## Matcher Semantics

- **Tool events** (`BeforeTool`, `AfterTool`, `BeforeToolSelection`): regex (e.g., `"write_.*"`)
- **Lifecycle events**: exact-string match (e.g., `"startup"`)
- **Wildcards**: `"*"` or `""` match all occurrences

## Security / Trust

Project-level hooks are **fingerprinted**. If a `.gemini/settings.json` hook command changes after a `git pull` or `git clone`, Gemini requires explicit user verification before executing. Prevents "malicious hook injection via PR" attacks.

Also gated by `security.folderTrust.enabled` — untrusted folders run in safe mode with no project settings and no auto-acceptance.
