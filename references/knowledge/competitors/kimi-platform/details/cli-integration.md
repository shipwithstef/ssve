# Deep Dive: Kimi K2.6 CLI & API Integration

## Mechanism: Running Kimi K2.6 Swarm (CLI vs UI)
A critical question for developers is whether the massive 300-agent swarm capabilities of Kimi K2.6 are locked behind a proprietary Web UI or if they can be invoked headlessly. 

**Finding: The Kimi K2.6 Agent Swarm is fully accessible via CLI and API.**

### 1. Official Kimi Code CLI
Moonshot AI provides the official `@moonshotai/kimi-code` CLI, designed explicitly for terminal-first swarm orchestration.
*   **Triggering the Swarm:** The swarm is launched headlessly using flags:
    ```bash
    kimi-code "Refactor /src to Rust" --swarm --agents 50
    ```
*   **Session Management:** The CLI provides interactive slash commands during a run:
    *   `/status`: Renders a live TUI showing the health, execution tree, and progress of the 300 active sub-agents.
    *   `/swarm`: Toggles swarm mode dynamically.
    *   `/plan`: Dumps the orchestrator's parsed decomposition graph.

### 2. Third-Party CLI Bridges (Ollama Cloud & Claude Code)
Because Kimi K2.6 weights are open-sourced under a Modified MIT License, the ecosystem has adapted it for use in other CLI agents.
*   **Ollama Cloud Integration:** Developers can pull the cloud-hosted weights (`ollama pull kimi-k2.6:cloud`) using Ollama v0.15+.
*   **Claude Code Bridge:** Once configured, Kimi K2.6 can be injected as the reasoning engine for Anthropic's Claude Code:
    ```bash
    ollama launch claude --model kimi-k2.6:cloud
    ```

### 3. Raw API Execution
For custom scripts and harnesses (like `svc` or `taskmaster`), Kimi K2.6 is accessible via an OpenAI-compatible endpoint.
*   **Endpoint:** `https://api.moonshot.ai/v1/chat/completions`
*   **Thinking Mode Requirement:** To unlock the swarm orchestration depth, the API request must include `chat_template_kwargs={"thinking": true}`.
*   **Tool Constraints:** When in thinking mode, `tool_choice` must be set to `"auto"` or `"none"`. Explicitly forcing a specific tool throws an API error, as the orchestrator must be free to fan-out tool calls autonomously.

## Analysis
The availability of the Swarm via CLI and standard API endpoints confirms that Kimi K2.6 is positioned as a foundational infrastructure layer for agentic software engineering, not just a walled-garden SaaS product. The ability to bridge K2.6 into Claude Code via Ollama indicates strong interoperability standards in the 2026 agent ecosystem.

## L4 Pointers
- Package: `@moonshotai/kimi-code`
- Integration target: `ollama launch claude --model kimi-k2.6:cloud`
- API Endpoint: `https://api.moonshot.ai/v1/chat/completions`