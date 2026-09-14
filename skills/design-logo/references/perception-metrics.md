# Perception Metrics — 10-axis measurable rubric for brand identity

Every design-logo v3 run scores concepts and refinements against this rubric. Each axis has a **measurement protocol** that produces a defendable number — not a vibe.

## Why this exists

v2's 7-axis rubric was self-graded prose. "I think this looks distinctive" is not a measurement; it's a confirmation bias. v3 forces every axis to specify HOW the score was obtained. If you can't run the protocol, you can't score the axis. Concept fails for the round.

## The 10 axes

### 1. Identifiability at 16px
**What it measures:** Does the silhouette survive favicon size?

**Protocol:**
1. Render mark at 16×16 px on white AND on slate #0F172A
2. Open both PNGs in browser tab. Position cursor far away. Glance for 1 second only.
3. Show the same to a person OUTSIDE the project (3-second glance, ask "is this distinct?")
4. Score:
   - 10 = both you AND outsider can identify mark in 1s glance
   - 7 = you can, outsider hesitates
   - 4 = you have to squint
   - 1 = unrecognizable mush

### 2. Semantic fit (stranger test)
**What it measures:** Does an outsider correctly identify product category in 2s?

**Protocol:**
1. Render mark at 256×256 with NO wordmark
2. Show to person who has never heard of the project
3. Ask: "What does this brand do?" — give them 2 seconds
4. Score:
   - 10 = correct sector + correct sub-category (e.g. "SaaS for local restaurants")
   - 8 = correct sector ("software for businesses")
   - 5 = wrong sector but logical guess ("delivery app")
   - 3 = "I don't know"
   - 1 = wrong sector AND wrong audience guess

### 3. Hidden-hook discoverability
**What it measures:** Is the second meaning findable in 2-3s without prompting?

**Protocol:**
1. Show concept to outsider who has NOT been told there's a hook
2. Ask: "Look at this for 5 seconds. Anything surprising or clever about it?"
3. Score:
   - 10 = spotted within 3s, articulated correctly
   - 7 = spotted within 10s
   - 4 = spotted only after being told "look for a hidden meaning"
   - 1 = no hook OR hook so hidden it's invisible

### 4. Distinctiveness vs sector
**What it measures:** Does it visibly differ from 8 captured competitor marks?

**Protocol:**
1. Build 9-up grid: 8 sector competitors + your concept
2. Cover all wordmarks
3. Show outsider for 3s
4. Ask: "Which one is different from the others?"
5. Score:
   - 10 = outsider correctly picks yours
   - 7 = outsider picks yours and one other
   - 4 = outsider picks a different one
   - 1 = yours blends invisibly

### 5. Adversarial distance
**What it measures:** How far from 6 anti-patterns?

**Protocol:**
1. Render concept next to all 6 anti-patterns (3D balloon, comic-sans, rainbow, literal-clock, no-entry-disc, generic-rounded-square)
2. For each pair, score visual similarity 1-10 (1=identical, 10=opposite register)
3. Take MIN across all 6 — this is your axis-5 score
4. Score:
   - 10 = far from all 6 anti-patterns
   - 5 = uncomfortably close to one
   - 1 = nearly indistinguishable from one

### 6. Type quality (kerning + weight discipline)
**What it measures:** Are wordmark letterforms intentional or default?

**Protocol:**
1. Audit per-pair kerning (Tr, AV, LT, Wo, rs, fi, fl). Each pair: visually balanced or off?
2. Letterform consistency: do similar shapes (o/c/e, n/h/m) share a family?
3. Custom glyphs vs system-default Inter? Bespoke moves earn higher.
4. Score:
   - 10 = bespoke wordmark with intentional kerning, custom glyphs, family discipline
   - 7 = system font with hand-kerned overrides
   - 4 = system font with default tracking
   - 1 = misaligned, broken kerning, or missing characters

### 7. Color discipline
**What it measures:** ≤3 hues with intentional ratio + WCAG contrast?

**Protocol:**
1. Count unique hues in mark (not values — actual hue families)
2. WCAG AA test: contrast against page bg both themes for any text-bearing component
3. Ratio audit: dominant hue ~70%, accent ~20%, neutral ~10% (the 70-20-10 rule)
4. Score:
   - 10 = ≤3 hues, 70-20-10 ratio, WCAG AAA, no off-brand bleed
   - 7 = ≤3 hues, WCAG AA
   - 4 = 4-5 hues, WCAG AA
   - 1 = ≥6 hues OR fails WCAG AA

