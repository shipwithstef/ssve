# Google for Startups Cloud Program

Last verified: 2026-04-26. Source: https://cloud.google.com/startup + `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` + `example-marketplace/docs/analysis/budget-bundle-evaluation.md`.

## Overview

Google Cloud's tiered startup program. Three tiers with very different gating:

| Tier | Credit value | Gate | Difficulty |
|---|---|---|---|
| **Bootstrapped (self-apply)** | **$2,000** Cloud + $1K Workspace | Self-funded OK; <5 years old; <$10M raised | 1/5 |
| **Funded / Accelerator** | up to **$100K+** | VC or accelerator backing required | 3/5 |
| **AI-First / Vertex AI tier** | up to **$350K** ($250K Y1 + $100K Y2) | VC/Accelerator backing required, AI-first product | 5/5 (~0% bootstrapped) |

For bootstrapped EU founders: realistically only the $2K self-apply tier is achievable. The Vertex AI $350K tier has near-0% approval rate without VC backing per `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part E.

## Bootstrapped tier (self-apply, $2K)

- **Credit:** $2,000 GCP + ~$1,000 Workspace
- **Duration:** 24 months
- **Eligibility:** any startup; <5 years old; self-funded OK; revenue OK
- **Geographic:** worldwide (with usual exclusions)
- **Application:** ~15 minutes at https://cloud.google.com/startup
- **Approval probability:** ~70%
- **Use case:** Modest GCP usage; replaces or supplements the $300 retail trial

## Vertex AI / VC tier (out of reach for bootstrapped)

- **Credit:** $250K Y1 + $100K Y2 = $350K
- **Eligibility:** VC-backed AND AI-first product
- **Reality check:** nearly 0% approval rate for bootstrapped founders. Don't waste the application time. Route to MS Founders Hub (Azure OpenAI) and AWS Activate via NVIDIA Inception (Bedrock for Claude) instead.

## Comparison: $300 retail trial vs Bootstrapped tier

| | $300 retail trial | Bootstrapped $2K tier |
|---|---|---|
| Credit | $300 | $2,000 |
| Duration | 90 days | 24 months |
| Auto-shutoff | Yes (after 90d) | No |
| Eligibility | Anyone with valid CC | Startup, <5yr, signed startup form |
| Workspace credit | No | $1K credit |

**Decision rule:** if you qualify for Bootstrapped tier, do NOT use the retail $300 trial first. The $300 90-day trial is for individuals exploring GCP; the $2K 24-month is for startups. Apply for the Bootstrapped tier first.

## BG / Eastern Europe credit-card friction

GCP is notorious for rejecting legitimate Bulgarian credit cards during signup (KYC/fraud filter), per `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part E:

- Use a traditional bank card (NOT Revolut/Wise virtual)
- Match cardholder name exactly
- Do NOT use a VPN during signup
- If still rejected: try a co-founder's card from a different bank

## Stackability

- ✅ Stacks with MS Founders Hub (different cloud)
- ✅ Stacks with NVIDIA Inception
- ⚠️ Conflict with AWS Activate in spirit (both want primary-cloud commitment) — see aws-activate.md
- ✅ Stacks with Cloudflare, PostHog, Perplexity, all single-vendor SaaS programs

## Application steps (Bootstrapped tier)

1. Visit https://cloud.google.com/startup
2. Click "Apply" → "Bootstrapped" tier
3. Fill in:
   - Company name + country + website
   - Founder details
   - Year founded (must be <5 years)
   - Funding history ($0 OK; if any, must be <$10M)
   - Product description (1–2 paragraphs)
4. Submit. Approval typically 1–2 weeks.
5. On approval, claim credits via the GCP billing console; redeem promotional code on the target billing account.

## Common pitfalls

- **Burning the $300 retail trial first.** Once burned, may complicate Bootstrapped-tier credit application onto the same billing account. Better: apply for Bootstrapped tier on a fresh billing account.
- **Applying for VC tier when bootstrapped.** Wastes 30 minutes; near-0% approval. Apply only for Bootstrapped tier unless you have a VC partner ready to refer.
- **Missing the 24-month expiry.** Set a calendar reminder at month 18 to migrate workload off GCP if the credit isn't being used productively (lest you owe real $/month after expiry).
- **Forgetting Workspace credit exists.** The $1K Workspace credit covers Google Workspace seats — useful if not already on a free Workspace plan via your domain.

## Sources

- Program landing: https://cloud.google.com/startup
- $300 retail trial: https://cloud.google.com/free
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Parts A (retail trial) + B (Vertex AI gating) + E (BG card issues)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B ($2K Bootstrapped tier, 1/5 difficulty)
