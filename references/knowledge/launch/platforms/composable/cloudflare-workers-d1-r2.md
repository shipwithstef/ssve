# Cloudflare Workers + D1 + R2 — Composable Edge Stack

Last verified: 2026-04-26. Sources: https://www.cloudflare.com/plans/, https://developers.cloudflare.com/workers/platform/pricing, `example-marketplace/docs/analysis/platform-migration-evaluation.md`, `example-marketplace/docs/analysis/budget-bundle-evaluation.md`.

## Overview

Cheapest at scale by a wide margin. Edge-first compute (Workers, V8 isolates) + edge SQLite (D1) + zero-egress object storage (R2). $5/mo Workers Paid minimum unlocks production-grade features. Always-free tier covers ~3K daily requests.

Best fit: cost-sensitive bootstrapped founders comfortable with edge-paradigm constraints (V8 isolates, no `npm:` packages with native bindings, 30s CPU limit on Paid).

## Key facts

| Item | Value | Source |
|---|---|---|
| Workers Paid minimum | **$5/month** unlocks 10M req/mo + key features | https://developers.cloudflare.com/workers/platform/pricing |
| Always-free Workers | 100K req/day | same |
| D1 free tier | 5GB storage + 25B reads/mo | https://developers.cloudflare.com/d1/platform/pricing/ |
| R2 free tier | 10GB storage; **zero egress fees** | https://developers.cloudflare.com/r2/pricing/ |
| Workers AI free tier | 10K Neurons/day (~Llama 3 inference) | https://developers.cloudflare.com/workers-ai/platform/pricing/ |
| Auth | BYO (Lucia, workers-oauth-provider, Clerk via Worker proxy) | not native |
| Email | BYO (Resend, SendGrid via Worker fetch) | Workers Email is inbound only |
| Cron | Native via Cron Triggers | https://developers.cloudflare.com/workers/configuration/cron-triggers/ |

## Cost projection by scale

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` cost table:

| Scale | Total monthly cost |
|---|---|
| <100 MAU | **$0–5/mo** (Workers Paid; D1/R2 free tier) |
| 1,000 MAU | **$5–10/mo** (Workers Paid; minor D1/R2 overage) |
| 10,000 MAU | **$20–50/mo** (still cheaper than competitors by 4×) |

Combined with **Cloudflare for Startups $5K credit** (see `credit-programs/cloudflare-startups.md`), realistic free runway is **12+ months at thousands of MAU**.

## What you build with this stack

| Need | Cloudflare service |
|---|---|
| Compute | Workers (V8 isolates, 30s CPU on Paid) |
| Database | D1 (SQLite at edge, 5GB free, 10GB cap per DB — use multiple) |
| Object storage | R2 (S3-compatible, zero egress) |
| Key-value | KV (eventually-consistent global KV) |
| Cron | Cron Triggers (1/hour on free, 1/min on Paid) |
| Realtime | Durable Objects (stateful coordination) |
| LLM inference | Workers AI (Llama 3, etc., included on Paid; 10K Neurons/day free) |
| Email send | BYO Resend / SendGrid via Worker fetch |
| Static + SSR site | Pages |
| Image / video delivery | Cloudflare Images / Stream |

## Comparison vs Base44 / Supabase / Vercel+Neon

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md`:

- **vs Base44:** Cloudflare is more work (BYO auth, BYO email) but eliminates lock-in + opaque pricing. NOT a 1:1 swap; a paradigm shift.
- **vs Supabase:** Cheaper at all scales. Less paradigm-similar to Base44 (no PostgREST-style entity API; you write Worker handlers). Loses Postgres ecosystem (RLS, pg_cron sophistication).
- **vs Vercel + Neon:** Significantly cheaper at scale (no per-seat fees). Equivalent compute. Less mature Next.js ergonomic.

## Eligibility for the $5K startup credit

See `credit-programs/cloudflare-startups.md` — bootstrapped tier, <5yr old, 1/5 difficulty.

## Common pitfalls

- **Workers CPU timeout.** Free: 10ms. Paid: 30s. Paid+: 5min via Durable Objects. If your workload runs >30s, restructure into Durable Objects or external compute.
- **D1 single-region writes.** D1 supports read replicas globally but writes go to a primary region. Plan accordingly for latency.
- **D1 10GB cap per database.** Cloudflare's solution: shard across multiple D1 databases. Adds operational complexity.
- **Workers V8 isolate constraints.** No native node modules with binary deps (no `bcrypt`, `sharp`, `puppeteer-core`). Many AWS Lambda patterns DON'T port directly. Use Workers-compatible packages.
- **Auth BYO complexity.** Lucia + workers-oauth-provider work but have a learning curve vs Supabase's built-in GoTrue. Budget 1–2 weeks to wire properly with cookie-based sessions and JWT verification.
- **Migrating from PostgreSQL to D1 SQLite.** SQL dialect differences (no array columns, JSON support is different, no extensions like PostGIS). Schema rewrite required, not a `pg_dump | sqlite3` move.

## When to choose this stack

**Greenfield + cost-sensitive + edge-friendly:** YES, default choice.

**Brownfield migration off Base44:** **NOT NOW** unless first $100 MRR + Base44 demonstrably blocks a paying customer (per `platform-migration-evaluation.md`). If you must migrate, **Supabase first** (closer paradigm, faster port at 9–13 working days reusing covibefusion patterns), Cloudflare second.

**Greenfield + Postgres-positive:** consider Supabase Pro instead. Cloudflare D1 is SQLite, not Postgres.

## Sources

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Reusable analysis: `example-marketplace/docs/analysis/platform-migration-evaluation.md` (Cloudflare candidate section, cost table, feature parity)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part A (Cloudflare row, 6/10 bundle equivalence)
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part A (Cloudflare always-free tier details)
