# AWS Activate (Founders / Portfolio / Builders / Web3)

Last verified: 2026-04-26. Source: https://aws.amazon.com/activate/ + `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` + `example-marketplace/docs/analysis/budget-bundle-evaluation.md`.

## Overview

AWS's umbrella startup program. Comes in four tiers with very different gating:

| Tier | Credit value | Gate | Difficulty |
|---|---|---|---|
| **Founders** | $1,000 (recently revised down from $5K) | Self-serve, self-funded OK, no VC required | 1/5 |
| **Portfolio** | Up to **$100,000** | Membership in approved investor / accelerator / partner program (NVIDIA Inception is one) | 3/5 (need Inception or VC first) |
| **Builders** | $1,000 | For freelance/agency builders, not founders directly | 1/5 |
| **Web3** | Up to $25,000 | Web3-specific filter | 2/5 |

The vast majority of bootstrapped founders should target **Portfolio via NVIDIA Inception** as the on-ramp. Founders tier is fine for an immediate $1K but doesn't move the needle.

## Founders tier (self-serve)

- **Credit:** $1,000 AWS
- **Duration:** 12 months
- **Eligibility:** any startup; self-funded OK; no VC required
- **Geographic:** worldwide (with usual exclusions)
- **Application:** ~10 minutes at https://aws.amazon.com/activate/founders/
- **Approval probability:** ~95% — basically rubber-stamped
- **Use case:** small experiments, learning AWS, dev environments

## Portfolio tier (the real prize)

- **Credit:** up to $100,000 AWS
- **Duration:** 24 months typical
- **Eligibility:** must be a member of an approved AWS Activate Portfolio program. Includes: VC firms (Sequoia, a16z, etc.), accelerators (YC, Techstars, etc.), AND **NVIDIA Inception** as a non-VC bootstrapped path
- **Geographic:** worldwide
- **Application path:** apply to NVIDIA Inception first → Inception acceptance → AWS Activate Portfolio enrollment via Inception portal link
- **Approval probability (via Inception):** ~85% if you make it through Inception
- **Use case:** production workloads, including Bedrock for Claude/LLM access (up to $100K Bedrock spend possible)

See `nvidia-inception.md` for the canonical bootstrapped path.

## Builders tier

- For freelance/agency builders building on AWS for clients, not for own product. Out of scope for product founders.

## Web3 tier

- Web3-specific (smart contracts, NFTs, decentralized apps). Out of scope for typical SaaS launches.

## AWS Bedrock angle

AWS Bedrock provides API access to Anthropic Claude (and Meta Llama, Cohere, AI21, Stability) via AWS billing. For founders who want **Claude API access without going through Anthropic Startups** (which is VC-gated), Bedrock + AWS Activate Portfolio credits ($100K) is the canonical path:

- Apply to NVIDIA Inception → AWS Activate Portfolio → use credits on Bedrock → get Claude usage paid for by AWS credits
- Practical effect: ~$100K of Claude usage at $0 founder spend (subject to Bedrock per-region quotas)
- Reference: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` PART E: *"OpenAI directly, and Anthropic directly...have an approval rate near 0% for bootstrapped European founders. Don't waste time looking for hidden application forms; route through Microsoft (for OpenAI) and AWS (for Anthropic)."*

## The 6-month cliff (NEW: 2025/2026 model change)

> **CRITICAL** — AWS changed their retail free tier in late 2025.

- New AWS retail free-tier accounts get $100–$200 credits.
- **If not converted to a paid plan within 6 months, AWS deletes the account and resources.**
- Distinct from AWS Activate Founders/Portfolio (those run on different credit timeline + don't auto-delete).
- Reference: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part A AWS row + Part E "AWS 6-Month Cliff" section.

**Implication:** if you have AWS Activate credits flowing, do NOT also activate the retail free-tier account on the same root email — keep them separate, and don't open the retail trial unless you specifically need the $200 retail credit (most founders don't).

## Stackability

- ✅ Stacks with MS Founders Hub (different cloud)
- ✅ Stacks with NVIDIA Inception (Inception is the on-ramp; not a conflict)
- ✅ Stacks with Cloudflare, PostHog, Perplexity
- ⚠️ Conflict with GCP for Startups in spirit — both want primary-cloud commitment; you can hold both credits but workload should pick one primary cloud

## Application steps (Portfolio via Inception)

1. Apply to NVIDIA Inception (see `nvidia-inception.md`).
2. Once Inception-accepted, log into Inception portal → find "AWS Activate Portfolio" section → click enrollment link.
3. Fill in AWS Activate Portfolio form (~15 min). Inception sponsorship is the entry signal.
4. AWS reviews 1–3 weeks.
5. On approval: credit applied to the linked AWS account; visible in Billing & Cost Management.
6. Set up budget alerts (mandatory — unbounded credit ≠ unbounded resource use; you can still over-provision and rack up costs that exceed credit balance).

## Common pitfalls

- **Applying for Founders tier when Portfolio is achievable.** Founders tier is $1K cap — easy to take and forget. But AWS Portfolio tier (via NVIDIA Inception) gets you $100K. Do BOTH (they don't conflict for credit reception) but prioritize the Portfolio path.
- **Forgetting credits expire.** AWS Activate credits typically have 12-24 month expiry. Plan workload migration into AWS within the credit window or credits go to waste.
- **Not setting budget alarms.** Credit balance does not stop spend. If a runaway Lambda or EC2 instance goes feral, you'll burn the credit AND hit a real bill. Always set Cost Anomaly Detection + budget alarm at 50%, 80%, 100% of credit.
- **Treating Founders $1K as "the AWS credit."** It's the entry tier. The $100K is via Portfolio. Most founders mistake the smaller number for the maximum.

## Sources

- Activate landing: https://aws.amazon.com/activate/
- Founders tier direct: https://aws.amazon.com/activate/founders/
- Portfolio tier direct: https://aws.amazon.com/activate/portfolio/
- Bedrock: https://aws.amazon.com/bedrock/
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` (Parts A, C, E)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B (1/5 difficulty rating, $1K Founders tier)
