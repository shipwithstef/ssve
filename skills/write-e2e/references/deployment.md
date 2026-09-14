## Production-Only Deployment Platforms (Base44, Vercel preview-only, etc.)

If the project has **no local server** (E2E always hits a live production or preview URL):

- **Pre-deploy spec run = baseline check**, not fix validation. A regression spec that passes before the fix is deployed means either (a) the bug was never deployed to production — document this, or (b) the spec is too weak to catch the bug — strengthen it.
- **Post-deploy spec run = the real fix validation.** Running the WI regression spec in `verify-promotion` after deployment is the only meaningful pass signal.
- When running pre-deploy, document what you observed: "PASS — bug not yet on production (fix was on feature branch only)" or "FAIL as expected — bug present, spec catches it."
- Do NOT claim the fix is verified until `verify-promotion` runs the spec against the deployed production.

For Base44 specifically: `npx playwright test --config=e2e/playwright.config.ts` hits `https://<app>.app` (production). There is no localhost server. Every test run is a production hit.

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before writing tests.

- `bootstrap`: if no E2E harness exists, create baseline Playwright structure/config first.
- `convert`: attach to existing test runner/layout and map tests to current conventions before
  introducing page-object structure changes.

## Step 0: Pre-Flight — Read the Frontend Before Writing Any Test (MANDATORY)

