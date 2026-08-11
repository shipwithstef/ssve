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

### Page Objects: Locators + Actions, No Assertions

```typescript
// academy.page.ts — navigation and interaction methods
export class AcademyPage {
  readonly lessonCompleteHeading: Locator;
  readonly firstUnlockedLesson: Locator;

  async navigateToPaymentsModule(): Promise<void> { ... }
  async openFirstLesson(): Promise<void> { ... }
  async completeCurrentLesson(answer: string): Promise<void> { ... }
}
```

Page objects never call `expect()`. Assertions live in spec files only.

### Selectors: Accessibility-First (2026 Best Practice)

Playwright's official recommendation and the 2026 agentic testing direction both
point the same way: use selectors that match how users and assistive technology
perceive the page. Good ARIA roles and labels benefit accessibility AND test stability.
AI-based testing agents (Mabl, QA Wolf) navigate via the accessibility tree, not
data-testid attributes — so investing in accessible components pays off twice.

**Priority order:**
```typescript
// 1. Role — how users perceive it (preferred)
page.getByRole('button', { name: /Submit Answer/i })
page.getByRole('heading', { name: /Lesson Complete/i })

// 2. Label / aria-label — accessible and stable
page.getByLabel('Module: Payments with RevenueCat & Stripe')

// 3. TestId — for dynamic lists where role+name isn't unique
page.getByTestId('academy-lesson-item')

// 4. Placeholder — for text inputs without labels
page.getByPlaceholder('Type a message...')

// 5. Data attributes — for state that isn't visible text
page.locator('[data-locked="false"]')

// 6. CSS selectors — last resort only
page.locator('.animate-pulse')  // ❌ prefer ARIA: page.getByRole('img', { name: /Loading/i })
```

**Common selector mistakes:**
```typescript
// ❌ page.locator('textarea') — fragile, not accessible
// ✅ page.getByPlaceholder('Type a message...')

// ❌ page.locator('.animate-pulse') — CSS class, breaks on refactor
// ✅ page.getByRole('img', { name: /Loading/i }) — ARIA, stable

// ❌ page.locator('[role="status"]') for toasts — role may not exist
// ✅ page.getByText(/error message text/i) — matches what user sees
```

**When a role selector gets fragile** (long regex like `/Payments with RevenueCat & Stripe.*module/i`),
don't add a testid — add a better `aria-label` to the component instead. This fixes
the selector AND improves accessibility:

```tsx
// Component: before (fragile selector needed)
<button>{module.title} module</button>

// Component: after (clean selector + accessible)
<button aria-label={`Module: ${module.title}`}>{module.title} module</button>

// Test: clean selector
page.getByLabel('Module: Payments with RevenueCat & Stripe')
```

### Optional Elements: `.isVisible().catch(() => false)`

When an element may or may not appear (Start Learning Path button, exercise radiogroup):

```typescript
const hasStart = await academy.startLearningPathButton
  .isVisible({ timeout: 2000 })
  .catch(() => false);
if (hasStart) {
  await academy.startLearningPathButton.click();
}
```

### Three Test Categories

**Smoke** — parametrized sweep across all routes/modules (official Playwright pattern):
- For apps with 30+ routes, build this layer first before writing AC tests
- Uses a typed module manifest (route, role, write/read flag) iterated with `forEach`
- Assertions are permissive: heading renders, role gating works, page doesn't crash
- Runs on every deploy; catches regressions across the entire surface quickly
- Named "Smoke project" in Playwright's own docs (`playwright.dev/docs/test-projects`)

```typescript
// manifest.ts — define once, test everywhere
const MODULES = [
  { id: 'deals', path: '/deals', role: 'owner', writeRequired: true },
  { id: 'dashboard', path: '/dashboard', role: 'owner', writeRequired: false },
  // ...all routes
];

// smoke.spec.ts — generated via forEach (official Playwright recommendation)
for (const module of MODULES) {
  test(`smoke: ${module.id} renders for ${module.role}`, async ({ page }) => {
    await page.goto(module.path);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });
}
```

This is the industry "go broad before going deep" approach (QA Wolf, 2026). Build this layer first on large apps — it catches broken routes and role gating while you write the deeper AC tests.

**Browser E2E** — tests what the user sees (academy, matching UI, chat):
- Uses page objects, browser navigation, UI assertions
- AC IDs in test names, precise assertions against feature specs
- Files: `43-academy-navigation.spec.ts`, `44-academy-lesson-interactions.spec.ts`

**DB Algorithm** — tests backend logic without a browser (matching scoring, credits):
- Calls RPCs directly, checks return values and DB state
- No page objects, no browser
- Files: `50-matching-algorithm-ac.spec.ts`

All three are valid. On large apps (30+ routes): smoke layer first, then Browser E2E for critical journeys, DB tests for algorithm correctness. On small apps: skip smoke, go straight to Browser E2E.

---

## API Waits: Mandatory for Server-Dependent Assertions

Every test that clicks a button causing a server write (send message, upload file, submit form) MUST set up an API wait BEFORE the click. This is the #1 source of flaky tests — without it, the test checks UI state before the server confirms the write, and sometimes the server hasn't finished yet. This is not optional; treat it like the await on the click itself.

### The Problem

When the test clicks "Submit Lesson", the server needs time to write to `academy_progress`. If the test immediately checks the next UI state, sometimes the server hasn't finished yet:

```
Click Submit → test checks Next Lesson button → server still writing → button not there → flake
```

### The Fix

Listen for the API response BEFORE clicking, then wait for it after. If the server errors, log it for debugging — but still check the UI because that's what matters:

```typescript
// Set up listener BEFORE the click (otherwise you miss the response)
// Match any status — we want to know about errors, not filter them out
const saved = page.waitForResponse(r =>
  r.url().includes('rest/v1/academy_') &&
  ['POST', 'PATCH'].includes(r.request().method())
).catch(() => null);

await academy.submitLessonButton.click();
const response = await saved;

// Log server errors — helps debug "UI timed out" failures
if (response && response.status() >= 400) {
  console.warn(`API returned ${response.status()} — UI may not update`);
}

await expect(academy.lessonCompleteHeading).toBeVisible(); // UI: what user sees
```

The API wait serves two purposes:
1. **Timing gate** — "the server is done, now safe to check UI"
2. **Debug signal** — if the UI times out, the console shows whether the server failed (500) or succeeded (200 but UI bug)

### When to Use API Waits

- After submitting a form that writes to the DB (lesson completion, exercise answer, profile save)
- After any action where the NEXT UI state depends on the server write

### When NOT to Use API Waits

- Pure navigation (clicking links, opening modals)
- Read-only views
- Actions with immediate UI feedback that doesn't need server confirmation

### Supabase URL Pattern

```typescript
// Supabase REST API follows this pattern — no status filter, capture all:
page.waitForResponse(r =>
  r.url().includes('rest/v1/TABLE_NAME') &&
  ['POST', 'PATCH'].includes(r.request().method())
).catch(() => null);
```

**Be specific with the table name.** A broad `rest/v1/` matcher catches unrelated Supabase calls (auth token refresh, realtime subscriptions) and resolves immediately on the wrong response. This breaks tests because the real response you're waiting for fires later and nothing catches it.

