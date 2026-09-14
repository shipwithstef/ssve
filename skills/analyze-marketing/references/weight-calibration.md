# Weight Calibration

Consistent 1-100 scoring system for marketing insights. Weights inform downstream tools about which insights to prioritize for social content, blog posts, and pitch materials.

---

## Weight Scale

| Range | Label | Marketing Action | Content Investment |
|-------|-------|------------------|--------------------|
| 90-100 | Category-defining | Homepage hero, every pitch deck, lead messaging | Maximum — dedicated landing section, hero copy |
| 70-89 | Strong differentiator | Dedicated blog post, social media thread, comparison tables | High — multi-format content, web research validated |
| 50-69 | Meaningful value | Supporting copy, feature list entries, email sequences | Medium — include in feature tours, onboarding |
| 30-49 | Table stakes plus | Comparison tables, "also includes" sections | Low — mention but don't spotlight |
| 10-29 | Hygiene | Documentation, help center, FAQ | Minimal — document, don't market |
| 1-9 | Internal only | Do not include in any external marketing | None — engineering detail only |

---

## Pre-Scored Anchors

Use these as calibration points. When scoring a new insight, compare it against these anchors to ensure consistency across sessions.

### High Anchors (70+)

| Anchor Insight | Weight | Rationale |
|----------------|--------|-----------|
| "Credits consumed only on mutual accept — you never pay for a match that ghosts you" | **95** | Unique mechanic, directly addresses #1 user fear (wasted effort), instantly understood, no competitor has this |
| "Matched on 7 dimensions that predict co-builder success — AI tools, skills, timezone, commitment, and more" | **92** | Core differentiator, defines the product category, demable in 10 seconds |
| "Blind mutual ratings mean both sides evaluate honestly — no performative niceness" | **85** | Strong emotional hook, addresses real matchmaking pain, novel approach |
| "Progressive trust tiers reward showing up — newcomers earn access, veterans get priority matching" | **78** | Creates platform stickiness narrative, differentiates from one-shot matching |
| "Two conversation modes: get-to-know for chemistry, straight-to-action for shipping — pick your pace" | **72** | User choice = marketing leverage, covers both personality types |

### Mid Anchors (30-69)

| Anchor Insight | Weight | Rationale |
|----------------|--------|-----------|
| "27 badges across 6 categories track your builder journey" | **45** | Engagement mechanic, but gamification is table stakes in 2026. Doesn't differentiate. |
| "GitHub OAuth means one-click signup with your real builder identity" | **40** | Convenient but expected. Every dev tool has GitHub auth now. |
| "Real-time typing indicators in group chat" | **35** | Nice UX polish but not a signup driver. Messaging apps all have this. |

### Low Anchors (<30)

| Anchor Insight | Weight | Rationale |
|----------------|--------|-----------|
| "Dark mode only interface" | **8** | Design choice, not a feature. Internal only. |
| "Rate-limited API endpoints prevent abuse" | **5** | Engineering hygiene. Never market this. |
| "Supabase Edge Functions for serverless compute" | **3** | Tech stack detail. Zero user value in messaging. |

---

## Adjustment Rules

Apply these modifiers AFTER the base score from evaluation framework analysis:

| Modifier | Adjustment | When to Apply |
|----------|------------|---------------|
| **Unique to market** | +10 | No named competitor has this feature or mechanic |
| **Published stat backup** | +5 | A credible third-party statistic supports the claim (cite source) |
| **Competitors have it** | -10 | 2+ named alternatives offer the same thing |
| **Planned — homepage/social** | -15 | Feature not shipped yet, used in high-visibility channels |
| **Planned — blog/email** | -5 | Feature not shipped yet, used in lower-visibility channels |
| **Planned — roadmap/pitch** | 0 | Feature not shipped yet, used in forward-looking contexts |
| **Network-effect dependent** | -5 | Feature requires critical mass of users to deliver value |
| **Demo-able in <10s** | +5 | Can be shown in a screenshot or short GIF |
| **Requires explanation** | -5 | Takes more than one sentence to understand the benefit |

### Applying Modifiers

1. Start with base score from evaluation framework
2. Apply all applicable modifiers (they stack)
3. Clamp to 1-100 range (never below 1, never above 100)
4. Compare against nearest anchor — if more than 15 points away from similar anchors, re-evaluate

### Consistency Check

After scoring all insights for a feature, verify:
- No two insights from the same feature have the same weight (break ties by specificity)
- The highest-weighted insight for the feature aligns with your gut check of "what's most marketable here?"
- Cross-feature comparison: Is a gamification badge really weighted higher than a trust mechanic? Probably not.

---

## When Weights Disagree With Intuition

If the math gives you a weight that feels wrong:

1. **Trust the framework first** — biases favor flashy features over genuinely useful ones
2. **But flag the disagreement** — add a note in the tracker: `"weight_note": "Framework says 72, gut says 55 — gamification bias?"`
3. **Re-anchor** — compare against the 8 pre-scored examples above
4. **Adjust if justified** — if you can articulate why the framework is wrong for this specific case, override with documented reasoning
