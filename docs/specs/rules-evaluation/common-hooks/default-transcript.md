# Default Transcript — common/hooks.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Asked about Claude Code hook types
2. Using TodoWrite for task tracking
3. Auto-accept configuration

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — hook types:**
I know PreToolUse (before a tool call), PostToolUse (after a tool call), and
Stop (when session ends / stopping before answering). I'd explain these from
memory without needing a rule.

**Scenario 2 — TodoWrite usage:**
I use TodoWrite to track multi-step tasks. I create granular items and mark
them complete progressively. I don't have a specific checklist of what to look
for in the todo list (out-of-order steps, wrong granularity, etc.).

**Scenario 3 — auto-accept:**
My default is cautious about auto-accept. I recommend against auto-approving
everything and prefer `allowedTools` whitelisting over broad permissions.
The "never use dangerously-skip-permissions" guidance is my default.
