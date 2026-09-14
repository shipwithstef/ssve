# Framework Evolution — 2026-04-13: Visual Coverage Completeness + Exploratory Comprehension

## Method

Read: `FRAMEWORK-STATE.md` (analysis history — visual lifecycle already fixed, review mode
already exists), `track-visuals/SKILL.md` (full — diff mode lines 153-208, review mode
lines 262-308, baseline mode lines 69-150), `references/knowledge/gsd/details/agents.md:56`
(GSD ui-auditor 6-pillar scoring), `references/knowledge/gstack/details/review-system.md:50-57`
(gstack design checklist), `references/knowledge/gstack/details/skills-catalog.md:45-48`
(plan-design-review 0-10 scoring), `references/skill-pack-comparison.md:31` (Design Review
gap row).

Evidence from WI-032 (Example Marketplace dark mode): 71 pages in app, 37 desktop-only screenshots
captured, 0 mobile, 0 tablet. Post-fix re-capture: only 9 of 37 screens. Blast radius
of dark mode = global (all screens × all viewports), but the skill had no mechanism to
determine this or enforce complete coverage.

## Findings (by priority)

### P0 — Fix now (blocks quality)

None.

### P1 — Fix soon (degrades quality)

#### 1. Diff mode has no blast-radius awareness — accepts incomplete capture silently

**Category:** Gap

**Evidence:** `track-visuals/SKILL.md:157` — diff mode Step 1 says "Use the same inventory
from the baseline manifest." If the baseline manifest has 37 desktop-only entries for a
71-page app, diff mode silently captures 37 screenshots and calls it done. For global
changes (dark mode, CSS variables, layout wrapper, theme tokens), this misses half the app
and all non-desktop viewports.

WI-032 real data:
- 71 `.jsx` page files in `src/pages/`
- 37 desktop screenshots captured in `.svc/visuals/WI-032/current-state/`
- 0 mobile screenshots, 0 tablet screenshots
- 9 post-fix re-captures (vs 37 that needed validation)

The skill has no step that asks: "Given this specific change, what's the actual blast radius?"

**Fix: Add Step 0 (Coverage Determination) to Diff Mode**

Insert before current Step 1 in diff mode (`track-visuals/SKILL.md:157`):

```markdown
**Step 0: Determine capture scope (blast radius)**

Before re-capturing, classify the change's visual blast radius:

| Blast radius | Trigger | Capture scope |
|-------------|---------|---------------|
| `global` | Theme change, CSS variables, layout wrapper, dark/light mode, base typography | ALL screens × ALL viewports (desktop + mobile + tablet if distinct) |
| `component` | Shared component modification (nav, sidebar, card, modal) | All screens using that component × all viewports |
| `route` | Single page or feature change | Affected routes only × all viewports |

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
```

Also add a **self-verify check** for coverage completeness:

```markdown
| 6 | Capture coverage complete | For global blast radius: captured count ≥ app page count × required viewport count. For component/route: captured count matches affected set. |
```

---

#### 2. Review mode has no exploratory comprehension — only checks against known concerns

**Category:** Gap (confirmed by comparison delta — gstack and GSD both have this)

**Evidence:** `track-visuals/SKILL.md:288-293` — review mode concern checklist has 4 types:
`dark mode completeness`, `color contrast`, `layout regression`, `general`. All are
**AC-driven** — they check against known issue categories. None ask "does this page look
like a polished product?" or surface problems outside any AC.

WI-032 experience: the review mode found issues matching the AC (dark mode gaps), but
couldn't flag things like "this modal looks weird regardless of dark mode" or "this layout
feels unfinished" — findings that are real bugs but outside the stated concern.

Comparative evidence:
- **GSD** `gsd-ui-auditor` (`references/knowledge/gsd/details/agents.md:56`): 6-pillar
  visual audit scored 1-4: Copywriting, Visuals, Color, Typography, Spacing, Experience Design
- **gstack** `plan-design-review` (`references/knowledge/gstack/details/skills-catalog.md:45-48`):
  rates each design dimension 0-10, explains what a 10 looks like
- **gstack** design checklist (`references/knowledge/gstack/details/review-system.md:50-57`):
  5 categories: AI Slop Detection, Typography, Spacing & Layout, Interaction States, DESIGN.md Violations
- **svc** `references/skill-pack-comparison.md:31`: Design Review row shows "— gap —"

**Fix: Add `comprehension` concern type to Review Mode**

Add to the concern checklist table (`track-visuals/SKILL.md:288`):

```markdown
| `comprehension` | Holistic page quality audit — rate each page across 6 dimensions (see scoring rubric below). Flag anything that looks unfinished, inconsistent, or broken regardless of whether it's in any AC. This is exploratory — you're looking for what the ACs missed. |
```

Add a **Comprehension Scoring Rubric** section after the concern checklist table:

