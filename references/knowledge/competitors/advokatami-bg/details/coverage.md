# Advokatami.bg — Coverage Table

Site has **1,346 total URLs** in sitemap. Focused subset extracted (18 URLs covering structural / capability pages); remaining ~1,328 are advocate profiles, blog posts, and document templates that are inventory-not-capability.

## Coverage scorecard (focused subset)

| Status | Count | Notes |
|---|---|---|
| read (content extracted verbatim) | 16 | Identity + service + capability pages |
| 404 | 2 | /politika-za-poverielnost/ + /cookies/ — privacy/cookies pages at expected URLs not present (may use different slug) |
| External verifications | 3 | Trustpilot (no listing — uses Google instead), Crunchbase (matches), SAC (2018 protocol verified) |
| **Subset coverage** | **18/18** (100%) | |
| Total site URLs (informational) | 1,346 | 488 blog / 133 doc / rest are profiles + templates |

## URL → category map (focused subset)

### Identity + Credibility (8 URLs)
- `/` — homepage hero with credibility metrics
- `/za-nas/` — founder Stanimir Nenov + team description
- `/nameri-advokat/` — find-an-advocate flow (network model)
- `/karieri/` — careers (team scale signal)
- `/partniori/` — partner network
- `/premium/` — premium tier description
- `/start/` — onboarding entry point
- `/kontakti/` — contact page

### Incorporation services (4 URLs)
- `/registracia-na-firma/` — EOOD/OOD/ET registration €119
- `/registracia-na-npo/` — NPO registration от €119
- `/promeni-v-biznesa/` — TR amendments
- `/deklaratsia-za-firma-bez-deinost/` — zero-activity declaration €35

### Ongoing services (3 URLs)
- `/schetovodstvo/` — accounting service
- `/gdpr/` — GDPR documentation
- `/zastrahovki/` — insurance services

### Legal disclosures (1 URL extracted, 2 not found at expected slugs)
- `/obshti-uslovia/` — General terms
- `/politika-za-poverielnost/` — 404 (slug variant unknown)
- `/cookies/` — 404 (slug variant unknown)

### External cross-checks
1. Trustpilot search — 0 reviews (they use Google instead)
2. Commercial Registry / Google search — found ЕИК 204364658 + 204649842 (verify at TR portal before official use)
3. SAC archives — 2018 disciplinary investigation protocol confirmed

## What was NOT extracted

- **488 blog post URLs** — sitemap has them; activity scorecard captured 187 via WP REST API. For content extraction, run `blog-content-extract.mjs` if needed.
- **133 doc/template URLs** — document templates inventory; not material for capability assessment
- **Hundreds of advocate profile pages** — individual lawyers in network; not material unless evaluating a specific advocate
- **Per-month accounting tier pricing** — /schetovodstvo/ page acknowledged but per-tier prices not extracted in this pass
- **Funding round details** — Crunchbase/Dealroom listings noted but not deeply analyzed (out of scope)

## Re-extraction triggers (if more depth needed)

- **Engagement decision pending pricing** → extract /schetovodstvo/ for monthly accounting tiers
- **Privacy policy review** → find correct slug (likely /politika-za-zasthita-na-lichnite-danni/ or similar) and extract
- **Specific advocate in network** → extract that profile URL
- **Recent blog content** → run `node research/scripts/blog-content-extract.mjs https://www.advokatami.bg --domain references/knowledge/competitors/advokatami-bg --months 12`
