# Deno Deploy — Capabilities

Analyzed: 2026-06-12
Source: research skill (example-marketplace WI-CUTOVER-01 $0-stack cutover), live docs + gemini-cli cross-check (3/3 claims verified)

## Space
Serverless Deno runtime hosting (V8 isolates) — runs plain `Deno.serve` apps at the edge; the natural free host for Supabase-style edge functions detached from Supabase itself.

## CRITICAL platform split (the gotcha that bites tooling)
- **Deploy Classic (`dash.deno.com`, `deployctl`, `*.deno.dev`) SHUTS DOWN 2026-07-20** and already refuses new users/orgs.
- Current platform: **`console.deno.com`** + **`deno deploy` CLI subcommand** (NOT deployctl), org-scoped URLs **`<app>.<org-slug>.deno.net`** (branch: `<app>--<branch>.<org>.deno.net`, preview: `<app>-<rev>.<org>.deno.net`).
- Any guide/script referencing deployctl or `*.deno.dev` is legacy — rewrite before first use.

## Pricing (verified 2026-06-12)
| Tier | Price | Requests | Egress | CPU | Active apps |
|---|---|---|---|---|---|
| Free | $0 | 1M/mo | 20 GB/mo | 15 h/mo | 20 |
| Pro | $20/mo | 5M (+$2/M) | 200 GB (+$0.50/GB) | 40 h (+$0.05/h) | 100 |
| Builder | $200/mo | 20M | 300 GB | 400 h | 100k |

- **No function-count limit** — one app can route hundreds of handlers (cap evasion for Supabase Free's 100-fn limit).
- Billing alerts + hard spend caps exist in org settings; free-tier exhaustion behavior undocumented — set alerts at provisioning.
- **No SLA below Enterprise. No startup-credits program** (verified twice, 2026-06-10).

## Key Technical Patterns
- **Multi-function router** (proven in example-marketplace `deploy/deno-deploy/`): modules calling `Deno.serve`/std-`serve` at import time are captured via `Object.defineProperty(Deno,'serve',...)` patch (getter-only in Deno 2.x — plain assignment throws) + import-map remap of `std/http/server.ts` to a shim; name-keyed lazy dynamic imports; gateway-level JWT + CORS (legacy-platform parity).
- New platform allows **unrestricted dynamic imports** (Classic required statically-analyzable specifiers).
- Region pinning per app (e.g. `europe-west3` Frankfurt — pairs with Supabase eu-central-1), changeable post-creation.
- Env loading: `deno deploy env load <file>` (file-based, beats dashboard hand-entry).
- Monorepo subdir apps: watch build-root detection when the entrypoint imports outside its directory (e.g. `../../supabase/functions`).

## Breaking changes vs Classic (migration guide)
- Legacy std `serve()` fails at warmup on the new platform (shim/import-map sidesteps it).
- Queues REMOVED; KV not auto-migrated; `Deno.cron` supported.

## Terms / AUP (verified)
- Explicitly allowed: DB/API-querying APIs, company/e-commerce sites, **reverse proxies** (a function router is one). Commercial use on Free is fine.
- Prohibited: mining, CPU-heavy ML, media hosting for external sites, scrapers, forward proxy/VPN.
- One credential per user; a separate legitimate company account is compliant. Enforcement is notify-first.

## Common Pitfalls
- Building tooling against deployctl/dash.deno.com after 2026-07 (dead platform).
- Assuming `*.deno.dev` URL shape in env wiring — org-slug URLs differ.
- Trusting "no limit" pages cached pre-2026 — egress is 20 GB free, not 100 GB.

## Standard Metrics
Requests/mo vs 1M, egress GB vs 20, CPU-h vs 15 — at typical validation traffic (<33k req/day) Free has ≥10x headroom; frontend egress should ride the CDN (CF Pages), not Deno.

## GOTCHA: unverified-trial vs verified-free tier (hit live 2026-06-12)
- A brand-new org/account starts on a TINY **unverified trial** tier, NOT the free tier: ~**10k HTTP requests, 0.2 CPU-hours, 1 GiB egress**. Apps suspend ("USAGE_EXCEEDED", 503 on every route incl. health) when these tiny caps blow — easy to hit with E2E testing.
- The advertised free tier (1M req, 15 CPU-h, 20 GiB, 350 GiB·h mem) is unlocked by **adding a payment method** (anti-abuse verification — explicitly "will not be charged"). Free still has NO overage billing (apps stop at cap), so $0 is preserved.
- Action for every new org: add a card immediately to move trial→free BEFORE load/E2E. Suspension is account-level (all apps), not per-app.
- Cold-start cost observed ≈ 0.36 CPU-s/request under lazy-per-function loading (each cold isolate re-imports supabase-js + builds JWKS). Fine for warm real traffic; throttle E2E parallelism (1–2 workers) and consider caching to stretch CPU-hours.
