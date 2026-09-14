# Diff and Verdict — common/coding-style.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Simple vs clever code | Always prefer simple (KISS default) | Same | None |
| File size | 200-400 lines typical, 800 max — my default range | Same | None |
| Function size | <50 lines — I'd suggest this | Same | None |
| Error handling | Explicit, never swallow — my default | Same | None |
| Naming conventions | camelCase/PascalCase/UPPER_SNAKE_CASE — my defaults | Same | None |
| Immutability | Return new copies, don't mutate — my default | Same | None |

## Analysis

Every item in this rule is already in my default behavior. KISS, DRY, YAGNI are
foundational principles I apply without instruction. The naming conventions are
the TypeScript/JS community standard I follow. The file/function size thresholds
are in my typical recommendation range. Immutability and error handling are defaults.

This is a well-written style guide for human developers, but it provides zero
per-turn behavior change for Claude.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | The checklist format provides minor structural reminder |
| correctness_delta | 1 | Correct but matches existing defaults |
| friction_cost | 0 | No friction |
| convention_conflict | 0 | No conflict |

## Verdict

**defer-to-default**

Universal software engineering principles already embedded in my defaults.
Rule inflation — burns tokens for zero behavior change.
