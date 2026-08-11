# Rule: Test Helpers Must Mirror the App's Exact Filter / Scope Query

When a test helper resolves "the X that belongs to Y" (owned records, scoped records, current-user records), it MUST use the SAME filter query the production app uses for the same resolution. A helper that uses a permissive superset (broader query, looser ownership check, fallback paths) will resolve records the app's UI cannot see, and the resulting test seeds become invisible in the UI under test.

## The failure pattern

1. App's context provider queries `entities.X.filter({owner_id: userId})`.
2. Helper queries `entities.X.list()` and applies a permissive ownership check (`owner_id === userId` OR `email-fallback` OR `created_by` match).
3. Helper finds a stale record with `owner_id: null` that matches the email-fallback path.
4. App's strict filter excludes that same stale record.
5. Helper "successfully" pins the test to a record the app cannot surface → UI assertions fail.

## Required practice

For every helper that resolves "owned X" / "scoped X" / "current-user's X", document and verify:

- **Source of truth — app query:** the exact `entities.X.filter({...})` (or equivalent) the production code uses.
- **Helper query:** must be byte-equivalent to the app query. Same fields, same operators, same fallback behavior (or NO fallback).
- **No permissive supersets.** If the app filters by `owner_id`, the helper must NOT fall back to email/created-by/owner-name matching when `owner_id` is missing — it must report "no match" so the failure surfaces.
- **No `list()` + client-side filter** when the app uses server-side filter. Stale data + permissive matching is the usual cause of helper-app divergence.

## Forbidden patterns

```ts
// ❌ Helper uses list() + permissive ownership, app uses filter({owner_id}).
const all = await client.entities.X.list();
const owned = all.filter(r =>
  (r.owner_id && r.owner_id === userId) ||
  (r.created_by?.toLowerCase() === userEmail) ||
  (r.owner?.toLowerCase() === userEmail)
);
```

```ts
// ✅ Mirror the app exactly.
const owned = await client.entities.X.filter({ owner_id: userId });
```

## Forbidden in cleanup helpers too

Cleanup paths have the same hazard: a `deleteAllE2EEntities` helper that uses `list()` with a permissive prefix-match can leave orphans the app's `filter({...})` would have included. Use the same query as the app, then prefix-match the result.

## How to enforce

- `audit-implementation` flags any helper that resolves "owned/scoped X" via a different filter than the app uses. Severity: HIGH.
- `review-gate` G3 — any PR touching `e2e/helpers/*`, `tests/fixtures/*`, or equivalent test-infra paths must declare which app query the helper mirrors. Cite file:line of the app code.
- A reviewer hook: search the PR for any test helper that calls `entities.*.list()` followed by an in-memory filter; require justification ("app uses list too because <reason>") before approving.

## When the helper LEGITIMATELY needs broader scope

There are two valid cases for a helper to use a broader query than the app:

1. **Cleanup of stale test data.** A teardown helper may need to delete records the app no longer sees (orphans, broken-ownership records). In this case, document explicitly: `// CLEANUP-ONLY: broader than app to catch orphans`.
2. **Asserting against records the app intentionally hides.** Rare. Document why and cite the app code that hides them.

Outside these two cases, helper-app query divergence is a bug.

## Why this exists

Real failure mode observed in WI-132 (Example Marketplace J04): `getOrCreateJ04SeedLocation` used `Location.list()` + permissive ownership (`owner_id === userId` OR `created_by`/`owner` email match). It found a stale seed with `owner_id: null` whose `created_by` email matched. The app's `LocationContext` used `Location.filter({owner_id})` which excluded that stale seed. Helper "succeeded" pointing at a phantom; UI showed a different location; tests failed for hours before the divergence was found.

This is universal. Any framework with strict server-side ownership filtering (Postgres RLS, Firestore rules, Base44 entity gateway) will have this failure mode if test helpers don't mirror the app exactly.

## Severity when violated

HIGH — silent failure mode, drives debug-by-PR loops. Block at `review-gate` G3 unless the helper carries one of the two documented exceptions above.
