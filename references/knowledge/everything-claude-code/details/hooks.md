# ECC Hooks — Detail

Source: `hooks/hooks.json`, `scripts/hooks/`, `the-shortform-guide.md`, `the-longform-guide.md`

## Mechanism

ECC uses a JSON-based hook registry (`hooks/hooks.json`) with matcher-driven dispatch. All hooks use Node.js scripts as entrypoints (`${CLAUDE_PLUGIN_ROOT}/scripts/hooks/`). A `run-with-flags.js` runner gates hooks by `ECC_HOOK_PROFILE` (minimal|standard|strict) and `ECC_DISABLED_HOOKS` (comma-separated hook IDs).

Stop hooks use an inline root-resolution pattern (inline Node.js `-e` code that searches CLAUDE_PLUGIN_ROOT, ~/.claude, plugins cache) because Stop events may fire outside plugin env injection context.

## PreToolUse Hooks

| Hook ID | Matcher | Effect |
|---------|---------|--------|
| pre:bash:block-no-verify | Bash | Runs `npx block-no-verify@1.1.2` — blocks `--no-verify` flag in git commands |
| pre:bash:auto-tmux-dev | Bash | Auto-starts dev servers in tmux with directory-based session names |
| pre:bash:tmux-reminder | Bash (strict) | Warns when long-running commands run outside tmux |
| pre:bash:git-push-reminder | Bash (strict) | Reminds to review changes before git push |
| pre:bash:commit-quality | Bash (strict) | Lints staged files, validates commit message format, detects console.log/debugger/secrets |
| pre:write:doc-file-warning | Write (standard+) | Warns about non-standard documentation files (exit 0, warns only) |
| pre:edit-write:suggest-compact | Edit\|Write (standard+) | Suggests manual context compaction at logical intervals |
| pre:observe:continuous-learning | * (standard+, async) | Captures tool use for continuous learning v2; async, 10s timeout |
| pre:governance-capture | Bash\|Write\|Edit\|MultiEdit (standard+) | Captures secrets, policy violations, approval requests (needs ECC_GOVERNANCE_CAPTURE=1) |
| pre:config-protection | Write\|Edit\|MultiEdit (standard+) | Blocks modifications to linter/formatter config files |
| pre:mcp-health-check | * | Checks MCP server health before MCP tool execution; blocks unhealthy MCP calls |

## PostToolUse Hooks

| Hook ID | Matcher | Effect |
|---------|---------|--------|
| post:bash:command-log-audit | Bash | Audits all bash commands to `~/.claude/bash-commands.log` |
| post:bash:command-log-cost | Bash | Cost tracker — logs bash tool usage with timestamps |
| post:bash:pr-created | Bash (standard+) | Logs PR URL and provides review command after PR creation |
| post:bash:build-complete | Bash (standard+, async) | Async hook for build analysis (background, 30s timeout) |
| post:quality-gate | Edit\|Write\|MultiEdit (standard+, async) | Runs quality gate checks after file edits (30s timeout) |
| post:edit:design-quality-check | Edit\|Write\|MultiEdit (standard+) | Warns when frontend edits drift toward generic template-looking UI |
| post:edit:accumulator | Edit\|Write\|MultiEdit (standard+) | Records edited JS/TS file paths for batch format+typecheck at Stop time |
| post:edit:console-warn | Edit (standard+) | Warns about console.log statements after edits |
| post:governance-capture | Bash\|Write\|Edit\|MultiEdit (standard+) | Captures governance events from tool outputs |
| post:session-activity-tracker | * (standard+) | Tracks per-session tool calls and file activity for ECC2 metrics |
| post:observe:continuous-learning | * (standard+, async) | Captures tool use results for continuous learning v2 |

## PostToolUseFailure

| Hook ID | Matcher | Effect |
|---------|---------|--------|
| post:mcp-health-check | * | Tracks failed MCP tool calls, marks unhealthy servers, attempts reconnect |

## PreCompact

| Hook ID | Effect |
|---------|--------|
| pre:compact | Saves state before context compaction (standard+) |

## Stop Hooks

| Hook ID | Effect |
|---------|--------|
| stop:format-typecheck | Batch format (Biome/Prettier) + typecheck (tsc) all JS/TS files edited this response — once per Stop instead of per Edit; 300s timeout |
| stop:check-console-log | Checks for console.log in modified files |
| stop:session-end | Persists session state after each response (async) |
| stop:evaluate-session | Evaluates session for extractable patterns (async) |
| stop:cost-tracker | Tracks token and cost metrics per session (async) |
| stop:desktop-notify | Sends desktop notification (macOS/WSL) with task summary (async) |

## SessionStart / SessionEnd

| Hook ID | Effect |
|---------|--------|
| session:start | Loads previous context + detects package manager |
| session:end:marker | Non-blocking lifecycle marker (async) |

## Runtime Controls

```bash
export ECC_HOOK_PROFILE=minimal   # Only minimal hooks
export ECC_HOOK_PROFILE=standard  # Default
export ECC_HOOK_PROFILE=strict    # All hooks active
export ECC_DISABLED_HOOKS="pre:bash:tmux-reminder,post:edit:typecheck"
```

## Memory Persistence Pattern (from Longform Guide)

- **PreCompact hook**: save important state to file before compaction
- **Stop hook**: persist session learnings + session-end marker
- **SessionStart hook**: load previous context automatically
- Files stored in `~/.claude/sessions/` or project `.claude/` directory

## Design Notes

- Hooks cannot distribute rules — rules must be installed manually
- Do NOT add a `"hooks"` field to `.claude-plugin/plugin.json` (Claude Code v2.1+ auto-loads `hooks/hooks.json` by convention; explicit declaration causes duplicate detection error)
- plugin.json `hooks` field absence is enforced by a regression test
