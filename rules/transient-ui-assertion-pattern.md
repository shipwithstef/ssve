# Rule: Transient UI Assertions Must Race a Durable Fallback

Any test assertion targeting a transient UI signal — toast, ephemeral banner, optimistic flash, auto-dismissing notification, animated success indicator — MUST race a short timeout AND fall through to a durable success signal (state mutation, navigation, persisted entity card, dialog close). Asserting only on the transient signal causes flaky failures whenever the underlying API responds fast enough that the signal appears and dismisses before the assertion runs.

## The failure pattern

1. App calls API, awaits ~300-800ms response.
2. App fires `toast.success("X created")` — Sonner / react-hot-toast / Radix Toast / etc. defaults to ~3-4s visible duration with auto-dismiss.
3. Test runs `expect(page.getByText(/X created/i)).toBeVisible({ timeout: 8000 })`.
4. When CI is fast or the API hits cache, the toast appears at t=400ms, dismisses at t=4400ms, and the assertion runs at t≥6000ms checking visibility — finds nothing, fails.
5. Same test passes locally (slower API) and fails in CI (faster API) intermittently.

This is universal across modern toast libraries — Sonner, react-hot-toast, RadixUI Toast, Mantine Notifications, Chakra Toast, Material-UI Snackbar. They ALL default to short auto-dismiss windows for UX reasons.

## Required practice

Combine a SHORT-window probe for the transient signal with a durable assertion that proves the action took effect:

```ts
// ✅ Race transient signal + durable signal.
const toastSeen = page
  .getByText(/X created/i)
  .isVisible({ timeout: 1500 })
  .catch(() => false);

await Promise.race([
  toastSeen,                                                       // happy path
  expect(dialogLocator).not.toBeVisible({ timeout: 5000 }),        // durable
]).catch(() => {});

// Always assert the durable signal at the end.
await expect(dialogLocator).not.toBeVisible({ timeout: 5000 });
await expect(newCardLocator).toBeVisible({ timeout: 8000 });
```

Or, simpler when a durable signal exists: drop the transient assertion entirely.

```ts
// ✅ Drop the toast — durable signals fully cover the success state.
await expect(dialogLocator).not.toBeVisible({ timeout: 8000 });
await expect(newCardLocator).toBeVisible({ timeout: 8000 });
```

## Forbidden patterns

```ts
// ❌ Transient-only assertion with a long timeout.
await expect(page.getByText(/X created/i)).toBeVisible({ timeout: 8000 });
```

```ts
// ❌ Transient-only with even a short timeout — still races on slow CI.
await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 1500 });
```

## Identifying transient signals

A signal is "transient" if ANY of:
- It auto-dismisses without user interaction.
- It uses `setTimeout` to remove itself.
- The library docs describe it as a "toast" / "notification" / "snackbar" / "banner".
- It animates out (fade, slide) after a fixed duration.

Common offenders: Sonner, react-hot-toast, RadixUI Toast, react-toastify, Mantine Notifications, Chakra `useToast`, MUI Snackbar.

A signal is "durable" if:
- It persists until the user navigates / dismisses / re-acts.
- It reflects an underlying state (rendered card, selected tab, URL).
- A reload or re-query of the page would still show it.

Examples: navigation to a new URL, a row appearing in a list, a dialog closing, a count incrementing.

## How to enforce

- `write-e2e` Phase "assertion strategy" must declare for each happy-path assertion whether the target signal is transient or durable. Transient signals require a paired durable assertion.
- `audit-implementation` flags any test that asserts ONLY on text matching a known toast pattern (`/created/i`, `/saved/i`, `/deleted/i`, `/successfully/i`) without a paired durable check. Severity: MEDIUM.
- `review-gate` G3 — any new E2E test or test-fix touching toast/banner assertions must explicitly cite the durable fallback.

## Recurrence-based rule promotion

This rule earned its place after firing 4+ times across Example Marketplace WIs (WI-123 J07 lightning-claim toast, WI-127 onboarding banner, WI-132 EMP-US-2 employee-added toast, WI-128 sample success). The framework principle: a pattern that fires 3+ times across distinct WIs is no longer a teaching moment — it is a rule.

## Severity when violated

MEDIUM in a new test (catch at review-gate). HIGH if the pattern keeps reappearing in the same area after this rule landed.
