# Diff and Verdict — web/performance.md

**Rule type:** correction  
**Source:** ECC rules/web/performance.md (SHA 125d5e61)  
**Scope:** project  
**Stack:** web

---

## Diff by Scenario

### S1: Landing page bundle size (250KB — too large?)

**Rule prescribes:** Explicit per-page-type JS budget table: landing page < 150KB gzipped, app page < 300KB, microsite < 80KB.

**Default said:** "It's on the heavier side, aim smaller" — directional but no specific number.

**Diff:** Rule provides specific thresholds where default gives vague guidance. 250KB would be flagged as exceeding the 150KB landing page budget. DG=2 (eliminates "how much is too much?" ambiguity). CD=1 (would have given correct direction but imprecise).

---

### S2: Core Web Vitals targets

**Rule prescribes:** Table with LCP < 2.5s, INP < 200ms, CLS < 0.1, FCP < 1.5s, TBT < 200ms.

**Default said:** Most thresholds correct. FCP < 1.5s less certain (might say "< 2s"). TBT not reliably recalled.

**Diff:** Rule makes the full table precise and complete. Eliminates the FCP and TBT recall uncertainty. DG=1 (mostly already correct), CD=1 (prevents possible FCP/TBT errors).

---

### S3: Hero image loading attributes

**Rule prescribes:** `loading="eager"` + `fetchpriority="high"` for hero/above-the-fold media.

**Default said:** I might default to `loading="lazy"` on hero images — the habit for most images would carry over to the hero image. This is the wrong default for LCP.

**Diff:** This is the strongest correction in the file. `loading="lazy"` on a hero image is a real performance mistake that hurts LCP. The rule explicitly states "eager + fetchpriority for hero media only." DG=2 (disambiguates eager vs lazy for hero images), CD=2 (prevents a real LCP regression).

---

### S4: Animation performance

**Rule prescribes:** Animate compositor-friendly properties only; use `will-change` narrowly and remove it when done; prefer CSS for simple transitions; use `requestAnimationFrame` or established animation libraries for JS motion.

**Default said:** I'd recommend compositor-friendly properties consistently. `will-change` narrow-use I know but might not mention the "remove it when done" cleanup requirement.

**Diff:** Mostly inflation except "remove `will-change` when done" — that's a real correctness note (leaving `will-change` on permanently has its own performance cost). CD=1 for that specific detail.

---

## Scoring

| Axis | Score | Rationale |
|---|---|---|
| determinism_gain | 2 | Bundle budget table (S1) collapses "how much is too much?" to specific KB thresholds per page type. Hero image loading (S3) clarifies eager vs lazy. |
| correctness_delta | 2 | Hero image `loading="lazy"` default is wrong; this rule catches it. Bundle budgets prevent vague guidance. |
| friction_cost | 1 | Fairly detailed rule (~50 lines). Checklist adds some overhead but is self-contained. |
| convention_conflict | 0 | Standard web performance guidelines; aligns with Google's CWV methodology. |

**Net: DG=2, CD=2, FC=1, CC=0**

Meets `adopt-with-edits` threshold. Strong adopt — two independent behavior changes (bundle budget specificity + hero image loading correction).

---

## Required Edits Before Adoption

1. **Strip "Prefer CSS for simple transitions"** from Animation Performance — this is embedded behavior, inflation.
2. **No ECC-internal references to strip** — the file is already clean.
3. **Add `paths` frontmatter** to scope to web files (`**/*.{tsx,jsx,html,css,scss,ts,js}`) — prevents injection on non-web turns.

**Result after edits:** ~45 lines. Lean enough given two genuine CD=2 behavior changes.

---

## Verdict

**`adopt-with-edits`**

Two real behavior changes justify this rule:
1. Bundle budget table — specific KB thresholds where default gives vague direction
2. Hero image loading — `loading="eager"` + `fetchpriority="high"` vs the lazy default that hurts LCP

The CWV table and Animation section have supporting value. Minor edits: strip one inflation sentence and add path scoping. This is the strongest of the three stack evals this session.
