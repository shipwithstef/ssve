# Proposal: `write-journeys` must auto-detect i18n flows + chrome-control journeys

**Status:** open
**Filed:** 2026-05-09
**Author:** Claude Opus 4.7 (Example Marketplace session, 2026-05-08/09)
**Class:** framework, journey-coverage
**Severity:** HIGH (real bug class shipped to production because no E2E existed)

---

## Problem (concrete recurrence)

Example Marketplace session 2026-05-08/09 hit this loop:

1. `WI-184` (mobile Select drawer click-death) was filed and fixed via PR #38. An E2E spec was written: `e2e/specs/journeys/WI184-mobile-filter-no-pointer-lock.spec.ts`. Spec covered the filter dropdown on the Notifications page only.
2. `WI-195` (notifications page click-death recurrence) was filed. **No new E2E** — fix shipped under PR #56 with bundle-grep verification only.
3. `WI-196` (language switcher kills all buttons after picking BG/FR) was filed. **No E2E exists for the lang-switcher flow.** Fix shipped via PR #67.
4. User asked the obvious question: "is everything verified end-to-end?" Answer: bundle-grep yes, behavioural E2E no.

When `test-journeys` finally ran, the gap was concrete: **there is no spec for `customer mobile sidebar → open language switcher → switch language → close drawer → tap any sibling button → assert click responds`** — despite this exact flow being:

