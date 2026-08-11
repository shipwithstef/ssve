# Diff and Verdict — typescript/coding-style.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Public API types | Always add explicit types | Same | None |
| interface vs type | My default (interface for shapes, type for unions) | Same | None |
| Avoid `any` / use `unknown` | Always — deep default | Same | None |
| React props — no `React.FC` | My default | Same | None |
| Async error handling with `unknown` narrowing | My default | Same | None |
| Input validation with Zod | My default recommendation | Same | None |
| No console.log in production | My default | Same | None |
| Immutability with spread | My default | Same | None |

## Analysis

This rule is a high-quality TypeScript style guide, but it documents behaviors that
are already deeply embedded in Claude's TypeScript defaults. Every directive the rule
states is independently part of my knowledge and practice. The rule provides good
examples and explanations, which makes it valuable as a **reference document** for
humans reading it, but adding it as a per-turn rule changes nothing about what the
model does.

The `React.FC` avoidance and `no enum` preferences are community-standard and
are already in my defaults.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | Thresholds and examples add minor specificity (Zod prescription over generic validation) |
| correctness_delta | 1 | Rule is correct but my defaults are already correct |
| friction_cost | 0 | No friction — aligns perfectly |
| convention_conflict | 0 | Standard TS community conventions |

## Verdict

**defer-to-default**

Rule restates TypeScript defaults. Zero per-turn token benefit. This file is
excellent documentation for onboarding human developers, but it is not a
behavior-change rule for Claude. Move to `references/` if the team wants the
content available; do not inject per-turn.
