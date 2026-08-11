# Scoring Guide

## Six Dimensions

| Dimension | Weight | What It Measures | Scoring Guide |
|---|---|---|---|
| **Guaranteed revenue** | 30% | Is there PROOF similar products make $1K+/mo? | 10 = multiple products with public revenue data. 7 = one product with evidence. 4 = app store rankings suggest it. 1 = "people might pay for this." |
| **Builder fit** | 25% | Can THIS builder maintain, deploy, and iterate? The pipeline builds — the builder needs to understand enough to debug and manage. | 10 = core domain, can maintain independently. 7 = minor learning needed. 4 = significant learning needed but teachable. 1 = domain so alien they can't evaluate if it works. |
| **Distribution fit** | 20% | Can THIS builder reach paying users through existing channels? | 10 = active engaged audience in exact niche. 7 = relevant community presence. 4 = marketplace with built-in discovery. 1 = cold start required. |
| **Speed to first $** | 15% | Days from "start building" to first payment received. | 10 = can charge before building (pre-sales). 7 = under 14 days. 4 = under 30 days. 1 = 60+ days. |
| **Self-sustaining** | 5% | Does free-tier infra cover it until revenue scales? | 10 = all free tier, zero cost. 7 = one small paid tool. 4 = needs modest infra spend. 1 = significant upfront cost. |
| **Ecosystem value** | 5% | Does this contribute to the builder's larger goal? | 10 = directly feeds the big idea. 7 = same audience, different product. 4 = builds general skills. 1 = pure money, no strategic value. |

**Total score = weighted sum, normalized to 0-100.**

Show the math. Each dimension gets a number and a one-sentence justification.

## Evidence Strength (Separate from Score)

Score measures OPPORTUNITY QUALITY. Evidence Strength measures HOW MUCH WE
ACTUALLY KNOW.

| Evidence Strength | Description | Examples |
|---|---|---|
| **10** | Public revenue data, verified MRR, customer count | IndieHackers revenue post, app store revenue estimate |
| **8** | Strong social proof + pricing validation | Reddit thread 500+ upvotes + competitor pricing page |
| **6** | One strong signal | GitHub trending with star velocity, ProductHunt #1 |
| **4** | Weak signal | Blog post about the niche, press release |
| **2** | Anecdote | Single tweet, forum comment |
| **0** | Speculation | "This could work", no sources |

**Gates:**
- Auto-select requires Evidence Strength >= 7
- Present to user requires >= 4
- < 4 → reject, research more

**Anti-inflation cap:** `max_score = min(calculated_score, 60 + evidence_strength * 2)`
- Evidence 4 → max score 68
- Evidence 8 → max score 76
- Evidence 10 → no cap

## AI Wrapper Special Path

AI wrappers are the fastest path to revenue for many builders.

**Model:** User pays $X per use. You take margin. API cost is covered by the user.

**When to recommend:**
- Builder can code an API integration
- Specific use case where general chatbot is 10x worse than purpose-built
- Niche is specific enough for SEO/community distribution
- Builder has domain expertise

**Multi-wrapper strategy:** If each wrapper takes 3-5 days, launching 2-3
simultaneously is valid. Different niches, same stack, shared infra. Kill
losers in 30 days, double down on winner.

**Wrapper economics:**
- API cost per request: ~$0.01-0.05
- User price per request: $0.10-0.50 (or $9-29/mo subscription)
- Margin: 5-50x on API cost
