# Default Transcript — web/performance.md

> Pass 1 elicited before deep-reading rule content.
> Contamination caveat: rule was fetched into context for evaluation; defaults below are from first-principles web performance knowledge.

## Scenario 1: Developer has a landing page with 250KB gzipped JS bundle. Is it too large?

**Prompt:** A landing page ships 250KB of gzipped JavaScript. Is that acceptable?

**Default response:**

I'd say "it's on the heavier side for a landing page — under 100-150KB gzipped is ideal, but 250KB isn't catastrophic if code-split correctly." My guidance would be vague directional ("aim smaller") rather than a specific threshold. Without a rule, I wouldn't say "150KB is the hard budget."

---

## Scenario 2: Developer asks what LCP, INP, and FCP targets to aim for

**Prompt:** What are the Core Web Vitals targets for a production site?

**Default response:**

I know these from training:
- LCP < 2.5s (Google's "Good" threshold) — confident
- INP < 200ms — I know INP replaced FID; would likely get this right
- CLS < 0.1 — confident
- FCP < 1.5s — less certain on this specific number, might say "< 2s"
- TBT < 200ms — less prominent, might not mention it unprompted

I'd get most of these right but the FCP and TBT thresholds are less reliably recalled. A table format makes these instantly actionable rather than narrative.

---

## Scenario 3: Developer is implementing a hero image. What attributes should it have?

**Prompt:** A hero image is the largest element in the viewport on page load. What HTML attributes and loading behavior do you give it?

**Default response — honest assessment:**

This is a potential behavioral error. I might default to `loading="lazy"` as a habit (best practice for most images) without distinguishing that the hero image is above-the-fold and needs the opposite treatment. The correct answer is `loading="eager"` + `fetchpriority="high"` for hero images — but I would not reliably produce this distinction without a prompt or a rule.

Without a rule: `<img src="hero.jpg" width="1200" height="600" loading="lazy" alt="...">` — wrong for LCP.
With correct knowledge applied: `loading="eager" fetchpriority="high"` — right for LCP.

This is a real correction opportunity.

---

## Scenario 4: Developer is adding animations. What CSS properties are safe to animate?

**Prompt:** Which CSS properties should animations use to avoid jank?

**Default response:**

I'd say: `transform` and `opacity` are compositor-friendly and don't trigger layout/paint. `top/left/width/height` trigger layout reflow. I'd apply this reasonably consistently but might not mention `will-change` or warn about removing it after use.

---

## Summary

Real behavior change: S3 (hero image `loading="lazy"` vs `loading="eager"` + `fetchpriority` — Claude would produce the wrong default). Real specificity gain: S1 (bundle budgets — vague guidance vs specific KB thresholds). Mostly reliable but uncertain: S2 (CWV targets — FCP/TBT less confidently recalled).
