# Diff and Verdict — common/performance.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| Agent model selection | Vague: "use smaller model for lightweight tasks" | Explicit table: Haiku→lightweight agents, Sonnet→main dev, Opus→complex reasoning | Significant determinism gain |
| Context window near-full | "Be careful, break work up" | Avoid last 20% for specific task types; list lower-sensitivity tasks | Adds specificity |
| Extended thinking toggle | Explain if asked | Extended thinking is default on; list control mechanisms | Behavior change — inform proactively |
| Build failures | Fix the error | Use `build-error-resolver` ECC agent | ECC dependency |

## Analysis

**Model selection table:** This is the genuine behavior change. My default for
"which model should this agent use?" is vague guidance. The rule creates a
concrete decision table: Haiku 4.5 for workers/pair-programming (90% Sonnet
capability, 3x cheaper), Sonnet 4.6 for main development and orchestration, Opus
for complex architectural decisions and research. This changes my recommendations
when building or configuring multi-agent systems.

**Context window "last 20%":** Adds more specificity than my default "be careful
near limits." The task categorization (large refactors = avoid at end; single-file
edits = ok at end) is genuinely useful guidance I don't provide consistently.

**Extended thinking:** The rule accurately describes defaults and controls. Minor
behavior change — I'd more proactively mention the toggle.

**Model version note:** The rule says "Opus 4.5" but the current production model
is `claude-opus-4-6`. This is a minor stale reference that needs updating.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | Model selection table eliminates vague defaults in multi-agent contexts |
| correctness_delta | 2 | Prevents suboptimal model choices (e.g., using Opus when Haiku suffices) |
| friction_cost | 1 | Model selection only relevant when building agents; mostly background |
| convention_conflict | 0 | No conflicts |

## Edits required for adoption

1. Update "Opus 4.5" → "Opus 4.6" (current: `claude-opus-4-6`)
2. Strip "Build Troubleshooting" section (ECC `build-error-resolver` agent)
3. Verify model IDs at adoption time — model names evolve

## Verdict

**adopt-with-edits**

DG=2, CD=2, FC=1, CC=0 — meets adopt threshold. The model selection decision
table is a genuine behavior change that prevents suboptimal model choices in
multi-agent system design. Keep after removing stale model version and ECC section.
