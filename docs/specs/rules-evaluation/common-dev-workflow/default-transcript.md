# Default Transcript — common/development-workflow.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. User asks me to implement a new feature
2. Researching before writing new code
3. Starting an implementation task

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — implement a feature:**
I'd typically: ask clarifying questions if unclear, look at existing code for
context, propose an approach, then implement. I don't follow a rigid
Plan→TDD→Code→Review→Commit pipeline by default unless guided by skills.

**Scenario 2 — researching before writing:**
I'd use Grep/Glob to search the existing codebase, WebSearch for external
patterns, and Read for relevant docs. I don't have a fixed tool priority
sequence (GitHub search first, then library docs, then broader web search).
I search where seems most useful for the question.

**Scenario 3 — starting implementation:**
My default is to start with a rough plan, but not necessarily with a formal
"planner agent" invocation or a full planning-docs set (PRD, architecture,
system_design, tech_doc, task_list). I often go more directly from spec to code
in simple cases.
