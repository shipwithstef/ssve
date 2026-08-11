# Harness Agent Design Patterns — Detail

## Mechanism

Two execution modes:

**Agent Teams (default):** TeamCreate spawns independent Claude instances. Members communicate via SendMessage, coordinate via shared TaskCreate/TaskUpdate. Leader monitors, doesn't relay. One active team per session but can dissolve and reform between phases. Previous team's output saved to `_workspace/` for next team.

**Subagents (lightweight):** Agent tool spawns background tasks. Results return to main only. No inter-agent communication. Cheaper, faster, less quality.

**Decision tree:** 2+ agents AND need communication → team. 2+ agents but independent → subagent possible. 1 agent → subagent.

### 6 Architecture Patterns

1. **Pipeline:** `[A] → [B] → [C]` — sequential dependency. Team mode limited unless parallel sections exist.
2. **Fan-out/Fan-in:** `[distribute] → [A] | [B] | [C] → [merge]` — parallel independent. MUST use team mode for cross-pollination during execution.
3. **Expert Pool:** `[router] → {A | B | C}` — conditional selection. Subagent better (no persistent team needed).
4. **Producer-Reviewer:** `[create] → [review] → (retry)` — quality loop. Team mode for real-time feedback. Max 2-3 retries.
5. **Supervisor:** `[boss] → [worker A|B|C]` — dynamic distribution based on runtime state. Team + TaskCreate is natural fit.
6. **Hierarchical Delegation:** `[top] → [mid] → [low]` — recursive decomposition. Team at each level, subagent if no cross-talk.

### Agent Separation Criteria (4 axes)

| Axis | Split when | Keep together when |
|---|---|---|
| Specialization | Different domain expertise needed | Same person could do both |
| Parallelism | Tasks can run concurrently | Must be sequential |
| Context | Different context windows needed | Shared context is cheaper |
| Reusability | Agent is useful in other harnesses | One-off logic |

### Agent Definition Structure (required sections)

Every agent MUST be a file at `.claude/agents/{name}.md`:
1. Core role
2. Working principles
3. Input/output protocol
4. Error handling
5. Collaboration (team communication protocol if team mode)

## Analysis

- **Useful for:** Any project needing structured multi-agent orchestration. Especially CI/CD pipelines, content production, code review, research teams.
- **Trade-offs:** Agent teams are expensive (each member = full Claude instance). Fan-out with 5 agents = 5x token cost. Subagent mode is much cheaper but loses inter-agent intelligence.
- **Similar to:** svc's `execute-changeset` inner worktrees are like subagent mode. GSD's `gsd-executor` is like a single-agent pipeline. Harness goes further with team-level coordination that neither svc nor GSD have.
- **Could improve svc by:** Our `execute-changeset` dispatches subagents but they can't talk to each other. Harness's team mode (SendMessage between agents) could enable cross-task discovery during execution — e.g., task-3 agent tells task-5 agent "I found a shared utility we should both use."
- **Assumptions:** Assumes Claude Code's Agent Teams API (TeamCreate, SendMessage) is available and stable. Assumes Opus model for all agents (expensive).
- **Watch out for:** Token cost with large teams. One active team per session limit. Leader is fixed — can't hand off orchestration mid-run.

## Key Source Files (L4)
- `skills/harness/SKILL.md:44-68` — Phase 2 team architecture selection
- `skills/harness/references/agent-design-patterns.md:1-285` — full pattern reference
- `skills/harness/references/team-examples.md:1-328` — concrete team examples
