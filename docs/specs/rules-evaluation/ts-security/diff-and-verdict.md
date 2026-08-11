# Diff and Verdict — typescript/security.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| API key in code | Never hardcode, always env var | Same | None |
| Missing env var at startup | Validate + throw | Same | None |

## Analysis

This rule is pure rule inflation. "Never hardcode secrets, use environment
variables" is one of the most deeply ingrained defaults in my behavior. I would
never write `const apiKey = "EXAMPLE_API_KEY"` in any context. The fail-fast startup
validation is also my default recommendation.

The second half of the rule ("Use **security-reviewer** skill") is ECC-specific
and not valid in non-ECC environments.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 0 | Default is already deterministic on secrets |
| correctness_delta | 0 | Default is already correct |
| friction_cost | 0 | No friction |
| convention_conflict | 0 | No conflict |

## Verdict

**defer-to-default**

Zero behavior change. This is the textbook definition of rule inflation — it
documents behavior that Claude does perfectly well without any instruction.
