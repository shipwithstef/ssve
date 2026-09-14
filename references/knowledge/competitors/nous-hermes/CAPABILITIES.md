# Nous Hermes Agent Capabilities

## 1. Core Architecture: The "Self-Improving" Loop
Hermes Agent is designed as a persistent, autonomous system that learns from its environment and interactions.

### Learning & Skills
- **Autonomous Skill Creation**: After complex tasks, the agent can synthesize its actions into new "Skills" (`skill_commands.py`, `skill_utils.py`).
- **Closed-Loop Refinement**: Skills are not static; they self-improve over time based on feedback and usage patterns.
- **agentskills.io Compatibility**: Fully compatible with the open SKILL.md standard.

### Tiered Memory Management
- **Managed Memory Controller**: Orchestrated by `memory_manager.py` and `memory_provider.py`.
- **Context Layering**: Uses Workspace-level `AGENTS.md` and user-level `USER.md` for grounding.
- **Trajectory Tracking**: Maintains detailed `trajectory.py` logs of reasoning steps and tool calls for periodic "insights" and model fine-tuning.

## 2. Multi-Provider & Context Stability

### Model-Agnostic Engine
- **Universal Adapters**: Native support for Anthropic (Opus/Sonnet), OpenAI (o1/GPT-4), Gemini (v1.5 Pro), and Xiaomi MiMo via a modular adapter system (`anthropic_adapter.py`, `gemini_native_adapter.py`, etc.).
- **Flash/Thinking Modes**: Supports specialized model modes (e.g., Kimi K2 Thinking) natively.

### Context Resilience
- **Managed Compression**: Uses `context_compressor.py` to handle large codebases without "context rot."
- **Prompt Caching**: Aggressive use of provider-specific prompt caching (`prompt_caching.py`) to reduce latency and cost.
- **Denwa Renji (OpenClaw legacy)**: Supports session time-travel and rollback to previous clean states.

## 3. Deployment & Interaction Surface

### Messaging Gateway
- **Multi-Platform Continuity**: Integrated `gateway` system supports Telegram, Discord, Slack, WhatsApp, Signal, and Email.
- **Voice-to-Task**: Supports voice memo transcription and multimodal (image/video/audio) inputs for task guidance.

### Execution Backends
- **Sandboxed Terminals**: Six backends including local shell, Docker, SSH, Daytona, and serverless backends (Modal, Singularity).
- **Subagent Swarms**: Ability to spawn isolated subagents for parallelized research or execution tasks.

## 4. Key Primitives Checklist

| Feature | Implementation | Notes |
| :--- | :--- | :--- |
| **Cognitive Trace** | `<thought>` tagging | Explicit reasoning tokens captured in trajectory. |
| **Tool Dispatch** | XML/JSON Schema | Robust tool-calling with error classification. |
| **Persistence** | Scratchpad Backend | Preserves state across gateway interruptions. |
| **Integrations** | MCP / ClawHub | Connects to any standard MCP server. |
