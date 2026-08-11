# Sector: local-business-saas

SaaS for SMB local-service businesses — home services, beauty/wellness, dental, auto repair, independent creatives. Distinguishing features from horizontal B2B (Salesforce-class) and from b2b-saas-vertical (which covers restaurant/hospitality):

- The buyer is usually the owner-operator, not a procurement team — page must answer "is this for me?" within 5 seconds
- Trust signals lean on volume metrics ("250k+ pros") or peer-recognizable independent-business names rather than Fortune-500 logos
- Pricing model is per-location or per-seat, often with explicit free-trial / no-credit-card offers in the hero
- Mobile-first discovery is dominant — many owners browse from a phone between jobs
- Two-sided dynamics common: the page often has to sell BOTH the operator AND their end-clients in one composition

## Anchors (≥10 required for landing-page Self-Verify #1 post-WI-131)

| Anchor slug | Brand | Archetype |
|---|---|---|
| `linear` | Linear | Stacked copy-band over live-UI product embed (positioning anchor — indie-alive) |
| `resy` | Resy (consumer) | Editorial feature image with journalism-style headline |
| `square-for-restaurants` | Square for Restaurants | Centered serif headline with hero video below |
| `jobber` | Jobber | Dual-device-trade-hero (phone + laptop split, numeric trust stack) |
| `housecall-pro` | Housecall Pro | Identity-aspiration-hero (practitioner photo + outcome promise) |
| `vagaro` | Vagaro | Two-sided-marketplace-hero (rotating sub-vertical headline + consumer-app visual) |
| `boulevard` | Boulevard | Editorial-premium-hero (luxury-brand visual language, demo-only CTA) |
| `dentrix-ascend` | Dentrix Ascend | Migration-narrative-hero (trust-by-incumbency + compliance-bar-first) |
| `shopmonkey` | Shopmonkey | Competitor-displacement-hero (names legacy incumbent in headline) |
| `honeybook` | HoneyBook | Category-invention-hero (coined noun + layered card-stack collage) |

Each anchor folder contains `pattern.md` (analysis). Anchors created on or after 2026-04-27 (jobber, housecall-pro, vagaro, boulevard, dentrix-ascend, shopmonkey, honeybook) have `pattern.md` only — `hero.png` and `hero.webm` are deferred to `track-visuals` external-anchor mode. The `pattern.md` files are authoritative until binary captures land.

## Refresh cadence

12 months. After that, `validate-landing-page-freshness.sh` flags the anchor as stale; capture a fresh PNG/WEBM and update `pattern.md` if the page redesigned materially.

## Adding a new anchor

1. Create `<anchor-slug>/` directory
2. Write `pattern.md` per the schema in `landing-page/references/reference-bank-capture.md`
3. Capture `hero.png` + `hero.webm` per the Playwright recipe (or queue via `track-visuals` external-anchor mode)
4. Add a row to the table above
5. Confirm the new archetype name does not duplicate one already in this or sibling sector indexes

## Sibling-sector dedup note

Anchors in this sector intentionally avoid duplication with `b2b-saas-vertical/` (restaurant/hospitality/Mindbody) and `_high-performers/` (Linear is a deliberate cross-listing as a positioning anchor — indie-alive — see `resy/pattern.md` and `linear/pattern.md` for rationale).
