# Diff and Verdict — common/development-workflow.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Pre-implementation research | Search where useful; no fixed sequence | Fixed priority: `gh search repos/code` → library docs → Exa → package registries | Behavior change — specific research sequence |
| Start implementation | Plan informally, or dive in | Use `planner` ECC agent for planning docs | ECC dependency |
| TDD approach | Recommend TDD | Use `tdd-guide` ECC agent, MANDATORY RED/GREEN/IMPROVE | ECC dependency + stronger framing |
| Code review | On demand | Always use `code-reviewer` agent after writing | ECC dependency |
| Commit | Conventional commits | Same, but adds agent dispatch | ECC dependency |

## Analysis

The research sequence (Step 0) is the genuine behavior change: explicitly using
`gh search repos` and `gh search code` BEFORE implementing, then library docs,
then broader web search. My default is more diffuse — I search where seems
useful without a mandated priority sequence. This research sequence helps prevent
reinventing the wheel by ensuring GitHub search happens first.

However, Steps 1-4 all depend on ECC-specific agents (planner, tdd-guide,
code-reviewer) that don't exist in base Claude Code or in svc's skill vocabulary.
In svc, the equivalent routing is done by `route-workflow` → `plan-changeset` →
`execute-changeset` → `review-gate`. The ECC agent names conflict.

The valuable core: "research before implementing, using this search priority."
The problematic overlay: ECC agent dispatch table for planning/TDD/review.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | Research sequence (`gh search` first) changes default behavior — I wouldn't always do `gh search repos` first |
| correctness_delta | 1 | Research-first reduces re-implementation errors |
| friction_cost | 1 | ECC agent refs create friction; research step itself has low friction |
| convention_conflict | 1 | ECC routing conflicts with svc's route-workflow; Step 0 is universal |

## Edits required for adoption

1. Keep Step 0 (Research & Reuse) verbatim — this is the behavior change worth adopting
2. Strip Steps 1-5 entirely (all ECC-specific agent dispatch) — svc has its own pipeline for these
3. Resulting rule: one section — "Before implementing, research in this order: gh search → vendor docs → broader web search → package registries"

## Verdict

**adopt-with-edits**

DG=2, CD=1, FC=1, CC=1 — meets adopt-with-edits threshold. The research sequence
is a genuine behavior change worth adopting. The ECC pipeline steps should be
stripped; svc already has its own implementation workflow.
