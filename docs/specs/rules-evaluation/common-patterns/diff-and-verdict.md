# Diff and Verdict — common/patterns.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| New functionality | Search for existing solutions; no fixed pipeline | Search → parallel ECC agents (security/extensibility/relevance) → clone skeleton | ECC-specific pipeline |
| Repository pattern | findAll/findById/create/update/delete — my default | Same | None |
| API response envelope | Variable shape; context-dependent | Fixed: success + data + error + meta | Minor narrowing |

## Analysis

The skeleton project discovery pipeline is the novel element — but it's entirely
ECC-specific (parallel security-assessment/extensibility/relevance/planning agents).
Without ECC, this pipeline doesn't exist.

The design patterns themselves (repository, API envelope) are either my defaults
(repository) or a minor narrowing I'd apply case-by-case (API envelope shape).
The envelope shape is also defined in `typescript/patterns.md` already evaluated as
defer-to-default.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | API envelope prescription adds minor specificity |
| correctness_delta | 1 | Patterns are correct but already in defaults |
| friction_cost | 1 | ECC agent dependency for skeleton search |
| convention_conflict | 1 | ECC routing conflicts with svc's patterns |

## Verdict

**defer-to-default**

DG=1, CD=1 — doesn't reach adopt threshold. The novel skeleton-search pipeline
is ECC-specific and invalid outside ECC. The patterns themselves are defaults.
