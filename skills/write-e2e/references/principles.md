### How to Find the Production Bug: Debug Spec Pattern

When a test fails with a timeout or cryptic assertion error and the root cause isn't obvious, the fastest path is a throw-away debug spec that adds raw listeners before diagnosing selectors:

```typescript
// e2e/specs/debug-subscription.spec.ts — DELETE after diagnosis
import { test } from '@playwright/test';
import { loginAsOwner, dismissCookieBanner } from '../helpers/auth';

test('debug: capture page errors on /subscriptionmanagement', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`PAGEERROR: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`);
  });

  await loginAsOwner(page);
  await dismissCookieBanner(page);
  await page.goto('/target-page');
  await page.waitForLoadState('networkidle');

  console.log('All page errors:', errors);
  // Now inspect: is the page crashing? Which error? What element did the locator actually match?
  const text = await page.locator('[class*="usage-card"]').first().textContent();
  console.log('Actual element text:', text);
});
```

`page.on('pageerror')` catches JavaScript exceptions thrown by the app itself (e.g., `RangeError: Invalid time value` from `date-fns format(new Date(null))`). Without this listener, Playwright swallows them silently and your test fails on a timeout with no indication the page crashed.

**Rule**: when a test fails in a way that seems impossible (element is visible in manual browser, but the test times out), add `page.on('pageerror')` first. If there's an app crash, that's always the root cause — fix the app, not the selector. Delete the debug spec after diagnosis.

Write every test as if you ARE the user sitting in front of the browser.

If a user would click a button, click that button. If a user would see a heading change, check that heading. If a user would scroll down to read, scroll down. If a user would never type a URL or hit browser back, neither does the test.

The test should be a script of exactly what a human would do — click by click, screen by screen. If you removed the code and just read the actions, it should read like instructions you'd give someone over the phone: "click the Payments module, then click the first lesson, scroll down, pick RevenueCat, click Submit Answer..."

## How Our Tests Work Today

### The Sandwich: DB Setup → UI Interaction → UI Assertion

```typescript
test.beforeEach(async () => {
  // DB: reset to known state
  await ensureP0UserState('user1');
  await setAcademyPathCompletion(authUserId, PATH_SLUG, 0);
});

test('lesson completion shows celebration', async ({ page }) => {
  // UI: navigate and interact
  await academy.navigateToPaymentsModule();
  await academy.openFirstLesson();
  await academy.completeCurrentLesson('RevenueCat');

  // UI: assert what the user sees
  await expect(academy.lessonCompleteHeading).toBeVisible();
  await expect(academy.nextLessonButton).toBeVisible();
});
```

DB helpers set the starting state. The test interacts through the UI. Assertions check what the user sees. That's it.

### DB Calls in Test Body — We Do This

Some tests call DB helpers mid-test to jump between states:

```typescript
test('progression lock across completion levels', async ({ page }) => {
  await setAcademyPathCompletion(authUserId, PATH_SLUG, 0);
  await academy.navigateToPaymentsModule();
  await expect(lesson1).toHaveAttribute('data-locked', 'false');
  await expect(lesson2).toHaveAttribute('data-locked', 'true');

  await setAcademyPathCompletion(authUserId, PATH_SLUG, 1);
  await page.reload();
  await academy.navigateToPaymentsModule();
  await expect(lesson2).toHaveAttribute('data-locked', 'false');
});
```

This is practical — testing 3 lock states through the full UI would mean completing 11 lessons. The DB shortcut is fine when you're testing state rendering, not the completion flow itself.

### Shared Production Accounts: beforeAll Cleanup

When tests run against a shared production account (no DB reset between runs), test-created entities accumulate over time and hit resource limits — plan quotas, storage caps, rate limits. A test that passes on Tuesday fails on Friday because previous runs left behind 10 "E2E test deals" and the account's plan allows 10.

The fix is two-part:

**Name test entities distinctively.** Prefix all test-created entities with `E2E ` (or a similar sentinel). This makes them easy to identify and clean up without touching real data.

**Clean up in `beforeAll`, not `afterAll`.** `afterAll` is unreliable — it doesn't run when a test crashes or is interrupted. `beforeAll` runs unconditionally and handles artifacts from prior failed runs too.

