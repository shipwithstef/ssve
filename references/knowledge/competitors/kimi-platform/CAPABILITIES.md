# Kimi Platform & Model Capabilities

Moonshot AI's Kimi platform has evolved beyond a simple chatbot into a comprehensive agentic ecosystem built around frontier-scale models and specialized execution modes.

## 1. Flagship Models (2026)

### Kimi K2.6
Launched in April 2026, K2.6 is the "Pro Max" model designed for complex agentic workflows.
- **Architecture**: Mixture-of-Experts (MoE) with 1 Trillion total parameters (32B active per token).
- **Context Window**: 262,144 tokens (standard).
- **Optimization**: Specifically trained for **Long-Horizon Stability**, enabling 200–300 consecutive tool calls without goal drift.
- **Native Multimodality**: Trained on interleaved text and visual data for seamless UI-to-code and visual reasoning.

## 2. Platform Operating Modes & Infrastructure

### Operating Modes
Kimi offers distinct modes for different levels of complexity:
- **Thinking Mode**: Optimized for step-by-step reasoning and maintaining extreme state coherence over long sessions.
- **Agent Mode**: Full autonomous execution with access to a rich toolset (Web, Shell, Python, ACP).
- **Agent Swarm (Managed)**: Orchestrates up to 300 specialized sub-agents in parallel (up from 100 in K2.5) via **PARL** (Parallel Agent RL) to solve massive tasks. Each run can execute up to 4,000 coordinated steps (up from 1,500), delivering real file outputs (e.g., 100+ files, 100k-word reviews) rather than chat responses. Supports heterogeneous skills running in parallel (search, analysis, coding, long-form writing, visual generation). See [details/agent-swarm-parl.md](details/agent-swarm-parl.md) and [details/cli-integration.md](details/cli-integration.md) for deeper SME analysis.

### Kimi Claw (Infrastructure)
- **Managed OpenClaw**: Cloud-hosted deployment of the OpenClaw framework for 24/7 autonomous task execution.
- **Persistence**: Goal states and long-running workflows persist even when the user is offline.
- **Ecosystem**: Integrated with ClawHub for community skill discovery.

## 3. The "Plan" Concept

In the Kimi ecosystem, a "Plan" is more than a document; it is a **persistent agent state**.
- **Persistence**: Goal states are maintained across sessions using a "scratchpad architecture."
- **Verification**: The model automatically verifies tool outputs against the current "Plan" and adjusts sub-tasks if errors are found.
- **Artifacts**: Plans often result in persistent markdown artifacts (like the CLI's `heroes` slugs) that serve as a shared source of truth between the user and the agent.

## 4. Key Use Cases

| Domain | Pro Max Capability |
| :--- | :--- |
| **Software Engineering** | Full-stack project implementation from visual UI prompts (visual-to-code). |
| **Deep Research** | Automated multi-source data synthesis, competitor mapping, and trend forecasting. |
| **Workflow Automation** | 24/7 "Proactive Agents" that monitor real-time feeds and execute actions (trading, support, etc.). |
| **Enterprise Data** | Swarm-based analysis of massive document sets (legal, medical, technical patents). |

## 5. Parallel Agent Reinforcement Learning (PARL)

The orchestration power of the Kimi K2.6 Agent Swarm is driven by **PARL**, a specialized training methodology designed to solve core challenges in multi-agent systems:
- **Overcoming Serial Collapse**: Models naturally default to sequential, one-by-one execution because it's easier to optimize. PARL introduces a "compute and time budget" during training that explicitly penalizes serial execution and rewards parallel fan-out.
- **Orchestrator-Only Training**: To solve the ambiguous credit assignment problem (knowing which sub-agent caused the success), PARL freezes the specialized sub-agents. The RL only updates the **Orchestrator model**, rewarding it strictly for successful task decomposition and delegation.
- **Critical Path Optimization**: The RL rewards minimizing the "wall-clock time" (the longest execution branch) rather than just the raw number of steps, encouraging the orchestrator to launch independent sub-tasks simultaneously (e.g., frontend, backend, and database provisioning).
