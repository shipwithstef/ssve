# Sample: Square for Restaurants

**URL captured:** https://squareup.com/us/en/restaurants
**Capture date:** 2026-04-21
**Viewport:** 1600×900
**Artifact files:** `hero.png` (this directory). `hero.webm` — PENDING.

## Positioning

- `positioning_tag`: **enterprise-defensive**
- Sector: local-business-saas (B2B — POS & restaurant operations tooling)

## ⚠️ Stale-assertion correction

The sector README previously asserted Square for Restaurants = "split-hero (copy left, POS screenshot right)." **The actual 2026-04-21 hero is NOT split.** It's a centered-hero: large serif headline "Refreshingly easy restaurant tech" with two CTAs directly beneath ("Get started" white pill, "Contact sales" blue pill), followed by a full-width hero video (play-button visible) showing a restaurant worker.

F-012 evidence, second instance (see also resy/pattern.md). Square has shifted from split-hero-with-product-screenshot to centered-hero-with-video.

## Measured dimensions (1600×900)

### Hero composition
- Primary elements visible: **6** (top Square logo + 5 nav items, sub-nav "Food & Beverage" + 6 items, large headline, 2 CTAs, video thumbnail with play button)
- Density: ~4 per 100k px² above fold (the video band is large but visually uniform)
- Layout: centered headline + centered CTAs + large video below

### Text hierarchy
- Headline ≈ 72-80px extra-light serif (high-weight serif family)
- CTAs ≈ 16px pill buttons
- Nav ≈ 14-16px
- Ratio ≈ 5:1 (headline-dominant; no subhead band — the value prop is compressed into the headline alone)

### Motion
- Video is the only motion element (autoplay likely on scroll-into-view or user play).
- Motion count: 1 (video). Cycle: video duration (30-60s loop). Area: ~50% of hero when playing.
- Liveness perceptibility estimate: medium-high — the video hero reads as alive even before play, because the frame suggests footage (worker, bottles) rather than a still. If it autoplays on scroll, score 7-8/10 for 3b.

### Illustration craft tier
- **photography / motion** (video footage of a real restaurant scene). Not product-UI. Different tier from Linear but at premium end of photo-led.

### Layout convention
- Centered single-column with video below copy. Similar to Linear's layout (not split-hero), but swap live-UI for video.

### First-5-sec comprehension
- Headline "Refreshingly easy restaurant tech" + 2 CTAs ("Get started", "Contact sales") + restaurant video = visitor gets "software for restaurants" in <3 seconds. Strong. Score estimate: 9/10.

## Why this sample is in the bank

1. **Enterprise centered-hero pattern with video.** Proves not all enterprise LB-SaaS uses split-hero. Both layouts coexist in the sector — centered-with-video (Square) and split-hero (earlier Square, possibly Mindbody). Don't over-index on split-hero being "the only right answer."
2. **Video-as-hero tier.** A legitimate illustration-craft option adjacent to live-UI. Video can provide liveness without the engineering cost of rendering actual product UI on the landing.
3. **CTA pair pattern.** Two complementary CTAs (primary action + sales/enterprise route) directly under headline is the sector dominant pattern. Use as a check for Example Marketplace's hero CTA pair.

## Scoring guidance

When using Square for Restaurants as a `vs_best_in_class_anchor`:
- Candidate's liveness signal can be video (not just live-UI) and still land in the same family
- Candidate's headline should do the pitch heavy-lifting — don't rely on subhead to clarify
- CTA pair should be present and high on the hero, not tucked below the fold
- Beware anchor bias: Square is a market leader with established brand — its "no subhead" confidence doesn't transfer to unknown indie brands. Example Marketplace likely still needs a subhead band for comprehension.
