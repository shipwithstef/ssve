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
