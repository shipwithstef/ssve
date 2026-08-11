# Proposal: landing-page + benchmark-landing must run mandatory visual side-by-side before declaring done

**Filed:** 2026-04-28
**Severity:** HIGH — multiple sessions on Example Marketplace WI-088, WI-161 declared landing iterations "complete" while the live page visually fell far short of named sector anchors. User caught it post-ship.
**Status:** OPEN

## What failed

WI-161 closed with self-graded PASS:
- Bundle-grep ✅ (markers shipped)
- Lane-tasks 5/5 ✅
- Perf budget ✅ (+9KB chunk)
- Below-fold gap "closed" via 3 CSS-only product UI mocks

But the user-experienced result: Example Marketplace landing below the hero is text + Lucide icons + tiny CSS mocks against ~50% white space, while Toast (named sector anchor in WI-158 bank) is full-bleed photoreal sections + real product UI screenshots + customer faces + brand-color blocks. **No automated check or skill output ever rendered Example Marketplace next to Toast at the same scale.** The 21-anchor bank was used for *capture* and *gap analysis* but never for *visual comparison of the shipped result*.

## Root causes

1. **`benchmark-landing` is text-graded**, not visually-graded. Its 8-dimension rubric is filled in by introspection, not by looking at screenshots side-by-side. The skill scores "below-fold-density" but never renders both pages.
2. **`verify-promotion` for landing-tagged WIs accepts bundle-grep as evidence.** A string can ship without the section *looking* like the anchor.
3. **No "would you ship this against $ANCHOR" gate.** Self-Verify checks contracts and presence, not aesthetic parity.
4. **Below-fold gap closure has no visual receipt.** WI-158 found "11/18 anchors ship product UI screenshots in features" — WI-161 "closed" it with CSS-only mocks that occupy ~3% of the visual real estate of an anchor's product screenshot section.
5. **The framework knew about Toast as the benchmark and never compared to it.** The anchor bank was treated as a one-shot Step 0.5 input, not as a permanent visual reference.

## Proposed fix — three additive changes

### A. `benchmark-landing` skill — Step 0 MANDATORY visual side-by-side

Before scoring any dimension, the skill MUST:

1. Render the target page at 1440×900 full-page screenshot (Playwright)
2. Render the top-2 sector anchors and top-1 high-performer (from `landing-bank/`) at the same size
3. Save a stitched 4-up comparison image to `docs/specs/landing/<wi>-side-by-side.jpg`
4. **Refuse to score** until that artifact exists
5. The verdict report must include the path to the side-by-side and an honest one-line aesthetic judgment per anchor: "matches density / falls 30% short / falls 60% short"

If the side-by-side shows the page is visually thin (>40% more white space than median anchor, or product UI section < 50% the height of anchor's equivalent), score "below-fold-density" max 4/10 regardless of textual checklist completion.

### B. `verify-promotion` — landing WIs require visual receipt

For any WI tagged `landing` / `marketing-page`, the verify-promotion gate adds:

1. Re-run the side-by-side after deploy (live URL, not local build)
2. Diff against the pre-implementation side-by-side stored at WI start
3. Require: shipped change is visible in production at the comparison scale (not just present in bundle string)
4. Include the post-deploy screenshot in the WI's verify-promotion receipt

### C. `landing-page` skill — Step 0.5 outputs a "ship-readiness gate"

After Market-Gap analysis, emit a binary: "ship-ready vs $ANCHOR_TOP_1" yes/no with one-paragraph honest read of the visual gap. This becomes the load-bearing question for any downstream landing WI: does the proposed change actually close visual parity with the named benchmark, or is it cosmetic?

## Where this hooks into the framework

- `landing-page/SKILL.md` Step 0.5 → add "Ship-readiness gate vs top anchor" subsection
- `benchmark-landing/SKILL.md` Step 0 → require side-by-side artifact path
- `verify-promotion/SKILL.md` → add tagged-WI conditional for landing/marketing-page WIs
- New tier-1 validator: `validate-landing-side-by-side-exists.sh` checks any landing WI marked verified has the artifact

## Why this elevates a learning to a rule

This is the second time across Example Marketplace sessions where a landing iteration shipped with self-grade PASS while the user, on first visual inspection, caught a thinness/disparity vs benchmark (WI-088 iter1 was the first; user said "I cannot launch with this"). Two recurrences with the same signature = pattern, not incident. Per `rules/learning-preload.md`, this earns rule status.

## Acceptance criteria when adopted

- A landing WI cannot reach `verify-promotion: completed` without a side-by-side artifact in `docs/specs/landing/<wi>-side-by-side.jpg`
- `benchmark-landing` refuses to score if anchor side-by-side is missing
- The honest-aesthetic-judgment line is required output and surfaced inline in the WI's verify-promotion receipt
**Promoted-to:** WI-139