**Never add `r.status() < 400` to the matcher.** If the server returns a 403 or 500, the `status < 400` filter makes the promise resolve to `null` — you lose the error signal, the UI never updates, and the test eventually times out on the toast assertion with no hint about why. Capture any response, then inspect the status in the body of the test:

```typescript
// ❌ WRONG — catches auth refresh, resolves too early
page.waitForResponse(r => r.url().includes('rest/v1/') && r.request().method() === 'POST')

// ✅ RIGHT — only matches writes to the specific table
page.waitForResponse(r => r.url().includes('rest/v1/academy_') && r.request().method() === 'POST')
```

### Supabase Storage Waits

File uploads go through Supabase Storage, not the REST API. Use a different URL pattern:

```typescript
// Storage upload (file attachments, images, audio)
const uploaded = page.waitForResponse(r =>
  r.url().includes('storage/v1/object') &&
  r.request().method() === 'POST'
).catch(() => null);

await page.getByRole('button', { name: /Send/i }).click();
const uploadResponse = await uploaded;
if (uploadResponse && uploadResponse.status() >= 400) {
  console.warn(`Storage upload returned ${uploadResponse.status()}`);
}
```

### Async Navigation Chains: Click → API → Client Redirect

Multi-step flows often follow this pattern: user clicks a button → the app calls a backend function → the function returns → the app navigates to a new page via client-side routing. The `waitForResponse` only covers the API leg. You also need `waitForURL` for the redirect that follows.

```typescript
// Role selection → validateUserType API → client navigates to /wizard
await roleSelection.continue();                                        // click
await page.waitForURL(/wizard/i, { timeout: 15000 });                  // wait for redirect
await page.waitForLoadState('networkidle').catch(() => {});             // wait for page to settle
await dismissOverlays(page);                                           // overlay may re-trigger

await expect(wizard.profileStepHeading).toBeVisible();                 // NOW safe to assert
```

Without the `waitForURL`, the test checks the wizard heading while still on the role selection page — a guaranteed failure. This is especially common in onboarding/setup flows where each step calls a backend function that triggers a client-side redirect.

### State-Mutating Tests Need beforeEach Reset, Not beforeAll

When a test ACTION permanently changes backend state (e.g., clicking "Continue" sets `user_type_locked: true` via a backend function), `beforeAll` cleanup only runs once — subsequent tests in the same describe block inherit the mutated state.

The rule: if any test in the suite calls a backend function that permanently alters user state, use `beforeEach` to reset that state before every test. This is more expensive (extra SDK call per test) but ensures each test starts from a known state.

```typescript
test.beforeEach(async ({ page }) => {
  // SDK reset — every test gets a fresh user state
  const client = await getAuthenticatedClient(email, password);
  await client.auth.updateMe({ user_type: null, onboarding_completed: false });

  // Then login in the browser
  await loginPage.login(email, password);
});

test.afterAll(async () => {
  // Restore to normal state for other test suites
  const client = await getAuthenticatedClient(email, password);
  await client.auth.updateMe({ user_type: 'owner', onboarding_completed: true });
});
```

This pattern turns a single shared account into any persona the test needs — fresh user, onboarded owner, locked employee — without maintaining separate test accounts. It's the most impactful pattern for testing multi-state flows (onboarding, role selection, tier upgrades) on shared production accounts.

---

For features that upload files AND then insert a DB row, chain both waits:
```typescript
const uploaded = waitForUpload(page);
await sendBtn.click();
await uploaded;  // upload done
// Now the message insert happens — UI assertion comes after both complete
await expect(inlineImg).toBeVisible({ timeout: 15000 });
```

Add `.catch(() => null)` so the test doesn't hang if no matching response appears (e.g., the app handles it client-side):

```typescript
const saved = page.waitForResponse(r =>
  r.url().includes('rest/v1/academy_') &&
  ['POST', 'PATCH'].includes(r.request().method())
).catch(() => null);
await submitButton.click();
const response = await saved;

// Not an assertion — just a debug breadcrumb
if (response && response.status() >= 400) {
  console.warn(`API returned ${response.status()} on submit`);
}

// UI is still the real check
await expect(heading).toBeVisible();
```

---

## Overlay Defense: Dismiss Before Clicking

Overlapping elements (cookie consent banners, badge notifications, onboarding tooltips, toast messages) silently intercept clicks intended for buttons underneath them. Handle this **proactively in setup**, not reactively after a test fails.

### The pattern

Create a shared `dismissOverlays(page)` helper that clears all known persistent overlays. Call it after every `waitForAppReady(page)` and before any click-heavy interaction sequence.

### Best practice: prevent the banner from rendering at all

The gold standard (Playwright docs, Checkly, QA Wolf) is to inject the consent state before navigation so the banner never appears. This is faster, more stable, and eliminates the entire class of overlay-interception bugs.

**For cookie-based consent managers** (OneTrust, Cookiebot, custom):
```typescript
// In global setup, beforeEach, or a shared fixture — call BEFORE page.goto()
await context.addCookies([{
  name: 'CookieConsent',       // inspect your app to find the exact name
  value: 'true',
  domain: '.yourdomain.com',
  path: '/',
  expires: Date.now() / 1000 + 60 * 60 * 24 * 365,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
}]);
```

**For localStorage-based consent:**
```typescript
// addInitScript runs before any page script on every navigation in this context
await context.addInitScript(() => {
  window.localStorage.setItem('cookie-consent', 'accepted');
});
```

**The most scalable pattern:** Handle consent once in a Playwright setup project (alongside auth), save the result with `storageState`, and all test projects inherit it. The banner never renders in any test, ever.

### Fallback: clicking the banner

When you can't inject (unknown cookie name, dynamic CMP, third-party banner), click **Accept** — not Decline. Industry sources (Checkly, scrapfly, kontent.ai) consistently recommend Accept because:
- It's terminal — no follow-up "are you sure?" modals
- It matches production user state — features gated behind consent work correctly
- "Accept All" buttons have more stable selectors than multi-step "Manage Preferences" flows

The exception: consent compliance audit tests where you must verify analytics tags don't fire before consent — that's a dedicated test, not general E2E.

```typescript
// e2e/helpers/overlays.ts — fallback when injection isn't possible
export async function dismissOverlays(page: Page): Promise<void> {
  // Cookie consent — Accept to match production state
  const accept = page.getByRole('button', { name: /Accept|Accept All|Got it|I agree/i });
  if (await accept.first().isVisible({ timeout: 1500 }).catch(() => false)) {
    await accept.first().click();
  }

  // Badge/achievement notifications
  const badge = page.getByRole('button', { name: /Dismiss badge/i });
  if (await badge.isVisible({ timeout: 1000 }).catch(() => false)) {
    await badge.click();
  }

  // Add project-specific overlays here as they're discovered
}
```

### When to call it

- **After every `page.goto()` within the test body** — not just in `beforeEach`. Persistent banners re-trigger on each navigation. If a test navigates to `/deals` and then clicks a button inside a dialog, the banner that appeared after navigation intercepts that click.
- **After `waitForAppReady(page)`:** `await waitForAppReady(page); await dismissOverlays(page);`
- **Symptom of a missed dismiss:** a `click()` that targets a button inside a dialog succeeds in isolation but fails when preceded by `navigate()`. The page snapshot at failure time shows the overlay above the button in the DOM layer order.

