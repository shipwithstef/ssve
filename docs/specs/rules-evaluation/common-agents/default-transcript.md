# Default Transcript — common/agents.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. User asks for help implementing a complex feature
2. User has just written code and asks for review
3. User needs architectural guidance
4. Performing multiple independent analysis tasks

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — complex feature:**
I do the planning work directly, inline. I might use the Agent tool with a
general-purpose subagent for parallelizable research, but I don't have
a named "planner" agent I dispatch to by default.

**Scenario 2 — code just written:**
I do the code review directly in the conversation. I don't dispatch to a
"code-reviewer" subagent. I check for correctness, security, style, and tests.

**Scenario 3 — architectural decision:**
I reason through the architecture directly, maybe using the Agent tool for
research or specific analysis tasks.

**Scenario 4 — parallel tasks:**
I do use parallel tool calls and parallel agent spawns via the Agent tool for
genuinely independent tasks. But I use generic "general-purpose" subagents, not
named specialized agents like "security-reviewer" or "tdd-guide".

**Key default:** I don't have a named agent ecosystem (planner, tdd-guide,
code-reviewer, security-reviewer, etc.) in base Claude Code. I work directly
or with generic subagents.
