# Diff and Verdict — common/testing.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| New feature testing | Recommend TDD, not mandatory | **MANDATORY** RED/GREEN/IMPROVE workflow | Stronger framing |
| Coverage threshold | 80% as guideline | 80% hard minimum | Stronger framing |
| Test structure | AAA naturally — my default | Same | None |
| Test naming | Descriptive behavior names — my default | Same | None |
| TDD agent | Generic subagents | `tdd-guide` ECC agent | ECC dependency |

## Analysis

The substantive elements (TDD approach, 80% threshold, AAA structure, descriptive
names) are all things I already do or recommend. The difference is degree of
emphasis: the rule uses MANDATORY framing that's stronger than my recommendations.

Does "MANDATORY" framing change Claude's behavior? Marginally — it shifts from
"I recommend TDD" to "I enforce TDD." But in practice, if a user pushes back on
TDD or the project context doesn't suit it, I'd still adapt. The MANDATORY label
doesn't reliably change outcome.

The tdd-guide agent reference is ECC-specific.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | MANDATORY framing slightly strengthens TDD recommendation |
| correctness_delta | 1 | Correct approach, slightly stronger than default |
| friction_cost | 0 | No friction from the guideline itself |
| convention_conflict | 0 | No conflict |

## Verdict

**defer-to-default**

DG=1, CD=1 — doesn't reach adopt threshold. The MANDATORY framing is the only
meaningful difference from defaults, and it's not a reliable behavior change
since I adapt to project context regardless. The patterns and 80% threshold
are already my recommendations.
