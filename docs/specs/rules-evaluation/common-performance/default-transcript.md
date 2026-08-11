# Default Transcript — common/performance.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. Asked which Claude model to use for a specific agent task
2. Working near context window limits
3. Asked about enabling extended thinking

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — model selection for agent tasks:**
My default is vague: "use a smaller/faster model for lightweight tasks, a more
capable model for complex reasoning." I know the Haiku/Sonnet/Opus capability
hierarchy but I don't have a formal decision table mapping task types to
specific models. I'd recommend Sonnet for most work and Opus for complex
architectural decisions.

**Scenario 2 — near context limits:**
I'm aware that context quality degrades as the window fills. I'd recommend
breaking work into smaller pieces. The specific "avoid last 20% for large
refactors" guidance is more prescriptive than my typical advice.

**Scenario 3 — extended thinking:**
I know extended thinking exists and how to toggle it (Option+T on macOS, etc.).
I'd explain it if asked. I don't proactively recommend enabling it unless the
task is clearly reasoning-heavy.
