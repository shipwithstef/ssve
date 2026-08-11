# Diff and Verdict — common/security.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| No hardcoded secrets | Never hardcode — deep default | Same | None |
| Input validation | Always validate at boundaries — my default | Same | None |
| SQL injection prevention | Parameterized queries — my default | Same | None |
| XSS prevention | Sanitize HTML output — my default | Same | None |
| Pre-commit checklist | Pattern-based mental review | Explicit checkbox list | Minor structural addition |
| Security issue found | Flag prominently, fix it | STOP → security-reviewer agent → rotate secrets → review codebase | ECC-specific protocol; escalation framing is stronger |

## Analysis

The security defaults (no hardcoded secrets, validate input, prevent SQLi/XSS/CSRF)
are all deeply embedded in my behavior. These generate zero behavior change.

The pre-commit checklist adds a checkbox format. My default is pattern-based
review without a formalized list. The checklist is slightly more systematic.

The security response protocol is the most novel element — "STOP immediately"
framing is stronger than my default contextual approach, and the rotation step
("rotate any exposed secrets") is an important reminder. However, the "use
security-reviewer agent" is ECC-specific.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | Checklist format + STOP protocol adds minor structure |
| correctness_delta | 0 | Security defaults are already correct |
| friction_cost | 0 | No friction |
| convention_conflict | 0 | No conflict |

## Verdict

**defer-to-default**

DG=1, CD=0 — doesn't reach adopt threshold. The security defaults are perfectly
handled without this rule. The STOP protocol framing is stronger but not
materially different from what I'd do. The checklist format is a minor plus
but not worth per-turn injection.
