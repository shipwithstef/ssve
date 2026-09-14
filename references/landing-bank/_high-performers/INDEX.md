# Sector: _high-performers (cross-sector)

Cross-sector reference bank of consistently high-performing landing pages, curated for inspiration regardless of the project's vertical. Where the `b2b-saas-vertical/` and `local-business-saas/` banks anchor sector-specific archetypes, this bank captures techniques that travel across categories — type systems, hero compositions, trust strategies, pricing transparency patterns, and CTA hierarchies that work whether the buyer is a restaurant operator, a developer, or a wellness studio owner.

The deliberate style mix below ensures `landing-page` and `benchmark-landing` reviewers cannot collapse to a single aesthetic. A project sector might suggest one style, but inspiration should reach across all four.

## Style categories represented

- **Sharp-utilitarian-dev-tool** — restraint, pixel-perfect product screenshots, code-snippet authority, near-monochrome palette
- **Lush-illustrative-creator-tool** — branded illustration system, warm character art, multi-use-case sub-page branching
- **Bold-statement-typography** — viewport-edge headline scale, single-claim subhead, demand-attention-through-restraint
- **Calm-minimal-data-tool** — 6-word headlines, single-incumbent positioning, calm color palette, pricing-as-feature

## Anchors (10, mixed style)

| Anchor slug | Brand | Style category | Archetype |
|---|---|---|---|
| `linear` | Linear | sharp-utilitarian-dev-tool | Sharp-utility hero with product-as-marketing fidelity |
| `vercel` | Vercel | sharp-utilitarian-dev-tool | Command-line-snippet hero with founder-credibility transfer |
| `stripe` | Stripe | sharp-utilitarian-dev-tool | Dual-persona hero with code-snippet authority |
| `notion` | Notion | lush-illustrative-creator-tool | Illustrated-mascot hero with verb-first activation |
| `cal-com` | Cal.com | lush-illustrative-creator-tool | Open-source-wedge hero with honest comparison table |
| `cursor` | Cursor | bold-statement-typography | Bold-statement typography with single-claim subhead |
| `posthog` | PostHog | bold-statement-typography | Bold-typography hero with radical-transparency stack |
| `plausible` | Plausible | calm-minimal-data-tool | Calm-minimal hero with single-incumbent positioning |
| `resend` | Resend | calm-minimal-data-tool | Calm-minimal hero with code-snippet integration surface |
| `tana` | Tana | calm-minimal-data-tool | Novel-primitive hero with definition-as-positioning |

Each anchor folder contains `pattern.md` (analysis), `hero.png` (1920×1080 above-fold), and `hero.webm` (5-10s scroll-cast). The PNG and WEBM are TODO-capture — see `landing-page/references/reference-bank-capture.md` for the Playwright recipe. The `pattern.md` files are authoritative until binary captures land.

## Refresh cadence

12 months. After that, `validate-landing-page-freshness.sh` flags the anchor as stale; capture a fresh PNG/WEBM and update `pattern.md` if the page redesigned materially. Cross-sector anchors tend to redesign on a faster cycle than vertical-SaaS anchors — Vercel, Linear, Cursor have all shipped major homepage refactors within 12-month windows historically. Watch this bank more actively.

## Adding a new anchor

1. Confirm the candidate genuinely fits one of the four style categories above. If it spans two, pick the dominant. If it fits none, propose a new category before adding.
2. Create `<anchor-slug>/` directory using `brand-name-lowercase-kebab` naming.
3. Write `pattern.md` per the schema in `landing-page/references/reference-bank-capture.md` (≥40, ≤120 lines).
4. Capture `hero.png` + `hero.webm` per the Playwright recipe.
5. Add a row to the table above with style category and archetype name.
6. If adding a third anchor in any single style category, audit whether the bank is over-rotating; consider rebalancing.