```markdown
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

| Dimension | Score | Notes |
|-----------|-------|-------|
| Copywriting | 3 | "Save" button could say "Save changes" |
| Visual hierarchy | 2 | Two CTAs compete — primary not obvious |
| ... | ... | ... |
| **Overall** | **2.7** | |

**Additional findings (outside ACs):**
- "The modal backdrop doesn't dim enough — content behind is distracting"
- "Empty state shows raw 'No data' instead of illustration + CTA"

These findings are logged alongside the scored dimensions. Any finding with
severity `high` or `critical` should be filed as a WI regardless of whether
it matches an existing AC.

**AI slop detection** (adapted from gstack `review/design-checklist.md`):

Flag and auto-tag with `[AI-SLOP]` if you detect:
- Generic gradient backgrounds with no brand relationship
- Stock/placeholder icons that don't match the icon system
- Meaningless decorative animations
- Overly corporate/generic copy ("Streamline your workflow", "Unlock the power of...")
- Symmetric layouts that look auto-generated rather than designed
```

---

#### 3. Visual capture scope is page-only — misses journey transitions and AC-specific states

**Category:** Gap

**Evidence:**
- `track-visuals/SKILL.md:76-87` — baseline mode Step 1 builds inventory from "every distinct
  screen and state" but the example table lists routes only: `/dashboard`, `/profile`, `/login`,
  `/settings`. No mention of mid-journey states (modal open, form half-filled, toast visible,
  confirmation dialog, multi-step wizard at step 3).
- `test-journeys/SKILL.md:199-201` — captures screenshots per AC verification, but these go to
  `docs/specs/features/test-evidence/` as disposable evidence, not into the visual tracking system.
- For global changes (dark mode), every journey step at every state transition needs visual
  validation — not just the route endpoints. A login page with an error toast in dark mode is
  a different visual state than login at rest.

Real WI-032 gap: 37 route-endpoint screenshots were captured but zero transition-state
screenshots (no modals, no toasts, no form validation states, no loading skeletons).

**Fix: Journey-driven capture inventory + test-journeys integration**

**A. Expand the screen inventory model** (`track-visuals/SKILL.md:76-87`):

Add a second inventory source — journey steps — alongside the existing route-based inventory:

```markdown
**Step 1: Build the screen inventory**

Two sources feed the inventory:

**Source A: Route endpoints** — from UX design + UI design, list every distinct route:

| Screen | States | Route/URL | Source |
|--------|--------|-----------|--------|
| Dashboard | empty, populated | /dashboard | UX doc |

**Source B: Journey transition states** — from journey docs (`J*.feature.md`),
extract every visual state that a user passes through:

| Journey | Step | Visual state | Route/URL | Source |
|---------|------|-------------|-----------|--------|
| J01 Login | Step 3 | Error toast visible | /login | J01.feature.md |
| J05 Checkout | Step 2 | Confirmation modal open | /checkout | J05.feature.md |
| J08 Schedule | Step 4 | Loading skeleton | /schedule | J08.feature.md |

For global blast radius changes, BOTH sources must be captured.
For route/component changes, Source A may be sufficient — use judgment.
```

**B. test-journeys screenshot handoff** — add to `test-journeys/SKILL.md` after line 201:

```markdown
**Visual tracking handoff:** When `track-visuals` is active for the same WI
(diff or baseline mode), journey screenshots captured during QA should be saved
to the WI working directory (`.svc/visuals/<WI>/`) in addition to
`test-evidence/`. This avoids re-capturing the same states twice. Use naming
convention: `<JourneyID>-step<N>-<state>-<viewport>.png`.
```

**C. Individual AC states** — some ACs define visual states that aren't part of any journey
(e.g., "empty state shows illustration" or "error boundary catches crashes gracefully").
These are captured as part of the route inventory's state column, not as journey steps.
The existing model handles this if the state column is populated from ACs as well as
UX docs.

---

### P2 — Improve when possible (nice to have)

None.

### P3 — Track (not actionable yet)

#### 4. No post-fix re-capture enforcement

**Evidence:** WI-032 post-fix directory had 9 screenshots vs 37 pre-fix. After applying
dark mode fixes, only the 7 pages that had been flagged as broken were re-captured — the
other 30 pages (which could have regressed) were not re-checked.

This is partially addressed by Finding #1's coverage check, but a specific "post-fix
must re-capture the same set as pre-fix" rule could be added. Deferring because the
blast-radius Step 0 + coverage self-verify should catch the most egregious cases.

---

## Comparison delta

| Capability | svc (current) | gstack | GSD | Gap? |
|-----------|--------------|--------|-----|------|
| Blast-radius awareness | None — uses stale manifest | Not explicit but design-review captures all routes | Not explicit | **Yes — Finding #1** |
| Viewport-sequential workflow | Not documented | browse responsive captures all 3 | Not documented | **Yes — Finding #1** |
| Exploratory visual scoring | None | 0-10 per dimension (plan-design-review) | 1-4 per 6 pillars (ui-auditor) | **Yes — Finding #2** |
| AI slop detection | AP-17 blacklist (text only) | Design checklist category | Not documented | **Partial — Finding #2 adds visual slop** |
| AC-driven visual review | review mode (4 concerns) | Not structured this way | Not structured this way | No gap |
| Journey-state visual capture | Not integrated — test-journeys evidence is disposable | browse + journey-driven capture | UI-phase captures journey steps | **Yes — Finding #3** |

## Stale proposal audit

- `proposals/2026-04-12-framework-improvement-blend-last30days.md` — still pending, unrelated to this proposal
- All visual-related proposals already in `done/`
