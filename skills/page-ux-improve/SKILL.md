---
name: page-ux-improve
version: "1.0"
live-evidence: not-applicable (proposal + optional illustrative mock; does not ship a product surface)
description: >
  Use when a founder names one existing product PAGE or route and wants it to
  look better against competitor pages that do the same job — “improve this
  page”, “make /home look better”, “page UX vs competitors”, “competitor look
  for Idea Overview”, “HoursHub /home look”, “Novisenti Idea Overview polish”,
  “find competitor pages for this route”, “how should this screen look”.
  Captures that page (light/dark, 375/1280), finds 5–8 equivalent competitor
  PAGES, extracts look techniques, and proposes 5–10 cited page-scoped
  improvements. Not explore-ux (whole-flow + required competitor KB). Not
  propose-ux-improvements (one region, no competitor hunt). Not
  benchmark-landing (marketing landing only). Not track-visuals (regression).
  Not diagnose-bug. Does not auto-implement.
phases:
  - { id: P1-PageScopeAndCapture, trigger: always, reads: ["named route/page", "live or local preview"], writes: [".svc/page-ux/<run-id>/", "docs/specs/page-ux/<page-slug>-<date>.md"], evidence_kind: screenshot, required_for_completion: true }
  - { id: P2-SameJobCompetitorPages, trigger: always, reads: ["page job", "web search / live browse", "optional competitor KB"], writes: ["docs/specs/page-ux/<page-slug>-<date>.md"], evidence_kind: file, required_for_completion: true }
  - { id: P3-LookTechniquesAndProposals, trigger: always, reads: ["our captures", "competitor page evidence"], writes: ["docs/specs/page-ux/<page-slug>-<date>.md"], evidence_kind: file, required_for_completion: true }
  - { id: P4-OptionalAfterMock, trigger: visual-change-proposed, reads: ["before captures", "selected look techniques"], writes: ["docs/specs/page-ux/<page-slug>-<date>-after.html"], evidence_kind: file, required_for_completion: false }
  - { id: P5-RouteAdviceSelfVerify, trigger: always, reads: ["proposal"], writes: [".svc/page-ux/<run-id>/self-verify.log"], evidence_kind: command_output, required_for_completion: true }
inputs:
  required:
    - { artifact: named-page, note: "One existing route or page (e.g. /home, Idea Overview)" }
  optional:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
    - { path: "references/knowledge/competitors/<slug>/CAPABILITIES.md", artifact: competitor-knowledge-base }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/page-ux/<page-slug>-<date>.md", artifact: page-ux-proposal }
    - { path: "docs/specs/page-ux/<page-slug>-<date>-after.html", artifact: illustrative-after-mock, note: "optional; visual proposals only" }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Improve one product page against competitor pages

**Announce at start:** "I'm using page-ux-improve to capture this page, find same-job competitor pages, and propose look changes for that page only."

This skill is a **proposal**. It does not edit product CSS, does not open a WI, and does not invoke `execute-changeset` or `write-spec` unless the owner later accepts the routing advice.

## When this is the wrong skill

| Ask | Use instead |
|-----|-------------|
| Whole-app or multi-step **flow** vs competitors (onboarding steps, time-to-value) | `explore-ux` |
| One **region or control** (“is this chip redundant”) | `propose-ux-improvements` |
| Marketing **landing** score vs sector bank | `benchmark-landing` |
| Visual **regression** / baseline / comprehension rubric | `track-visuals` |
| Control is **broken** | `diagnose-bug` |
| New feature visual design | `design-ui` |

`explore-ux` requires a populated competitor KB and landing-bank and will halt without them. This skill **must not** halt for that. Reuse KB notes when they name the **same page job**; still hunt live same-job pages. Company homepages are not substitutes for in-app pages.

## Grain

One **page** = one route or named screen the user already reaches (HoursHub `/home`, Novisenti Idea Overview, settings, owner dashboard). Not the whole product. Not a single button. Not a marketing hero unless that hero *is* the named page.

