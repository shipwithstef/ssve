# GSD Hook Internals (v1.50.0)

## Statusline Hook (`hooks/gsd-statusline.js`)
The status line provides real-time observability of GSD's orchestrator state and context budget.

### Phase Lifecycle Parsing
It parses the YAML frontmatter of `.planning/STATE.md` to identify:
- `active_phase`: Used to detect mid-flight orchestration (e.g. `Phase 4.5 executing`).
- `next_action` / `next_phases`: Recommends the next CLI command when the agent is idle.
- `progress`: Computes completion visually.

### Context Budget Reporting
It safely truncates and reports context usage. It reads `CLAUDE_CODE_AUTO_COMPACT_WINDOW` to calculate dynamic compaction buffers, storing intermediate token values in `/tmp/claude-ctx-{session_id}.json`.

## Context Monitor (`hooks/gsd-context-monitor.js`)
A `PostToolUse` hook that reads the temporal `/tmp/` file created by the statusline and injects advisory system warnings into the agent's context when usage surpasses 60% (Warning) and 70% (Critical).
