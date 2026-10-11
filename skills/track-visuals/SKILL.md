---
name: track-visuals
version: "1.0"
description: >
  Capture and diff screenshots of every screen across viewports against a visual baseline.
  Use for 'visual baseline', 'screenshot all screens', 'visual regression', 'what changed
  visually', or after design-ui and UI-affecting changes.
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
    brownfield-feature: { position: 10, prev: landing-page, next: design-tech }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Visual Tracker

Capture complete visual state of the app and track changes over time.
Visual regression testing integrated into the pipeline.

## Hard rule — multi-viewport capture (added 2026-04-20 per F-003)

Any component that can render at a non-design viewport size (embedded cards, responsive containers, aspect-ratio frames, modals, drawers) is captured **at every size it actually ships at**, not only at its design-canvas size. Scoring and AI-vision analysis run **independently per viewport**. If a component scores acceptable at 1600×900 but fails at 600×338, that's a FAIL for the component — not a pass with a footnote.

The Storyboard-hero regression that triggered this rule: component designed at 1600×900, reviewed only at that size, deployed at ~600×338 embedded, legibility destroyed (text 62.5% smaller, characters 30×52 unreadable). No alarm fired, which is why every viewport actually in use is asserted.

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

DOM-presence checks ("the button is in the DOM") are perceptually blind: they pass while a button is half-hidden behind a fixed bottom nav or sitting under the phone's home indicator. And headless Chromium reports `env(safe-area-inset-bottom)=0`, so a fixed nav never grows and these bugs are invisible to a normal render. Four shipped to users this way — a Sample FAB clipped by the tab bar, a logout under the gesture bar, a FAB that vanished on scroll, a hero clipped at 390px — each caught by a human testing on-device, not by any gate.

**Rule:** any browser-visible change to an app screen with fixed/sticky chrome (bottom tab bar, sticky header, FAB) — or any screen a mobile user reaches — passes the `mobile-occlusion` gate at a real phone viewport with the device safe-area emulated:

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
After promotion (or WI close without visual changes), only screenshot files
(`.png/.jpg/.webp`) are deleted — review reports, manifests, and analysis logs
are retained for platform improvement and cross-WI analysis.

## Process

### Baseline Mode

**Baseline Mode** — Run after `design-ui` produces the first visual design, or when onboarding a brownfield project. Step 0 (WI/feature impact scan) runs before building the inventory: read the WI and linked feature spec, mine `docs/specs/journeys/J*.feature.md` for modal/toast/form/loading/empty transition states, check existing E2E coverage, map affected shared components, read the Production-Derived Mock Parity Ledger when UI work modifies an existing component (if required but missing, stop and route back to `design-ui`), and log a pre-flight checklist. Step 1 builds the inventory from Source A (routes from UX/UI docs) plus Source B (transition states, required whenever journey docs or shared-component ACs exist). Step 2 captures each screen and state at desktop 1280, tablet 768 and mobile 375, with a browse-daemon pre-flight before any capture (fall back to Playwright MCP only if it fails, with a warning). Step 3 saves `docs/specs/visuals/baseline/manifest.md`. Details: `references/baseline-mode.md`.

**Read the Production-Derived Mock Parity Ledger** when UI work modifies an
existing component/screen or when `design-ui` produced
`docs/specs/ui/<feature>-mock-parity-ledger.md`. Extract the affected component,
production source paths, current-state evidence, intended final-state evidence,
affected usages/routes, spec ACs, journeys, required states, viewports, and
known exclusions. If the ledger is required but missing, stop and route back to
`design-ui` before capturing; Source A route listing cannot substitute for this
component-level evidence.

### Diff Mode

Run after code changes to detect visual regressions.

**Step 0: Determine capture scope (blast radius)**

Before re-capturing, classify the change's visual blast radius:

| Blast radius | Trigger | Capture scope |
|-------------|---------|---------------|
| `global` | Theme change, CSS variables, layout wrapper, dark/light mode, base typography | ALL screens × ALL viewports (desktop + mobile + tablet if distinct) |
| `component` | Shared component modification (nav, sidebar, card, modal) | All screens using that component × all viewports |
| `route` | Single page or feature change | Affected routes only × all viewports |

For `component` blast radius, derive the capture scope from the
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

**Review Mode** — Analyze already-captured screenshots (`screenshots_dir`, `concern`, `exclusions` from the caller) for one visual concern; no re-capture, no baseline comparison. Read the dir's `manifest.md`, turn the concern (dark mode completeness, color contrast, layout regression, general, comprehension) into a checklist, and read every `.png` (no sampling, since one unread screenshot can hide the defect), skipping excluded items. Record file, area, problem, likely cause and severity (critical/high/low), tag generic gradients, stock icons or filler copy as `[AI-SLOP]`, and for `comprehension` score six dimensions 1-4 and file a WI for any high or critical finding even outside ACs. Save `.svc/visuals/<WI>/review-<concern-slug>-<date>.md`, then run `node scripts/verify-skill-contract.mjs artifact-family track-visuals --root .` and `visual-review-closeout`; the review is not complete until both pass. Details: `references/review-mode.md`.

### External-Anchor Mode

**External-Anchor Mode** — Capture a third-party landing page for `landing-page`'s reference bank, when an anchor lacks `hero.png`/`hero.webm` or its captures are over 12 months old. Given `url`, `sector` and `anchor`, use the browse pre-flight, capture a 1920x1080 hero PNG and a short scroll-cast WEBM into `references/landing-bank/<sector>/<anchor>/`, then update the sector `INDEX.md` row and the `pattern.md` Captured field. Return only file paths to the caller (not raw screenshots or DOM dumps, which flood the caller's context), and leave `docs/specs/visuals/` untouched. Details: `references/external-anchor-mode.md`.

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

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Follow `references/task-graph-chaining-protocol.md`: treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, mark this skill's task `completed` before leaving, then load the next runnable task's skill (marking it `in_progress`) or mark it `completed` with a skip reason. Mirror status to the host UI only from the parent session (Claude `TaskList`/`TaskUpdate`; Kimi `/task` observation; in Codex, mirror only the active step in `update_plan`); a subagent (`SVC_SUBAGENT=1`) leaves mirroring to the parent, because a failed mirror call silently drifts from the file.

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

Apply the task-graph protocol above, then:

Sidecar skill — upstream handoffs invoke it at visual checkpoints, but it does
not advance the chain itself. Suggest after UI design (baseline) and after
execution (diff).

## Post-Compaction Recovery

If context was compacted and you lost framework state, `.svc/lane-tasks-<WI>.json` is the sole source of truth: resume the first `in_progress` task (else the first `pending` task with blockers satisfied), re-load its skill with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and continue. Never ghost-complete: verify `skill_receipt` exists before marking any task complete. If `.svc/.checkpoint-<WI>.checkpoint.json` names a different `next_task`, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

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
