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
  Captures that page at supported viewports and themes, finds 5–8 equivalent
  competitor PAGES, extracts look techniques, and proposes cited page-scoped
  improvements when evidence supports a change. Not explore-ux (whole-flow + required competitor KB). Not
  propose-ux-improvements (one region, no competitor hunt). Not
  benchmark-landing (marketing landing only). Not track-visuals (regression).
  Not diagnose-bug. Does not auto-implement.
phases:
  - { id: P1-PageScopeAndCapture, trigger: always, reads: ["named route/page", "live or local preview"], writes: [".svc/page-ux/<run-id>/", "docs/specs/page-ux/<page-slug>-<date>.md"], evidence_kind: file, required_for_completion: true }
  - { id: P2-SameJobCompetitorPages, trigger: current-page-evidence-available, reads: ["page job", "web search / live browse", "optional competitor KB"], writes: ["docs/specs/page-ux/<page-slug>-<date>.md"], evidence_kind: file, required_for_completion: true }
  - { id: P3-LookTechniquesAndProposals, trigger: current-page-evidence-available, reads: ["our captures", "competitor page evidence"], writes: ["docs/specs/page-ux/<page-slug>-<date>.md"], evidence_kind: file, required_for_completion: true }
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

**DRAFT — unregistered and uninstalled.** This file records a proposed contract for review. It is not an available skill and must not be invoked or routed to until registered and validated.

**Announce at start:** "I'm using page-ux-improve to capture this page, find same-job competitor pages, and propose look changes for that page only."

The proposed skill produces an evidence-based report. It does not edit product CSS, open a WI, or invoke an implementation skill. Accepted changes later enter the normal chain through `route-workflow`, reusing authorization already given.

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

Capture the current page into `.svc/page-ux/<run-id>/` at every supported combination below that matters to the page's job. Record which viewport and theme combinations the product actually supports. Do not manufacture a dark theme or mobile layout to satisfy a fixed count.

| File | Viewport | Theme |
|------|----------|-------|
| `ours-375-light.png` | 375×812 | light |
| `ours-375-dark.png` | 375×812 | dark |
| `ours-1280-light.png` | 1280×800 | light |
| `ours-1280-dark.png` | 1280×800 | dark |

Prefer project browse/auth helpers (`e2e/helpers/browse-auth.md`, `track-visuals` capture conventions). Do not log in or change access without authorization. If current-page capture is impossible, write an `evidence-needed` report with the exact missing observation, skip P2–P4 with reasons, and stop after P5. Do not invent screenshots.

Record route, viewport, theme, state (empty/populated), date, and provenance in the report. Explain omitted combinations (for example, no dark theme or unsupported mobile viewport). If an applicable combination cannot be captured, state the evidence limit and choose `evidence-needed` when it could change the recommendation.

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

Score the **page** (not the company) 1–4 per applicable lens against the best cited competitor page. Every score cites a URL. Distinguish observed gaps from stylistic preference and retain the current design when it serves the user's job better.

Choose `propose-change`, `retain-current`, or `evidence-needed` from the observed comparison. For `propose-change`, include only improvements the evidence supports; 5–10 is a useful upper range, not a quota. `retain-current` and `evidence-needed` may have zero proposals. For each proposed improvement write:

```markdown
### P<n>: <title>

- **Page element:** (hero, list, empty state, chrome, type ramp, …)
- **Current:** observed (cite our capture)
- **Technique:** (type / density / hierarchy / empty / chrome)
- **Citation:** <competitor page URL> — <what they do>
- **Change:** implementable on THIS page
- **Class:** css-token | structural
- **Suggested next:** route-workflow (normal plan/review/execute chain; write-spec first when required)
```

`css-token` = color, type, spacing, density, copy, empty-state treatment using existing components.  
`structural` = new regions, new states, chrome redesign, new components, information architecture.

Forbidden proposals: “be more like Linear”; restyling the whole app; landing-page motion; changing product mechanics; HoursHub copy on Novisenti or the reverse.

### P4 — Optional after-mock

If at least one visual change is proposed, a self-contained HTML mock **may** be written at `docs/specs/page-ux/<page-slug>-<date>-after.html`. Label it **illustrative**. Show the same page job at applicable supported viewports. Do not call it deployed, user-tested, or verified. Retain-current / evidence-needed runs skip this phase.

### P5 — Route advice (do not run it)

Write the report, then stop.

```markdown
## Suggested routing (not executed)

| ID | Class | Suggested route | Why |
|----|-------|-----------------|-----|
| P1 | css-token | route-workflow → required plan/review/execute chain | spacing/type on this page |
| P4 | structural | route-workflow → write-spec when required → required plan/review/execute chain | empty state + chrome change |
```

Reuse owner authorization already given for implementation; ask only when it is missing or a consequential choice remains unresolved. This terminal proposal has no default successor. Write `.svc/page-ux/<run-id>/self-verify.log` with the results of the checks below before marking the report complete.

## Report template

Save to `docs/specs/page-ux/<page-slug>-<date>.md`:

```markdown
# Page UX: <page name> — <YYYY-MM-DD>

**Route:**
**Job:**
**Outcome:** propose-change / retain-current / evidence-needed
**Captures:** `.svc/page-ux/<run-id>/`
**Supported viewports/themes captured:**
**Omitted combinations and reason:**

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

## Proposals (only evidence-supported changes; may be none)

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
| `route-workflow` / `write-spec` / `execute-changeset` | Referenced in later routing advice only | No |

## Rationalization table

| Thought | Reality |
|---------|---------|
| “I’ll run explore-ux, we already have competitors” | explore-ux is flow + KB gate + auto-WIs. This ask is one page’s look. |
| “No landing-bank, halt” | That gate belongs to explore-ux / benchmark-landing. Hunt same-job pages. |
| “The marketing homepage is close enough” | Only if our target is that homepage. In-app pages need in-app comparables. |
| “I’ll just implement the CSS, it’s small” | Keep this run as a proposal; accepted work follows `route-workflow` and the required chain. |
| “Ten pages of the whole app” | Out of grain. One named page. |

## Red flags

- Report cites brands but no page URLs
- Missing a supported viewport or theme capture without a stated evidence limit
- Change proposals forced despite evidence for retaining the current page
- Proposals rewrite the product, not the page
- Implementation invoked from this proposal instead of the normal `route-workflow` chain
- Halted because competitor KB was empty
- Mock labelled as shipped or verified

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Applicable supported viewport/theme captures exist, or evidence-needed names the missing observation | Check report support matrix and `.svc/page-ux/<run-id>/ours-*.png` | |
| 2 | When current-page evidence exists, 5–8 competitor entries are **pages of the same job** with URLs (or thin-market justification) | table in report; no marketing-homepage padding; record skip reason for evidence-needed | |
| 3 | Outcome follows the evidence; each actual proposal cites a competitor page and look lens | Check outcome and citations; zero proposals are valid for retain-current/evidence-needed | |
| 4 | Report path is `docs/specs/page-ux/<page-slug>-<date>.md` | `test -f` | |
| 5 | No product files were edited; routing is advice only | `git status` / diff scoped to docs + `.svc/page-ux/` | |

If any check FAILs, fix the report before declaring done.
Write each result and its evidence to `.svc/page-ux/<run-id>/self-verify.log`.

## Pipeline Continuation

Terminal proposal. Read `.svc/lane-tasks-<WI>.json` when a graph exists; mark this task completed after the report and self-verify log exist. Do not mark a successor `in_progress`. Accepted items later enter `route-workflow` and its required planning, review, and execution chain; structural changes enter `write-spec` when that route requires it. Reuse existing owner authorization.
