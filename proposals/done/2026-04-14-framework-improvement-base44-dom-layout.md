**Status:** IMPLEMENTED (2026-04-14, write-e2e/SKILL.md)

# Framework Improvement: write-e2e Base44 SPA DOM Layout Patterns

## Evidence

- **Source:** Example Marketplace WI-006 J30 E2E test run — two independent runtime failures on FOLLOW+FAV-01
- **Finding 1:** `write-e2e/SKILL.md` has no guidance on sidebar/nav Tailwind class collision with content cards. `page.locator('div.group').first()` matched the sidebar Favorites nav link (earlier in DOM) instead of the discovery grid card, causing navigation to `/favorites` instead of `/location?id=…`. Failed at the URL assertion, not the selector — making the root cause non-obvious.
- **Finding 2:** `write-e2e/SKILL.md` has no guidance on auth-helper UI-milestone vs data-API gap. `loginAndNavigateHome` waits for `h2:has(span)` (zone banner appears before location API resolves); without explicit `waitForLoadState('networkidle')`, `isVisible()` on a location card returned false → test self-skipped silently.
- **Severity:** P0 — framework guidance gap that causes recurring runtime failures requiring an extra fix-commit cycle per occurrence

## Diagnosis

- **Root cause:** write-e2e Step 0 ("Read the Frontend Before Writing Any Test") correctly says "read the component source before writing selectors" but doesn't articulate Base44 SPA-specific hazards. A developer following Step 0 reads the card shape (`div.group`) but has no reason to grep what else on the page shares that class — especially sidebar nav items in a different logical section.
- **Category:** missing capability — the skill covers generic Playwright scoping patterns (line 61–63: ARIA landmark roles, `.locator('main')`) but has no Base44-specific DOM layout section analogous to the existing "Base44 SDK as DB Helper" section.
- **Already in FRAMEWORK-STATE.md?** No — Base44 entries cover deployment semantics and `--diagnose-only` flag behavior only.

## Implementation

- **Route:** direct `write-e2e/SKILL.md` edit (isolated skill surgery, no pipeline overhead)
- **Files changed:** `write-e2e/SKILL.md` — new subsection "Base44 SPA DOM Layout Patterns" inserted after "Base44 SDK as DB Helper" (after line 383, before "Page Objects")
- **Content added:** two named rules:
  1. Sidebar/nav elements share Tailwind classes with content cards → always scope card selectors to the grid container (`getByTestId('business-list').locator('div.group')`, not bare `div.group`); grep page component for class sharing before writing any card selector
  2. Auth helpers wait for UI milestone (zone banner), not data API → add `waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})` before asserting on dynamic discovery-grid content; `.catch()` is intentional for long-polling pages

## Replay Verification

- **Replay target:** qualitative — the exact FOLLOW+FAV-01 failure pattern (sidebar nav collision + networkidle gap)
- **Result:** PASS (qualitative)
- **Evidence:** The new rule text directly prescribes `getByTestId('business-list').locator('div.group')` and `waitForLoadState('networkidle')` — both being the exact fixes applied in WI-006 to recover from the failures. A developer following the new rules would not have written the failing selectors in the first place.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** add entry for "2026-04-14: write-e2e Base44 SPA DOM Layout Patterns"
- **Known Gaps:** none to move (this was a new finding, not a deferred gap)
- **Decisions:** none new
- **Capabilities:** no new capability — this is a hazard-documentation addition to an existing skill