```typescript
// Clean up test entities before each test suite — works even after prior run crashed
test.beforeAll(async () => {
  const res = await fetch(`${API_BASE}/entities/Deal`, { headers: { api_key: API_KEY } });
  const deals: Array<{ id: string; title: string }> = await res.json();
  const testDeals = deals.filter(d => d.title?.startsWith('E2E '));
  await Promise.all(
    testDeals.map(d => fetch(`${API_BASE}/entities/Deal/${d.id}`, {
      method: 'DELETE',
      headers: { api_key: API_KEY }
    }))
  );
  if (testDeals.length) console.log(`Cleaned up ${testDeals.length} stale E2E deal(s)`);
});
```

This keeps the shared account at a stable baseline on every run. The `console.log` is intentional — it's a health signal that the cleanup ran and how many artifacts it found. A growing count across runs means the test is creating more than it's cleaning.

### Parallel Test Suites Sharing One Account: Cross-Suite Interference

When multiple test suites (J02, J06, J07) run in parallel and share the same production account, their `beforeAll` cleanups destroy each other's setup data. Example: J07 creates a Follower entity in `beforeAll` so the customer follows a location. J06 runs concurrently and calls `deleteAllFollowers` in its own `beforeAll`. J07's follower is gone — tests fail with "no favorites" empty state.

**The rule: never assume `beforeAll` setup survives to `beforeEach`.**

If a setup entity (Follower, seed data) is critical for every test, verify it exists in `beforeEach` and recreate if missing:

```typescript
test.beforeAll(async () => {
  // Initial setup — may be destroyed by concurrent suites
  await deleteAllFollowers(client);
  followerId = await createFollower(client, locationId, email);
});

test.beforeEach(async ({ page }) => {
  // Guard: recreate if another suite deleted it
  const existing = await client.entities.Follower.list();
  const hasFollower = existing.some(f => f.location_id === locationId);
  if (!hasFollower) {
    followerId = await createFollower(client, locationId, email);
  }
  // ... login and navigate
});
```

**Even better: design tests that don't depend on fragile cross-entity state.** If a page has a "Browse All" button that bypasses a filter, use it as a fallback when the filter's prerequisite data (followers) is missing. This makes the test resilient to concurrent cleanup without extra API calls:

```typescript
// After navigating to a page with a favorites filter:
const hasCards = await page.locator('.card-selector').first()
  .isVisible({ timeout: 5000 }).catch(() => false);
if (!hasCards) {
  // Favorites filter hiding everything — click Browse All to bypass
  const browseAll = page.getByRole('button', { name: 'Browse All' });
  if (await browseAll.isVisible({ timeout: 2000 }).catch(() => false)) {
    await browseAll.click();
    await page.waitForLoadState('networkidle').catch(() => {});
  }
}
```

### Plan-Gated Features: Test Account Tier Matters

When testing features gated by subscription tier (employee management, advanced analytics, loyalty programs), the test account's plan determines what's possible. If `secureOperation` enforces `max_staff: 0` for Starter plans, "add employee" tests silently fail — the API returns 403, the dialog stays open, and the test times out on a toast that never appears.

**Before writing tests for gated features, check the test account's plan limits.** Read the security middleware (`secureOperation` or equivalent) to find what limits apply. If the test account is on a lower tier:

1. **Upgrade the test account** to a plan that allows the feature (preferred)
2. **Branch the test**: detect the 403 and assert the error state instead of the success path
3. **Skip with `test.skip()`** and document the tier requirement

```typescript
// Detect plan-gated 403 and assert error state instead of success
const saveResponse = await page.waitForResponse(
  r => r.url().includes('/api/') && r.request().method() === 'POST'
).catch(() => null);

if (saveResponse && saveResponse.status() === 403) {
  // Plan limit hit — assert the error UI, not the success UI
  await expect(page.getByText(/limit reached|upgrade/i)).toBeVisible({ timeout: 5000 });
  return; // test passes — we verified the error path
}
// Otherwise assert the success path
await expect(page.getByText(/success/i)).toBeVisible();
```

### Subscription Tier Limits Block Entity Creation
**Symptom**: POST returns 403; dialog stays open; no success toast appears
**Root cause**: Test account's subscription has a zero or missing limit for the resource being created. Backend access control defaults to 0, blocking all creation.
**Fix**: In `beforeAll`, patch the subscription to unlock the resources under test:
```typescript
// Project-specific: read your subscription entity and patch limits before tests
const subs = await client.entities.Subscription.list();
if (subs.length > 0) {
  await client.entities.Subscription.update(subs[0].id, {
    max_items: 50  // adjust field names to match your schema
  });
}
```
Always patch before the first test that creates a gated entity. This is faster than branching on 403 responses and produces cleaner tests focused on the happy path.

---

