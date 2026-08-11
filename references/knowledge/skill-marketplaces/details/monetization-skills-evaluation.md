# Monetization Skills Evaluation — Layer 3 Details

**Context:** WI-008 (customer premium gating not enforced) and WI-016a (bundle optimization) need monetization architecture expertise. The question: which features to hard-paywall, usage-limit, or keep free — grounded in business analysis.

## The Specific Gap

None of the 14 installed skills answer: **"Given N pages and M pricing tiers, which features should be hard-paywalled, which should be usage-limited, and which should be free — and what's the evidence?"**

This is a **monetization architecture** decision that combines:
1. Competitor gating analysis (what do competitors gate at each tier?)
2. Domain best practices (freemium vs hard paywall vs usage metering for the specific market)
3. Product-specific wedge analysis (which feature drives adoption? paywalling it kills growth?)
4. Revenue math (usage-limiting vs hard gating for pre-revenue products)
5. Feature-value mapping (which features are table-stakes vs differentiation vs premium?)

## Installed Skills Assessment (against WI-008 need)

| Skill | Covers WI-008 gap? | What it DOES cover | What it MISSES |
|---|---|---|---|
| `pricing` | 30% | What to charge, tier structure, value metrics, packaging | Does NOT answer "which features go in which tier" with evidence. Gives frameworks but not feature→tier mapping methodology |
| `paywalls` | 20% | How to design the paywall UI/UX, conversion optimization | Assumes you already DECIDED what to gate. Does NOT help decide what to gate |
| `churn-prevention` | 5% | Post-gate retention, cancel flows | Irrelevant to the gating decision itself |
| `mor-vs-stripe` | 0% | Payment processor comparison | Wrong domain entirely |
| `stage-revenue` | 10% | Revenue staging strategy | Helps with "should we monetize now?" but not "which features to gate" |
| Dodo stack (6 skills) | 0% | Payment implementation | Implementation, not strategy |

**Combined coverage of installed skills against WI-008: ~35%**

The remaining 65% is the monetization architecture gap: feature→tier mapping, gating mechanism selection (hard paywall vs usage limit vs time limit vs feature limit), competitor gating benchmarks, and wedge protection analysis.

## External Candidate Assessment

### 1. eronred/aso-skills@monetization-strategy (618 installs)

**Full read completed.** Covers:
- Model comparison (freemium+subscription, freemium+IAP, paid upfront, free+ads, hybrid)
- Subscription pricing with category benchmarks
- Paywall timing and conversion rates by trigger type
- Free trial strategy with length recommendations
- IAP strategy (consumable + non-consumable)
- Revenue metrics and targets

**Against WI-008:** Adds ~15% coverage. Has paywall timing recommendations and conversion benchmarks that pricing lacks. But it's mobile-app-focused (App Store, IAP, Apple review guidelines) — not SaaS web app focused. The paywall timing table (onboarding: 2-5%, aha moment: 5-10%, feature gate: 8-15%, usage limit: 5-8%) is useful but generic.

**Verdict: SKIP for blend, MAYBE as external addon.** The mobile focus makes it wrong for SaaS web gating decisions. The paywall timing data is the only new signal, and it's too generic to justify a blend.

### 2. manojbajaj95/claude-gtm-plugin@pricing-strategy (118 installs)

**Full read completed.** Covers:
- Same Van Westendorp + MaxDiff + Gabor-Granger as installed pricing
- Value-based pricing (identical framework)
- Tier structure with anchor pricing
- More detailed research methods section

**Against WI-008:** Adds ~5% coverage. Slightly more detailed on pricing research methods (Gabor-Granger, conjoint analysis), but fundamentally the same skill as installed pricing. More verbose, not more useful.

**Verdict: SKIP entirely.** Duplicate of installed pricing with minor additions. Not worth blend or external addon.

### 3. scientiacapital/skills@business-model-canvas (262 installs)

