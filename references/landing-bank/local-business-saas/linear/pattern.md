# Sample: Linear

**URL captured:** https://linear.app
**Capture date:** 2026-04-21
**Viewport:** 1600×900
**Artifact files:** `hero.png` (this directory). `hero.webm` — PENDING (capture tooling gap, see Capture notes below).

## Positioning

- `positioning_tag`: **indie-alive**
- Rationale: Linear sits in the product-dev-tools vertical (not local-business-saas) but is included in this bank as a cross-sector *positioning anchor*. The `benchmark-landing` rubric scores against positioning-matched medians (F-014 / F-017), not only sector-matched ones. Indie SaaS products that differentiate on "feels alive" need a positioning reference, and the local-business-saas bank was biased entirely enterprise-defensive before this addition.

## Measured dimensions (1600×900)

### Hero composition (above-the-fold)
- Primary elements visible: **5**
  1. Top nav (logo + 6 nav items + Log in + Sign up CTA)
  2. Large headline: "The product development system for teams and agents"
  3. Subhead: "Purpose-built for planning and building products. Designed for the AI era."
  4. Single-line announcement pill (right-aligned): "● Issue tracking is dead · linear.app/next →"
  5. Full live-UI product screenshot below the copy (not a marketing illustration — the actual Linear app rendered with a specific issue "Faster app launch ENG-2703", left sidebar, activity feed, right-side metadata panel)
- Density per 100k px²: ~3.5 elements (hero band occupies ~900×400 = 360k px², ~5 elements above fold; rest is the live UI below it)
- Element count feels below sector median (4) but the live UI adds considerable information density in a second band

### Text hierarchy
- Headline: ~72px, extrabold
- Subhead: ~18px, regular, muted slate
- Nav / announcement / CTA labels: ~14px
- Ratio ≈ **4:1:0.8** — headline dominates, subhead restrained, supporting text quiet. Tighter than the 3:1:1 sector convention — headline even more dominant.

### Motion (per-element — evidence-required for dimension 3b scoring)
| Element | Type | Cycle time | Pixel area % | Qualifies for 3b liveness? |
|---|---|---|---|---|
| "Issue tracking is dead" pill dot | `bg-blue-500` pulse (approx) | ~2s | ~0.03% | NO (fails ≥0.5% area threshold) |
| Codex notification popover bottom-right of product UI | Appears during interaction / scroll; appears live | not measurable from still; approx 1-3s | ~2% of hero when visible | YES (area qualifies; cycle likely qualifies — needs hero.webm to confirm) |
| Activity feed lines "Linear created the issue via Slack on behalf of karri · 2min ago" | Typed progressively in product tour | 3-5s per line | ~1.2% per line | LIKELY YES pending WebM capture |

**Honest caveat:** without `hero.webm` I cannot confirm the Codex popover or activity-feed typing cycle times. Measurements above are visual estimates from the still + public knowledge of Linear's landing (it does animate the issue tour). Re-measure after WebM capture lands.

**Motion count (dimension 3a):** 2-3 simultaneously-animating elements observed / inferred. At sector 75th percentile (>1), but not chaotic.

**Liveness perceptibility (dimension 3b, estimated):** likely scores 7-8/10 if WebM confirms cycles. The live product UI with an appearing notification + activity feed reads as *working*, not static. This is the model for what "feels alive" looks like on a hero.

### Illustration craft tier
- **live-ui** (actual product UI rendered on the page — not a screenshot image, likely a real React tree). Matches sector convention (product-UI or live-UI), sits at the premium end.

### Layout convention
- Stacked single-column at 1600×900: copy band on top, live-UI band below. Not a split-hero.
- Cold-glance reads: "this is a software system" (the product UI below the copy is the visual anchor, not a dashboard photo).

### First-5-sec comprehension
- Target: "can a cold visitor name the product's purpose?"
- Test: at 5 seconds, headline says "product development system for teams and agents" + UI shows issues, priority, labels → "it's an issue tracker / project management for software teams." Passes. Score estimate: 9/10.

## Why this sample is in the bank

1. **Proves indie-alive is achievable without motion chaos.** Linear has 2-3 moving elements vs. iter0's 12+. Motion count is in range; perceived liveness is high because the motion is *on the product*, not decorative.
2. **Counterpoint to enterprise-defensive static screenshots.** The enterprise LB-SaaS bank (OpenTable, Resy, Square, Mindbody) leans mostly-static. Linear proves liveness is not categorically wrong — it's wrong when mis-applied (iter0).
3. **Motion placement lesson for Example Marketplace:** the live signal should BE the product affordance (a scheduled slot activating, a deal reaching its claim cap) — not decorative (pulsing dots, spinning badges).

## Capture notes (gaps encountered in capture session 2026-04-21)

- `hero.webm` — PENDING. No motion-capture script exists yet in `scripts/`. Need to build `scripts/capture-motion.mjs` that records a 3-second WebM alongside the PNG. Current `benchmark-landing/SKILL.md` Step 0 check only enforces `hero.png` + `pattern.md` — WebM is required per skill text but not enforced in code.
- Per-element area percentage measurements were eyeballed. Need a measurement helper that takes bounding boxes from rendered DOM and computes % of hero viewport.
- Overall capture pipeline is not yet scripted — done ad-hoc through playwright-mcp here. See proposal `2026-04-21-gap-capture-tooling.md` (to be written).

## Scoring guidance (for anyone using this sample as an anchor)

When scoring a candidate against Linear on dimension 8 (`vs_best_in_class_anchor`):
- Candidate needs live-UI or rendered-product-UI tier (not illustration, not animated character scenes, not generic dashboard photos)
- Candidate's motion must be on the product, not decorative
- Candidate's motion count can exceed 1 if the motion *is the product affordance* (Linear: activity feed ticking = product demonstrating itself)
- Linear's bar is high — few candidates will legitimately score 9-10 against it. Expect 5-7 range as the honest zone.
