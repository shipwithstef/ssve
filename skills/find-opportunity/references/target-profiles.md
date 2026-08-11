# Target Profiles & Bootstrapping

**Minimum revenue bar: $1K/mo.** Below this, the product doesn't justify the builder's time.

## Target Profiles (read from builder profile)

Don't assume everyone is bootstrapping from $0. Read the builder profile —
budget, income, time, and philosophy determine which profile applies.

| Situation | Speed | Ceiling | Strategy |
|---|---|---|---|
| **$0, needs tools to continue** | 1-2 weeks, revenue in 30 days | $1K/mo min, maximize | Fastest proven model. No experiments. Built-in distribution only. |
| **Employed, side project, evenings** | 4-6 weeks OK | $1-3K/mo life-changing | Async products only (tools, templates, APIs). No real-time support. |
| **Good income, project must self-fund** | 2-4 weeks OK | Must cover its own costs ($150-300/mo tools) within 60 days | Already paying for Claude/Base44/etc. Product must earn back tool costs, then profit. Not desperate — but disciplined. |
| **Good income, exploring** | 1 month OK | $3-10K/mo ceiling matters | Can invest in slower channels (SEO, content). Subscription > one-time. |
| **Has savings/runway, full-time** | 1-2 weeks (motivated) | $5K+/mo to justify full-time | Aggressive: 3-5 products in parallel, kill losers fast, double down on winner. |
| **Has capital, wants scale** | 1 month OK | $10K+/mo priority | SaaS with onboarding, proper infra. Can pay for Stripe, marketing tools. |
| **Co-founder team, splitting work** | 2-3 weeks | $3K+/mo (split revenue) | Builder builds, co-founder markets/sells. Pick products where marketing > engineering. |
| **Has existing audience (newsletter, followers)** | 1 week (audience = distribution) | $2-5K/mo (audience converts fast) | Pre-sell to audience before building. Validated demand before code. |
| **Agency/freelancer, wants productized service** | 2-4 weeks | $5-20K/mo (knows the domain deeply) | Package what they already do manually as self-serve. Existing clients = first customers. |
| **Retired/FIRE, building for fun + income** | No rush | $1-3K/mo covers hobbies | Passion projects in their domain. Quality > speed. Can iterate slowly. |

**The profile is not a label — it's derived from the builder profile data.**
Map the builder's actual situation to the closest row. If none fits exactly,
interpolate.

**Default when no builder profile exists:** assume "$0, needs tools" — the
most constrained profile.

## Scoring Adjustments by Profile

Shift dimension weights based on the matched profile:

| Profile | Speed | Ceiling | Distribution | Domain | Evidence |
|---|---|---|---|---|---|
| $0 needs tools | 40% | 10% | 30% | 10% | 10% |
| Employed side project | 15% | 25% | 25% | 20% | 15% |
| Good income, self-fund | 20% | 20% | 25% | 20% | 15% |
| Good income, exploring | 10% | 35% | 25% | 20% | 10% |
| Full-time, aggressive | 30% | 25% | 25% | 10% | 10% |
| Has capital, scale | 10% | 35% | 20% | 20% | 15% |
| Co-founder team | 20% | 20% | 30% | 15% | 15% |
| Has audience | 35% | 20% | 30% | 10% | 5% |
| Agency productizing | 10% | 30% | 15% | 35% | 10% |
| Retired/fun | 5% | 15% | 20% | 40% | 20% |

## Evidence Bar

Every opportunity must show:
- Similar products ALREADY making the target revenue (not "could" — "does")
- User/customer count that proves the market exists
- The gap or angle that makes THIS version competitive

If an opportunity cannot clear this bar with evidence, it does not make the top 3.

## Bootstrapping Mode

When the builder's goal is self-sustaining (pay for tools to build more):

```
$0 → pipeline builds product → $200/mo (covers Claude sub) → 
$200/mo → pipeline builds more products with Max plan (100 instances) →
$1K/mo → register entity, get Stripe, reinvest → $3K+ → real business
```

**The pipeline does almost everything autonomously:**
- Find opportunity (scored, evidence-backed)
- Build the entire product (code, tests, deployment config)
- Create store listing / landing page copy
- Write marketing copy and launch draft
- Generate owner guide (teach-project)
- Deploy to free-tier infra

**The builder does the minimum human-required steps:**
- Create Dodo Payments account (5 min, no company needed, handles VAT)
- Copy-paste the listing the pipeline wrote
- Post the launch announcement the pipeline drafted
- Respond to customers (pipeline can draft responses)

**MCP integrations reduce human steps further.**

**Break-even math the opportunity must satisfy:**
| Price model | Customers needed for $200/mo | Customers for $1K/mo |
|---|---|---|
| $5/mo subscription | 40 | 200 |
| $10/mo subscription | 20 | 100 |
| $25 one-time | 8/mo | 40/mo |
| $49 one-time | 5/mo | 21/mo |
| Pay-per-use ($0.10/use) | 2000 uses/mo | 10000 uses/mo |

Each opportunity card should show: "At [price], you need [N] customers
for break-even, [M] for target. Evidence says similar products have [X]
users/customers."
