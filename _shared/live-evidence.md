# Live In-App Verification — terminal gate for visual-output skills

**Status:** canonical pattern, referenced by `design-logo`, `landing-page`, `design-ui` (svc-native) and via `route-workflow` post-hook for external CRO/ad skills (`ad-creative`, `popups`, `signup`, `paywalls`, `cro`, `onboarding`).

This spec is the **terminal gate** for any skill producing a visible artifact shipped to a deployed product. Bundle-grep + perf PASS + isolated-rubric scoring do NOT substitute for it.

## Why

Self-rated rubrics, isolated component previews, build-green checks, and bundle-grep verification ALL miss live-page failures:

- Palette mismatch with the actual deployed page chrome
- Raw JSX text leaking onto the page (orphan attributes from mass-edit component swaps)
- Silhouette failure on the page's real background (slate-on-slate, iris-on-iris)
- Wordmark contrast failure on dark hero
- Cached old asset serving despite new commit (Cloudflare 4hr TTL)
- Theme-toggle bug — light variant shown in dark mode or vice versa
- Mobile layout collapse (only desktop tested)
- Broken/empty links shipped to prod
- Console errors at any viewport not surfaced

Past failures it would have caught: WI-088 (landing iter declared done while mobile pricing was broken), WI-161 (logo passed isolation rubric while mobile hero showed orphan attrs), WI-066 / WI-074 (deployed bundle drift undetected), Example Marketplace logo session 2026-04-30 (shipped `fetchPriority="high"` rendering as raw text on the live page).

The ONLY reliable terminal gate is **live in-app screenshot capture across viewports + themes after deploy lands**, with eyeball check.

## What MUST be captured (all six are mandatory; none optional)

### 1. Multi-viewport × theme matrix — 6 full-page screenshots

