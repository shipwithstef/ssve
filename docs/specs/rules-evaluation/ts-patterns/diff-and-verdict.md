# Diff and Verdict — typescript/patterns.md

## Diff

| Scenario | Default | Rule prescribes | Delta |
|---|---|---|---|
| API response shape | Variable — `{data,error}`, `{ok,data}`, etc. | Specific: `{success,data?,error?,meta?}` | Minor narrowing |
| useDebounce | Generic<T> with useState+useEffect | Same pattern, same shape | None |
| Repository interface | findAll/findById/create/update/delete | Same | None |

## Analysis

The repository pattern and useDebounce shape are already my defaults. The API
response format is the only place the rule narrows my behavior — prescribing
a specific `success + data + error + meta` envelope. This is marginally more
specific than my default of "use a consistent envelope," but it's a minor
preference, not a materially different behavior.

The rule also references `common/patterns.md` which adds a skeleton project
search workflow — but the TS-specific file itself doesn't add that.

## Scores

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 1 | Specific API envelope shape is a minor narrowing |
| correctness_delta | 1 | No correctness improvement — my defaults are correct |
| friction_cost | 0 | No friction |
| convention_conflict | 0 | No conflict |

## Verdict

**defer-to-default**

DG=1 and CD=1 don't meet the adopt threshold. The rule codifies patterns I
already know and use. The API envelope shape is the one novel element, but
that's a project convention decision, not a universal default worth enforcing
globally.
