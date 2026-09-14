# Rule: Tenant-Scoped Test Seeding Must Match the App's Default Resolution

When a test seeds an entity in a multi-tenant or multi-scope environment (multi-location, multi-workspace, multi-org, multi-account), the seed MUST land at the same scope the app's UI resolves to by default — OR the test MUST explicitly drive the UI to the seed's scope through the same control a user would use.

Mixing the two — seeding at a hardcoded scope while letting the UI default elsewhere — is the failure mode this rule prevents.

## The failure pattern

1. App's context provider (e.g. `LocationContext`, `WorkspaceContext`) defaults its current scope to `entities.X.filter({owner_id: me.id})[0]` or equivalent.
2. Test seeds data at a hardcoded scope (e.g. a "Stream-B Seed" location, a "Test Workspace") that is NOT the same record the context picks first.
3. UI queries by current scope → seeded data invisible → assertion fails with no signal pointing at the scope mismatch.
4. Symptom looks like a backend persistence bug; engineer chases code that's working correctly.

This pattern fired across multi-location e2e accounts after they accumulated 10+ scope records over time.

## Required practice — pick ONE of the two paths and commit

**Path A — Seed where the app lands.** In test setup, run the app's exact resolution query, take the same record the context will pick, and seed against it:

```ts
// Mirror LocationContext.jsx default behavior exactly.
const ownedScopes = await client.entities.Location.filter({ owner_id: me.id });
const defaultScope = ownedScopes[0];                  // same as the app
const employeeId = await ensureEmployeeRecord(client, ..., defaultScope.id);
// No UI navigation needed — the app already queries this scope.
```

**Path B — Seed at a fixed scope and drive the UI to it.** Reachable only when the seed scope is in the same set the context surfaces (i.e. same filter). The UI control must be exercised through the same selector mechanism a user would use, with disambiguation per `rules/no-positional-role-selectors.md` (proposal).

```ts
const seedScopeId = await getOrCreateSeed(client, me.id);   // must pass owner_id filter
await page.locator('[data-testid="scope-switcher"]').selectByName(SEED_NAME);
```

Picking Path A is almost always simpler. Reach for Path B only when the test must verify scope-switching itself.

## Forbidden patterns

- ❌ Seed at scope X, assert UI without driving UI to scope X — the implicit default rarely matches X on shared/multi-scope accounts.
- ❌ Resolve the seed via a permissive query (`list()`, email-fallback ownership) when the app uses a strict query (`filter({owner_id})`). See `rules/helper-app-query-parity.md`.
- ❌ Use positional `getByRole('combobox').first()` for scope switchers when the app's chrome may render other comboboxes first (language, theme).

## How to enforce

- `write-e2e` Phase "seed setup" must declare which path (A or B) the test takes and cite the app's default-resolution query path the seed mirrors.
- `audit-implementation` flags any test that seeds entities AND asserts on a scoped UI query without one of: (a) seeding via the same filter the app uses, OR (b) explicit scope switching with a disambiguated selector.
- `diagnose-bug` Phase 0 (persistence bisect) — when a probe shows data IS persisted but the UI shows empty, the next inspection must be the scope/filter the UI is querying vs the scope the seed lives at.

## Why this exists

Real failure mode observed in WI-132 (Example Marketplace J04): test owner accumulated 14 locations across runs; `LocationContext` defaulted `currentLocation` to `Location.filter({owner_id})[0]` = `E2E Onboarding 7T0510...`; seed lived at `Stream-B Seed Café` with stale/missing `owner_id`; UI queried `currentLocation.id`'s employees and stat counts stayed at 0. Six PRs were spent before the scope mismatch was identified. Path A (seed where the app lands) closed the loop in one PR.

The pattern is universal. Any framework with multi-tenant context defaults — workspaces in Linear, organizations in GitHub, accounts in Stripe — exhibits this same failure mode if the test seed scope diverges from the app's default scope.

## Severity when violated

HIGH. Tests fail with misleading symptoms (looks like persistence/permissions bug). Drives debug-by-PR loops. Treat any new test that violates this rule as a blocking finding in `review-gate` G3.
