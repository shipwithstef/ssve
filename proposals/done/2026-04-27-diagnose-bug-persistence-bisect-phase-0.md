# Proposal — `diagnose-bug` Phase 0: Persistence Bisect

**Filed:** 2026-04-27
**Status:** proposed
**Severity:** HIGH
**Affects:** `diagnose-bug/SKILL.md`

## Problem

"Data didn't appear in UI" bugs have exactly two root-cause classes:

- **Class A — data not persisted.** Backend rejected the write, RLS blocked it, schema silently dropped the field, transaction rolled back, idempotency key collision, etc. Fix lives in the backend / API gateway.
- **Class B — data persisted but query/cache/scope mismatch.** UI queries a different scope than the seed lives at, React Query has stale cache, optimistic update missed the cache key, multi-tenant context default points elsewhere, etc. Fix lives in the frontend / test-infra.

These two classes have ZERO overlap in their fix paths. Without bisecting between them up front, debugging searches BOTH spaces simultaneously — reading frontend AND backend code, hypothesizing on both sides, drafting fixes that target the wrong half.

`diagnose-bug` currently starts at "trace inspection" which assumes the bug is a class-B (the data flowed through, something on the receiving side dropped it). For class-A bugs the trace just shows the failed write or empty response — no signal pointing at WHY. The bisect step is missing.

## Proposed change

Add a new Phase 0 to `diagnose-bug/SKILL.md`, BEFORE current Phase 1 (trace inspection):

### Phase 0 — Persistence Bisect (MANDATORY for "expected X visible, got 0/empty" symptoms)

For any symptom matching:
- "expected entity / record / row / item visible, got 0 / empty / not found"
- "stat count should be N+1, got N (or 0)"
- "list should contain X, got empty"
- "after action, page should show Y, got nothing"

Run a direct SDK / API probe to bisect the search space:

```ts
// Pseudo — adapt per project SDK
const c = await getAuthenticatedClient(account.email, account.password);
// Step 1: did the write actually happen?
const records = await c.entities.X.filter({ <same scope as the test seeded> });
console.log('persisted count:', records.length);
records.forEach(r => console.log(' -', r.id, /* relevant fields */));
```

**Branch on the result:**

- **records.length === 0 → CLASS A (not persisted).** Investigate: API response status, RLS rules, schema field allowlists, secureOperation gates, validation errors, transaction failures. Skip frontend inspection entirely.
- **records.length ≥ 1 → CLASS B (persisted, UI doesn't see).** Investigate: scope/filter mismatch (see `rules/tenant-scoped-test-seeding.md`), cache key alignment, query enabled state, current-context resolution, helper-app query parity (see `rules/helper-app-query-parity.md`). Skip backend inspection entirely.

Phase 0 output: a one-line classification ("Class A — Employee.create returned 200 but no record exists" / "Class B — record exists at scope X, UI queries scope Y") that scopes all subsequent phases.

### Why mandatory

Without this bisect, ~50% of debugging effort searches the wrong half of the system. The probe takes 2-5 minutes; the savings on a bisected search are typically 60-90 minutes.

## Real failure observed

WI-132 J04 stat tests: spent ~6 PRs investigating helper code, secureOperation gates, query keys, and React Query cache (all class-B inspections) before running a probe. The probe (run AFTER PR #4) revealed the data WAS persisted correctly — symptom was scope mismatch (class B, but in test infra, not app code). Had Phase 0 run first, the probe would have shown "records exist at scope X" in 60 seconds and routed directly to scope-resolution debugging.

## How this composes with other rules

- `rules/post-fix-evidence-before-next-fix.md` — applies AFTER the first fix attempt fails. Phase 0 applies BEFORE the first fix.
- `rules/helper-app-query-parity.md` — direct fix path when Phase 0 returns class B.
- `rules/tenant-scoped-test-seeding.md` — direct fix path when Phase 0 returns class B AND the symptom is multi-tenant.

## Decision needed

Add Phase 0 to `diagnose-bug/SKILL.md` as a mandatory pre-trace step for the listed symptoms. No new skill needed — extending the existing `diagnose-bug` skill is sufficient.

## Source

WI-132 J04 stat tests; pattern observed in WI-097 (Base44 `$gte` operator returning empty), WI-108→WI-113 (schema vs data drift), WI-126 (user_type null persistence).
