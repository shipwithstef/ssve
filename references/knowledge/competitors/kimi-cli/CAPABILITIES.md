# Kimi Code CLI - Capabilities (Pro Max Analysis)

Moonshot AI's Kimi Code CLI is a high-density agentic platform that blends research-grade agent loops with production-grade developer tooling. This analysis covers the full feature set as of version 1.37.0.

## 1. Core Operating Modes
- **Agent Mode**: Collaborative, turn-based developer assistance.
- **Shell Mode**: AI-assisted terminal environment.
- **Print Mode (`--print`)**: One-shot execution for CI/CD or automation scripts.
- **Plan Mode**: A persistent, read-only research state that isolates planning artifacts from production code.
- **Yolo Mode**: Fully autonomous execution with all approval gates disabled.
- **Ralph Mode**: Iterative self-correction loop for multi-step tasks.

## 2. Advanced AI Features
- **Denwa Renji (Context Reversibility)**: Intentional session "time travel" using D-Mails to revert context to previous checkpoints.
- **Agent Flows**: Graph-based execution of prompts and decisions defined via Mermaid/D2 flowcharts.
- **Chain of Thought**: Specialized `Think` tool to sequester reasoning from actions.
- **Context Compaction**: Automated, Denwa-Renji-aware compression of long conversation histories.

## 3. Extensibility Model
- **Agent Skills**: `agentskills.io` compatible; supports standard instructions and Flow-based state machines.
- **Sub-agents**: YAML-defined isolated agent instances with restricted toolsets for specialized tasks (e.g., coder, explore, plan).
- **Plugins**: Stateless local toolkits with secure host configuration/credential injection.
- **MCP (Model Context Protocol)**: native integration for background tool loading and server management.
- **Hooks System**: Policy enforcement and auditing via shell/wire hooks capable of blocking actions.

## 4. Systems Architecture
- **Multi-Kernel Implementation**: Choice between the Python `KimiSoul` and a high-performance Rust `kagent` sidecar.
- **Monorepo Primitives**:
    - `kaos`: Unified filesystem abstraction supporting Local and **Remote SSH** backends.
    - `kosong`: Reusable agent loop components and multi-modal message primitives.
- **Wire Protocol**: Bidirectional JSON-RPC stdio protocol (v1.9) for UI and IDE bridging.

## 5. Persistence & Management
- **Heroes Storage**: Persistent, human-readable plan storage in `~/.kimi/plans/`.
- **Background Task Store**: JSON-based lifecycle management for autonomous bash and agent tasks.
- **Notification System**: Unified alerting for task completions, errors, and system status.

## 6. Integrations
- **Web UI**: React/Vite-based browser interface.
- **Terminal UI**: Modern TUI built with Textual (Toad).
- **ACP (Agent Client Protocol)**: Integration bridge for modern IDEs like Zed.
- **Zsh Plugin**: Native shell shortcuts and completions.
