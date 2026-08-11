# Kimi CLI Extensibility

Kimi Code CLI supports multiple ways to extend its capabilities, from lightweight project-specific scripts to full Model Context Protocol (MCP) servers.

## 1. Agent Skills
Based on the `agentskills.io` format, skills are directories containing a `SKILL.md` file.
- **Discovery**: Scanned from built-in, user (`~/.kimi/skills`), and project (`.kimi/skills`) directories.
- **Standard Skills**: Markdown instructions injected into the prompt if the AI chooses to read them.
- **Flow Skills**: Skills that define a state-machine or flowchart (Mermaid/D2) in `SKILL.md`. The agent can "move" through nodes in the flow.

## 2. Plugins
Lightweight local toolkits for packaging scripts and utilities.
- **plugin.json**: Defines the plugin name, version, and tools.
- **Installation**: Handled by `PluginManager` which copies source to `~/.kimi/plugins/` and injects host configurations (API keys, base URLs).
- **Injection**: Plugins can receive fresh configuration at startup to keep credentials up to date.

## 3. MCP (Model Context Protocol)
Supports connecting to external MCP servers.
- **Tools**: MCP servers provide tools that are merged into the agent's available toolset.
- **Deferred Loading**: MCP tools can be loaded in the background to avoid blocking the initial startup UI.

## 4. Hooks
Executes custom commands at key points in the agent lifecycle.
- **Event-Driven**: Hooks are triggered by events like `UserPromptSubmit` or `PreToolUse`.
- **Blocking**: Hooks can block the action with a reason, which is then reported back to the user/AI.
