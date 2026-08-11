# Sector: local-business-saas

**Target persona:** Solo owners of small local businesses (cafés, restaurants, salons, retail, studios). Non-technical. Mobile-first discovery. 5-second judgment on cold landing. Skeptical of SaaS.

**Sample bar:** all listed products have shipped and have demonstrable traction (YC / public funding / known to industry). Samples are scored on the 8-dimension rubric and must median ≥ 7/10 for inclusion.

## Current samples

**Capture status (2026-04-21):** 3 of 7 samples have full capture bundles — `benchmark-landing` Step 0 gate **passes** for local-business-saas sector. Capture session exposed two stale assertions (Resy + Square for Restaurants — both had different hero patterns than the pre-capture table asserted) and one anti-bot block (OpenTable). Per-sample `pattern.md` files contain per-element motion measurements, positioning tags, and usability notes for each as a `vs_best_in_class_anchor`.

**Gaps surfaced by this capture session (tracked for follow-up):**
- OpenTable blocks Playwright entirely (Access Denied). Needs stealth-browser tooling (puppeteer-extra-plugin-stealth, playwright-extra) or manual capture upload path. This is the sample the WI-088 "OpenTable archetype" claim referenced — until it's captured, that claim remains unverifiable.
- `hero.webm` motion capture is required per `benchmark-landing/SKILL.md` dimension 3b but no `scripts/capture-motion.mjs` exists yet. All current `pattern.md` motion measurements are eyeballed from stills — will need recomputation once WebM capture tooling lands.
- Cookie modals block first-shot capture on most sites (Resy, Square). Need a `scripts/capture-landing.mjs` helper that handles common consent-dismissal patterns (Reject all / Decline All button detection).
- Memory-based medians are unreliable: 2 of 3 captured samples contradict the pre-capture table. **Do not trust the "Pattern density summary" below until recomputation from per-sample `pattern.md` files lands (F-017).**

| Product | Year | Tier | Positioning | Hero pattern (captured or asserted) | Capture bundle | Notes |
|---|---|---|---|---|---|---|
| Linear | 2026-04-21 | indie | indie-alive | stacked: copy band on top, live-UI product embed below (real Linear issue with activity feed + Codex popover) | ✅ CAPTURED (`linear/`) | Best-in-class live-UI anchor. Use as primary `vs_best_in_class` anchor for indie-alive candidates. |
| Square for Restaurants | 2026-04-21 | enterprise | enterprise-defensive | centered-hero: big serif headline + 2 CTAs + hero video below | ✅ CAPTURED (`square-for-restaurants/`) | **Stale assertion corrected** — was "split-hero with POS screenshot"; actual is centered + video. |
| Resy | 2026-04-21 | enterprise | enterprise-defensive | editorial feature image + journalism-style headline | ✅ CAPTURED (`resy/`) | **Stale assertion corrected** — was "full-bleed restaurant photo + overlay CTA"; actual is editorial/magazine layout. ⚠️ Do NOT use as `vs_best_in_class` anchor for owner-facing pitches (Resy's consumer home is not a SaaS pitch). |
| OpenTable | — | enterprise | enterprise-defensive | split-hero (asserted, unverified) | ⛔ BLOCKED — Playwright Access Denied | Needs stealth-mode capture tooling or manual screenshot. Tracked as capture-tooling gap. |
| Mindbody | — | enterprise | enterprise-defensive | split-hero (asserted, unverified) | ⛔ PENDING | Not attempted in 2026-04-21 capture session. |
| Top of Mind Networks | — | indie | indie-defensive | centered single-column + large illustration below (asserted) | ⛔ PENDING | Not attempted in 2026-04-21 capture session. |

**Positioning tag (F-014):** `enterprise-defensive` optimizes for "we won't break" (static, conservative); `indie-alive` optimizes for "we feel alive." For indie SaaS where liveness IS the differentiator (Example Marketplace's Flash Offers pitch), scoring against the *global* median pulls toward the enterprise end. Track a separate `indie-alive` segment — current gap: zero indie-alive samples in this bank. Candidate adds (positioning-matched, not sector-matched): Linear `/home`, Raycast `/`, Attio `/`, Cron pre-acquisition hero. Add at next bank refresh.

**Pattern density summary (asserted — pending recomputation from per-sample pattern.md files):**

| Dimension | Median across samples |
|---|---|
| Primary elements in hero | 4 (headline, subhead, 1 CTA, 1 product visual) |
| Motion count | 0-1 (mostly static; 1 small live element if any) |
| Text hierarchy ratio | ~3:1:1 (headline : subhead : CTA label) |
| Illustration craft tier | Product screenshot (live or rendered) — NOT character illustration |
| Density per 100k px² | ~5 elements |
| Mobile behavior | Stack vertically; hero visual below copy; preserve CTA prominence |

**Key patterns applicable to Example Marketplace:**

- **Copy left, visual right.** All 5 samples use the split-hero. Example Marketplace Landing should preserve this (it does now, post-restore).
- **Static or barely-moving visuals.** None of these use 12-character animated scenes. The most "live" element observed is a single animated booking-availability pill (OpenTable).
- **Product screenshot > illustrated scene.** Enterprise LB-SaaS uses actual UI; indie uses minimal illustration. Neither goes for busy animated character stories.
- **One dominant CTA.** Not "try free + see demo + read docs." One primary, one minor outline.

## What Example Marketplace's current landing fails on (benchmarked against this sector)

- **Motion count:** Example Marketplace hero card = 12+ simultaneously animating characters + 4 countdowns + pulses + tints. Sector median is 0-1 motion per hero. **Example Marketplace is ~15× sector median** — reads as chaotic noise at embedded size.
- **Primary element count:** Example Marketplace right card at 600×338 has 18+ distinct visible elements (headline, 12 characters, payoff card, claim counter, bakery building, lightning pill, door, windows, barista). Sector median is 4. **Example Marketplace is ~4.5× sector median.**
- **Illustration craft:** Example Marketplace uses flat-SVG character art at 30×52px scaled size — reads as colored blobs. Sector uses live product UI (Linear / Square / OpenTable) or single illustrated element (indie). **Wrong illustration tier for target persona.**
- **Density:** Example Marketplace ~18 elements in ~200k px² container ≈ 9 per 100k px². Sector median ≈ 5. **80% denser than sector.**

**Conclusion:** Example Marketplace landing right-card is using the WRONG illustration strategy (animated-character-story) for a local-business-SaaS target. The closest-to-correct pattern in this sector is OpenTable's live-availability pill — ONE animated signal embedded in an otherwise-static split-hero.

## Stewardship

- Refresh every 6 months; mark samples `deprecated: true` if they redesign
- When a sample enters top 3 rankings in its sector, bump to "bar-setter" tier
- Discard any sample that falls below 7/10 on re-evaluation
