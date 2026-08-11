# Vercel + Neon Postgres — Composable Stack

Last verified: 2026-04-26. Sources: https://vercel.com/pricing, https://neon.tech/pricing, `example-marketplace/docs/analysis/platform-migration-evaluation.md`, `example-marketplace/docs/analysis/budget-bundle-evaluation.md`.

## Overview

Best-in-class **frontend** developer experience (Next.js native, edge functions, instant previews on every PR) + serverless Postgres via **Neon** (branchable Postgres with cold-start scale-to-zero). Most popular among Next.js + React shops. **Per-seat pricing** is the killer drawback for multi-founder teams.

## Key facts

| Item | Value | Source |
|---|---|---|
| Vercel Hobby | Free, non-commercial use only, hard caps | https://vercel.com/pricing |
| Vercel Pro | **$20/seat/month** (2 cofounders → $40/mo base) | https://vercel.com/pricing |
| Vercel Enterprise | Custom (negotiated) | sales contact |
| Neon Free | 0.5GB DB, 100 hours compute/mo, 1 read replica | https://neon.tech/pricing |
| Neon Launch | $19/mo, 10GB, 300 hours compute, scale-to-zero | https://neon.tech/pricing |
| Auth | BYO (NextAuth, Clerk, Auth.js, Lucia) | not native |
| Storage | Vercel Blob ($0.15/GB/mo) or BYO S3/R2 | https://vercel.com/docs/storage/vercel-blob |
| Email | BYO (Resend integrates well) | not native |
| Cron | Vercel Cron Jobs (Pro tier only) | https://vercel.com/docs/cron-jobs |
| Functions | 1M invocations/mo Hobby; usage-based v2 model on Pro | https://vercel.com/pricing |

## Cost projection by scale

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` cost table:

| Scale | Total monthly cost (1 seat) | (2 seats) |
|---|---|---|
| <100 MAU | **$0/mo** (Hobby + Neon Free) | **$0/mo** |
| 1,000 MAU | **~$25–40/mo** (Pro $20 + Neon Launch $19) | **~$45–60/mo** |
| 10,000 MAU | **$100–200/mo** (per-seat scales linearly + bandwidth) | **$200+/mo** |

**The per-seat cost is the trap for multi-founder teams.** A 2-cofounder team starts at $40/mo base on Pro just to enable commercial use, before any compute or DB cost. Compare to Cloudflare ($5/mo flat) or Supabase ($25/mo flat).

## What you build with this stack

| Need | Vercel + Neon equivalent |
|---|---|
| Compute | Vercel Functions (Node + Edge runtimes) |
| Database | Neon Postgres (branchable, scale-to-zero) |
| Object storage | Vercel Blob OR external S3/R2 |
| Cron | Vercel Cron (Pro only) |
| Auth | BYO NextAuth / Clerk / Auth.js |
| Realtime | BYO (Pusher, Ably, Liveblocks) |
| Email | BYO Resend |
| Hosting | Vercel (auto-CDN, edge, instant previews) |

## Comparison vs Cloudflare / Supabase / Base44

Per `platform-migration-evaluation.md`:

- **vs Cloudflare:** Vercel has best Next.js DX. Cloudflare cheaper at scale (no per-seat fees). Vercel preview deploys per PR are unmatched.
- **vs Supabase:** Vercel covers frontend; Supabase covers backend. Many teams use Vercel + Supabase together (Vercel for Next.js + Supabase for DB/auth/storage). Vercel + Neon is the lighter alternative without Supabase's auth+storage layer.
- **vs Base44:** Vercel is paradigm-different. Base44 is full-stack monolith; Vercel + Neon is composable. Migration is rewrite, not port.

## Branchable Postgres (Neon's killer feature)

Neon offers **per-branch databases** — every git branch / PR gets its own isolated Postgres with zero-config copy-on-write storage. Useful for:

- Feature-branch dev environments with realistic prod-shaped data (after seeding)
- E2E tests against a fresh DB per CI run
- Risk-free destructive migrations (test on a branch first)

This is genuinely unique vs Supabase/CockroachDB/Aurora and may justify the per-seat cost for large teams.

## Common pitfalls

- **Hobby plan commercial use.** Vercel Hobby is **strictly non-commercial** per ToS. Generating any revenue on Hobby → Vercel will shut you down. Pro is mandatory at first revenue.
- **Per-seat cost shock.** Scaling Vercel Pro to 5 founders = $100/mo base before any usage. Plan accordingly.
- **Function execution unit billing.** Vercel's v2 functions pricing bills by execution units (memory × time). Cold starts + long-running functions can spike unpredictably. Set spend caps.
- **Neon scale-to-zero cold starts.** Neon Free / Launch tiers scale to zero between requests. First request after idle may add 200–500ms latency. Mitigate with `keep-alive` ping cron or upgrade tier.
- **Forgetting Vercel Cron is Pro-only.** Hobby plan has no cron. If you need scheduled jobs, you're paying $20/seat from day one.

## When to choose this stack

**Greenfield + Next.js / React + frontend-DX-positive + 1 founder:** YES, strong choice ($20/mo Pro is reasonable for the DX).

**Greenfield + 2+ cofounders:** check the per-seat math vs Supabase Pro flat $25/mo. Often Supabase wins on cost for 2+.

**Brownfield migration off Base44:** **NOT NOW** unless first $100 MRR. If you must, Supabase is closer paradigm match (per `platform-migration-evaluation.md`).

## Sources

- Vercel pricing: https://vercel.com/pricing
- Neon pricing: https://neon.tech/pricing
- Reusable analysis: `example-marketplace/docs/analysis/platform-migration-evaluation.md` (Vercel + Neon candidate section, cost table)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part A (Vercel row, 6/10 bundle equivalence — flagged for limited bundling)
