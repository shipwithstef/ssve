# Cloudflare for Startups

Last verified: 2026-04-26. Source: https://www.cloudflare.com/startups + `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B.

## Overview

Cloudflare's startup program. Two practical tiers:

- **Bootstrapped tier**: $5,000 in Cloudflare credits, self-apply. <5 years old.
- **Workers Launchpad / Funded tier**: up to $250K+ in Workers + AI usage, requires accelerator/VC backing or AI-startup-track.

The bootstrapped $5K is the realistic target for solo / 2-founder startups. The Workers Launchpad tier targets AI-product startups raising priced rounds.

## Bootstrapped tier (self-apply, $5K)

| Item | Value |
|---|---|
| Total credit | **$5,000** in Cloudflare services |
| Duration | 12 months |
| Eligibility | <5 years old; bootstrapped or seed-stage OK |
| Geographic | Worldwide |
| Application | https://www.cloudflare.com/startups/ |
| Difficulty | **1/5** |
| Approval probability | ~60–70% |

## What the $5K covers

Cloudflare's product surface that the credit applies to:

- **Workers / Workers Paid plan** — beyond the always-free 100K req/day tier, the credit covers Workers Paid usage
- **D1** — SQLite-at-the-edge database; 5GB free + paid overages covered by credit
- **R2** — S3-compatible object storage with **zero egress fees**; 10GB free + paid covered
- **KV** — global key-value store
- **Workers AI** — Llama 3 / similar model inference at the edge (Workers AI is in the always-free tier with 10K Neurons/day, but credit covers higher usage)
- **Durable Objects** — stateful compute primitive
- **Pages** — static + SSR site hosting
- **Queues** — message queue
- **Cloudflare Images / Stream** — image and video delivery

Most credit goes to Workers + R2 + D1 in practice (the canonical edge-stack triple).

## Why this matters for bootstrapped founders

Cloudflare's structural pricing advantage is **zero egress fees on R2** + flat $5/month Workers Paid base. Combined with always-free tier (100K Workers req/day), the $5K credit extends realistic free-runway to **12+ months at thousands of MAU**.

See `platforms/composable/cloudflare-workers-d1-r2.md` for the full stack architecture and cost projection.

## Eligibility cuts (when to NOT bother)

- > 5 years incorporated → out
- Pure consulting / agency → out
- Already on a paid Cloudflare plan with $5K+ annual spend → contact sales for direct discount instead
- Heavy enterprise compliance needs (SOC 2 audits, dedicated SE) → enterprise plan path, not startup tier

## Stackability

- ✅ Stacks with MS Founders Hub (different vendor)
- ✅ Stacks with NVIDIA Inception, AWS Activate, GCP for Startups
- ✅ Stacks with PostHog, Perplexity, all single-vendor SaaS
- ✅ Stacks with xAI Grok deposit
- No conflicts.

## Application steps

1. Visit https://www.cloudflare.com/startups/
2. Sign up for a Cloudflare account (or use existing)
3. Click "Apply for Startups"
4. Fill in:
   - Company name + website
   - Founder details
   - Year founded (must be <5)
   - Funding history ($0 OK)
   - Product description
   - Estimated Cloudflare service usage (be reasonable)
5. Submit. Approval typically 1–3 weeks.
6. On approval: credit applied to Cloudflare account; visible in billing.

## Common pitfalls

- **Not enabling R2 in time.** R2's zero-egress is the killer feature. If you've been on AWS S3, the migration is straightforward (S3-compatible API). Move static assets and user uploads to R2 ASAP after credit acceptance.
- **Hitting Workers CPU time limits.** Free tier: 10ms CPU per request. Paid tier: 30 seconds. If your workload needs >30s, use Durable Objects or external compute (Workers is not a replacement for full Linux VMs).
- **Forgetting D1 is SQLite.** D1 is fast and cheap but has SQLite-shape constraints (no parallel writes from multiple replicas). Plan schema accordingly.
- **Treating Workers as Lambda equivalent.** Workers is V8-isolate based, not container-based. No `npm:` packages with native bindings. Many AWS Lambda patterns DON'T port directly.

## Sources

- Program landing: https://www.cloudflare.com/startups/
- Workers Launchpad (funded tier): https://workers.cloudflare.com/launchpad
- Cloudflare Pricing: https://www.cloudflare.com/plans/
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B ($5K bootstrapped tier, 1/5 difficulty)
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part A (Cloudflare always-free tier details)
