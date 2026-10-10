# Phase 4: Coverage Analysis — detail

Moved verbatim from SKILL.md (progressive disclosure).

### AC Coverage Matrix

For each feature spec, list:
- Total AC count
- ACs referenced by at least one journey
- ACs NOT referenced by any journey (gaps)
- ACs with E2E test coverage
- ACs with journey reference but no E2E test (needs test)

```
JOURNEY COVERAGE REPORT
═══════════════════════════════════════════════════
Feature                | Total ACs | In Journeys | Gaps
-----------------------|-----------|-------------|------
feature-matching.md         | 43        | 12          | 31
feature-onboarding.md     | 28        | 15          | 13
feature-collab.md  | 35        | 8           | 27
...
═══════════════════════════════════════════════════
```

### Cross-Journey Dependency Graph (supply-side validation)

This is the highest-value coverage check. Most product gaps hide here.

For every journey's Background section and Given preconditions, trace backwards:

1. **List every assumed state** — entities that must exist, flags that must be set,
   data that must have been created by someone
2. **Identify the producing role** — which user role creates that data?
3. **Check if a journey covers that production** — does any journey for that role
   include a scenario where they create/set that data?
4. **Check if a UI path exists** — even if no journey covers it, does the codebase
   have a page/component where that role can produce the data?

```
CROSS-JOURNEY DEPENDENCY REPORT
═══════════════════════════════════════════════════════════════════════
Consumer Journey       | Assumes                  | Producer | Producer Journey | UI? | Validation?
-----------------------|--------------------------|----------|-----------------|-----|------------
J07 (buyer claims deal)| flash deal exists         | Seller   | NONE            | Partial | NO — bypasses limits
J12 (filtered search)  | listing.accessible = true | Seller   | NONE            | No  | N/A
J06 (redeem points)    | points balance > 0        | System   | J05 (partial)   | Yes | Yes
J15 (team report)      | tasks assigned to members | Manager  | NONE            | Yes | NO — wrong permission
═══════════════════════════════════════════════════════════════════════
```

**Flag as CRITICAL** any row where both "Producer Journey" and "UI Exists?" are
missing or partial — that means the consumer feature literally cannot work because
there's no way to produce its preconditions.

**Flag as GAP** any row where the UI exists but no journey covers it — the feature
works in practice but is undocumented and untested.

This check catches the class of bugs where individual journeys look complete but
the product has holes: features that consume data nobody can create, entity fields
assumed in filters that no UI exposes, states that Background sections require but
no role can produce.

For multi-role products (owner/employee/customer, seller/buyer, creator/viewer),
run this check systematically: every entity referenced in a consumer journey's
Background should trace back to a producer journey's scenario.
