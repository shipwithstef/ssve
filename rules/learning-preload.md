---
id: svc-learning-preload
type: steering
scope: universal
severity: medium
---

# Rule: Pre-Load Relevant Learnings Before Acting

Before starting any non-trivial task, check for prior learnings that could prevent known mistakes. Learnings are more specific than general knowledge — they capture project- and framework-level pitfalls discovered through real failures.

## Two Learning Repositories

| Repository | Path | Scope | When to check |
|---|---|---|---|
| **Project learnings** | `docs/learnings/learnings.jsonl` | Project-specific patterns, pitfalls, operational quirks | Every session start, before `execute-changeset` |
| **Framework learnings** | `references/framework-learnings.jsonl` | Framework-level mistakes, host API drift, validator gaps | Before any framework change (`evolve-framework`, `improve-framework`, `create-skill`) |

## How to Check

```bash
# Project learnings — match current error or topic
grep -i "<topic>" docs/learnings/learnings.jsonl 2>/dev/null \
  | jq 'select(.confidence >= 7)' || true

# Framework learnings — always check before framework work
grep -i "<topic>" references/framework-learnings.jsonl 2>/dev/null \
  | jq 'select(.confidence >= 7)' || true
```

## What to Do With Matches

1. **Read the insight** — understand what was learned and why
2. **Apply it** — adjust your approach based on the prior learning
3. **Log application** — when a learning prevents a mistake, note it: the learning's confidence can be bumped +1 (cap 10)

## When Learnings Become Rules

If a learning fires 3+ times across sessions with confidence >= 8, it is a candidate for elevation to a `rules/` correction rule. This is how the framework improves deterministically.

## Rationale

An agent that ignores prior learnings repeats the same debugging cycles. An agent that checks learnings first operates like a team member who reads the runbook before touching production.