### Base44 SDK as DB Helper (Base44 Projects)

For Base44 platform projects, the `@base44/sdk` npm package works directly in Node.js -- which means it works in Playwright test fixtures. No raw `fetch` calls or `api_key` management needed. The SDK provides the same entity CRUD API the app uses, so test setup/teardown code reads identically to application code.

The pattern: create a client with `createClient({ appId })`, authenticate with `loginViaEmailPassword()`, then use the full entity API -- `.list()`, `.filter(query, sort, limit, skip)`, `.get(id)`, `.create(data)`, `.update(id, data)`, `.delete(id)`.

**Reusable fixture** (`e2e/helpers/base44-client.ts`):

```typescript
// e2e/helpers/base44-client.ts
import { createClient } from '@base44/sdk';

const APP_ID = process.env.BASE44_APP_ID || 'your-app-id';

export async function getAuthenticatedClient(email: string, password: string) {
  const client = createClient({ appId: APP_ID });
  await client.auth.loginViaEmailPassword(email, password);
  return client;
}

// Usage in test fixtures:
// const client = await getAuthenticatedClient(email, password);
// const deals = await client.entities.Deal.filter({ is_active: true });
// await client.entities.Deal.delete(deal.id);
```

This replaces the raw `fetch` + `api_key` approach from the "Shared Production Accounts" section above. Compare the cleanup code:

```typescript
// Before: raw fetch with api_key
test.beforeAll(async () => {
  const res = await fetch(`${API_BASE}/entities/Deal`, { headers: { api_key: API_KEY } });
  const deals = await res.json();
  const testDeals = deals.filter(d => d.title?.startsWith('E2E '));
  await Promise.all(testDeals.map(d =>
    fetch(`${API_BASE}/entities/Deal/${d.id}`, { method: 'DELETE', headers: { api_key: API_KEY } })
  ));
});

// After: SDK — same API the app uses, no manual headers
test.beforeAll(async () => {
  const client = await getAuthenticatedClient(TEST_EMAIL, TEST_PASSWORD);
  const deals = await client.entities.Deal.filter({ title: { $regex: '^E2E ' } });
  await Promise.all(deals.map(d => client.entities.Deal.delete(d.id)));
});
```

The client authenticates as the test user, so it respects the same permissions that user would have in the app. This is intentional -- tests should not bypass access control.

Beyond cleanup, the SDK enables full state manipulation for tests: resetting user profile fields, clearing loyalty points, setting up preconditions (creating a location with specific hours, seeding menu items), or verifying backend state after a UI action completes. All through the same SDK the application code uses.

For Base44 projects, this is the recommended approach for the "DB helpers" layer in the test sandwich (API setup -> browser test -> API verify).

---

### Base44 SPA DOM Layout Patterns (Base44 Projects)

Two recurring hazards in Base44 SPA discovery-page tests:

**1. Sidebar/nav elements share Tailwind classes with content cards.**

Base44 SPA pages commonly style both sidebar nav links and content grid cards with the same
Tailwind utility class (e.g., `div.group`). Without container scoping, `page.locator('div.group').first()`
will match the sidebar element (which is earlier in the DOM), not the discovery grid card.

**Rule:** Always scope location/content card selectors to their grid container:
```typescript
// ❌ Wrong — matches sidebar Favorites link first
const card = page.locator('div.group').first();

// ✅ Correct — scoped to the discovery grid
const card = page.getByTestId('business-list').locator('div.group').first();
```

Before writing any card/item selector: grep the page component for all elements that share
the same CSS class or Tailwind utility — especially sidebar and nav elements. Confirm the
selector is unambiguous by checking what else renders the same class in the same page.

**2. Auth helpers wait for the UI milestone, not for the data API.**

Navigation helpers like `loginAndNavigateHome` wait for a UI element that appears BEFORE
the data API resolves (in Example Marketplace: the zone banner `h2:has(span)`). Discovery grid content
(location cards, list items) loads asynchronously after that milestone.

**Rule:** After navigating to any data-driven page via a helper, add `waitForLoadState('networkidle')`
before asserting on dynamic content:
```typescript
await loginAndNavigateHome(page, email, password);
// Zone banner is visible — but location cards may not be loaded yet
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
const hasCard = await page.getByTestId('business-list').locator('div.group').first()
  .isVisible({ timeout: 10000 });
```

The `.catch(() => {})` is intentional — `networkidle` can time out on pages with long-polling
(e.g., analytics). The fallback timeout on `isVisible` is the real guard.

---