| Viewport | Width × Height | Theme | Filename |
|---|---|---|---|
| Mobile | 390 × 844 (iPhone 14) | light | `<slot>-mobile-light.png` |
| Mobile | 390 × 844 | dark | `<slot>-mobile-dark.png` |
| Tablet | 768 × 1024 (iPad portrait) | light | `<slot>-tablet-light.png` |
| Tablet | 768 × 1024 | dark | `<slot>-tablet-dark.png` |
| Desktop | 1440 × 900 (MBP 14") | light | `<slot>-desktop-light.png` |
| Desktop | 1440 × 900 | dark | `<slot>-desktop-dark.png` |

Captured **full-page** (not viewport-clipped) so pricing, features, and footer are inspectable. Output to `docs/specs/<skill>/in-app-verification/<YYYY-MM-DD>/`.

### 2. Per-section close-up shots (full-width, viewport-clipped)

For landing-class artifacts, capture each named section at mobile + desktop:
- hero
- social proof / logos strip (if present)
- features grid
- pricing
- testimonials (if present)
- footer

Names: `<slot>-section-<name>-<viewport>-<theme>.png`. Skip per-section dark unless brand uses dark-only sections.

### 3. Side-by-side anchor strip (mobile)

Create `<slot>-anchor-strip-mobile.png` — a horizontally-stitched composite of `<our-product>` mobile-light vs the 3 declared sector anchors at the same viewport (read anchors from `docs/specs/landing/reference-bank.json` or equivalent). Identical width, same crop region (hero or pricing — whichever is being judged).

This is the test that catches "looks fine in isolation, looks amateur next to category leaders."

### 4. Link-integrity report

Crawl every `<a href>`, `<button onClick → navigate>`, and nav element on the deployed page. For each:

| Field | Notes |
|---|---|
| `text` | Visible label |
| `href` or `to` | Resolved target |
| `status` | HTTP status from HEAD request, OR `internal-route-exists` / `internal-route-missing` for SPA routes |
| `verdict` | OK / 4xx / 5xx / EMPTY (`#`, `javascript:void`, empty href) / DEAD |

Output to `docs/specs/<skill>/in-app-verification/<YYYY-MM-DD>/links.json`. Any non-OK row blocks completion.

### 5. Console + network audit

Capture during each viewport's load:
- All console errors / warnings (filter dev-only noise)
- All network requests with status >= 400
- Largest Contentful Paint (LCP) per viewport

Output to `docs/specs/<skill>/in-app-verification/<YYYY-MM-DD>/runtime.json`.

### 6. Eyeball-check rubric (orchestrator-judged)

The orchestrator (Claude/Kimi/Codex) scores each row and surfaces fails:

| # | Check | Pass criterion | Hard-fail? |
|---|---|---|---|
| 1 | Hero matches brand on mobile | Logo, type scale, CTA prominent and not clipped at 390px | YES |
| 2 | Hero matches brand on desktop | Same as above at 1440px; layout doesn't feel cramped or empty | YES |
| 3 | Pricing section premium feel | Type hierarchy clear, plan cards aligned, currency/price/period consistent, recommended-plan affordance present | YES |
| 4 | Pricing section mobile usability | Cards stack cleanly, no horizontal scroll, tap targets ≥ 44px, no truncated copy | YES |
| 5 | Dark mode contrast across sections | All text WCAG AA against actual dark bg; no light-mode-only gradients leaking through | YES |
| 6 | Side-by-side parity vs anchors at mobile | Our hero does not look obviously weaker than 3 sector anchors at same width | YES |
| 7 | No raw-text leaks / orphan attrs | Visual scan for `fetchPriority=`, `loading=`, stray `/>` etc. on any viewport | YES |
| 8 | No broken/empty links | Every entry in links.json verdict = OK | YES |
| 9 | No console errors at any viewport | runtime.json shows zero unfiltered errors | YES |
| 10 | Section transitions feel intentional | Borders, gradients, spacing between sections consistent — no abrupt theme shifts | NO (note in audit) |

A skill cannot mark its task `completed` until all hard-fail rows are PASS or the user passes `--skip-live-evidence` (logged as `taste` decision in `.svc/pipeline-decisions.jsonl`).

## Canonical capture script

Skills should call a project-local Playwright script that implements the matrix above. Per-project copies are allowed; the contract is the output filenames + report shapes above, not the script internals. To create the project-local script, run:

```bash
node scripts/live-evidence-capture.mjs --init scripts/capture-live-evidence.mjs
```

Minimum behaviour:

```js
import { chromium } from 'playwright';

const URL = process.env.SNAP_URL || 'https://your-prod.host/';
const THEME_KEY = process.env.SNAP_THEME_KEY || 'app-theme';
const OUT = process.env.SNAP_OUT || 'docs/specs/<skill>/in-app-verification';

const VIEWPORTS = [
  { name: 'mobile',  w: 390,  h: 844 },
  { name: 'tablet',  w: 768,  h: 1024 },
  { name: 'desktop', w: 1440, h: 900 },
];
const THEMES = ['light', 'dark'];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: theme });
    const p = await ctx.newPage();
    await p.emulateMedia({ colorScheme: theme });
    await p.addInitScript((t, k) => localStorage.setItem(k, t), theme, THEME_KEY);
    await p.goto(URL, { timeout: 30000, waitUntil: 'networkidle' });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(1500);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/<slot>-${vp.name}-${theme}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
```

The script must:
1. Set `prefers-color-scheme` via `emulateMedia({ colorScheme: theme })` AND, if the app uses class-based theming, toggle the theme switcher first.
2. Wait for `networkidle` before each shot.
3. Scroll the full page once (to trigger lazy-loaded sections) before the full-page screenshot.
4. Emit a single summary JSON `report.json` that lists every output file produced, so the eyeball-check rubric can iterate them.

## When this gate runs

- `landing-page` → after Phase Z (deploy + smoke); blocks completion.
- `design-ui` → after the component lands on a real page; blocks completion.
- `design-logo` → after the mark is wired and bundle deployed; blocks completion (existing Phase 13).
- External addons (`cro`, `popups`, `signup`, `paywalls`, `onboarding`, `ad-creative`) → enforced by `route-workflow` post-hook only.

## Output contract

All artifacts persist to `docs/specs/<skill>/in-app-verification/<YYYY-MM-DD>/`. Future iterations of the skill use these as the **before** baseline for delta scoring.

## Loop-back rule

If any hard-fail check fails, the skill **must not declare done**. Loop back to the appropriate iteration phase (in design-logo: Phase 8 iteration; in landing-page: copywriting+benchmark iteration; in design-ui: component re-render). Self-rated success in isolation is no longer a valid termination state for visual-output skills.

## Skip conditions (extremely rare)

- Skill produces no visible artifact (e.g. internal tool config, server-side schema) — N/A.
- Skill produces multi-stage flow that requires auth (`signup`, `paywalls`) — capture each step's first-impression render at minimum, even if full flow requires test account.

There are no skip conditions for skills that produce a single deployed visual artifact. The screenshots are mandatory.