**Full read completed.** Covers:
- Osterwalder's 9 building blocks (Customer Segments, Value Props, Channels, Relationships, Revenue Streams, Key Resources, Key Activities, Key Partnerships, Cost Structure)
- Revenue stream types and pricing mechanisms
- Customer segment types

**Against WI-008:** Adds ~10% coverage. The Revenue Streams block and Customer Segment analysis gives a strategic framework, but it's too high-level for feature→tier mapping. A business model canvas says "we make money via subscriptions" — it doesn't say "Flash Offers should be in Growth tier because..."

**Verdict: EXTERNAL ADDON (not for WI-008, but for pipeline).** Useful for early-stage strategy (before pricing). Complements stage-revenue. Not worth blending into svc core — it's a standalone framework skill. Add to EXTERNAL_ADDONS.md as an optional strategy addon.

### 4. sickn33/antigravity-awesome-skills@startup-financial-modeling (184 installs)

**Not read (repo structure unclear from clone).** Based on description: startup financial modeling, P&L, runway.

**Against WI-008:** Likely 0% coverage. Financial modeling is about projecting revenue, not deciding what to gate.

**Verdict: SKIP for WI-008. MAYBE external addon for pipeline (stage-revenue complement).**

### 5. personamanagmentlayer/pcl@finops-expert (78 installs)

**Not readable (404 on GitHub).** Based on description: FinOps, cloud cost optimization.

**Against WI-008:** 0% coverage. FinOps is about reducing cloud infrastructure costs, not product monetization.

**Verdict: SKIP. Wrong domain entirely.**

## The Real Answer: Create a New Skill

**None of the external candidates fill the WI-008 gap.** The gap is specifically:

### What `monetization-architecture` (new skill) would do:

**Input:** Product pages/features, pricing tiers, competitor gating data, user behavior data
**Output:** Feature→tier mapping with evidence-graded justification for each decision

**Decision framework it would contain:**
1. **Feature Classification** — table-stakes (must be free) vs differentiation (gate to mid-tier) vs premium (gate to top tier)
2. **Gating Mechanism Selection** — hard paywall vs usage limit vs time limit vs feature preview, with decision matrix
3. **Wedge Protection Analysis** — which feature drives adoption? if you paywall the wedge, you kill growth
4. **Competitor Gating Benchmark** — what do competitors at each tier gate? (requires research skill or analyze-competitors output)
5. **Revenue Impact Modeling** — estimated revenue impact of each gating decision (requires usage data or assumptions)
6. **Enforcement Audit** — check code for actual enforcement vs stated policy (exactly WI-008's problem)

**Patterns to blend FROM existing skills:**
- From `pricing`: tier structure framework, value metric selection
- From `paywalls`: gating mechanism types, conversion benchmarks
- From `validate-feature`: evidence-graded kill/ship signals
- From `analyze-competitors`: competitor analysis structure
- From `eronred/aso-skills@monetization-strategy`: paywall timing + conversion rate benchmarks

**This is a CREATE, not a blend.** The components exist in fragments across 5 skills, but no single skill orchestrates the monetization architecture decision.

## Recommendation Summary

| Skill | Action | Reason |
|---|---|---|
| `eronred/aso-skills@monetization-strategy` | SKIP (blend) / OPTIONAL external | Mobile-focused; only paywall timing benchmarks are new |
| `manojbajaj95/claude-gtm-plugin@pricing-strategy` | SKIP entirely | Duplicate of installed pricing |
| `scientiacapital/skills@business-model-canvas` | EXTERNAL ADDON | Useful for early pipeline, not for WI-008 |
| `sickn33/.../startup-financial-modeling` | SKIP for WI-008 | Financial modeling, not gating decisions |
| `personamanagmentlayer/pcl@finops-expert` | SKIP entirely | Wrong domain (cloud costs, not product monetization) |
| **NEW: `monetization-architecture`** | CREATE in svc core | The actual gap — feature→tier mapping with evidence |
