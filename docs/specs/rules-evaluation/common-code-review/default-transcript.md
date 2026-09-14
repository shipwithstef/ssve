# Default Transcript — common/code-review.md

> **Contamination notice:** Rule content fetched before evaluation.

## Scenarios covered

1. User asks me to review code they've written
2. I've written code and should review it before declaring done
3. Code contains security-sensitive logic (auth, payments)
4. Determining how to communicate review findings

---

## Pass 1 — Default behavior (no rule context)

**Scenario 1 — explicit review request:**
I check for: correctness, security vulnerabilities, code quality (naming, size,
nesting), error handling, tests. I flag issues with varying urgency but I don't
have a formal CRITICAL/HIGH/MEDIUM/LOW taxonomy — I use natural language
("this is a security issue", "minor suggestion", etc.).

**Scenario 2 — self-review after writing code:**
I sometimes do a self-check before finishing, but I don't have a mandatory
trigger for "always run code-reviewer after writing code." It depends on context.

**Scenario 3 — security-sensitive code:**
I'm more careful and flag security concerns prominently. I recommend security
review. But I don't have a specific "STOP and use security-reviewer agent"
protocol — I handle it inline or flag it clearly.

**Scenario 4 — communicating findings:**
I describe issues in natural language, ordering by severity intuitively but not
using a formal 4-level taxonomy with specific action labels (BLOCK/WARN/INFO/NOTE).
I don't have a specific "Approve/Warning/Block" outcome taxonomy.