**This is Process Step 0 — it runs BEFORE any test code is written. It is part of the Pre-Flight Protocol (see `route-workflow` Task-Graph Execution Protocol). Skipping it is a contract violation and a self-verify failure (check #4).**

**Before writing a single selector or assertion, READ the actual component source code for every UI surface the test will touch.** This is non-negotiable. You cannot write a test based on what you assume the DOM looks like — you must know:

- What ARIA roles and labels exist (e.g., `role="tablist"` vs `role="progressbar"`)
- What text content elements actually render (e.g., just `"1"` vs `"Phase 1"`)
- Whether `<label>` elements have `htmlFor` connections to inputs
- Whether inputs have `name`, `aria-label`, or `placeholder` attributes
- Which `<aside>`, `<nav>`, `<section>` elements exist and what distinguishes them
- What the component renders conditionally vs always

**If a component lacks accessible names** (no `htmlFor`, no `aria-label`, no `name` attr), you have two options:
1. **Fix the component** — add `htmlFor`/`aria-label` (preferred, improves a11y)
2. **Use positional selectors** — `dialog.locator('input').first()` as a pragmatic fallback

Never guess selectors. Never assume attribute names. Read the code first.

**Scope selectors to their container — never use global `.first()` for form fields.** `page.getByRole('combobox').first()` will match the language selector in the site header, not the Category dropdown in the wizard form. Always scope to the nearest unique parent: `page.locator('text=Category *').locator('..').getByRole('combobox')` or `wizard.locator.getByRole('combobox')`. Global `.first()` / `.last()` is only safe inside an already-scoped container like a `dialog` or a specific `section`.

**Use ARIA landmark roles for broad scoping** when you need to isolate main content from sidebar/header/nav elements. This is a [recommended Playwright pattern](https://playwright.dev/docs/best-practices) — semantic HTML landmarks (`<main>`, `<nav>`, `<aside>`) have implicit ARIA roles that make excellent scope boundaries:
```typescript
// Scope to main content — skips sidebar language switcher, nav dropdowns, etc.
page.locator('main').getByRole('combobox')        // CSS tag
page.getByRole('main').getByRole('combobox')       // ARIA role (preferred)

// Also useful for nav vs main disambiguation
page.getByRole('navigation').getByRole('link', { name: /Dashboard/i })
```

**Especially read the toast/notification component.** Don't assume Sonner (`[data-sonner-toast]`) or `[role="status"]` — many projects use custom toast components that render plain `<p>` or `<div>` elements with no ARIA role. Check `useUIStore`, `toast()`, or whatever the project uses, then find the actual component that renders the message. Use `page.getByText(/expected text/i)` as the most reliable toast locator when the component lacks semantic attributes.

**If toasts silently disappear across multiple unrelated tests, the toast provider is probably not mounted.** This is an app bug, not a selector problem. Before spending time on selectors, check that the `<Toaster />` component is actually rendered in the root — `App.tsx`, `main.tsx`, or equivalent. Projects using multiple toast libraries (e.g., shadcn's `<Toaster>` AND Sonner's `<Toaster>`) must mount both. A page that calls `toast.success()` from `sonner` while only `<SonnerToaster>` from shadcn is mounted will silently swallow every toast with no error. The diagnosis: grep for the `toast` import in the page component, then search the root for the matching `<Toaster>` mount.

---

## Fix the App, Not the Test

When a test failure reveals a production bug or anti-pattern, **fix the production code first**. Tests must exercise real application behavior, not paper over incorrect behavior with timing hacks, navigation tricks, or synthetic responses that hide the bug.

### The Principle

A test passes under workaround ≠ the feature works. If a test cannot pass without bypassing the production code path it is supposed to verify, the production code has a bug. Shipping that test as PASS encodes the bug as "verified" and hides it from future readers — including your future self. The framework treats this as a P0 quality failure.

### Anti-Patterns (non-exhaustive — the principle is the gate, not the list)

The following are concrete examples. This list is illustrative — if your workaround is structurally similar but not named here, it still fails the principle.

**Timing hacks:**
- `waitForTimeout(>5000)` to wait for broken state to eventually sync (e.g., stale cache, missing invalidation, slow propagation)
- Long `polling` loops retrying an assertion that should pass on first read

**Navigation hacks:**
- Navigating away and back to force a component remount that skips stale state
- Refreshing the page mid-test to "reset" something the app should reset itself

**Internal-state manipulation:**
- `page.evaluate()` to dispatch synthetic events or mutate component state directly
- Injecting values into `localStorage` / `sessionStorage` to simulate a state the app should produce

**Response manipulation (the insidious class):**
- `page.route('**/functions/X', route.fulfill({success: true}))` replacing a real backend function's response with a synthetic success that hides a broken backend path
- Mocking an API that the test exists to verify
- `page.setExtraHTTPHeaders` / cookie injection to skip auth the test should exercise

**Spec-circumvention:**
- `test.skip('AC-XX: spec/implementation mismatch')` without filing the mismatch
- Weakening an assertion ("expect toBe → expect toContain") just to make it pass
- Commenting out a step because "the UI doesn't support it yet"

**Smell test:** if a real user can't do what your test does (inject cookies, replace network responses, mutate internal state), the test is not exercising the user's path. Investigate why the user's path is failing.

### What To Do Instead

1. **Identify the root cause in production code.** Read the source; don't guess. Common culprits: `invalidateQueries` without an active observer, wrong query key, missing auth guard, 401/403 hidden behind error-tolerant UX.
2. **Classify the fix:**

   | Classification | Meaning | Route |
   |---|---|---|
   | **Spec drift** | Spec says X, code does Y, **code is correct** (spec is wrong) | `sync-spec-code` — update spec to match code. Test proceeds against real code. |
   | **Production bug (in-scope)** | Spec says X, code does Y, **code is wrong** AND the fix is within this WI | Fix the production code in the current WI before the test PASSes. Redeploy. Re-run. |
   | **Production bug (out-of-scope)** | Spec says X, code does Y, **code is wrong** AND the fix needs its own work item | HALT. File as new WI entering at `diagnose-bug` with **no pre-locked fix** (see `skills/diagnose-bug/SKILL.md:0.4`). Mark the current WI `BLOCKED_ON_DISCOVERY: WI-###`. Do NOT ship the current test with a workaround. |
   | **Out-of-scope architectural** | Full behavior requires refactor beyond this WI (e.g., new persistence model, new host abstraction) | `test.skip('AC-XX: requires <architectural change>')` + file as new WI entering at `write-spec` (delta mode), NOT `sync-spec-code`. The escape valve is labeled. |

3. **Deploy the fix** before running the test (for production-bug paths).
4. **Write the test against the correct behavior** — no mocks of code under test, no timing padding, no internal-state mutation.

**Routing discipline:** `sync-spec-code` is the lowest-scrutiny lane. Do not use it as a default landing pad for anything that doesn't fit the current WI. Production bugs go through `diagnose-bug`; architectural gaps go through `write-spec`. Under-routing a production bug as "spec drift" is itself a quality failure — spec-drift fixes do not pass through `review-security` or `review-gate` the same way bugfixes do.

### This Principle Applies To Every Layer

React Query caching, missing API endpoints, incomplete CRUD operations, broken state management, missing i18n keys, incorrect ARIA roles, auth guards, backend validation, platform quirks. Wherever the test hits the app, the app must work — not a stub, not a mock, not a timing-padded version of it.

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