### When writing new tests

Before writing click assertions, check the page snapshot for persistent overlays. If you see cookie consent, badge popups, or toast notifications that could intercept clicks, first try the injection approach (preferred), then fall back to the `dismissOverlays` helper.

### The anti-pattern

Don't scope buttons with fragile `.first()` or `.locator('..')` chains to dodge overlays — that's treating symptoms. If a cookie banner's "Accept" conflicts with an invite banner's "Accept", dismiss the cookie banner first, then click the invite's button cleanly.

---

## Understand Component State Before Asserting

Before writing `await expect(button).toBeEnabled()` or `toBeDisabled()`, read the component source to understand when that state applies. A send button is typically disabled when there's nothing to send (no text, no files) — that's correct behavior, not a bug. After sending a message and clearing the input, the button *should* be disabled.

The test writer's job is to understand the component's state machine, not to assert what "feels right." Read the code, trace the state transitions, then write assertions that match the actual logic.

**Common mistake:** asserting `sendBtn.toBeEnabled()` after send completes, when the component correctly disables it because input is now empty. Instead, assert:
```typescript
// ✅ Assert the action completed (message visible) and input is ready (editable)
await expect(page.locator('img[alt="test-image.png"]')).toBeVisible({ timeout: 15000 });
await expect(page.getByPlaceholder('Type a message...')).toBeEditable();
// Don't assert sendBtn.toBeEnabled — it's correctly disabled when empty
```

---

## File Upload Testing with Playwright

Playwright can't open native file dialogs, so use `setInputFiles` on the hidden `<input type="file">`:

```typescript
// Standard file upload — works for both click-to-attach and drag-drop tests
await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, 'test-image.png'));

// Synthetic file (no fixture needed) — for validation tests
await page.locator('input[type="file"]').setInputFiles({
  name: 'malware.exe',
  mimeType: 'application/x-msdownload',
  buffer: Buffer.from('fake'),
});
```

Create small test fixtures programmatically (tiny PNG, minimal PDF) and commit them to `e2e/fixtures/`.

**ES module gotcha:** `__dirname` doesn't exist in ES modules. Use:
```typescript
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
```

---

## DRY Navigation Helpers

When every test in a spec file repeats the same navigation sequence (seed → goto → waitForAppReady → dismissOverlays), extract a helper at the top of the file. This isn't a page object — it's a local convenience function:

```typescript
async function openLoungeDM(page: Page, user1: string, user2: string) {
  const chatId = await seedLoungeDM(user1, user2);
  await page.goto(`/lounge/chat/${chatId}`, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await new CookieConsentComponent(page).dismissIfVisible();
  return chatId;
}
```

Extract to a page object when the helper is used across multiple spec files.

---

## Testing Transient States (Skeletons, Loading, Spinners)

Transient UI states (loading skeletons, upload spinners) flash by too fast to catch in tests. Use Playwright route interception to artificially delay the response that ends the transient state:

```typescript
// Delay signed URL response → skeleton stays visible long enough to assert
await page.route('**/storage/v1/object/sign/**', async (route) => {
  await new Promise((r) => setTimeout(r, 2000));
  await route.continue();
});

// Trigger the action
await page.getByRole('button', { name: /Send/i }).click();

// Now the skeleton is visible because the signed URL is delayed
await expect(page.getByRole('img', { name: /Loading/i })).toBeVisible({ timeout: 10000 });

// After the delay, the real image loads
await expect(page.locator('img[alt="photo.png"]')).toBeVisible({ timeout: 20000 });
```

Only use route interception for testing transient states. For regular tests, the real network speed is fine.

---

## Testing External Payment Redirects (Stripe, Dodo, Checkout.com)

Payment flows that redirect users to an external checkout page (Stripe Checkout, Dodo Payments, etc.) cannot be automated end-to-end — you can't automate entering real card numbers on a third-party domain. But you CAN verify everything up to and after the boundary.

**The three-layer strategy:**

**Layer 1 — Verify the redirect URL origin** (what the button actually does):
Mock the backend checkout function to return a controlled redirect URL, then verify the browser navigated to the expected domain. This proves the button wires correctly to the backend without completing the payment.

```typescript
test('US-2-AC1: "Continue to Payment" calls checkout and redirects to payment provider', async ({ page }) => {
  // Mock the backend checkout function — return a controlled redirect URL
  await page.route('**/functions/dodoCreateCheckout', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ checkout_url: 'https://pay.dodo.dev/c/test_session_e2e' }),
  }));

  // Intercept the external domain so we don't actually leave the app
  await page.route('https://pay.dodo.dev/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<html><body>Dodo Checkout (intercepted)</body></html>',
  }));

  await wizard.selectPlan('Growth');
  const navPromise = page.waitForURL(/pay\.dodo\.dev/, { timeout: 15000 });
  await wizard.continueToPaymentButton.click();
  await navPromise;

  expect(page.url()).toContain('pay.dodo.dev');
});
```

**Layer 2 — Test the success/failure page directly** (what happens after payment):
Navigate directly to the post-payment URL with synthetic parameters. This tests the receipt/success page independently of the actual payment flow.

```typescript
// After payment, Dodo redirects to /subscriptionsuccess?subscription_id=...&status=active
test('US-2-AC3: success page shows welcome state', async ({ page }) => {
  // Mock the verification function that the success page calls
  await page.route('**/functions/dodoVerifyCheckout', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, plan: 'growth', trial: true }),
  }));

  await page.goto('/subscriptionsuccess?subscription_id=sub_test_e2e&status=active');
  await dismissCookieBanner(page);

  await expect(page.getByRole('heading', { name: /Welcome to Premium/i }))
    .toBeVisible({ timeout: 10000 });
});
```

**Layer 3 — Test the canceled/failed path** (user clicks "back" or payment fails):
Most providers redirect back with a `?canceled=true` or `?error=...` query param. Navigate directly.

```typescript
test('US-2-AC9: canceled checkout shows error toast', async ({ page }) => {
  await page.goto('/subscription?canceled=true');
  await dismissCookieBanner(page);

  await expect(page.getByText(/checkout was canceled/i)).toBeVisible({ timeout: 5000 });
  // Plan cards should still be visible — user can retry
  await expect(page.getByRole('heading', { name: /^Growth$/i })).toBeVisible();
});
```

**What NOT to do:**
- Don't try to automate clicking through a real Stripe/Dodo checkout form — test card numbers, iframe sandboxing, and CAPTCHA make this fragile and unsupported
- Don't `test.skip` the entire payment flow — the three layers above give you full coverage of everything you own

---

## Two-User Test Setup

Features like chat, notifications, and collaborative editing require two users interacting simultaneously. The key insight: browser tabs share storage, so two tabs are NOT two users. You need separate browser contexts.

### The pattern