### 8. Scalability (16/32/64/256/512/1024)
**What it measures:** Does the mark hold geometry across the size ladder?

**Protocol:**
1. Render at all 6 sizes
2. Eyeball each: at this size, does the mark still convey the concept?
3. Each size where mark loses meaning = -2 points
4. Score:
   - 10 = all 6 sizes hold meaning
   - 8 = loses meaning at 16px only (acceptable — favicon stylization is OK)
   - 5 = loses meaning at 16 + 32
   - 1 = only works at one size

### 9. 5-year longevity (trend resistance)
**What it measures:** Will this look intentional or dated in 2031?

**Protocol:**
Audit for these dated trends. Each present trend = -2 points from base 10.
- Gradient fills (esp. trendy purple→pink, blue→teal)
- Glassmorphism / frosted backgrounds
- AI-render-of-the-month (specific 2024-2026 image-gen aesthetics)
- Bevels / drop shadows / 3D extrusion
- Memphis-pattern accents
- Squiggle underline
- Pantone color of the year (without strong reason)
- Generic rounded-square container
- Y2K nostalgic palette without intentional reference

Score:
- 10 = trend-free
- 7 = one trend present but used intentionally (e.g. subtle brand gradient)
- 4 = two trends
- 1 = three or more trends — will look dated by 2027

### 10. Founder-love (5 binary questions)
**What it measures:** Does the founder actually love it?

**Protocol:**
Ask the founder these 5 questions. Each YES = 2 points. Total /10.
1. "Would you tattoo this on your forearm?"
2. "If a top-tier studio handed this to you for $5k, would you accept it as the deliverable?"
3. "If a competitor shipped this tomorrow, would you be impressed (not just shrug)?"
4. "Will this look intentional or dated in 5 years?"
5. "When you show this to a friend outside the project, do they correctly guess what your company does in 2 seconds?"

**Founder shrug ("fine / okay / I guess / sure / it's something") on the live mark = score capped at 4 regardless of other axes.** This is the saturation truth that overrides everything else.

## Floors for promotion

| Phase | Floor |
|---|---|
| Phase 1b concept-only score (no render) | 70/100 to advance to render |
| Phase 5 rendered self-score | 80/100 to advance to refinement |
| Phase 9 post-refinement promotion | 90/100 + axis #2 ≥8 + axis #10 ≥8 to advance to terminal |
| Phase 13 in-app verification + founder-emotion | 90/100 + founder says "impressed" not "fine" to declare done |

A mark that scores 89/100 by axes but ≥90 with founder shrug is broken. A mark that scores 91/100 by axes but founder shrug is also broken. Founder-love is the floor.

## Why these specific 10 axes

- **#1, #8** — physical reality of the medium (16px favicon, multi-size ladder)
- **#2, #4** — semantic and competitive perception
- **#3, #5** — distinctiveness and craft
- **#6, #7** — execution discipline
- **#9** — temporal longevity
- **#10** — emotional truth

Each axis answers a question that competent designers ask without realizing they're asking it. Making the questions explicit and measurable is what moves AI-generated marks from competent to designer-grade.

## What this rubric replaces

| v2 axis | v3 axis | Improvement |
|---|---|---|
| Silhouette legibility | Identifiability at 16px (#1) | Same idea, with explicit 16px protocol |
| Distinctiveness vs sector | Distinctiveness vs sector (#4) | Now measured by 9-up outsider test |
| Distance from anti-patterns | Adversarial distance (#5) | Now measured pairwise vs 6 anti-patterns |
| Semantic fit | Semantic fit (stranger test) (#2) | Now measured by FRESH outsider, 2s glance |
| Type quality | Type quality (#6) | Now requires bespoke moves for ≥7 |
| Color discipline | Color discipline (#7) | Adds 70-20-10 ratio + WCAG floors |
| Scalability | Scalability (#8) | Same |
| — | **Hidden-hook discoverability (#3)** | NEW — distinguishes great from competent |
| — | **5-year longevity (#9)** | NEW — trend audit catches dated work |
| — | **Founder-love (#10)** | NEW — emotional truth as decisive floor |

Net: 7 axes → 10 axes, all with measurement protocols. Total score moves from /70 to /100. Floor moves from ~58 (sector mediocrity) to ≥90 (designer-grade).