- A documented user journey (every customer who isn't English-default does it)
- Touching shipped code (50+ i18n PRs + a Vaul Drawer + Radix Select + a Sheet — three primitives nested)
- A 3rd manifestation of the same body-pointer-events bug class (after WI-184 and WI-195)

`write-journeys`, `audit-coverage`, and `audit-ac` were all available throughout. None flagged the gap. None auto-generated a journey for "customer changes language on mobile."

## Why each skill missed it

### `write-journeys`
- Generates journeys from feature specs in `docs/specs/features/`. There is no feature spec called `i18n-language-switcher.md` or similar — i18n was treated as cross-cutting infrastructure, not a feature, so no journey was scaffolded for it.
- Never crawls the rendered chrome (`Layout.jsx` sidebar, `MobileHeader.jsx`) to discover interactive controls that are NOT spec-rooted.
- 7 modes (create / expand / sync / audit / bootstrap / tiered auto-discovery / regression refresh) all read FROM specs FORWARD. Nothing reads FROM CODE BACKWARD to find chrome controls without a spec.

### `audit-coverage`
- Audits canonical artifact presence (vision, journeys, specs, etc.) against the catalog. A *missing* journey for a *cross-cutting concern* doesn't trigger because i18n isn't in the canonical catalog.
- The "Coverage Gaps" section of `project-state.md` lists missing canonical artifacts but doesn't enumerate "interactive UI controls without journeys" — that's a different audit dimension.

### `audit-ac`
- Operates on existing AC tables. Cannot flag missing ACs for journeys that don't exist.
- Doesn't introspect chrome-control coverage.

### `catalog-domain-capabilities` (closest match)
- Builds a domain capability matrix from competitor analysis + domain profile. i18n / multi-language IS in the matrix for Example Marketplace (FR/BG are shipped). But the matrix doesn't auto-generate journeys for each capability — it sits as table-stakes context.

## The structural gap

Two coverage axes the framework currently misses:

### Axis 1 — Cross-cutting infrastructure as journey source

**Pattern:** A capability that touches every page (i18n, theming, auth-state) is treated as infra and never gets its own journey, even though it has user-facing flows.

**Concrete examples:**
- i18n: switch language → all visible text re-renders → user can interact again
- Theme: toggle dark mode → no contrast regressions → user can interact
- Auth: log out from any page → returns to landing → no stale state leaks
- Locale-aware date pickers, currency formatters

For Example Marketplace specifically, language switching alone has at least 4 distinct flows:
1. Customer mobile sidebar (where the bug shipped)
2. Customer desktop sidebar
3. Owner mobile sidebar
4. Owner desktop sidebar

None of these have journeys today.

### Axis 2 — Chrome controls as journey source

**Pattern:** Interactive controls in `Layout.jsx`, `MobileHeader.jsx`, `Sidebar.jsx` etc. are reachable from every page but rarely get journey coverage because they're not "in" any feature spec — they're chrome.

**Concrete in Example Marketplace:**
- Customer mobile sidebar trigger → opens Sheet
- Inside that Sheet: language switcher, theme toggle, account menu, sign out
- Mobile bottom nav (Home, Map, Saved, Profile)
- Notification bell icon
- All of these can break independently of any feature spec

## Proposal — three concrete framework improvements

### 1. New journey-source: `code-derived-chrome-journeys`

`write-journeys` gains a new mode: `auto-discover-chrome` that reads `Layout.jsx` (or equivalent), enumerates every interactive control in the rendered chrome (buttons, links, Select triggers, Sheet triggers), and emits a "skeleton chrome journey" for each that doesn't already have a journey covering it.

Output: `docs/specs/journeys/Chrome-<role>-<surface>.feature.md` (e.g., `Chrome-customer-mobile-sidebar.feature.md`) with one Scenario per chrome control.

**Heuristic:** any element matching `<button|<Select|<Sheet|<DropdownMenu|<Drawer|<a` inside a Layout-class component AND outside of `<children />` content area gets a skeleton scenario.

### 2. `catalog-domain-capabilities` → `write-journeys` chain

When `catalog-domain-capabilities` includes a row like "multi-language" or "theme switching" in the table-stakes matrix AND the project's tech-stack includes the corresponding library (i18n provider, theme context), `write-journeys` is automatically invoked with `--capability=<name>` to produce a journey skeleton.

**Example Marketplace example:** capability matrix includes "multi-language (FR/BG/EN)"; stack includes `react-i18next`-style pattern (`getNavTranslations`, `dispatchEvent('languageChange')`); `write-journeys --capability=multi-language` would have produced `J-CAP-i18n-language-switcher.feature.md` covering all 4 mobile/desktop × customer/owner combinations.

### 3. New tier-1 validator: `validate-chrome-journey-coverage`

Runs at every `route-workflow` session-start in `convert` repo mode. Scans `src/Layout.jsx` (or stack-equivalent) for chrome controls, cross-references against `docs/specs/journeys/Chrome-*.feature.md`, fails CI / gates promotion if any chrome control has zero journey coverage.

**Severity:** WARN initially; HIGH after a 30-day adaptation period.

**Failure surfaces in `route-workflow` output as:** `[chrome-coverage WARN] Layout.jsx exposes <LangSwitcher> but no journey covers it. Run: write-journeys --auto-discover-chrome`.

## Counterfactual — what would have happened with these three improvements

Re-running the Example Marketplace session with these in place:

1. Session-start in Example Marketplace → `validate-chrome-journey-coverage` runs → fails with `[WARN] Layout.jsx language switcher has no journey coverage`.
2. WI-184 (the original) is still filed. Before fix is shipped, the WARN forces `write-journeys --auto-discover-chrome` to run, which produces `Chrome-customer-mobile-sidebar.feature.md` covering the language switcher AND the theme toggle AND the sign-out flow.
3. WI-184's E2E spec now has a sibling journey: `J-Chrome-customer-mobile-sidebar` with Gherkin for "Given customer logged in, When I switch language to BG, Then all buttons remain interactive."
4. PR #38 lands → that scenario gets converted to E2E by `write-e2e` automatically (if i18n journey is on the lane-task graph).
5. The bug never recurs as WI-195 / WI-196 because the original E2E covers ALL three primitives (Filter Select, Notifications drawer, Lang Switcher) — the *class* of bug, not just the *instance*.

Estimated session savings: this one bug class (WI-184 + WI-195 + WI-196) would have collapsed into ONE iteration instead of THREE, saving ~3 PRs of churn + 1 mobile build cycle.

## Generalization — recurrence-pattern principle

This is the framework principle: **any bug class that recurs ≥3 times across distinct WIs in the same project signals a coverage-generator gap, not a developer error**. The fix is upstream in journey/coverage generation, not in catching each instance.

WI-184 → WI-195 → WI-196 is the canonical "three strikes, file framework gap" pattern (already documented as a rule in `rules/transient-ui-assertion-pattern.md` for E2E specs). This proposal extends the pattern to the journey-generator.

## Out of scope

- Generic UI testing tools that crawl all interactive elements (overkill — chrome-only scope is the right primitive).
- Auto-generating *automated* E2E specs for every chrome control (write-e2e is a separate skill; this proposal stops at journey scaffolds).
- Backporting chrome journeys to all greenfield templates (do this once the convert-mode tier-1 validator is stable).

## Decision needed

Approve as 3 follow-up WIs:

- **WI-A:** `write-journeys --auto-discover-chrome` mode — enumerates Layout chrome controls, emits skeleton journeys.
- **WI-B:** `catalog-domain-capabilities` → `write-journeys --capability=<name>` auto-chain for table-stakes capabilities (i18n, theme, auth).
- **WI-C:** `test-framework/evals/tier-1/validate-chrome-journey-coverage.sh` — convert-mode session-start WARN, escalates to HIGH after 30-day adaptation window.

When approved, route through `capture-idea --from-proposal proposals/done/2026-05-09-journey-generator-must-detect-i18n-and-chrome-controls.md` to file the three WIs, then standard Lane 7 framework lane.

## Companion artifacts

- Example Marketplace work items proving the recurrence: WI-184, WI-195, WI-196 (in `example-marketplace/docs/specs/work-items/`)
- The session that surfaced this gap: 2026-05-08/09 user-driven debugging
- Existing test-journeys SUMMARY.md acknowledging the gap: `example-marketplace/docs/specs/features/test-evidence/2026-05-09-prod-WI-195-196/SUMMARY.md`
