# Sector: b2b-saas-vertical

Vertical-specific B2B SaaS — restaurant tech, healthcare-clinic SaaS, fitness-studio SaaS, real-estate-team CRM. Distinguishing features from horizontal B2B (Salesforce-class):

- Hero almost always shows the actual product UI in context, not a stock business scene
- Trust bar uses RECOGNIZABLE customer names from the vertical (a Toast review uses "Sweetgreen", not "Acme Corp")
- Pricing is per-location or per-seat, not per-user
- The page MUST teach the visitor how the product fits their daily-workflow, not just feature-list

## Anchors (≥3 required for landing-page Self-Verify #1)

| Anchor slug | Brand | Archetype |
|---|---|---|
| `toast-pos` | Toast (restaurant POS) | Product-hero with workflow-cards underneath |
| `square-restaurants` | Square Restaurants | Asymmetric hero, right-side dashboard mockup |
| `resy-business` | Resy for Restaurants | Founder-quote hero with reservation-volume metric |
| `square-online` | Square Online | Free-tier hero with itemized inclusion list |
| `lightspeed-restaurants` | Lightspeed Restaurants | Multi-tier-vertical hero with competitor-switching shortcuts |
| `cloudbeds` | Cloudbeds | Underserved-segment hero with global-scale numeric proof |
| `mindbody` | Mindbody | Two-sided network hero with demand-side proof |
| `mews` | Mews | Liberation-narrative hero against a generic foil |
| `opentable-restaurant` | OpenTable for Restaurants | Marketplace-scale hero with cost-transparency wedge |
| `lavu` | Lavu | Form-factor-commitment hero with niche cuisine callouts |

Each anchor folder contains `pattern.md` (analysis), `hero.png` (1920×1080 above-fold), `hero.webm` (5-10s scroll-cast). The PNG and WEBM are TODO-capture — see `landing-page/references/reference-bank-capture.md` for the Playwright recipe. The `pattern.md` files are authoritative until binary captures land.

## Refresh cadence

12 months. After that, `validate-landing-page-freshness.sh` flags the anchor as stale; capture a fresh PNG/WEBM and update `pattern.md` if the page redesigned materially.

## Adding a new anchor

1. Create `<anchor-slug>/` directory
2. Write `pattern.md` per the schema in `landing-page/references/reference-bank-capture.md`
3. Capture `hero.png` + `hero.webm` per the Playwright recipe
4. Add a row to the table above