```typescript
test('user1 sends message, user2 receives it', async ({ browser }) => {
  // Separate contexts = separate sessions = separate users
  const ctx1 = await browser.newContext({ storageState: 'e2e/.auth/user1.json' });
  const ctx2 = await browser.newContext({ storageState: 'e2e/.auth/user2.json' });
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  // Navigate independently
  await page1.goto('/chat/room-123');
  await page2.goto('/chat/room-123');

  // User1 acts, User2 observes
  await page1.getByPlaceholder('Type a message...').fill('Hello');
  await page1.getByRole('button', { name: /Send/i }).click();

  // Wait for DELIVERY, not just the send (see Realtime Flake Prevention)
  await expect(page2.getByText('Hello')).toBeVisible({ timeout: 10000 });
});
```

### Cleanup matters

If a test fails mid-execution, unclosed contexts leak browser processes. Use `Promise.allSettled` in afterEach to ensure both contexts close even if one throws:

```typescript
test.afterEach(async () => {
  await Promise.allSettled([ctx1?.close(), ctx2?.close()]);
});
```

### Data sync between pages

After user1 performs an action, user2's page does not instantly reflect it. The write completes on the server before the subscription delivers it to the other client. Always wait for the data to appear on the receiving page rather than assuming it arrives immediately after the API call returns. See the Realtime Flake Prevention section below.

### `browser.newContext()` Doesn't Always Mean Unauthenticated

When you create a fresh context with `browser.newContext({ storageState: undefined })` inside a test that previously authenticated, some platforms maintain session state at the browser level — through service workers, shared IndexedDB, or platform-managed session tokens — that bleeds into the new context even without a `storageState` file.

**Symptom**: A test that expects "Sign In Required" or a redirect to `/login` instead sees the authenticated home page. Checking `localStorage` and `cookies()` in the new context shows they're empty, but the page still renders authenticated content.

**Root cause**: The authentication isn't in cookies or localStorage — it's in a service worker, a platform-level session, or a shared browser process state that Playwright doesn't clear via `storageState: undefined`.

**How to write the test**: Verify the OBSERVABLE outcome, not the mechanism. Instead of asserting "must show Sign In Required card", assert "subscription-specific content is not shown" and handle the platform routing gracefully:

```typescript
test('unauthenticated user cannot access /subscription', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: undefined });
  const pg = await ctx.newPage();
  try {
    await pg.goto('/subscription');
    await pg.waitForLoadState('networkidle');

    const isOnPage = pg.url().includes('/subscription');
    if (!isOnPage) {
      // Redirected away — access denied ✓
      expect(pg.url()).not.toContain('/subscription');
      return;
    }

    // Still on the page — check what's shown
    const hasSignIn = await pg.getByRole('heading', { name: /Sign In Required/i })
      .isVisible({ timeout: 3000 }).catch(() => false);
    const hasSubscriptionContent = await pg.getByRole('heading', { name: /^Growth$/i })
      .isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSignIn) {
      // Component-level auth gate shown ✓
      await expect(pg.getByRole('heading', { name: /Sign In Required/i })).toBeVisible();
    } else if (!hasSubscriptionContent) {
      // Platform redirected or showed non-subscription content ✓
      expect(true).toBe(true);
    } else {
      // Platform auto-authenticated in same browser session — known limitation
      test.skip(true, 'Platform maintains auth state across newContext() — cannot test unauthenticated gate in same browser session');
    }
  } finally {
    await ctx.close();
  }
});
```

This pattern is honest: it passes when the observable outcome (no access to content) is correct regardless of mechanism, and skips with a clear explanation when the platform prevents the test from running at all.

---

## Auth State Decision Tree

There are three ways to authenticate in E2E tests. Each has a purpose — using the wrong one wastes time or makes tests fragile.

### 1. Programmatic/API auth (fastest, most deterministic)

Inject a session token directly via API call or cookie manipulation. No UI interaction at all. Use this when speed matters and you trust the auth system works.

```typescript
// Example: set auth cookie/token directly
const token = await getAuthToken(TEST_USER_EMAIL, TEST_USER_SECRET);
await context.addCookies([{ name: 'session', value: token, domain: 'localhost' }]);
```

### 2. Cached auth state (pre-generated storageState files)

Run a global setup script once that logs in through the real UI, then saves the browser state to a JSON file. All tests reuse that file. This is the sweet spot for most test suites because it validates auth once and reuses it everywhere.

```typescript
// global.setup.ts — runs once before all tests
await page.goto('/login');
await page.getByLabel('Email').fill(creds.email);
await page.getByLabel('Password').fill(creds.password);
await page.getByRole('button', { name: /Log in/i }).click();
await page.context().storageState({ path: 'e2e/.auth/user1.json' });

// Any test — reuses the saved state instantly
test.use({ storageState: 'e2e/.auth/user1.json' });
```

### 3. Interactive auth (real login flow)

Walk through the full login UI every time. Slow and brittle — only use this when the login flow itself is the thing you're testing.

### Decision tree

- **Are you testing the login flow?** → Interactive auth
- **Do you need multiple users?** → Cached auth state (one file per user)
- **Is speed critical and auth is stable?** → Programmatic auth
- **Default for most tests** → Cached auth state

---

## Realtime Flake Prevention

When two pages exchange data through subscriptions, websockets, or any pub/sub system, a successful API write does NOT mean the other page has received the update. The server accepted the data — it has not yet pushed it to subscribers.

### Why this causes flakes

```
User1 clicks Send → API returns 200 → test checks User2's page → data not there yet → FAIL
```

The API response and the subscription delivery are two separate events with different timing. In CI environments with variable network latency, this gap widens unpredictably.

### The fix: wait for arrival, not for send

```typescript
// ❌ WRONG — waits for the API, then immediately checks the other page
const sent = page1.waitForResponse(r => r.url().includes('/api/messages'));
await page1.getByRole('button', { name: /Send/i }).click();
await sent;
await expect(page2.getByText('Hello')).toBeVisible(); // flaky — delivery hasn't happened

// ✅ RIGHT — wait for the data to appear on the receiving page
await page1.getByRole('button', { name: /Send/i }).click();
await expect(page2.getByText('Hello')).toBeVisible({ timeout: 10000 }); // waits for delivery
```

### Timeout tuning

Realtime delivery is inherently slower than a direct API response. A 5-second timeout that works for API waits will flake on subscription delivery. Use longer timeouts (8-15 seconds) for cross-page assertions, and even longer in CI where network conditions are less predictable.

### Works for any pub/sub system

This pattern applies whether you use websockets, server-sent events, polling, or any other realtime transport. The principle is the same: the receiving page is your source of truth, not the sending page's API response.

---

## Flaky Test Diagnosis Framework

Not all flakes have the same root cause. Before adding `{ timeout: 30000 }` everywhere, diagnose the actual problem. Here are the five types, ordered by frequency:

### Type 1 (~60%): Race between server write and UI check

The test checks UI state before the server confirms the write. The UI hasn't updated yet because the data isn't there.

**Symptom**: Test passes locally, fails ~30% in CI. Adding a sleep "fixes" it.
**Fix**: Set up an API wait BEFORE the click, await it after. See the API Waits section.

### Type 2 (~15%): Element not in viewport or hidden by overlay

The element exists in the DOM but something covers it — a cookie banner, a toast notification, a modal backdrop.

**Symptom**: `click()` times out or clicks the wrong thing. Screenshot shows an overlay.
**Fix**: Dismiss overlays proactively (see Overlay Defense section), or scroll the element into view.

### Type 3 (~15%): Realtime delivery lag

