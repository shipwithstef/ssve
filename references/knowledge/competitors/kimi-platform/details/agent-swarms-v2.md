# Kimi Agent Swarm: Parallel Orchestration & PARL

The Kimi Agent Swarm is a high-concurrency execution architecture designed to overcome the latency and sequential bottlenecks of traditional single-agent loops.

## 1. Parallel Agent Reinforcement Learning (PARL)
The core of the swarm is an orchestrator model trained using **PARL**, a specialized RL framework for multi-agent coordination.

### Orchestrator Intelligence
- **Decomposition**: The orchestrator is trained to break a high-level goal into non-blocking, parallelizable sub-tasks.
- **Agent Allocation**: It dynamically assigns sub-tasks to specialized models (e.g., a "Code Expert" for implementation and a "Security Expert" for auditing).
- **Consensus & Fusion**: The orchestrator performs a "Fusion Turn" where it synthesizes the outputs of multiple sub-agents into a unified result.

## 2. Swarm Dynamics: 300-Agent Execution
Kimi can spawn up to 300 sub-agents in a single "Swarm Surge."

### Operation Principles
- **Massively Parallel Audits**: Can analyze thousands of files across a large monorepo simultaneously, reducing completion time from hours to minutes (4.5x speedup).
- **Communication Protocol**: Sub-agents communicate via a high-speed shared blackboard (RPC stdio Wire).
- **Heartbeat & Recovery**: The orchestrator monitors sub-agent health. If an agent hangs or fails, its sub-task is re-queued or delegated to a survivor.

## 3. Integration with Kimi Claw
Kimi Claw provides the cloud infrastructure for these swarms to run 24/7.

- **Managed Persistence**: Swarm state is preserved even if the user disconnects.
- **Skill Propagation**: Any skill installed via ClawHub is instantly available to all 300 agents in a swarm.
- **Telemetry**: Users receive real-time updates via the Messaging Gateway (Telegram/Discord) on swarm progress and "Fusion" milestones.
