# Fixture: US Delaware LLC, two co-founders

This fixture represents the canonical US-based two-founder shape. Used to verify AC-07 (profile bias).

## Profile content

```markdown
# Founder Profile

Last updated: 2026-04-26

## Tax residence
- Country: United States
- Residency status: both founders US persons (citizens or green-card holders)
- States: California (founder A), New York (founder B)

## Employment status
- Founder A: full-time on this venture (left previous W-2)
- Founder B: 50% time, retains W-2 elsewhere
- Annual gross income: founder A ~$0 from this venture, founder B ~$200K from W-2

## Household applicant pool
- Spouses: not co-founders
- Co-founders: 2 (founder A + founder B)
- Other household applicants: 0

## Risk tolerance
- Incorporation: already incorporated as Delaware LLC (multi-member, taxed as partnership)
- Considering Delaware C-Corp conversion if/when raising priced round
- Personal liability exposure: medium (B2B SaaS, handles customer PII)
- Geographic flexibility: US-only customers initially; international after MRR proven

## Existing credits
- Microsoft Founders Hub: not applied
- AWS Activate: $1K Founders tier active
- NVIDIA Inception: not applied
- Google Cloud for Startups: not applied
- xAI Grok deposit: done — $150/mo perpetual active
- Cloudflare for Startups: not applied
- PostHog for Startups: not applied
- Perplexity for Startups: not applied
- Stripe Atlas: did NOT use (incorporated via local lawyer instead)

## Programs previously rejected
- (none)

## Past project portfolio
- Founder A: 2 prior shipped SaaS products, $50K + $200K total revenue (proven distributor)
- Founder B: 1 enterprise B2B exit (acquihire), strong network in fintech vertical
- Distribution channels tried: outbound enterprise sales, founder-network warm intros
- Distribution channels NOT tried: HN Show, Product Hunt, programmatic SEO

## Notes
- Already on Mercury for banking
- Already on Stripe (direct, not Atlas)
- Want to optimize for fundraising-readiness within 12 months
```

## Expected biases when this fixture is loaded

`launch-knowledge` should produce these specific outputs:

### `launch-vehicle-decision.md`
- **Skip BG / EE jurisdiction content entirely** — irrelevant
- Acknowledge existing Delaware LLC; recommend **conversion to Delaware C-Corp** when first priced-round LOI lands (cite YC/Carta standard practice)
- Stripe + Mercury already in place; do NOT recommend Stripe Atlas (already incorporated)
- VAT not applicable for US-only customers; flag for international expansion
- Risk note: as multi-member LLC taxed as partnership, founder B's W-2 + LLC K-1 income may push tax bracket — recommend talking to CPA before year-end

### `credit-stack-plan.md`
- Top 3 to apply NOW:
  1. **Microsoft for Startups Founders Hub** — V=$150K, P=0.8 (US incorporation + 2 cofounders is a strong profile), U=0.3, ROI ≈ 2,880×
  2. **NVIDIA Inception** — V=$100K AWS + $150K Nebius. AWS Activate Founders is already $1K — escalate via NVIDIA Inception to Portfolio tier. P=0.7
  3. **PostHog for Startups** — V=$50K, P=0.7 (B2B SaaS + <2yr is strong fit)
- Tier 2:
  4. **Cloudflare for Startups** — V=$5K, P=0.7
  5. **Google Cloud for Startups** — V=$2K bootstrapped or $100K+ if VC-referred (founder B's network may unlock). P=0.4 self-apply, 0.8 referred
  6. **Perplexity for Startups** — V=$5K, P=0.7
- **Already done** (skip):
  - xAI Grok deposit ($150/mo perpetual) — confirmed in profile
- **Ignore** (US-shaped, already covered):
  - Stripe Atlas (already incorporated)

### `runway-projection.md`
- **Vercel Pro + Neon** flagged at $40/mo base for 2 founders (Vercel Pro is per-seat $20/seat) per `platforms/composable/vercel-neon.md`
- **Cloudflare Workers + D1 + R2** flagged as cheaper-at-scale alternative ($5/mo flat) per `platforms/composable/cloudflare-workers-d1-r2.md`
- **Supabase Pro** ($25/mo flat, no per-seat) flagged as middle-ground
- Recommendation: stay on current stack until first $1K MRR; revisit at scale

### `distribution-plan.md`
- B2B SaaS first-100-customers playbook (see `distribution/first-100-customers-b2b-saas.md`)
- Lean into founder B's fintech network for warm intros — highest ROI channel given profile
- Defer programmatic SEO to month 6+ (long lead time; founder-network outbound has 10× faster cycle for first 20 customers)

## Diff from empty-profile run

Empty-profile would NOT include the per-seat Vercel cost warning (no co-founder count known), would NOT recommend C-Corp conversion timing (no LLC-already-exists context), and would offer the BG/EE jurisdictions as candidates (no US residence known). This fixture's output is measurably different.