## Process

### P1 — Scope and capture

Resolve:

```markdown
| Field | Value |
|-------|-------|
| Product | |
| Page / route | |
| User job on this page | one sentence |
| Preview URL | live or owner-authorized local |
| Auth | anonymous / seeded role (name it) |
```

Ask only if the **page** is ambiguous. Do not expand to adjacent routes.

Capture **four** stills of the current page into `.svc/page-ux/<run-id>/`:

| File | Viewport | Theme |
|------|----------|-------|
| `ours-375-light.png` | 375×812 | light |
| `ours-375-dark.png` | 375×812 | dark |
| `ours-1280-light.png` | 1280×800 | light |
| `ours-1280-dark.png` | 1280×800 | dark |

Prefer project browse/auth helpers (`e2e/helpers/browse-auth.md`, `track-visuals` capture conventions). Do not log in or change access without authorization. If capture is impossible, write `evidence-needed` with the exact missing observation and stop — do not invent screenshots.

Record route, viewport, theme, state (empty/populated), date, and provenance in the report.

### P2 — Same-job competitor pages (5–8)

Name the **job**, then search for pages that perform that job.

| Our page (example) | Job | Valid competitor page | Invalid |
|--------------------|-----|----------------------|---------|
| HoursHub `/home` | owner sees today’s hours / who is in | Deputy dashboard, When I Work home, Homebase today | Deputy marketing homepage |
| Novisenti Idea Overview | decide proceed/kill on one idea with evidence | Linear issue view, Productboard insight, Coda doc home | Linear.com marketing |

Find **5–8** pages. For each record URL, job match (one line), and at least one capture or cited screenshot/docs image. Prefer live browse; if a page is behind auth, use public product tours, docs screenshots, or app-store shots and label provenance. Fewer than 5 is a FAIL unless the market is honestly thin — then say so and still cite every page found.

Do not pad with homepages, Dribbble shots, or “SaaS dashboard inspiration” unrelated to the job.

### P3 — Look techniques and proposals

Extract techniques **from the competitor pages**, not generic UX slogans:

| Lens | What to write |
|------|----------------|
| **Type** | Family, scale, weight contrast, measure. Ban Inter/Poppins as “the fix” unless the product already uses them. |
| **Density** | Information per viewport; grouping; whitespace that carries hierarchy vs emptiness. |
| **Hierarchy** | What the eye hits first; primary action; what recedes. |
| **Empty states** | Illustration vs CTA vs honest zero; first action. |
| **Chrome** | Header, nav, tabs, page title, persistent actions — how the page sits in the shell. |

Score the **page** (not the company) 1–4 per lens against the best cited competitor page. Every score cites a URL.

Propose **5–10** improvements. Each row:

```markdown
### P<n>: <title>

- **Page element:** (hero, list, empty state, chrome, type ramp, …)
- **Current:** observed (cite our capture)
- **Technique:** (type / density / hierarchy / empty / chrome)
- **Citation:** <competitor page URL> — <what they do>
- **Change:** implementable on THIS page
- **Class:** css-token | structural
- **Suggested next:** execute-changeset | write-spec
```

`css-token` = color, type, spacing, density, copy, empty-state treatment using existing components.  
`structural` = new regions, new states, chrome redesign, new components, information architecture.

Forbidden proposals: “be more like Linear”; restyling the whole app; landing-page motion; changing product mechanics; HoursHub copy on Novisenti or the reverse.

### P4 — Optional after-mock

If at least one visual change is proposed, a self-contained HTML mock **may** be written at `docs/specs/page-ux/<page-slug>-<date>-after.html`. Label it **illustrative**. Show the same page job at 375 and 1280. Do not call it deployed, user-tested, or verified. Retain-current / evidence-needed runs skip this phase.

### P5 — Route advice (do not run it)

Write the report, then stop.

