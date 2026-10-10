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
