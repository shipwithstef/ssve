# Supabase Pro — Composable Stack

Last verified: 2026-04-26. Sources: https://supabase.com/pricing, `example-marketplace/docs/analysis/platform-migration-evaluation.md`, `example-marketplace/docs/analysis/budget-bundle-evaluation.md`.

## Overview

Supabase = managed Postgres + PostgREST API + GoTrue auth + Edge Functions (Deno) + Storage + Realtime. Conceptually closest to Base44 (entity-style API via PostgREST, Deno functions). Largest community, best docs, most agent-friendly. **Pro tier is flat $25/mo (no per-seat surcharge)** — the cost-effective middle ground for 2+ founders.

## Key facts

| Item | Value | Source |
|---|---|---|
| Free tier | 0.5GB DB; 5GB bandwidth; 50K MAU auth; 1GB file storage; functions included | https://supabase.com/pricing |
| Pro | **$25/mo flat** (NOT per-seat); 8GB dedicated Postgres; 100GB bandwidth; 100K MAU; 100GB storage; 2M function invocations | https://supabase.com/pricing |
| Compute add-ons | $10/mo per compute step up (when you outgrow the included compute) | same |
| Auth | **GoTrue native** — JWT, OAuth (40+ providers), magic links, RLS-aware | https://supabase.com/docs/guides/auth |
| Storage | Native S3-compatible | https://supabase.com/docs/guides/storage |
| Realtime | Native Postgres Changes + broadcast + presence | https://supabase.com/docs/guides/realtime |
| Edge Functions | Deno runtime, deploy via `supabase functions deploy` | https://supabase.com/docs/guides/functions |
| Cron | pg_cron (Postgres-native) + Edge cron via Supabase Cron | https://supabase.com/docs/guides/cron |
| LLM gateway | BYO (no native; recommend stacking with MS Founders Hub Azure OpenAI for credits) | n/a |
| Email | Custom SMTP only (BYO Resend / SendGrid for sending API) | https://supabase.com/docs/guides/auth/auth-smtp |

## Cost projection by scale

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` cost table:

| Scale | Total monthly cost |
|---|---|
| <100 MAU | **$0/mo** (Free tier sufficient) |
| 1,000 MAU | **~$25–40/mo** (Pro $25 + compute add-on $10 + minor egress overage $5) |
| 10,000 MAU | **$50–150/mo** (Pro + 2-3 compute add-ons + egress) |

**No per-seat fees.** This is the structural advantage over Vercel for multi-founder teams — same $25/mo regardless of how many founders.

## What you build with this stack

| Need | Supabase service |
|---|---|
| Compute (functions) | Edge Functions (Deno) |
| Database | Managed Postgres + PostgREST API auto-generated from schema |
| Object storage | Storage (S3-compatible) |
| Auth | GoTrue (JWT, OAuth, magic links, RLS-aware) |
| Realtime | Postgres Changes + broadcast |
| Cron | pg_cron + Supabase Cron |
| Vector search | pgvector included |
| Migrations | `supabase/migrations/` workflow |

## Why founders migrating off Base44 pick Supabase first

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` recommendation:

> **Supabase — Stefan's DevOps profile makes RLS + Postgres a one-week ramp-up. Deno Edge Functions are the closest 1:1 port of Base44 functions. Largest agent-tooling surface (Supabase MCP exists; Claude/Cursor know it cold). Single-bill ($25/mo) is a Wife-debuggable cost. Pick this if you migrate in 2026.**

Specifically: Base44's **entities → tables + RLS**, **functions → Edge Functions (Deno → Deno, 1:1 port)**, **auth → GoTrue (similar shape)**. Migration estimate: **9–13 working days** when reusing covibefusion patterns (covibefusion already has 22 Edge Functions, 280 migrations, RevenueCat webhook, GDPR functions per `platform-migration-evaluation.md`).

## Comparison vs Cloudflare / Vercel+Neon / Base44

- **vs Cloudflare:** Supabase is more expensive at scale ($25 vs $5 base) but has Postgres maturity (RLS, pg_cron, ecosystem) and built-in auth/storage. Supabase wins on paradigm fit for Base44 migrators.
- **vs Vercel + Neon:** Comparable cost at low scale ($25 vs $20 single-seat, but Vercel scales by seat). Supabase wins for multi-founder teams. Vercel wins for Next.js DX.
- **vs Base44:** Supabase requires explicit auth + storage wiring (built in but you write the code) vs Base44 bundled. No LLM gateway native (BYO Azure OpenAI via MS Founders Hub credits). No SMS / email-send (BYO Resend / Twilio).

## Eligibility for Supabase startup credits

Supabase has its own startup program ($600 credit, $50/mo for 12 months) but typically requires VC/Accelerator backing per `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B (3/5 difficulty, ~50% approval bootstrapped). For most bootstrapped founders: just pay the $25/mo Pro tier.

## Common pitfalls

- **RLS policy debugging.** Supabase RLS is powerful but invisible failures (policy denies row access) look like empty result sets. Always test queries with anon key + authenticated key separately.
- **Edge Function cold starts on Free tier.** First request after idle adds 100–300ms. Mitigate with keep-alive cron on Pro.
- **Forgetting compute add-on cost.** At 1k+ MAU, default compute often saturates → $10/mo compute step add-on. Adds $10–30/mo to baseline at scale.
- **Treating PostgREST as ORM.** PostgREST auto-exposes tables as REST endpoints. Some queries are awkward to express via PostgREST URL filters; use Edge Functions or RPCs (Postgres functions) for complex logic.
- **Email send confusion.** Supabase Auth emails send via the configured SMTP server but Supabase doesn't provide an email-sending API for app messages. BYO Resend/SendGrid for transactional + marketing email.

## When to choose this stack

**Greenfield + Postgres-positive + 1+ founder:** YES, strong default for non-edge-paradigm projects.

**Brownfield migration off Base44:** **DEFAULT CHOICE** if/when migration is greenlit (per `platform-migration-evaluation.md`). Supabase Pro $25/mo, 9-13 working days reusing covibefusion patterns.

**Greenfield + 2+ cofounders + cost-sensitive:** Supabase Pro flat $25/mo beats Vercel Pro $20/seat for 2+ founders.

## Sources

- Supabase pricing: https://supabase.com/pricing
- Supabase docs: https://supabase.com/docs
- Supabase MCP: https://supabase.com/docs/guides/getting-started/mcp
- Reusable analysis: `example-marketplace/docs/analysis/platform-migration-evaluation.md` (Supabase candidate section + cost table + recommendation)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part A (Supabase 8/10 bundle equivalence) + Part C (Best $30/mo Bundle verdict: Supabase Pro)