```markdown
## Suggested routing (not executed)

| ID | Class | Next skill | Why |
|----|-------|------------|-----|
| P1 | css-token | execute-changeset | spacing/type on this page |
| P4 | structural | write-spec | empty state + chrome change |
```

Owner authorization is required before any implementation skill. This terminal skill has no default successor.

## Report template

Save to `docs/specs/page-ux/<page-slug>-<date>.md`:

```markdown
# Page UX: <page name> — <YYYY-MM-DD>

**Route:**
**Job:**
**Captures:** `.svc/page-ux/<run-id>/`
**Viewports:** 375, 1280 × light, dark

## Competitor pages (same job)

| # | Product | Page URL | Job match | Provenance |
|---|---------|----------|-----------|------------|

## Look techniques

| Lens | Ours | Best cited page | Gap |
|------|------|-----------------|-----|
| Type | | | |
| Density | | | |
| Hierarchy | | | |
| Empty states | | | |
| Chrome | | | |

## Proposals (5–10)

…

## Suggested routing (not executed)

…

## Evidence limits
```

## Guardrails

1. One page. Adjacent routes stay out unless the owner named them.
2. Competitor evidence is **pages of the same job**, not brands.
3. Missing KB / landing-bank is not a blocker.
4. No auto-implementation, no auto-WI, no `quick-fix` (retired).
5. Captures have provenance. Inference is labelled.
6. Do not restyle with AI-purple gradients, Inter/Poppins-as-upgrade, or another product’s copy.

## Relationship to other skills

| Skill | This skill uses it | Replaces it? |
|-------|--------------------|--------------|
| `explore-ux` | No. Point the owner there for flow teardowns | No |
| `propose-ux-improvements` | No. Point there for one control | No |
| `benchmark-landing` | No | No |
| `track-visuals` | Capture conventions / auth helper | No |
| `analyze-competitors` | Optional notes if they name the same page job | No |
| `design-ui` | Taste/tokens if a later spec needs visuals | No |
| `execute-changeset` / `write-spec` | Named in routing advice only | No |

## Rationalization table

| Thought | Reality |
|---------|---------|
| “I’ll run explore-ux, we already have competitors” | explore-ux is flow + KB gate + auto-WIs. This ask is one page’s look. |
| “No landing-bank, halt” | That gate belongs to explore-ux / benchmark-landing. Hunt same-job pages. |
| “The marketing homepage is close enough” | Only if our target is that homepage. In-app pages need in-app comparables. |
| “I’ll just implement the CSS, it’s small” | Proposal skill. Owner accepts, then execute-changeset. |
| “Ten pages of the whole app” | Out of grain. One named page. |

## Red flags

- Report cites brands but no page URLs
- Captures missing dark or 375
- Proposals rewrite the product, not the page
- Skill invoked `execute-changeset` in the same run without owner accept
- Halted because competitor KB was empty
- Mock labelled as shipped or verified

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Four our-page captures exist (375/1280 × light/dark) or evidence-needed names the missing shot | `ls .svc/page-ux/<run-id>/ours-*.png` | |
| 2 | 5–8 competitor entries are **pages of the same job** with URLs (or thin-market justification) | table in report; no marketing-homepage padding | |
| 3 | 5–10 proposals each cite a competitor page + look lens | grep citations; no ungrounded “best practice” | |
| 4 | Report path is `docs/specs/page-ux/<page-slug>-<date>.md` | `test -f` | |
| 5 | No product files were edited; routing is advice only | `git status` / diff scoped to docs + `.svc/page-ux/` | |

If any check FAILs, fix the report before declaring done.

## Pipeline Continuation

Terminal skill. Read `.svc/lane-tasks-<WI>.json` when a graph exists; mark this task completed after the report exists. Do not mark a successor `in_progress`. Accepted css-token items later enter `execute-changeset`; structural items later enter `write-spec` via `route-workflow` with owner authorization.
