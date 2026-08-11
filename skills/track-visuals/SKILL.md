---
name: track-visuals
version: "1.0"
description: >
  Capture and track visual state of all screens. Creates a baseline after first
  UI design or brownfield onboarding, then diffs against it when code changes.
  Use when "capture visuals", "visual baseline", "screenshot all screens",
  "visual regression", "what changed visually", "track visual state", or
  automatically as a sidecar after design-ui (baseline) and after
  execute-changeset (diff) for browser-visible features. Also works
  standalone for periodic visual audits.
phases:
  - id: P1-ModeAndScopeSelection
    trigger: always
    reads: ["task request", "docs/specs/ux/<name>.md", "docs/specs/ui/<name>.md", "docs/specs/journeys/J*.feature.md"]
    writes: [".svc/track-visuals-scope.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ImpactInventoryPreflight
    trigger: always
    reads: ["docs/specs/work-items/<WI>.md", "docs/specs/features/<name>.md", "docs/specs/journeys/J*.feature.md", "E2E tests"]
    writes: [".svc/track-visuals-preflight.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ScreenStateInventory
    trigger: always
    reads: ["UX/UI docs", "journey transition states", "shared component map", "baseline manifest"]
    writes: ["docs/specs/visuals/baseline/manifest.md", ".svc/visuals/<WI>/manifest.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-BrowserAuthPreflight
    trigger: always
    reads: ["browse daemon status", "e2e/helpers/browse-auth.md", "fallback Playwright state"]
    writes: [".svc/track-visuals-browser-preflight.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-CaptureOrReviewExecution
    trigger: always
    reads: ["screen inventory", "target URLs", "screenshots_dir when review mode", "external anchor URL when applicable"]
    writes: ["docs/specs/visuals/baseline/", "docs/specs/visuals/diffs/", ".svc/visuals/<WI>/", "references/landing-bank/<sector>/<anchor>/"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-ReportAndContractValidation
    trigger: always
    reads: ["captured screenshots", "diff report", "review report", "scripts/verify-skill-contract.mjs"]
    writes: ["docs/specs/visuals/diffs/<date>-diff.md", ".svc/visuals/<WI>/review-*.md", ".svc/track-visuals-contract.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-SelfVerifyContinuation
    trigger: always
    reads: ["track-visuals artifacts", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
    - { path: "docs/specs/journeys/J*.feature.md", artifact: journey-docs }
outputs:
  produces:
    - { path: "docs/specs/visuals/baseline/", artifact: visual-baseline }
    - { path: "docs/specs/visuals/diffs/", artifact: visual-diff-report }
    - { path: ".svc/visuals/<WI>/review-*.md", artifact: visual-review-report }
    - { path: "references/landing-bank/<sector>/<anchor>/", artifact: external-anchor-capture, note: "external-anchor mode only — populates hero.png + hero.webm next to the anchor's pattern.md" }
chain:
  lanes:
    greenfield: { position: 14, prev: landing-page, next: design-tech }
    brownfield-feature: { position: 9, prev: landing-page, next: design-tech }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Visual Tracker

Capture complete visual state of the app and track changes over time.
Visual regression testing integrated into the pipeline.

## Hard rule — multi-viewport capture (added 2026-04-20 per F-003)

Any component that can render at a non-design viewport size (embedded cards, responsive containers, aspect-ratio frames, modals, drawers) MUST be captured **at every size it actually ships at**, not only at its design-canvas size. Scoring and AI-vision analysis run **independently per viewport**. If a component scores acceptable at 1600×900 but fails at 600×338, that's a FAIL for the component — not a pass with a footnote.

The Storyboard-hero regression that triggered this rule: component designed at 1600×900, reviewed only at that size, deployed at ~600×338 embedded, legibility destroyed (text 62.5% smaller, characters 30×52 unreadable). No alarm fired. Viewports actually in use MUST all be asserted.

**Required capture viewports (minimum):**
- Design-canvas size (whatever the source-of-truth specifies)
- Every production breakpoint the component renders at (1600, 1280, 1024, 768, 390 — prune the ones not used)
- Any explicit constrained-container case (e.g., embedded inside a 16:9 card at ≤ 600px)

**Per-viewport scoring:** emit a score per viewport. Aggregate passes only if every viewport passes.

This skill is a sidecar checkpoint, not a lifecycle state transition. The lane
declarations anchor the baseline checkpoint after `design-ui`; route-workflow
also invokes it again after `execute-changeset` for diff capture whenever the
feature has a visual surface.

**Announce at start:** "I'm using track-visuals to capture/compare visual state."

## Hard rule — mobile occlusion + safe-area gate (added 2026-07-11 per WI-SAMPLE-NAV-01)

DOM-presence checks ("the button is in the DOM") are perceptually blind: they pass while a button is half-hidden behind a fixed bottom nav or sitting under the phone's home indicator. And headless Chromium reports `env(safe-area-inset-bottom)=0`, so a fixed nav never grows and these bugs are **invisible** to a normal render. Four shipped to users this way — a Sample FAB clipped by the tab bar, a logout under the gesture bar, a FAB that vanished on scroll, a hero clipped at 390px — each caught by a human testing on-device, not by any gate.

**Rule:** any browser-visible change to an app screen with fixed/sticky chrome (bottom tab bar, sticky header, FAB) — or any screen a mobile user reaches — MUST pass the `mobile-occlusion` gate at a real phone viewport with the device safe-area emulated:

```bash
node scripts/browser-verify.mjs --url "<screen-url>" --wi <WI> \
  --check '{"type":"mobile-occlusion","viewport":{"width":390,"height":844},"safeAreaBottom":34}'
```

The check sets a real `env(safe-area-inset-bottom)` via CDP (`Emulation.setSafeAreaInsetsOverride`) so the page renders like a device, then fails if any interactive element is (a) occluded by fixed/sticky chrome or (b) inside the bottom gesture-bar / home-indicator zone. **Authenticated screens need a logged-in fixture** — the FAB and account controls won't render for an anonymous session (this is why the bugs escaped every existing test); pair with the seeded-customer session follow-up.

**Companion gates (same capture pass, per `rules/mobile-ui-verification-gate.md`):** for a mobile diff also run the `scroll-position` check (a page must open at the top, not inherit a shared container's scroll — the "Profile opens at the bottom" class) and the `screenshot-matches` perceptual diff (a DOM-presence assertion passed while a hero card was clipped). Run all of them against a **seeded logged-in session** via `--auth-state <storageState.json>` — an anonymous session never renders the customer FAB / account controls, which is why those bugs escaped every gate.

Self-tests + fixtures: `bash test-framework/evals/tier-1/validate-mobile-occlusion-gate.sh` and `validate-scroll-position-gate.sh` — fixtures under `test-framework/fixtures/{mobile-occlusion,scroll-position}/`.

## Modes

| Mode | When | What it does |
|------|------|-------------|
| `baseline` | After first UI design or brownfield onboarding | Captures screenshots of all screens/states |
| `diff` | After code changes | Re-captures, compares to baseline, reports changes |
| `update` | After verify-promotion G7 with intentional visual changes | Promotes WI screenshots to golden baseline, cleans up ephemeral files |
| `audit` | Periodic check | Compares current app to UI design docs |
| `review` | After any capture pass; analyze existing screenshots for a specific concern | AI-vision analysis of already-captured screenshots — reports issues ranked by severity |
| `external-anchor` | Capturing third-party landing pages for `landing-page`'s reference bank | Captures hero screenshot + scroll-cast of an external URL into `references/landing-bank/<sector>/<anchor>/` |

## Storage Convention

Visual screenshots follow a 4-state lifecycle: **CAPTURED → DIFFED → PROMOTED → CLEANED**.

| Purpose | Path | Lifecycle |
|---------|------|-----------|
| Golden baseline (canonical) | `docs/specs/visuals/baseline/` | Persistent. Updated only via promote step after G7. |
| Baseline manifest | `docs/specs/visuals/baseline/manifest.md` | Living doc. Per-screen `last_verified_by` + date. |
| Diff reports (audit trail) | `docs/specs/visuals/diffs/<date>/` | Persistent. Kept for regression archaeology. |
| WI working screenshots (ephemeral) | `.svc/visuals/<WI>/*.png` | Screenshot files deleted after promotion. |
| WI review reports & analysis (persistent) | `.svc/visuals/<WI>/*.md` | Kept permanently for platform improvement. |

`.svc/visuals/<WI>/` contains both screenshot files and analysis artifacts.
After promotion (or WI close without visual changes), **only screenshot files**
(`.png/.jpg/.webp`) are deleted — review reports, manifests, and analysis logs
are retained for platform improvement and cross-WI analysis.

## Process

### Baseline Mode

Run after `design-ui` produces the first visual design, or when
onboarding a brownfield project.

**Step 0: WI/Feature Impact Scan — MANDATORY BEFORE BUILDING INVENTORY**

This step costs ~2K tokens. Skipping it and going straight to page listing
produces an inventory that misses modals, toasts, form states, shared
components, and E2E gaps — the exact failure mode Source B was designed to prevent.

**If a WI is provided:** Read `docs/specs/work-items/<WI>.md` — extract all ACs and their resolution states.

**Read the linked feature spec** (e.g., `docs/specs/features/dark-mode.md`) — extract every user story and AC that defines a visual surface or shared-component behavior (navigation, modals, toasts, form inputs, overlays).

**Mine journey docs for transition states** — scan `docs/specs/journeys/J*.feature.md` and extract every step that mentions any of:
- modal, dialog, sheet, drawer, popup, overlay, confirmation
- toast, notification, alert, banner
- form input focused, filled, or error state
- loading skeleton, spinner, empty state illustration
- progress indicator, success/error screen

**Check E2E coverage** — what visual/dark-mode tests already exist? Which transition states are already exercised vs missing?

**Map affected shared components** — which shared components (navigation, `<Dialog>`, `<Toast>`, form inputs) are visually touched by the feature? These become mandatory Source B entries even if no journey mentions them explicitly.

**Read the Production-Derived Mock Parity Ledger** when UI work modifies an
existing component/screen or when `design-ui` produced
`docs/specs/ui/<feature>-mock-parity-ledger.md`. Extract the affected component,
production source paths, current-state evidence, intended final-state evidence,
affected usages/routes, spec ACs, journeys, required states, viewports, and
known exclusions. If the ledger is required but missing, stop and route back to
`design-ui` before capturing; Source A route listing cannot substitute for this
component-level evidence.

**Log the pre-flight checklist** before building the inventory:

```
Pre-flight for track-visuals (WI-032):
✅ Read WI-032.md — 7 ACs, DM-FIN-01 through DM-FIN-07
✅ Read dark-mode.md — DM-14/15/16/17 cover nav, modals, toasts, forms
✅ Mined 30 journey docs — found 11 transition states in J03, J04, J06, J13
✅ E2E check — dark-mode.nightly.spec.ts: class presence only; no transition screenshots
✅ Shared components: Navigation, ToastProvider, Dialog, Form inputs
✅ Mock parity ledger — Navigation current/final states, 4 routes, mobile+desktop
```

**Then proceed to Step 1.**

---

**Step 1: Build the screen inventory**

Two sources feed the inventory — Step 0 provides the raw material for both.

**Source A: Route endpoints** — from UX design + UI design, list every distinct route:

```markdown
| Screen | States | Route/URL | Source |
|--------|--------|-----------|--------|
| Dashboard | empty, loading, populated, error | /dashboard | UX doc |
| Profile | viewing, editing | /profile | UX doc |
| Login | default, error, loading | /login | Journey J01 |
| Settings | default, changed | /settings | UX doc |
```

**Source B: Transition State Inventory (required when journey docs or feature ACs exist)** — from Step 0's journey mining and shared component map:

```markdown
| Journey | Step | Visual state | Route/URL | Source |
|---------|------|-------------|-----------|--------|
| J01 Login | Step 3 | Error toast visible | /login | J01.feature.md |
| J05 Checkout | Step 2 | Confirmation modal open | /checkout | J05.feature.md |
| J08 Schedule | Step 4 | Loading skeleton | /schedule | J08.feature.md |
| — | — | Navigation sidebar dark | all auth pages | DM-14 |
| — | — | Form input focused state | /settings | DM-17 |
```

Source B is required whenever Step 0 found journey docs, feature ACs covering
shared components, or E2E gaps on transition states. "Source A alone is sufficient"
applies only to projects with no journey docs AND no feature spec with shared
component ACs.

Individual ACs that define visual states outside any journey (e.g., "empty state
shows illustration") are captured as part of Source A's state column.

**Step 2: Capture each screen + state**

**Browser pre-flight — MANDATORY before any capture:**

```bash
BROWSE="$HOME/gstack/browse/dist/browse"
if $BROWSE status 2>&1 | grep -q "Status: healthy"; then
  echo "✅ browse daemon ready — using gstack browse (low token cost, auth persists)"
  USE_BROWSE=true
else
  echo "⚠️  WARNING: browse daemon unavailable — falling back to Playwright MCP"
  echo "   Why this matters:"
  echo "   • Token cost: ~3-5x higher (MCP schema overhead per call vs plain Bash)"
  echo "   • Auth state: resets between commands — must re-login each capture run"
  echo "   • responsive command unavailable — must do 3 separate screenshot calls"
  echo "   Fix permanently: bash $(cd "$(dirname "$0")" && pwd)/scripts/install-browse.sh" # or bash <SKILLS_PATH>/scripts/install-browse.sh from the installed skills root
  USE_BROWSE=false
fi
```

**Auth bootstrap — run once before capturing authenticated screens:**

```bash
# Check for project auth helper
ls e2e/helpers/browse-auth.md 2>/dev/null && cat e2e/helpers/browse-auth.md
# If found: follow the role-specific login sequence
# If not found: login manually, then create browse-auth.md for next time
```

For each entry in the inventory, navigate to the screen and capture:

```bash
# Preferred: Browse tool (persistent daemon, lowest token cost)
# See references/browse-integration.md for setup
browse goto <url>
browse screenshot docs/specs/visuals/baseline/<screen>-<state>.png

# All 3 breakpoints in one command:
browse responsive docs/specs/visuals/baseline/<screen>-<state>
# → produces <prefix>-desktop.png (1280), <prefix>-tablet.png (768), <prefix>-mobile.png (375)

# Or manually per breakpoint:
browse viewport 1280x800  && browse screenshot <screen>-<state>-desktop.png
browse viewport 768x1024  && browse screenshot <screen>-<state>-tablet.png
browse viewport 375x812   && browse screenshot <screen>-<state>-mobile.png

# Fallback: Playwright MCP (ONLY when browse pre-flight FAILED — warning already logged)
# browser_navigate → <url>
# browser_resize → { width: 1280, height: 800 }
# browser_take_screenshot → <screen>-<state>-desktop.png
# (repeat for tablet and mobile — no responsive shortcut available)
```

For states that require setup (error state, empty state, populated state):
- Use the app's API or UI to create the state
- Document how to reproduce the state in the inventory

**Step 3: Save the baseline manifest**

```markdown
# Visual Baseline: <project name>

**Created:** <date>
**Screens:** <count>
**States:** <count>
**Breakpoints:** desktop (1280), tablet (768), mobile (375)

## Inventory

| Screen | State | Desktop | Tablet | Mobile | Last verified by | Last verified date |
|--------|-------|---------|--------|--------|-----------------|-------------------|
| Dashboard | empty | ✅ captured | ✅ | ✅ | (initial) | <date> |
| Dashboard | populated | ✅ captured | ✅ | ✅ | (initial) | <date> |
| ... | ... | ... | ... | ... | ... | ... |

## How to Reproduce States

### Empty state
<steps to get to empty state>

### Error state
<steps to trigger error>

### Populated state
<steps to create test data>
```

Save to `docs/specs/visuals/baseline/manifest.md`.

---

### Diff Mode

Run after code changes to detect visual regressions.

**Step 0: Determine capture scope (blast radius)**

Before re-capturing, classify the change's visual blast radius:

| Blast radius | Trigger | Capture scope |
|-------------|---------|---------------|
| `global` | Theme change, CSS variables, layout wrapper, dark/light mode, base typography | ALL screens × ALL viewports (desktop + mobile + tablet if distinct) |
| `component` | Shared component modification (nav, sidebar, card, modal) | All screens using that component × all viewports |
| `route` | Single page or feature change | Affected routes only × all viewports |

For `component` blast radius, the capture scope MUST be derived from the
Production-Derived Mock Parity Ledger when one exists or is required. Use the
ledger's affected usages/routes, required states, current-state evidence,
intended final-state evidence, and viewports as the minimum capture set. If the
ledger identifies a component usage not present in the baseline manifest, expand
the manifest before comparing. If no ledger exists for an existing-component
change, fail the diff pre-flight and route back to `design-ui`.

Then compare against the baseline manifest:
1. Count pages in the app (e.g., `ls src/pages/*.jsx | wc -l` or route config)
2. Count entries in `baseline/manifest.md`
3. If blast radius is `global` and manifest has fewer entries than app pages,
   the manifest is stale — expand it to cover all pages before capturing.
4. If blast radius is `global` and manifest has only one viewport (e.g., desktop-only),
   expand to include mobile (375px) at minimum.

**Viewport-sequential workflow (recommended for global changes):**

For global visual changes, work viewport-by-viewport:
1. Desktop pass — capture all, review, fix issues found
2. Mobile pass — capture all, review, fix mobile-specific issues
3. Tablet pass (if UX/UI contract defines distinct tablet layout) — capture, review, fix

This prevents interleaving viewport fixes and keeps the feedback loop tight.

**Step 1: Re-capture screens per blast radius**

Use the inventory determined by Step 0. For `global` blast radius, this is
the full app page set × required viewports. For `component`/`route`, use the
baseline manifest filtered to affected screens. Capture to a temp directory.

**Step 2: Compare**

For each screen + state + breakpoint:
- Compare new screenshot to baseline
- Report: UNCHANGED / CHANGED / NEW / MISSING

Visual comparison approach (in order of preference):
1. **Pixel diff** — if `pixelmatch` or similar tool is available
2. **AI vision comparison** — use Claude's multimodal capability to compare two screenshots
3. **Manual visual inspection** — present both side by side

**Step 3: Generate diff report**

```markdown
# Visual Diff Report

**Date:** <date>
**Baseline:** <baseline date>
**Branch:** <current branch>

## Summary
- Unchanged: <count>
- Changed: <count>
- New screens: <count>
- Missing screens: <count>

## Changes

### Dashboard (populated, desktop)
**Status:** CHANGED
**Baseline:** baseline/dashboard-populated-desktop.png
**Current:** diffs/<date>/dashboard-populated-desktop.png
**What changed:** <description of visual difference>
**Intentional?** ⬜ Yes / ⬜ No (needs investigation)

### Settings (default, mobile)
**Status:** CHANGED
...

## New Screens
<screens that exist now but weren't in the baseline>

## Missing Screens
<screens from baseline that no longer exist — routes removed?>
```

Save to `docs/specs/visuals/diffs/<date>-diff.md`.

---

### Update Mode (Promote + Cleanup)

Triggered by `verify-promotion` after G7 passes with intentional visual changes.
This is the only path that modifies the golden baseline.

**Step 1: Identify screens to promote**

From the diff report (`docs/specs/visuals/diffs/<date>-diff.md`), list all
CHANGED entries marked intentional.

**Step 2: Promote to golden baseline**

For each intentional change:
1. Copy the new screenshot from the WI working dir (or diff capture) to
   `docs/specs/visuals/baseline/`, replacing the old version.
2. Update `baseline/manifest.md`: set `last_verified_by: <WI-ID>` and
   `last_verified_date: <date>` on the affected row. Preserve unchanged rows.

For NEW screens (not in baseline):
1. Add the screenshot to baseline.
2. Add a new row to the manifest.

For MISSING screens (route removed):
1. Delete the screenshot from baseline.
2. Remove or mark the manifest row as `[REMOVED — <WI-ID>]`.

**Step 3: Cleanup screenshot files (preserve logs)**

Delete only `.png`/`.jpg`/`.webp` screenshot files from `.svc/visuals/<WI>/`
after promotion. Preserve all other files (review reports, manifests, analysis
logs) — these are needed for platform improvement and analysis.

**Step 4: Verify manifest consistency**

Count screenshots in `baseline/` vs rows in `manifest.md`. They must match.
If mismatch, report the discrepancy — do not auto-fix.

---

### Audit Mode

Compare current app visuals against UI design documents:

1. Load UI design docs (`docs/specs/ui/<name>.md`)
2. Extract expected component layouts, colors, spacing
3. Capture current app state
4. Compare: does the implementation match the design?
5. Report discrepancies: wrong colors, broken layout, missing components

---

### Review Mode

Analyze a set of **already-captured** screenshots for a specific visual correctness
concern. No re-capture. No baseline comparison. Pure AI-vision analysis.

Use when: screenshots exist and you need a structured issue report — dark mode
coverage check, contrast audit, post-design-pass verification, accessibility
color review.

**Inputs (all provided by the caller):**

```
screenshots_dir: .svc/visuals/<WI>/current-state/
concern: "dark mode completeness" | "color contrast" | "layout regression" | "general" | "comprehension"
exclusions: <list of things NOT to flag — justified deviations>
```

**Step 1: Read the manifest**

Check for `<screenshots_dir>/manifest.md`. If present, read it for coverage
context (which screens were captured, which were skipped and why).

**Step 2: Define the concern checklist**

Translate the concern into concrete things to look for in each screenshot:

| Concern | What to check |
|---------|--------------|
| `dark mode completeness` | White/light backgrounds that should be dark; dark text on dark bg (contrast fail); light text on light bg; mixed surfaces (card light while page dark); light-only borders/dividers; inputs/modals/dropdowns that missed dark tokens; any page appearing fully in light mode |
| `color contrast` | Text-on-background contrast ratio failures (WCAG AA: 4.5:1 normal, 3:1 large); low-contrast interactive states; disabled elements that are invisible rather than muted |
| `layout regression` | Elements overflowing containers; broken grid alignment; clipped or hidden content; components stacked when they should be side-by-side |
| `general` | All of the above — broad scan |
| `comprehension` | Holistic page quality audit — rate each page across 6 dimensions (see Comprehension Scoring Rubric below). Flag anything that looks unfinished, inconsistent, or broken regardless of whether it's in any AC. This is exploratory — you're looking for what the ACs missed. |

#### Comprehension Scoring Rubric

When concern is `comprehension`, score each screenshot on 6 dimensions (1-4 scale):

| Dimension | 1 (Poor) | 2 (Acceptable) | 3 (Good) | 4 (Polished) |
|-----------|----------|-----------------|----------|---------------|
| **Copywriting** | Placeholder text, lorem ipsum, grammatical errors, unclear labels | Functional but generic copy | Clear, purposeful copy | Compelling, brand-consistent copy |
| **Visual hierarchy** | No clear focus, elements compete equally | Primary action identifiable | Clear visual path, scannable | Effortless eye flow, intuitive grouping |
| **Color & contrast** | Clashing colors, unreadable text | Functional but bland or inconsistent | Cohesive palette, good contrast | Design-system consistent, purposeful accents |
| **Typography** | Inconsistent sizes, poor line height, font mismatches | Readable but unstyled hierarchy | Clear type scale, consistent fonts | Refined type ramp, balanced density |
| **Spacing & layout** | Cramped or swimming, inconsistent padding | Adequate but not intentional | Consistent, breathing room | Grid-aligned, every gap deliberate |
| **Experience design** | Missing states (loading, empty, error), dead ends | Happy path works, edge states rough | States handled, feedback present | Micro-interactions, smooth transitions, delightful details |

**Per-screenshot output:**

```markdown
| Dimension | Score | Notes |
|-----------|-------|-------|
| Copywriting | 3 | "Save" button could say "Save changes" |
| Visual hierarchy | 2 | Two CTAs compete — primary not obvious |
| Color & contrast | 3 | |
| Typography | 3 | |
| Spacing & layout | 2 | Card padding inconsistent with sidebar |
| Experience design | 2 | No loading skeleton, empty state shows raw "No data" |
| **Overall** | **2.5** | |

**Additional findings (outside ACs):**
- "The modal backdrop doesn't dim enough — content behind is distracting"
- "Empty state shows raw 'No data' instead of illustration + CTA"
```

These findings are logged alongside the scored dimensions. Any finding with
severity `high` or `critical` should be filed as a WI regardless of whether
it matches an existing AC.

**AI slop detection** (adapted from gstack `review/design-checklist.md`,
MIT, Copyright 2025 Garry Tan):

Flag and auto-tag with `[AI-SLOP]` if you detect:
- Generic gradient backgrounds with no brand relationship
- Stock/placeholder icons that don't match the icon system
- Meaningless decorative animations
- Overly corporate/generic copy ("Streamline your workflow", "Unlock the power of...")
- Symmetric layouts that look auto-generated rather than designed

**Step 3: Read and analyze each screenshot**

For each `.png` file in the directory:
1. Read the image with the Read tool (multimodal)
2. Apply the concern checklist — for most concerns, check only checklist items.
   For `comprehension`, apply the scoring rubric AND flag anything unexpected —
   this is the one concern where exploratory findings outside the checklist
   are expected and desired.
3. Skip anything in the `exclusions` list without flagging it
4. For each issue found, record:
   - `file`: screenshot filename
   - `area`: which element or region has the problem
   - `problem`: what the problem is (specific and concrete)
   - `likely_cause`: missed class swap / inline style / hardcoded color / dark variant missing
   - `severity`: `critical` (feature unusable) / `high` (clearly wrong, obvious) / `low` (minor contrast gap, subtle)

Work through ALL files. Do not skip or sample.

**Step 4: Generate the review report**

```markdown
# Visual Review Report: <concern>

**Date:** <date>
**Screenshots dir:** <path>
**Files reviewed:** <count>
**Exclusions applied:** <list>

## Issues Found

### Critical

| File | Area | Problem | Likely cause |
|------|------|---------|--------------|
| ... | ... | ... | ... |

### High

| File | Area | Problem | Likely cause |
|------|------|---------|--------------|

### Low

| File | Area | Problem | Likely cause |
|------|------|---------|--------------|

## Clean Screenshots

<count> screenshots had no issues: <comma-separated filenames>

## Summary

- Critical: <n>
- High: <n>
- Low: <n>
- Total issues: <n>
- Clean: <n> / <total>
```

Save to `.svc/visuals/<WI>/review-<concern-slug>-<date>.md`.

**Step 5: Validate close-out before claiming review complete**

Run the shared contract validator after writing the report:

```bash
node scripts/verify-skill-contract.mjs artifact-family track-visuals --root .
node scripts/verify-skill-contract.mjs visual-review-closeout \
  --report .svc/visuals/<WI>/review-<concern-slug>-<date>.md \
  --screenshots-dir .svc/visuals/<WI>/current-state/
```

If either check fails, the review is not complete. Fix the report counts or the
artifact path before summarizing the result to the user.

**Comprehension report additions:** When concern is `comprehension`, add these
sections to the report after the issues table:

```markdown
## Comprehension Scores

### Per-Screenshot Scores

| Screenshot | Copy | Hierarchy | Color | Type | Spacing | XD | Overall |
|-----------|------|-----------|-------|------|---------|-----|---------|
| Dashboard-desktop | 3 | 3 | 3 | 3 | 2 | 2 | 2.7 |
| Login-desktop | 3 | 4 | 3 | 3 | 3 | 2 | 3.0 |
| ... | ... | ... | ... | ... | ... | ... | ... |

### Aggregate

| Dimension | Mean | Min | Max |
|-----------|------|-----|-----|
| Copywriting | 2.8 | 1 | 4 |
| Visual hierarchy | 3.1 | 2 | 4 |
| Color & contrast | 3.0 | 2 | 4 |
| Typography | 2.9 | 2 | 3 |
| Spacing & layout | 2.5 | 1 | 4 |
| Experience design | 2.3 | 1 | 3 |
| **Overall** | **2.8** | **1.7** | **3.3** |

### Bottom 5 (needs attention)

1. Settings-mobile — 1.7 (spacing: 1, XD: 1)
2. ...

### AI Slop Findings

| Screenshot | Finding | Tag |
|-----------|---------|-----|
| About-desktop | Generic gradient hero with no brand connection | [AI-SLOP] |
```

**What this mode is NOT:**
- It does NOT re-capture screenshots (use `baseline` or `diff` for that)
- It does NOT compare to a baseline (use `diff` for that)
- It does NOT update any baseline
- It does NOT require a running app

---

### External-Anchor Mode

Capture a third-party landing page for `landing-page`'s reference bank. Different from `baseline` mode in three ways: (1) the URL is external, not the project's own pages; (2) output path is `references/landing-bank/<sector>/<anchor-slug>/` not `docs/specs/visuals/`; (3) only captures the **hero** PNG + a short **scroll-cast** WEBM, not full inventory.

**When to use:**
- A `landing-page` invocation needs an anchor for a sector that has a `pattern.md` but missing `hero.png`/`hero.webm`
- Refreshing an anchor whose binary captures are stale (>12mo per `validate-landing-page-freshness.sh`)

**Inputs (caller provides):**
- `url` — the page to capture (e.g., `https://pos.toasttab.com`)
- `sector` — kebab-case slug from `references/landing-bank/<sector>/INDEX.md`
- `anchor` — kebab-case slug from the same INDEX.md table

**Step 1: Browser pre-flight** (same as Baseline Mode Step 2 pre-flight — prefer `browse` daemon over Playwright MCP for token efficiency)

**Step 2: Hero PNG capture (1920×1080 above-fold)**

```bash
# Preferred: browse
browse goto "<url>"
browse viewport 1920x1080
browse screenshot "references/landing-bank/<sector>/<anchor>/hero.png"

# Fallback: Playwright MCP (only when browse unavailable)
# browser_navigate → <url>
# browser_resize → { width: 1920, height: 1080 }
# browser_take_screenshot → references/landing-bank/<sector>/<anchor>/hero.png
```

**Step 3: Scroll-cast WEBM (5-10s, captures motion + first 2 screens)**

```bash
# browse offers scroll-cast natively if available; otherwise puppeteer-recorder
npx puppeteer-recorder "<url>" "references/landing-bank/<sector>/<anchor>/hero.webm" \
  --duration=8 --scroll-from=0 --scroll-to=200vh
```

If neither is available, set `hero.webm` as TODO in `pattern.md` and note WEBM capture as deferred.

**Step 4: Update INDEX.md row**

In `references/landing-bank/<sector>/INDEX.md`, mark the anchor row's binary capture status from TODO → captured `<date>`. Existing `pattern.md` content is left untouched.

**Step 5: Update `pattern.md` Captured field**

Edit `references/landing-bank/<sector>/<anchor>/pattern.md`:
- Change `**Captured:** YYYY-MM-DD (pattern.md only; hero.png/.webm TODO-capture)` to `**Captured:** YYYY-MM-DD (binary captures fresh)`

**Output contract** — return ONLY the file paths to the caller; do NOT return raw screenshots, DOM dumps, or page text. Per `references/browser-verify-doctrine.md`, raw page-sized payloads in stdout burn parent-orchestrator tokens fast.

**What this mode is NOT:**
- It does NOT modify the `docs/specs/visuals/` baseline (that's project-owned UI)
- It does NOT update or compare any baseline
- It does NOT analyze the captured page (that's `pattern.md`'s job, manual)
- It does NOT validate page health (LCP, CLS, etc.)

---

## Integration Points

| Trigger | Mode | Automatic? |
|---------|------|-----------|
| After `design-ui` | baseline | Via `design-ui` handoff for browser-visible features |
| After `execute-changeset` | diff | Via `execute-changeset` handoff when baseline exists |
| After `verify-promotion` G7 (intentional visual changes) | update (promote + cleanup) | Triggered by verify-promotion |
| Periodic / on-demand | audit | Manual |
| Screenshots exist, need correctness check | review | Manual — invoke with dir + concern + exclusions |
| `landing-page` needs anchor binaries OR freshness validator flagged stale anchor | external-anchor | Manual — invoke with url + sector + anchor |

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `track-visuals` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeAndScopeSelection --evidence command_output:.svc/track-visuals-scope.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ImpactInventoryPreflight --evidence command_output:.svc/track-visuals-preflight.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ScreenStateInventory --evidence file:.svc/visuals/<WI>/manifest.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-BrowserAuthPreflight --evidence command_output:.svc/track-visuals-browser-preflight.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-CaptureOrReviewExecution --evidence file:.svc/visuals/<WI>/
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ReportAndContractValidation --evidence command_output:.svc/track-visuals-contract.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/track-visuals-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Baseline or diff report exists | `test -d docs/specs/visuals/` | |
| 2 | All screens in inventory captured | count captured vs inventory | |
| 3 | Diff report flags all changes | no CHANGED without description | |
| 4 | (review mode) All files in dir processed | count reviewed == count in dir | |
| 5 | (review mode) Report saved to logs | `test -f .svc/visuals/.../review-*.md` | |
| 6 | (diff mode) Capture coverage complete | For `global` blast radius: captured count ≥ app page count × required viewport count. For `component`/`route`: captured count matches affected set. | |
| 7 | (baseline/diff mode) Step 0 pre-flight logged | Pre-flight checklist exists in output before first screenshot — WI spec read, feature spec read, journeys mined, E2E checked, shared components mapped. Skip justified if applicable: log skip reason in lane-tasks JSON when no WI, no feature spec, and no journey docs exist. | |
| 8 | Declared track-visuals artifact family emitted | `node scripts/verify-skill-contract.mjs artifact-family track-visuals --root .` passes; explicit track-visuals invocation cannot complete with only ad-hoc notes outside the declared output families. | |
| 9 | (review mode) Report totals reconcile | `node scripts/verify-skill-contract.mjs visual-review-closeout --report .svc/visuals/<WI>/review-<concern-slug>-<date>.md --screenshots-dir .svc/visuals/<WI>/current-state/` passes. | |
| 10 | (existing-component UI work) Mock parity ledger covered | Production-Derived Mock Parity Ledger read; capture scope covers affected component, all usages/routes, states, viewports, current-state evidence, and intended final-state evidence, or the task routes back to `design-ui` before capture. | |

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

Sidecar skill — upstream handoffs invoke it at visual checkpoints, but it does
not advance the chain itself. Suggest after UI design (baseline) and after
execution (diff).

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

## Feature Validation Ledger Handoff

When `feature_validation_closeout` is required, emit saved-state and visual
evidence in a row-oriented form that can be referenced by
`FEATURE_VALIDATION_LEDGER.md`:

| AC ID | Visual/saved-state evidence | Result | Notes |
|---|---|---|---|
| `<AC-ID>` | `.svc/visuals/<WI>/current-state/<file>.png` | `PASS|FAIL|BLOCKED` | `<viewport/state>` |

Each visual or rendering AC must have screenshot or `track-visuals` evidence.
If visual capture is impossible, file or link the WI that owns the gap before
the feature ledger can classify as `framework-complete`.

## Provider Fidelity Handoff

For generated visual deliverables, review mode must emit rows that can satisfy
`PROVIDER_FIDELITY_EVIDENCE.md`:

| Field | Required visual review result |
|---|---|
| `image_source` | Provider output id, URL, log path, or artifact path for the generated image. |
| `provider_used` | Provider actually used; do not infer from UI labels. |
| `semantic_relevance_result` | PASS only when the saved image matches the requested subject. |
| `visual_quality_result` | PASS only when the image is product-quality, not placeholder or generated filler. |
| `saved_state_verified` | PASS only when the image is visible after save/return, not just in draft preview. |

If the image came from fallback, upload, placeholder, mock, or a different
provider, report FAIL/BLOCKED unless explicit fallback approval is linked.

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
