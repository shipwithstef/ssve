# Launch Knowledge Index

Universal launch knowledge for software founders — legal vehicles, startup credit programs, hosting/platform bundles, and early-distribution playbooks. Read by the `launch-knowledge` skill.

Last reviewed: 2026-05-03.

## How This Works

Same Layer 1 → Layer 2 → Layer 3 pattern as `references/knowledge/INDEX.md`. This file is Layer 1 (always loaded). The per-domain `INDEX.md` files are Layer 2. The detail files (e.g., `credit-programs/microsoft-founders-hub.md`) are Layer 3, read on demand.

See `launch-knowledge/references/knowledge-base-protocol.md` for the read order, refresh discipline, and citation requirements.

## Domains

| Domain | Summary | Layer 2 |
|---|---|---|
| **jurisdictions** | Legal vehicles by jurisdiction (BG свободна професия / OOD / EOOD; EE e-Residency / OÜ; US Delaware LLC / C-Corp). Tax-residency, social-security caps, VAT triggers, CFC implications. | [jurisdictions/INDEX.md](jurisdictions/INDEX.md) |
| **credit-programs** | Startup credit programs cataloged with eligibility cuts, $-value, application difficulty, stackability matrix. Microsoft Founders Hub, NVIDIA Inception, AWS Activate, Google Cloud, xAI Grok, Cloudflare, PostHog, Perplexity. | [credit-programs/INDEX.md](credit-programs/INDEX.md) |
| **platforms** | All-in-one MoR-style platforms (Base44) vs composable stacks (Cloudflare Workers + D1 + R2; Vercel + Neon; Supabase Pro). Cost projections at zero / 100 MAU / 1k MAU / 10k MAU. | [platforms/INDEX.md](platforms/INDEX.md) |
| **distribution** | First-100-customer playbooks by product type. v1 covers B2B SaaS. | [distribution/INDEX.md](distribution/INDEX.md) |
| **operations** | Vendor account-ownership migrations (Cloudflare zone transfer, Vercel/GitHub team handoff, etc.). What moves with the resource, what's account-scoped, how to sequence without downtime. | [operations/INDEX.md](operations/INDEX.md) |

## Coverage status (v1)

| Domain | Files included v1 | Files deferred to on-demand `/research` |
|---|---|---|
| jurisdictions | bg (extended 2026-05-03 with чл. 97а / NKPD codes / diploma alternatives / spouse-as-owner / online providers), ee, us-de, **bulgaria**, **eu-general** (OSS / CFC / EIC / EEA Grants / EDIH / NRRP) | uk, de, nl, ie |
| credit-programs | microsoft-founders-hub, nvidia-inception, aws-activate, google-cloud-startup, xai-grok-deposit, cloudflare-startups, posthog-startups, perplexity-startups, **startup-programs**, **euipo-sme-fund** (EU IP voucher 75-90% reimburse, calendar-bound annual Feb 1 cycle) | mongodb-startups, stripe-atlas, notion-linear-sentry, brex-mercury, ycombinator-deals, female-founder-programs |
| platforms | base44, cloudflare-workers-d1-r2, vercel-neon, supabase-pro | replit, convex, appwrite-cloud, pocketbase-fly, trial-credits, perpetual-free-tiers, llm-gateways |
| distribution | first-100-customers-b2b-saas, **marketing-tools**, **cold-outreach**, **directory-submissions** | first-100-customers-b2c-subs, first-100-customers-dev-tools, first-100-customers-vertical-saas |
| operations | **cloudflare-zone-transfer** (added 2026-05-04) | vercel-team-transfer, github-org-transfer, stripe-account-handoff, namecheap-push, vercel-domain-transfer, posthog-org-transfer |
| payment-processors | (none v1 — covered by sibling `mor-vs-stripe` skill) | full processor matrix on demand |

Subsequent files accrete via on-demand `/research` dispatches (see `launch-knowledge/references/knowledge-base-protocol.md`).

## Refresh schedule

- `credit-programs/` and `jurisdictions/` files: 12-month max age. Enforced by `test-framework/evals/tier-1/validate-launch-knowledge-freshness.sh`.
- `platforms/`: not gated by freshness validator (structural advice changes slower than per-program eligibility cuts), but recommended annual review.
- `distribution/`: review on milestone completion (when launch retro happens).

## Reusable source artifacts

These vendor-cited research artifacts are referenced by multiple files in this knowledge base:

- `/home/svc-user/app-workspaces/example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` (2026-04-26)
- `/home/svc-user/app-workspaces/example-marketplace/docs/analysis/budget-bundle-evaluation.md` (2026-04-26)
- `/home/svc-user/app-workspaces/example-marketplace/docs/analysis/platform-migration-evaluation.md` (2026-04-26)
- `/home/svc-user/app-workspaces/example-marketplace/docs/analysis/launch-vehicle-recommendation.md` (2026-05-03) — **Example Marketplace-specific applied recommendation**: spouse-as-owner EOOD + marital property contract + chl 97a registration + Dodo migration + IP firewall protocol. Synthesizes all `jurisdictions/` + `credit-programs/euipo-sme-fund.md` + `eu-general.md` knowledge into a concrete action plan for the Example Marketplace fact pattern.

Each detail file cites the artifact path inline next to the claim being sourced.

## Project-specific applied recommendations

When `launch-knowledge` is invoked for a project that matches one of the indexed projects below, READ the applied recommendation file as primary source — it has already synthesized the underlying knowledge for that fact pattern.

| Project | Applied recommendation file | Status | Last refreshed |
|---|---|---|---|
| **Example Marketplace** | `/home/svc-user/app-workspaces/example-marketplace/docs/analysis/launch-vehicle-recommendation.md` | ACTIVE | 2026-05-03 |
