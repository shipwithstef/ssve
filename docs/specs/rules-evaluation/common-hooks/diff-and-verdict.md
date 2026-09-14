# Diff and Verdict — common/hooks.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Hook types | Know PreToolUse/PostToolUse/Stop | Same | None |
| Auto-accept | Cautious default, prefer allowedTools | Same — "never use dangerously-skip-permissions" | None |
| TodoWrite checklist | Use for task tracking, mark items | Rule adds: check for out-of-order steps, wrong granularity, misinterpreted requirements | Minor specificity |

## Analysis

The hook types section and auto-accept guidance restate what I already know and
do. The TodoWrite section adds some meta-inspection prompts (check for out-of-order
steps, wrong granularity) that go slightly beyond my default "create and track
todos" behavior — but this is very minor.

The rule reads more like documentation than a behavioral constraint. It doesn't
tell me to do anything materially different.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | TodoWrite meta-inspection prompts add slight specificity |
| correctness_delta | 1 | Minor improvement to todo quality |
| friction_cost | 0 | No friction |
| convention_conflict | 0 | No conflict |

## Verdict

**defer-to-default**

DG=1, CD=1 — doesn't reach adopt threshold. Largely informational content
that restates what Claude already knows. The TodoWrite inspection tips are
mildly useful but not worth per-turn injection cost.
