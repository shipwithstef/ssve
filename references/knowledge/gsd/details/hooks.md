# GSD Hooks Details

GSD integrates tightly with host agents (e.g., Claude Code, OpenCode) through a lifecycle hook system.

## Supported Events
Primarily revolves around `PreToolUse`, `PostToolUse`, and `SessionStart`.

## Specific Hooks
- **Statusline** (`gsd-statusline.js`): Intercepts `statusLine` events to show real-time phase progress and context window %.
- **Context Monitor** (`gsd-context-monitor.js`): Uses `PostToolUse` to inject advisory warnings when context falls below 35% (Warning) or 25% (Critical). v1.40.0 raised these to 60%/70% thresholds.
- **Guards**: 
  - `gsd-prompt-guard.js`: Detects injection attacks in `.planning/` writes.
  - `gsd-workflow-guard.js`: Advises when manual edits subvert the workflow.
  - `gsd-read-guard.js`: Enforces Read-Before-Edit patterns to prevent rewrite loops.
  - `gsd-commit-docs.js`: PreToolUse hook enforcing the `commit_docs` setting to prevent accidental tracking of `.planning/` artifacts.
