# Framework Improvement: page-ux-improve skill (page-scoped competitive look)

**Status:** DRAFT
**Date:** 2026-09-20
**Severity:** medium — missing capability (founder-named)
**Category:** missing capability
**Route:** `create-skill` (draft only this change; do not register until evals)

## Evidence

- **Source:** Founder request to recover the old SSVE “improve a specific UI page via competitors + look techniques” story as a generic reusable skill.
- **Old stories:**
  - `proposals/done/2026-05-07-evolution-competitive-ux-explorer.md` → `explore-ux` (Option B).
  - `proposals/2026-08-26-framework-improvement-ux-improve-mode-skills.md` / WI-FW-UX-GRADUATION-01 → `propose-ux-improvements`.
- **Finding:** Those two skills closed adjacent gaps and left the original **page** gap open.

## Diagnosis

The visual/UX stack split into four skills that never meet on a single product page:

| Skill | Unit of work | Competitive look? | Limitation |
|-------|--------------|-------------------|------------|
| `explore-ux` | Whole app / multi-step **flow** | Yes — but only after KB + landing-bank | Hard-halts without `references/knowledge/competitors/*/CAPABILITIES.md` and `references/landing-bank/*/INDEX.md`. Scores step count / friction. Auto-creates WIs for ≥ Medium. |
| `propose-ux-improvements` | One **region or control** | No | Spec/code/persona evidence only. Explicitly: “Do not bulk-read … a competitor library.” |
| `benchmark-landing` | **Marketing landing** | Yes — sector bank | Landing/hero only. Promotion gate, not in-app page polish. |
| `track-visuals` | Screen inventory / regression | No (self-rubric) | Baseline/diff/review. Comprehension is internal 1–4, not competitor pages. |

A founder saying “make HoursHub `/home` look like a real product” or “Novisenti Idea Overview should look as good as Linear issue view” currently misfires:

- `explore-ux` wants a full competitor KB and a flow teardown.
- `propose-ux-improvements` will debate one chip or button.
- `benchmark-landing` will try to score a marketing hero that is not the page.
- `track-visuals` will screenshot and grade against our own rubric.

**Root cause:** The 2026-05-07 gap was implemented at **flow + knowledge-base** grain. The 2026-08-26 gap was implemented at **region** grain. Neither is “this **page**, same job as theirs, how does it **look**.”

**Already in FRAMEWORK-STATE.md?** No open gap for page-scoped competitive look. `competitive-ux-explorer` was closed by `explore-ux`. UX graduation closed the region-proposal skill.

## Proposed skill

**Name:** `page-ux-improve`

**Job:** Given one route/page, capture it, find 5–8 competitor **pages of the same job**, extract look techniques, propose 5–10 page-scoped improvements with citations. Stop. Do not implement.

**Inputs:** one named route/page (e.g. HoursHub `/home`, Novisenti Idea Overview). Live URL or owner-authorized local preview. Optional existing competitor notes — **not a hard precondition**.

**Process (contract, not a description dump):**

1. Capture current page: light + dark × 375 + 1280.
2. Name the **user job** of that page (not the company category).
3. Find 5–8 competitor **pages** that do that job. Company homepages are invalid unless the target *is* a homepage.
4. Extract look techniques: type, density, hierarchy, empty states, chrome.
5. Propose 5–10 improvements scoped to this page, each citing a competitor page (URL + technique).
6. Write `docs/specs/page-ux/<page-slug>-<date>.md`. Optional labelled HTML after-mock. Hand off routing; do not execute.

**Outputs:**

- `docs/specs/page-ux/<page-slug>-<date>.md` (required)
- `docs/specs/page-ux/<page-slug>-<date>-after.html` (optional, visual change only)
- `.svc/page-ux/<run-id>/` captures (screenshots)

**Routing (advisory, not auto-dispatch):**

| Finding class | Next |
|---------------|------|
| Small CSS / token / copy on this page | `execute-changeset` after owner accept |
| Structural layout, new states, chrome change, new components | `write-spec` |
| Broken behavior, not look | `diagnose-bug` (wrong skill) |
| Whole-app / multi-step flow vs competitors | `explore-ux` |
| One control / region | `propose-ux-improvements` |
| Marketing landing score | `benchmark-landing` |

Do **not** auto-implement. Do **not** auto-file WIs. Do **not** halt for missing landing-bank.

## Trigger phrases (should fire)

- “improve this page”
- “make /home look better”
- “page UX vs competitors”
- “competitor look for Idea Overview”
- “how should this screen look”
- “HoursHub /home look”
- “Novisenti Idea Overview polish”
- “find competitor pages for this route”
- “this dashboard page looks cheap vs Linear / Linear-like products”

## Should not fire (near-misses)

| Utterance | Winner |
|-----------|--------|
| “how does our onboarding flow compare to Toast” | `explore-ux` |
| “is this header chip redundant” | `propose-ux-improvements` |
| “score the marketing landing” | `benchmark-landing` |
| “visual regression / what changed visually” | `track-visuals` |
| “the save button doesn’t work” | `diagnose-bug` |
| “design the UI for this new feature” | `design-ui` |

## Implementation

- **Route:** `create-skill` draft only.
- **Expected files this change:**
  - `proposals/2026-09-20-page-ux-improve-skill.md` (this file)
  - `skills/page-ux-improve/SKILL.md` (DRAFT)
- **Deferred until create-skill evals:** `skills-manifest.json`, README / EXTERNAL_ADDONS mirrors, `intent-routing.md`, `hot-path-operational-details.md`, installer, tier-1.5/tier-2 evals.
- **live-evidence:** not-applicable — proposal + optional mock; nothing ships to a deployed product from this skill.

## Replay verification (after registration)

- `bash test-framework/evals/tier-1/validate-skill-structure.sh` against `skills/page-ux-improve/SKILL.md`
- Trigger evals: page-look prompts fire this skill; flow/region/landing/regression prompts do not
- Contract: report path `docs/specs/page-ux/`, 5–8 competitor **pages**, 5–10 cited proposals, no auto-implementation

## FRAMEWORK-STATE.md Mutations (when registered, not this draft)

- Analysis History: 2026-09-20 page-scoped competitive look skill drafted
- Known Gaps: add `page-ux-competitive-look` until registered + evals pass
- Capabilities: competitive look at **page** grain, distinct from flow exploration
