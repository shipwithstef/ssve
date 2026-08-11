# Fixture: BG resident, above max insurable cap, solo founder

This fixture represents the most common Stefan-shaped builder. Used to verify AC-07 (profile bias).

## Profile content

```markdown
# Founder Profile

Last updated: 2026-04-26

## Tax residence
- Country: Bulgaria
- Residency status: long-term resident, full tax-resident
- City: Sofia

## Employment status
- Primary employment: full-time employee at a registered BG entity
- Annual gross salary: 80,000 BGN (well above max insurable income cap of ~49,560 BGN/year, 2026)
- Status vs cap: ABOVE — primary employment already saturates social-security contributions

## Household applicant pool
- Spouse: present, separate registration possible (see bg.md for dual-employment math)
- Co-founders: none currently
- Other household applicants: 0

## Risk tolerance
- Incorporation: prefers свободна професия until first €5K MRR (UNLESS employer IP-clause concern present — then EOOD now via spouse-as-owner pattern)
- Personal liability exposure: low (digital products only, standard TOS)
- Geographic flexibility: Bulgaria-only for now (no plans to relocate)
- **IP clause check:** if profile has `employer_ip_clause: restrictive` flag, default recommendation flips to spouse-owned EOOD (Layer 1 €153) immediately, not "defer until MRR"

## Expected КЕП requirement (precondition for any BG digital filing)
- Personal Cloud КЕП needed for own NAP filings — 6 лв/year (€3.07)
- If becoming EOOD owner: upgrade to Professional Cloud КЕП — 50.40 лв/year (€25.77)
- Source: `references/knowledge/competitors/b-trust-bg/CAPABILITIES.md`
- Sequencing: КЕП before any TR/NAP filing (mobile-app onboarding via B-Trust Mobile, no hardware)

## Existing credits
- Microsoft Founders Hub: not applied
- AWS Activate: not applied
- NVIDIA Inception: not applied
- Google Cloud for Startups: not applied
- xAI Grok deposit: not done
- Cloudflare for Startups: not applied
- PostHog for Startups: not applied
- Perplexity for Startups: not applied

## Programs previously rejected
- (none yet — first launch decision)

## Past project portfolio
- 50+ side projects, $0 cumulative revenue (matches `~/.svc/builder-profile.md` build-no-launch pattern)
- Distribution channels tried: cold email (low yield), Twitter/X (mixed), Product Hunt (1 launch, no traction)
- Distribution channels NOT tried: HN Show, Reddit, niche communities, vertical SaaS direct outreach

## Notes
- Wife less infra-comfortable; pick managed platforms over self-hosted
- Bulgarian credit cards sometimes rejected by Google Cloud and Oracle Cloud (KYC fraud filter)
```

## Expected biases when this fixture is loaded

`launch-knowledge` should produce these specific outputs:

### `launch-vehicle-decision.md`
- Recommend **свободна професия under БУЛСТАТ**, NOT EOOD, NOT Stripe Atlas LLC
- Cite the cap-saturation rule: "primary employment ≥ max insurable cap → registering self-employed adds €0 net SS cost"
- VAT trigger note: "register at 100K BGN/year revenue, mandatory"
- Revisit triggers: first €5K MRR, first co-founder, raising capital, US-customer-LLC-protection requirement
- **Reject Stripe Atlas explicitly** with CFC-trap citation (see `bg.md` and `us-de.md`)

### `credit-stack-plan.md`
- Top 3 to apply NOW (high ROI per Calculator 2):
  1. **Microsoft for Startups Founders Hub** — V=$150K, P=0.7 (no incorp gate, no funding gate), U=0.3, ROI ≈ 2,520×
  2. **NVIDIA Inception** — V=$100K AWS + $150K Nebius, P=0.6 (BG OOD acceptable; no VC required), but spouse-OOD needed first
  3. **Cloudflare for Startups** — V=$5K, P=0.6 bootstrapped tier, immediate apply
- Tier 2 (apply after Tier 1 confirmed):
  4. **PostHog for Startups** — V=$50K, P=0.5
  5. **Perplexity for Startups** — V=$5K, P=0.7
  6. **xAI Grok deposit** — V=$150/mo perpetual, P=1.0 (deterministic; deposit $5)
- **De-prioritize** all VC-gated programs (OpenAI Startups, Anthropic Startups, Vertex AI $350K) — cite ~0% approval for bootstrapped EU founders

### `runway-projection.md`
- Baseline platform: keep Base44 if existing; if greenfield, recommend **Cloudflare Workers + D1 + R2** ($5/mo) OR **Supabase Pro** ($25/mo) per Calculator 3
- Total free runway with Tier 1 credits: **12–24 months** of enterprise infra (per `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part D)
- BG-specific note: avoid Google Cloud + Oracle Cloud retail trials due to BG card KYC issues

### `distribution-plan.md`
- Skip Product Hunt (already tried, no result per profile)
- Recommend HN Show + Reddit niche subs + first-100 B2B SaaS playbook (see `distribution/first-100-customers-b2b-saas.md`)
- Cold email NOT discouraged but flag low past yield; suggest pivot to vertical SaaS direct outreach

## Diff from empty-profile run

Empty-profile would produce a generic ranked list with no jurisdiction-specific Stripe Atlas rejection, no cap-saturation math, and no Bulgarian-card warning. This fixture's output is measurably different.
