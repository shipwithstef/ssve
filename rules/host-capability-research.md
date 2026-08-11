---
id: svc-host-capability-research
type: correction
scope: universal
severity: high
---

# Rule: Verify Host Capabilities Before Host-Specific Implementation

Before implementing ANY feature that touches host integration surfaces — hooks, MCP servers, task graphs, model routing, UI paradigms, Background Tasks, or any host-specific API — you MUST verify current host documentation. Do NOT rely on training data for host API capabilities.

## Host Integration Surfaces

| Surface | Examples | Host Docs |
|---|---|---|
| Hooks / lifecycle events | PreToolUse, PostToolUse, Stop, SessionStart, etc. | `code.claude.com/docs/en/hooks` (Claude); Kimi CLI docs |
| MCP servers / tools | Available tools, tool schemas, tool behavior | Host documentation or `mcp.json` |
| Task graphs / Background Tasks | TaskList, TaskUpdate, /task, update_plan | Host CLI docs |
| Model routing | Model IDs, context windows, pricing | Host provider docs |
| UI paradigms | How the host displays task state, how subagents work | Host behavior docs |

## Mandatory Research Protocol

1. **If you are uncertain about ANY host capability**, invoke the `research` skill before proceeding.
2. **If the change modifies host wiring** (e.g., `scripts/wire-hooks.mjs`, `scripts/wire-kimi-hooks.mjs`, host `settings.json`), read the host's CURRENT documentation, not your training data.
3. **If you discover a capability mismatch** between training data and docs, update `references/knowledge/svc/CAPABILITIES.md` and `FRAMEWORK-STATE.md`.

## Failure Mode This Prevents

Training data on host APIs is often stale by months. Assuming "Claude Code only supports 3 hook events" when the actual docs show 27 events leads to:
- Under-implementation (missing 18 hooks)
- Wrong documentation in FRAMEWORK-STATE.md and proposals
- Framework degradation that propagates to all downstream skills

## Rationale

"Research before build" is already a framework principle (`rules/common/research-before-build.md`). This rule elevates it to a hard gate for host-specific surfaces because host API drift is silent, high-impact, and affects every project using the framework.