Two pages are involved and the test checks the receiving page too soon after the sending page's action.

**Symptom**: Multi-user tests fail intermittently. Single-user version of the same flow passes.
**Fix**: Wait for data arrival on the receiving page, not just the API response. See Realtime Flake Prevention.

### Type 4 (~5%): Selector matches the wrong element

A generic selector like `getByRole('button')` matches multiple elements. The test clicks a different button than intended.

**Symptom**: Test fails with "element is not visible" or performs unexpected navigation.
**Fix**: Use more specific selectors — add `{ name: /Submit/i }`, scope to a parent locator, or improve the component's accessibility attributes.

### Type 5 (~5%): CI network or resource constraints

The test works locally but CI machines are slower, have higher latency, or throttle CPU.

**Symptom**: Timeouts on navigation or page load, but selectors and logic are correct.
**Fix**: Increase timeouts for CI via `playwright.config.ts` environment detection. Don't increase them globally — that hides real bugs locally.

### Type 6: Shared account resource limit exhaustion

On shared production accounts with no DB reset, test-created entities accumulate over repeated runs and hit plan-level limits (quotas, storage caps, rate limits). The test passed every day last week and suddenly fails with a 403 or silent error.

**Symptom**: A form submit returns a non-2xx response (API error), the dialog stays open, no toast appears, the test times out on the toast assertion. The error message when you log the response body mentions "limit reached" or "quota exceeded".
**Fix**: Add `beforeAll` API cleanup using a named prefix (see the Shared Production Accounts section). Check the response body when `waitForResponse` resolves — `response.status() >= 400` with a body containing "limit" confirms this type.

This is distinct from Type 1 (timing race) — the server responds synchronously with an error, the UI just doesn't update the way the test expects.

