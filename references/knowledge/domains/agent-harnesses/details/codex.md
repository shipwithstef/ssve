# Codex Harness Deep Dive
Layer 3 Extraction (revised 2026-04-23)

## Core Architecture
Codex operates primarily as an advanced CLI IDE tether rather than an open-ended conversational orchestrator. Its runtime tightly bounds context by restricting visibility to explicitly declared tracked files.

## Technical Boundaries
- **PTY Injection:** Codex attaches natively to pseudo-terminals (pty). This provides it immense control to see raw standard output, interact with debuggers natively, and emit terminal color codes.
- **Strict Context Boundary:** It does not natively orchestrate subagents the way Claude Code does. It is tightly coupled to the user's terminal session state.

## Native Hooks (CORRECTION)

Earlier revisions of this doc stated that Codex had no native hook system and that external PTY-wrapper approaches (taskmaster-style) were the only option. **That was wrong.**

Codex has a full native hook system with 6 lifecycle events (`SessionStart`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `UserPromptSubmit`, `Stop`), JSON-on-stdin / JSON-on-stdout wire protocol, regex matchers, and precedence-layered config (`~/.codex/hooks.json` + `<repo>/.codex/hooks.json`). It must be enabled via `[features] hooks = true` in `config.toml`.

**Full spec:** see `references/knowledge/domains/codex-hooks/` (L2 CAPABILITIES + L3 details for events, configuration, decision formats).

**Current limitation to know about:** tool-event matchers (`PreToolUse`, `PermissionRequest`, `PostToolUse`) cover `Bash`, `apply_patch` (with `Edit` / `Write` aliases), and MCP tools, but hook coverage is still not a complete enforcement boundary. Some shell paths use richer execution mechanisms, and non-shell/non-MCP tools are not intercepted.

## Framework Defenses Required (svc compatibility)
- Because Codex does not natively scale out orchestrator-subagent hierarchies, complex `svc` pipelines (like full progressive feature discovery) must be explicitly managed by `update_plan` logic injection.
- PTY output can occasionally be overly verbose; truncating terminal stdout is critical to prevent simple compile errors from consuming local context.
- For hook parity with Claude/Kimi/Gemini on Edit/Write flows, fall back to `PostToolUse` on `Bash` (inspecting commands like `sed -i`, `tee`, etc.) until Codex exposes Edit/Write matchers.
