# Platforms Knowledge

Hosting + backend platforms for SaaS launch. Two categories:

- **All-in-one** — bundle DB + auth + functions + storage + LLM + email under one vendor (Base44 archetype). Faster to ship, more lock-in.
- **Composable** — stitch together purpose-built services (Cloudflare Workers + D1 + R2; Vercel + Neon; Supabase Pro). More work, less lock-in, often cheaper at scale.

Last reviewed: 2026-04-26.

## Files

| File | Platform | Type | Cost @ current scale | Cost @ 1k MAU |
|---|---|---|---|---|
| [all-in-one/base44.md](all-in-one/base44.md) | Base44 | All-in-one | Tied to AI credits | Tied to AI credits |
| [composable/cloudflare-workers-d1-r2.md](composable/cloudflare-workers-d1-r2.md) | Cloudflare full stack | Composable | $0–5/mo | $5–10/mo |
| [composable/vercel-neon.md](composable/vercel-neon.md) | Vercel + Neon Postgres | Composable | $0/mo | $25–40/mo |
| [composable/supabase-pro.md](composable/supabase-pro.md) | Supabase Pro | Composable | $0/mo | $25–40/mo |

## Cost-comparison at three scale points

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` cost table:

| Platform | 100 MAU | 1k MAU | 10k MAU |
|---|---|---|---|
| Base44 | unclear (AI-credit tied) | unclear | unclear |
| Cloudflare full stack | $0–5/mo | $5–10/mo | $20–50/mo |
| Vercel + Neon | $0/mo | $25–40/mo | $100–200/mo (per-seat fees scale) |
| Supabase Pro | $0/mo | $25–40/mo | $50–150/mo |

**Key insight:** at small scale, all platforms are effectively free. **Cost is not the decider.** What dominates is engineering effort, paradigm fit, and lock-in tolerance.

## Decision shape

For founders without strong platform preference:

- **Greenfield + want fastest ship**: All-in-one (Base44 if vibe-coding-positive; Replit if dev-positive).
- **Greenfield + low budget + edge-friendly**: Cloudflare full stack ($5/mo plus credits).
- **Greenfield + Postgres-positive + managed services tolerated**: Supabase Pro.
- **Brownfield / migrating off Base44**: NOT NOW per `example-marketplace/docs/analysis/platform-migration-evaluation.md` — wait for first $100 MRR. If forced to migrate, Supabase first (closest paradigm match), Cloudflare second (cheapest at scale), Convex/Firebase only if rewriting from scratch.

## Deferred to on-demand `/research`

| Platform | Trigger to populate |
|---|---|
| all-in-one/replit.md | First Replit-curious project |
| all-in-one/convex.md | First Convex-curious project |
| all-in-one/appwrite-cloud.md | First Appwrite-curious project |
| composable/pocketbase-fly.md | First self-hosted-curious project |
| trial-credits.md | Consolidated cloud trial credit table beyond what's in `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part A |
| perpetual-free-tiers.md | First need for perpetual free tier comparison |
| llm-gateways.md | First need for LLM gateway pricing comparison |
