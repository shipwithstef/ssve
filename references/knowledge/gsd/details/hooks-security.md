# GSD Hooks & Security — Detail

Source: hooks/*.js, hooks/*.sh, docs/ARCHITECTURE.md
Extracted: 2026-04-08

## Mechanism

### Hook Architecture

9 hooks integrating with host AI agent runtime. Hooks are event-driven (SessionStart, PreToolUse, PostToolUse, statusLine).

```
Runtime Engine
├── statusLine   → gsd-statusline.js (model/task/context bar)
├── PostToolUse  → gsd-context-monitor.js (context warnings)
│                → gsd-session-state.sh (state tracking)
│                → gsd-validate-commit.sh (commit format)
│                → gsd-phase-boundary.sh (phase transitions)
├── PreToolUse   → gsd-prompt-guard.js (injection detection)
│                → gsd-workflow-guard.js (edit scope)
│                → gsd-read-guard.js (read-before-edit)
└── SessionStart → gsd-check-update.js (version check)
```

### Hook Details

**gsd-statusline.js** (statusLine): Reads session JSON from stdin, writes formatted status to stdout. Bridges to /tmp/claude-ctx-{session}.json for context-monitor.

**gsd-context-monitor.js** (PostToolUse/AfterTool): Reads tool event JSON + bridge file. Injects context warnings:
- >35% remaining: no warning
- ≤35%: WARNING ("Avoid starting new complex work")
- ≤25%: CRITICAL ("Context nearly exhausted, inform user")
- Debounce: 5 tool uses between repeated warnings
- Severity escalation bypasses debounce

**gsd-prompt-guard.js** (PreToolUse): Triggers on Write/Edit to .planning/ files. Scans for prompt injection patterns (role override, instruction bypass, system tag injection). Advisory-only — logs, does not block. Patterns inlined for hook independence.

**gsd-workflow-guard.js** (PreToolUse): Triggers on Write/Edit to non-.planning/ files. Detects edits outside GSD workflow context (no active /gsd- command). Advises /gsd-quick or /gsd-fast. Opt-in via hooks.workflow_guard: true (default: false).

**gsd-read-guard.js** (PreToolUse): Advisory guard preventing Edit/Write on files not yet Read in the session. Helps prevent blind edits.

**gsd-check-update.js** (SessionStart): Background version check against npm registry. Caches in ~/.claude/cache/gsd-update-check.json.

**gsd-validate-commit.sh** (PostToolUse): Enforces Conventional Commits format on git commits.

**gsd-phase-boundary.sh** (PostToolUse): Detects .planning/ modifications, reminds to update STATE.md.

**gsd-session-state.sh** (PostToolUse): Tracks session state for shell-based runtimes.

### Hook Safety Properties

- All hooks wrap in try/catch, exit silently on error
- stdin timeout guard (3s) prevents hanging
- Stale metrics (>60s) ignored
- Missing bridge files handled gracefully
- Context monitor is advisory — never overrides user preferences

### Security System

**Built-in since v1.27:**

1. **Path traversal prevention**: All user-supplied paths validated to resolve within project directory
2. **Prompt injection detection**: Centralized security.cjs module scans for injection patterns in user text
3. **PreToolUse prompt guard hook**: Scans .planning/ writes for injection vectors (advisory)
4. **Safe JSON parsing**: Malformed --fields caught before corrupting state
5. **Shell argument validation**: User text sanitized before shell interpolation
6. **CI-ready injection scanner**: prompt-injection-scan.test.cjs scans all agent/workflow files

**Sensitive file protection**: Users add patterns to Claude Code deny list (Read(.env), Read(.env.*), Read(**/*.pem), etc.)

### Build System

hooks/gsd-*.js are source files. `npm run build:hooks` compiles via scripts/build-hooks.js (esbuild) into hooks/dist/ which the installer copies. Required for development installs.

## Analysis

**Strengths**: The context monitoring with bridge file pattern is clever — statusline writes metrics, context-monitor reads them. The advisory-only approach for security hooks is pragmatic — doesn't block workflow but surfaces issues. The hook system adapts to different runtimes (PostToolUse vs AfterTool for Gemini).

**Weaknesses**: Advisory-only security hooks mean injection patterns are logged but not prevented. The bridge file pattern (/tmp/claude-ctx-{session}.json) is fragile in multi-user environments. Shell hooks (.sh) are less portable than JS hooks.

## L4 Pointers

- Hook source: hooks/*.js, hooks/*.sh (9 files)
- Security module: get-shit-done/bin/lib/security.cjs
- Hook build: scripts/build-hooks.js
- Hook registration: bin/install.js (settings.json integration)
- CI scanner: tests/prompt-injection-scan.test.cjs
