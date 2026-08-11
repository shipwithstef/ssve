# Deep Dive: Kimi K2.6 Agent Swarm & PARL Architecture

## Mechanism: Parallel Agent Reinforcement Learning (PARL)
Kimi K2.6 utilizes PARL to train a central "Orchestrator Agent" to decompose complex, long-horizon tasks and manage a massive "Agent Swarm". Unlike traditional RLHF that optimizes for single-turn chat quality, PARL specifically targets the challenges of multi-agent orchestration.

1.  **Overcoming "Serial Collapse":**
    *   **The Problem:** LLM orchestrators default to executing tools sequentially because tracking sequential dependencies is easier to learn and optimize than parallel execution.
    *   **The Solution:** PARL introduces an **Instantiation Reward** to explicitly incentivize the model to schedule tasks concurrently (fan-out).
2.  **Combating "Spurious Parallelism":**
    *   **The Problem:** Once rewarded for parallelism, models may "reward hack" by spawning hundreds of agents without meaningful task decomposition, wasting compute.
    *   **The Solution:** PARL counters this via a **Sub-agent Finish Rate Reward** and a **Task-level Outcome Reward**, ensuring that parallelism only yields a high reward if it actually contributes to solving the overarching goal.
3.  **Credit Assignment (Orchestrator-Only Training):**
    *   **The Problem:** In a 300-agent swarm, determining which agent's action led to success is ambiguous.
    *   **The Solution:** PARL freezes the specialized sub-agents. Only the Orchestrator model's weights are updated during training, strictly rewarding it for accurately decomposing tasks and delegating them to the frozen workers.
4.  **Critical Path Optimization:**
    *   **The Solution:** The RL objective function minimizes the "wall-clock time" (the longest execution branch) rather than just the raw number of steps taken.

## Analysis: Core Model Specifications
The "brain" of this orchestrator is Kimi K2.6, an advanced native multimodal MoE (Mixture-of-Experts) model:
*   **Total Parameters:** 1 Trillion
*   **Active Parameters:** 32 Billion per token (using 8 active experts + 1 shared expert out of 384).
*   **Attention:** Multi-head Latent Attention (MLA) combined with SwiGLU activation for extreme hardware efficiency.
*   **Vision:** Integrated MoonViT encoder (400M parameters) allowing the swarm to process visual inputs (e.g., UI screenshots) natively.
*   **Context:** 256K (or up to 262K) tokens.
*   **Efficiency:** Native INT4 support via Quantization-Aware Training (QAT).

By leveraging PARL, K2.6 can autonomously manage up to **300 specialized sub-agents** for up to **4,000 coordinated steps**. This architecture enables it to run autonomously for 12+ hours, making it capable of tasks like full-stack legacy codebase refactoring (e.g., a 13-hour run rewriting a 4,000-line financial engine resulting in a 185% throughput leap).

## L4 Pointers
- Source: Moonshot AI PARL technical papers and K2.6 release notes (April 2026).
- Framework integration points: "Orchestrator vs Sub-agent" freezing is a pattern `svc` should analyze for its own test-framework metrics.