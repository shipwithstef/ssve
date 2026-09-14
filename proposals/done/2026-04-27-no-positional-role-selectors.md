# Proposal — No Positional Role Selectors in E2E Tests

**Filed:** 2026-04-27
**Status:** proposed
**Severity:** MEDIUM (recurrence-driven escalation candidate)
**Affects:** `write-e2e/SKILL.md`, `playwright/SKILL.md`, `e2e-automation/SKILL.md`

## Problem

E2E tests routinely use positional role selectors like `page.getByRole('combobox').first()` to target controls (location switcher, account selector, environment picker). This idiom is brittle on layout-heavy apps where the framework's chrome (sidebar, header, top bar) renders OTHER role-matching elements before the target. Common offenders: language selectors, theme switchers, environment dropdowns, search comboboxes, account avatars (button role).

The failure is silent — the test "successfully" clicks something, opens an unrelated dropdown, and the option assertion times out searching for an option that never existed in the opened menu.

## Real failure observed

WI-132 (Example Marketplace J04 stat tests) shipped a "switch to seed location" helper using `page.getByRole('combobox').first()`. The first combobox was the **sidebar language selector** (English / Français / Български), not the page-header location switcher. Screenshot evidence in test artifacts: clicking opened the language menu, not locations. Two PRs (#75, #77) were spent before the disambiguation logic was correct.

## Proposed change

Add a "Selector Disambiguation" subsection to `write-e2e/SKILL.md`, `playwright/SKILL.md`, and `e2e-automation/SKILL.md` — and promote to a hard rule (`rules/no-positional-role-selectors.md`) if it fires in 2 more independent WIs.

### Selector strategy hierarchy (best to worst)

1. **`data-testid`** — explicit, stable, app-controlled. ALWAYS preferred for switchers, navigation, action buttons.
2. **Container-scoped role selector** — `page.locator('[data-testid="page-header"]').getByRole('combobox')`.
3. **Content-disambiguated role selector** — iterate role matches and skip those whose text is in a known-other set (e.g. language codes, theme names).
4. **Positional `.first()` / `.nth(N)`** — LAST RESORT. Only valid when the test asserts the position is stable AND has a backup data-testid plan.

### Forbidden idioms

```ts
// ❌ Brittle on layout-heavy apps.
page.getByRole('combobox').first().click();
page.getByRole('button', { name: /save/i }).first().click();
```

### Preferred idioms

```ts
// ✅ Best — explicit data-testid.
page.locator('[data-testid="location-switcher"]').click();

// ✅ Acceptable — container-scoped.
page.locator('[data-testid="page-header"]').getByRole('combobox').click();

// ✅ Acceptable when no testid exists — content-disambiguated.
const candidates = page.getByRole('combobox');
const count = await candidates.count();
let target: Locator | null = null;
for (let i = 0; i < count; i++) {
  const text = (await candidates.nth(i).textContent())?.trim() ?? '';
  if (/^(english|français|български)$/i.test(text)) continue;  // skip language
  target = candidates.nth(i);
  break;
}
```

## Companion: app code obligation

Apps under test SHOULD add `data-testid` to every chrome-rendered control that tests interact with. This is a one-time investment that eliminates an entire class of E2E flakiness. Add to `design-ui` / `design-tech` skills: when designing chrome / layout components, every interactive element gets a `data-testid`.

## Decision needed

- Accept as a `rules/` entry now (proactive — pattern fired 1× but the failure mode is universal), OR
- Hold as a `write-e2e` SKILL.md addition first; promote to rule on 2nd recurrence.

Recommendation: **add as SKILL.md guidance now, promote to rule on next recurrence.** The pattern is real but a single occurrence isn't yet enough to justify a hard rule. Track recurrences in `references/framework-learnings.jsonl`.

## Source

WI-132 J04 stat tests, PR #77 (`fix(wi-132): pick correct combobox for location switcher`).