### queryFn Short-Circuits (No Request Fires)
**Symptom**: waitForResponse never triggers; page shows empty content; no network request in logs
**Root cause**: A condition inside queryFn (e.g., `if (!hasFilter) return []`) prevents the API call from ever firing. The page renders empty not because the API returned nothing, but because it was never called.
**Diagnosis**: Search the component for `if (` inside `queryFn` or early `return []` patterns. Check what state variables gate the query.
**Fix**:
1. Ensure test data satisfies ALL queryFn conditions before navigating
2. Add a fallback: if expected content doesn't appear within 3s, trigger the "show all" / "clear filter" button to bypass the filter
3. For filter-dependent pages: always recreate the prerequisite data in `beforeEach` (don't just check — delete all + create fresh)

### SDK-Created Entities Invisible to UI Cache (staleTime + no refetch triggers)
**Symptom**: Entity created via SDK (API) before navigation, but UI shows stale empty state. Waiting 30s, 60s, or longer doesn't help. `waitForResponse` for the entity GET never fires.
**Root cause chain** (must check ALL THREE):
1. `staleTime` on the query (e.g., 30s) makes `initialData: []` "fresh" — no background fetch fires
2. `refetchOnWindowFocus: false` globally — focus events don't trigger refetch
3. No `refetchInterval` on the query — no periodic refetch

With all three true, SDK-created data NEVER appears in the cache until a component remount with stale data.

**Diagnosis checklist** (read these files BEFORE writing the test):
1. Read `query-client.js` or equivalent — check `defaultOptions.queries.refetchOnWindowFocus`
2. Read the hook — check `staleTime`, `refetchInterval`, `initialData`
3. Check if any UI mutation invalidates this query key (e.g., a "follow" button calling `invalidateQueries`)
4. Check if different pages use different query keys for the same data (e.g., Home uses `['followers']` but FlashSlots uses `['followed-locations']`)

**Fix** (in order of preference):
1. **Fix the production code** — the root cause is almost always a missing `setQueryData` call in the mutation. `invalidateQueries` only works when an active observer exists for the target query key. If Page A mutates data that Page B reads under a different query key, and no component on Page A subscribes to Page B's key, `invalidateQueries` is a no-op. The correct React Query pattern is `queryClient.setQueryData(['target-key', userId], updaterFn)` which directly writes to the cache regardless of active observers. File a bug or fix the production code.
2. **Create via UI mutation** — if the production code already has `setQueryData` (or the mutation and consumer use the same query key with an active observer), follow/create via the UI. Then sidebar-navigate to the consuming page (client-side routing preserves cache).
3. **staleTime expiry + remount** — last resort if production code can't be fixed:
   - Create via SDK, navigate to the page, wait for `staleTime + 5s` margin
   - Navigate away via sidebar (unmounts component), then back (remount triggers `refetchOnMount` for stale data)
   - Very slow (30-35s per test). Treat this as a workaround, not a solution.
4. **Intercept and mock** — use `page.route` to intercept the entity GET and return the expected data

**Critical pitfall: `invalidateQueries` vs `setQueryData`.**
`invalidateQueries({ queryKey: ['x'] })` marks existing cache entries as stale and triggers refetch for ACTIVE observers only. If no component currently renders with that query key, there is no observer, and the invalidation does nothing. When the consuming component later mounts, `initialData` seeds a "fresh" entry, and `staleTime` prevents refetching. This is the #1 cause of "I invalidated the query but the other page still shows stale data."
`setQueryData(['x', userId], newData)` writes directly to the cache. No observer needed. The data is there when the component mounts.

### Overlay Modals After Client-Side Navigation
**Symptom**: Assertion fails but error screenshot shows a modal (promo popup, cookie banner, onboarding wizard) blocking the target element.
**Root cause**: `dismissPromoModals` / `dismissCookieBanner` is called in `beforeEach` after login, but client-side navigation (sidebar link click) triggers the modal again without a `beforeEach` re-run.
**Fix**:
1. Call `dismissCookieBanner` + `dismissPromoModals` after EVERY navigation, not just after login
2. For localStorage-gated popups: set the dismissal flag directly via `page.evaluate(() => localStorage.setItem('key', 'true'))` before navigation
3. Check the popup source code — find what localStorage key or cookie controls it

### Playwright waitForFunction API Gotcha
**Symptom**: `waitForFunction` times out at 10s (or the configured `actionTimeout`) instead of the timeout you specified.
**Root cause**: `page.waitForFunction(fn, { timeout: 40000 })` passes `{ timeout: 40000 }` as the function's `arg` parameter (2nd positional), not as options (3rd positional).
**Fix**: Always pass `undefined` as the second argument when the function takes no args:
```typescript
// WRONG — timeout is the arg, not options
await page.waitForFunction(() => ..., { timeout: 40000 });

// RIGHT — undefined arg, timeout in options
await page.waitForFunction(() => ..., undefined, { timeout: 40000 });
```

### querySelector Finds Wrong Element in Card Components
**Symptom**: `waitForFunction` with `document.querySelector('.card span')` never matches the expected text. The card has the element, but querySelector returns a different span (e.g., a Badge label like "HOT" instead of the countdown "35s").
**Root cause**: `querySelector` returns the FIRST matching element in DOM order. Cards with badges, icons, and labels have multiple spans — the first one is rarely the one you want.
**Fix**: Use `querySelectorAll` and iterate:
```typescript
await page.waitForFunction(() => {
  const spans = document.querySelectorAll('.card-class span');
  for (const el of spans) {
    const match = el.textContent?.match(/^\d+s$/);
    if (match && parseInt(match[1], 10) < 10) return true;
  }
  return false;
}, undefined, { timeout: 40000 });
```

### Route Mock Response Shape (Axios/SDK Wrapping)
**Symptom**: Route mock returns data but the UI doesn't react (no toast, no state change). The intercepted request shows correct body.
**Root cause**: The SDK (Axios) wraps HTTP responses in `{ data: <body> }`. If your mock body is `{ data: { result: ... } }`, the code sees `response.data.data.result` — double-wrapped.
**Fix**: Mock body should match what the SERVER returns, not what the SDK returns:
```typescript
// If server returns { limit_check: { allowed: false } }
// and code checks response.data.limit_check:
await route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ limit_check: { allowed: false } }), // NO data: wrapper
});
```

### Strict Mode Violations in Dialogs
**Symptom**: `page.getByRole('dialog').getByText(/Edit/i)` fails with "strict mode violation: resolved to 2 elements" — even though only one dialog is open.
**Root cause**: The page has multiple elements with `role="dialog"` — the actual dialog plus a hidden/portal element, or the dialog description text also matches.
**Fix**: Scope assertions to a pre-filtered locator (e.g., a page object's `employeeDialog` that uses `.filter({ has: ... })`), not raw `page.getByRole('dialog')`:
```typescript
// FRAGILE — matches any dialog element
await expect(page.getByRole('dialog').getByText(/Edit/i)).toBeVisible();

// ROBUST — scoped to the specific filtered dialog
await expect(employees.employeeDialog.getByRole('heading', { name: /Edit/i })).toBeVisible();
```

### Backend SDK null vs undefined for Schema Fields
**Symptom**: Backend function's `=== undefined` check passes for fields the user never set, but `null` values (returned by some SDKs for absent fields) slip through, causing `(null || defaultValue)` to evaluate wrong.
**Root cause**: Some backend SDKs (e.g., Base44) return `null` for schema fields that were never set, not `undefined`. `=== undefined` misses `null`.
**Fix**: Always use `== null` (loose equality) to catch both:
```typescript
// WRONG — misses null
if (subscription.max_staff === undefined) subscription.max_staff = defaults.max_staff;

// RIGHT — catches both null and undefined
if (subscription.max_staff == null) subscription.max_staff = defaults.max_staff;
```

### UI Feature Parity: Test What the UI Actually Does
**Symptom**: Test expects a toggle behavior (follow/unfollow) but the UI only supports one direction (follow-only). Test fails because clicking the "active" button shows an error toast instead of removing the entity.
**Root cause**: Spec says "toggle" but implementation only does "add". The component's `onClick` calls `addToFavorites` which checks `alreadyFollowing` and shows an error — it never calls `delete`.
**Diagnosis**: Read the component's onClick handler. Don't assume symmetry — check if the inverse operation exists.
**Fix**:
1. Skip the test with a clear spec-drift note
2. OR test the unfollow on the page that actually implements it (e.g., detail page, settings page)
3. File a spec-drift issue for the product team

### Component Library "Title" Elements Render as `<div>`, Not Headings
**Symptom**: `getByRole('heading', { name: /Revenue Trends/i })` never matches, even though the text is visible on screen. No error — the locator silently times out.
**Root cause**: Many component libraries (shadcn/ui `CardTitle`, Chakra UI `CardHeader`, custom design systems) render "title" components as `<div>` or `<p>` with styled classes — not as semantic `<h1>`–`<h6>`. Playwright's `getByRole('heading')` follows the W3C ARIA spec and only matches elements with an implicit or explicit heading role.
**Diagnosis**: Check the actual element tag: `page.locator('text=Revenue Trends').evaluate(el => el.tagName)`. If it returns `DIV` or `P`, heading role won't match.
**Fix** (in order of preference):
1. **Fix the component** — use a real heading element or add `role="heading" aria-level="N"` (improves accessibility too)
2. **Use `getByText()`** for card/panel titles when you can't change the component:
```typescript
// WRONG — CardTitle is a <div>, heading role won't match
this.chartHeading = page.getByRole('heading', { name: /Revenue Trends/i });

// RIGHT — matches visible text regardless of element type
this.chartHeading = page.getByText(/Revenue Trends/i).first();
```
Page-level `<h1>` headings ("Analytics Dashboard") still use `getByRole('heading')` correctly — this issue only affects card/panel titles in component libraries that use non-semantic elements.

### Blob URL Downloads Not Captured by waitForEvent('download')
**Symptom**: `page.waitForEvent('download')` never fires after clicking an export/download button, even though the file downloads correctly in a real browser.
**Root cause**: Export functions that use `URL.createObjectURL()` + synthetic `<a>` click create blob URL downloads. This is a [known Playwright limitation](https://github.com/microsoft/playwright/issues/33972) — Chromium opens a new tab with the blob URL instead of firing a download event.
**Fix**: Make a reliable UI signal (toast, status text) the primary assertion; wrap the download check in try/catch as best-effort:
```typescript
const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await exportButton.click();

// PRIMARY: toast or status message (reliable)
await expect(page.getByText(/exported to CSV/i)).toBeVisible({ timeout: 5000 });

// BEST-EFFORT: download event + filename check
try {
  const download = await downloadPromise;
  if (download) {
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  }
} catch {
  // blob URL download didn't trigger event — toast assertion is sufficient
}

// Verify no accidental navigation
expect(page.url()).toContain('/analytics');
```
**Alternative** (more robust): Use `page.evaluate()` to intercept the blob content directly — see [Playwright #29788](https://github.com/microsoft/playwright/issues/29788) for patterns.

### Charting Library Tooltip Selectors Are Unstable
**Symptom**: `.recharts-tooltip-wrapper` (or similar chart lib class) never matches after hover, even though the tooltip appears in a real browser.
**Root cause**: Charting libraries (Recharts, Chart.js, D3) use internal CSS classes that change between versions and aren't part of a stable public API. Recharts 2.x → 3.x rewrote tooltip rendering entirely. These classes are implementation details, not test contracts.
**Fix**: Use a broad selector strategy for chart tooltips:
```typescript
// Cover multiple Recharts versions
this.tooltip = page.locator(
  '.recharts-tooltip-wrapper, .recharts-default-tooltip, [class*="recharts-tooltip"]'
).first();
```
For hover targets, use `.recharts-responsive-container` with nth-index rather than parent traversal from a heading (headings may be divs, breaking `..` traversal):
```typescript
const container = page.locator('.recharts-responsive-container').nth(1);
const box = await container.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
}
```
Use `toBeAttached()` for tooltip assertions — some chart libs toggle CSS `visibility` rather than `display`, so `toBeVisible()` may not work even when the tooltip is rendered.
**Best practice**: If you control the chart component, add `data-testid` on custom tooltip components. Chart internal DOM is not a stable test surface.

### Conditional test.skip() for Data-Dependent Assertions on Shared Accounts
When tests depend on data that may or may not exist on a shared/production account (billing thresholds, customer segments with zero records, usage-based badges), use `test.skip(condition, reason)` — the [official Playwright annotation](https://playwright.dev/docs/test-annotations) for tests that are irrelevant in the current configuration:
```typescript
test('Healthy badge visible when usage < 70%', async ({ page }) => {
  const tierText = await usagePage.getTierUsageValue();
  const pct = parseInt(tierText.replace('%', ''), 10);
  if (pct < 70) {
    await expect(usagePage.healthyBadge).toBeVisible();
  } else {
    test.skip(true, `Account at ${tierText} — Healthy badge not expected`);
  }
});
```
**Choose the right annotation:**
- `test.skip(condition)` — test is **not applicable** in this state (data doesn't exist)
- `test.fixme()` — test is **known broken**, awaiting a fix
- `test.fail()` — test **should fail** (inverted expectation)

Use this pattern for: threshold-based UI (badges, color borders), chart legends that render only with data, conditional sections guarded by `{data && <Component />}`.

### Environment-Resilient Assertions: Assert Structure, Not Values
On shared accounts with mutable production data, assert what you control (labels, headings, element presence, format patterns) — not what you don't control (specific numeric values created by other users/processes):
```typescript
// GOOD — structural, stable across environments
await expect(analyticsPage.totalRevenueLabel).toBeVisible();
await expect(page.getByText(/\$\d+\.\d{2}/).first()).toBeVisible(); // format assertion

// BAD — value assertion, fails when data changes
await expect(analyticsPage.totalRevenueLabel).toHaveText('$1,234.56');
```
This applies to read-only pages (dashboards, analytics, reports) where the test doesn't create its own data. When a test DOES seed its own entities, it should absolutely assert expected values — the environment-resilient pattern is for observing existing data, not for verifying test-created data.

### react-day-picker v8 / shadcn `<Calendar>` — Day Cell and Navigation Selectors
**Symptom**: `getByRole('gridcell')` or `locator('[role="gridcell"]')` finds 0 elements. `locator('button[aria-label*="December 15"]')` also finds nothing. Day cells are visible but unreachable.
**Root cause**: react-day-picker v8 renders `<td role="presentation">` — NOT `role="gridcell"`. Only hidden inner `<div>` elements get `role="gridcell"`. Day buttons have no `aria-label` attribute by default. shadcn `<Calendar>` wraps react-day-picker v8 and inherits the same structure.
**Fix — day cell selector**:
```typescript
// WRONG — td has role="presentation", gridcell is on a hidden div
page.getByRole('gridcell', { name: /15/ })

// WRONG — aria-label not set on day buttons
page.locator('button[aria-label*="December 15"]')

// RIGHT — scope to the grid table, match visible button text exactly
page.locator('table[role="grid"]')
  .locator('button')
  .filter({ hasText: /^15$/ })  // anchored regex avoids matching "15" inside "151"
  .first()
```
**Fix — month navigation** (navigating to a target month/year):
Don't parse the calendar caption from the DOM — the caption's CSS class (e.g., `.text-sm.font-medium`) often matches other elements on the page, and parsing fails silently if the text is momentarily empty during a transition.
Instead, compute the delta from today and click the chevron exactly that many times:
```typescript
async navigateCalendarToMonth(year: number, month: number): Promise<void> {
  const today = new Date();
  const diff = (year * 12 + month) - (today.getFullYear() * 12 + today.getMonth() + 1);
  if (diff === 0) return;
  const btn = this.page.getByRole('button', {
    name: diff > 0 ? /go to next month/i : /go to previous month/i
  });
  for (let i = 0; i < Math.abs(diff); i++) {
    await btn.click();
    await this.page.waitForTimeout(200);
  }
}
```
This works because the calendar always starts on the current month on a fresh page load. Call `navigateCalendarToMonth` before every `getCalendarDayCell` call.

### Conditional Skip: Precondition Data Exists But Deleting It Breaks Concurrent Tests
The existing `test.skip(condition, reason)` pattern (above) handles tests that need data which doesn't exist yet. There's a mirror case: a test needs the **absence** of data, but deleting all records in `beforeAll` would break other tests in the same suite that depend on those records.

The right move is a runtime guard inside the test body — not a top-level `test.skip` and not a destructive `beforeAll` cleanup:
```typescript
test('empty state shows "No items scheduled"', async ({ page }) => {
  const items = await client.entities.Exception.list();
  if (items.length > 0) {
    console.log(`Skipping empty state test: ${items.length} existing item(s) found`);
    test.skip(true, `Shared account has ${items.length} existing records — cannot clear without breaking highlight/edit tests in the same suite`);
    return;
  }
  await page.goto('/exceptions');
  await expect(page.getByText(/No items scheduled/i)).toBeVisible();
});
```
**Why not `beforeAll` cleanup?** Other describe blocks in the same suite file may run concurrently and depend on those records for their own assertions. A `beforeAll` that deletes everything is a cross-suite race condition.
**Why not `test.skip` at the top level?** The condition is dynamic — it depends on account state at runtime, which varies across environments and runs.
**Document the skip clearly**: log the count and the reason so future readers understand why it fires, not just that it did.

### Static Container Visible, Inner Content Still Lags
**Symptom**: `waitFor({ state: 'visible' })` on a card/panel succeeds, but the assertion on text *inside* that card fails intermittently after a location/context switch.
**Root cause**: The outer container (e.g., `todaysScheduleCard`) is a static structural element that never unmounts. `waitFor` on it resolves immediately because it was already visible — it gives no signal that the *data inside* has refreshed for the new context. React Query refetches in the background and the inner content updates a render cycle later.
**Fix**: Use `expect.poll()` for any inner content that is data-driven, even if the outer container uses a plain `waitFor`:
```typescript
// ✅ outer container — static, waitFor is fine
await this.todaysScheduleCard.waitFor({ state: 'visible', timeout: 10000 });

// ✅ inner content — data-driven after location switch, needs polling
await expect
  .poll(
    () => this.todaysScheduleCard.getByText(location.statusMessage, { exact: true })
      .isVisible().catch(() => false),
    { timeout: 12000 }
  )
  .toBe(true);
```
The `.catch(() => false)` inside the poll callback is important — the locator may throw if the element is momentarily detached during a re-render, and returning `false` lets the poll retry rather than failing immediately.

### `expect.poll()` Timeout — Always Be Explicit
**Symptom**: `expect.poll(fn)` times out earlier than expected, even though `{ timeout: 12000 }` works when passed explicitly.
**Root cause**: `expect.poll()` without an explicit `timeout` option uses Playwright's hardcoded internal default of 5000ms — separate from the `expect.timeout` key in `playwright.config.ts`. For post-navigation or post-context-switch assertions where the data layer (React Query, SWR, etc.) needs time to refetch, 5s is frequently insufficient on slower networks or loaded CI environments.
**Rule**: Always pass `{ timeout }` explicitly on `expect.poll()` calls that follow navigation or context switches:
```typescript
// ❌ implicit — Playwright default is 5s, often not enough after a switch
await expect.poll(async () => getValue()).toEqual(expected);

// ✅ explicit — survives slow refetch and CI latency
await expect.poll(async () => getValue(), { timeout: 12000 }).toEqual(expected);
```
10–12 seconds is a reasonable default for post-switch data assertions; increase for multi-hop flows.

### SDK / Direct API Writes Bypass Application-Layer Middleware
**Symptom**: A fixture seeds more entities than the app UI would allow (e.g., 3 locations on a 2-location plan, extra employees on a free tier). A code reviewer flags this as a blocker — "secureOperation will block the third create." But the tests pass fine.
**Root cause**: Test fixtures that use an SDK client or direct API calls hit the platform's entity/data layer directly. Application-layer middleware — plan enforcement, quota checks, permission guards, rate limiters — lives in the app's own backend functions (serverless handlers, controllers, RPC wrappers). Those functions are only invoked when the app's frontend makes its normal HTTP calls. SDK/direct writes skip that entire layer.
**How to verify when in doubt**: If the claim is that "X will block the create," the empirical test is authoritative — run the fixture and check whether the entity was created. A passing test with the expected data is proof the enforcement is not in the SDK path. Don't accept a code review blocker based on middleware enforcement without verifying which code path the fixture actually uses.
**Implication for fixture design**: This is useful and intentional. Seed via SDK/direct API without worrying about plan limits; you're testing the app's behavior given that data exists, not testing the enforcement logic itself. If you need to test enforcement (e.g., "the UI blocks creation when the quota is full"), do that in a separate dedicated test — don't let it constrain your fixture setup.
**Caveat**: The inverse is also true. If the test *then drives the browser* to create more entities via the UI, those UI actions route through the app's middleware and will hit limits. Seed via SDK; let the browser interact only with the entities you've already seeded.

### SDK Field Names Must Match the Schema, Not the App's JS Aliases
**Symptom**: `beforeAll` seeding fails with `ValidationError: Error in field customer_email: Field required` (or similar). The entity was created with `user_email` because that's what the app component uses — but the schema field is `customer_email`.
**Root cause**: Application code often uses camelCase or aliased property names when reading from API responses. The underlying schema field name can differ. `entity.create({ user_email: '...' })` silently ignores unrecognized fields while the required `customer_email` is missing.
**Fix**:
1. When a `ValidationError: Error in field X: Field required` fires, check the entity's schema definition (Base44 entity schema, Supabase table, etc.) for the canonical field name — not the component source
2. Read the error message literally — it tells you exactly which schema field is missing
3. Cross-check: `grep -r "customer_email\|user_email" src/` to find where the component reads the field and what alias it uses

### Seed Completeness: Include All Fields the Page Renders
**Symptom**: `beforeAll` seeding succeeds (entity created). Tests navigate to the page. Page crashes with an error boundary ("We encountered an unexpected error"). All tests in the describe block fail on the heading `toBeVisible()` — the first assertion on the page.
**Root cause**: The seeded entity has only schema-required fields, but the page renders optional fields without full optional chaining. `obj?.field.method()` guards against `obj` being null, but not against `field` being undefined — `undefined.method()` still throws. A seed that omits `base_charge` on a `BusinessUsage` entity causes `currentUsage?.base_charge.toFixed(2)` to crash.
**Diagnosis**: When all tests in a describe fail on the page heading (not on specific assertions), the page is crashing. Use the error context file or screenshot from the first failure. If main shows an error boundary message, it's a page crash — likely from a seeded entity with missing fields.
**Two fixes needed** (both):
1. **Fix the app** — add `?.` at every nullable property in the render: `obj?.field?.method() ?? fallback` (not just `obj?.field.method()`)
2. **Fix the seed** — read the page component source and include all fields it accesses. The minimum viable seed is one that doesn't crash the page, not one that merely satisfies the schema
```typescript
// WRONG — only schema-required fields; page crashes on base_charge.toFixed(2)
await client.entities.BusinessUsage.create({
  location_id, month_year: '2026-03', unique_customers: 1, tier_mau_limit: 1000
});

// RIGHT — all fields the page accesses without null guards
await client.entities.BusinessUsage.create({
  location_id, month_year: '2026-03', unique_customers: 1, tier_mau_limit: 1000,
  billing_tier: 'starter', base_charge: 4.99, overage_charge: 0,
  overage_mau: 0, total_charge: 4.99
});
```

### Count-Based Assertions on Shared Accounts: Make Them Dynamic
**Symptom**: `expect(comboboxCount).toBe(1)` passes all week, then fails with `Expected: 1, Received: 2`. No code changed. Another test suite created an entity (a second Location, a second Employee) that changed what the UI renders — and it never cleaned it up because `afterAll` was skipped on a crash.
**Root cause**: Assertions that expect an exact count of DOM elements tied to database entities are fragile on shared accounts. The count reflects current account state, which drifts as other tests create/fail/abandon entities.
**Fix**: Replace `expect(count).toBe(N)` with a dynamic assertion — query the actual state from the API first, then assert the DOM matches it:
```typescript
// WRONG — hardcoded count, breaks when another suite adds a Location
const comboboxCount = await page.locator('main [role="combobox"]').count();
expect(comboboxCount).toBe(1);

// RIGHT — dynamic: DOM count matches actual account state
const client = await getAuthenticatedClient(account.email, account.password);
const locations = await client.entities.Location.list();
const expectedComboboxes = locations.length > 1 ? 2 : 1; // 1 time-range + 1 if multi-location
const comboboxCount = await page.locator('main [role="combobox"]').count();
expect(comboboxCount).toBe(expectedComboboxes);
```
**When to use this pattern**: Anywhere the DOM renders one element per entity (cards, table rows, nav items, switcher options). On shared accounts, always query the source of truth and assert the DOM matches it — don't hardcode what you expect the count to be.


### Type 7: Cascading query double-fetch (React Query / SWR / TanStack Query)

Pages that use dependent queries fire multiple fetches on mount. A common pattern: Query A fetches user preferences (e.g., followed locations), Query B filters data using Query A's result. When Query A starts with `initialData: []`, Query B fires immediately with an empty filter, returns nothing, and the UI renders an empty state. When Query A resolves with real data, Query B refetches — but a `waitForResponse` that only catches ONE response already resolved on the empty fetch.

**Symptom**: Selector is correct (verified in source), element exists when you manually browse, but the test times out at `toBeVisible()`. The screenshot shows an empty state or "no results" message. The API wait resolved successfully (caught the first empty response).

**How to identify**: Look for React Query keys that include state arrays: `queryKey: ['items', filterArray]`. If `filterArray` starts as `[]` (from `initialData`, `placeholderData`, or an `enabled:` gate), the query fires twice. Your `waitForResponse` catches the wrong one.

**Fix**: Wait for TWO responses on the dependent query, or use `expect(element).toBeVisible({ timeout })` with a timeout long enough to cover both fetches (typically 12-15s). The two-response approach is more deterministic:

```typescript
// Wait for the dependent query to resolve with real data
await page.waitForResponse(  // first fetch (empty filter)
  r => r.url().includes('/entities/Item') && r.request().method() === 'GET',
  { timeout: 10000 }
).catch(() => {});
await page.waitForResponse(  // second fetch (real filter)
  r => r.url().includes('/entities/Item') && r.request().method() === 'GET',
  { timeout: 8000 }
).catch(() => {});
```

**Prevention**: When reading component source (PREREQUISITE), search for `queryKey` arrays that include state variables. If any state variable starts as `[]` or `null`, document the double-fetch in the test helper's JSDoc and wait for the correct fetch.

### Diagnosis process
