# Base44 — All-in-One Vibe-Coding Platform

Last verified: 2026-04-26. Sources: https://base44.com (and Base44 docs), `example-marketplace/docs/analysis/platform-migration-evaluation.md`, `example-marketplace/docs/analysis/budget-bundle-evaluation.md`, example-marketplace `CLAUDE.md` operating notes.

## Overview

Base44 is a vibe-coding-first all-in-one app platform. Bundles: relational DB (entities), Deno serverless functions, auth, storage, LLM gateway (`InvokeLLM`), email/SMS, file upload, agent integrations. **Closed runtime; no local emulator; no Docker dev mode.** Optimized for AI-assisted full-stack development inside the Base44 sandbox + dashboard.

## Key facts

| Item | Value |
|---|---|
| Pricing model | Tiered subscription tied to **AI credits per business tier**, not per resource — opaque vs traditional cloud per-resource pricing |
| Bundle includes | DB (entities) + auth + storage + Deno functions + LLM (`InvokeLLM`) + email + SMS + file upload |
| Comparable score (vs $30/mo bundle requirement) | **8/10** per `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part A — closest 1:1 to "everything you need" |
| Vendor lock-in | HIGH — `@base44/sdk` is closed runtime; no offline/local dev; auth + storage + LLM all routed through Base44 |
| Monthly cost @ current scale | Not in CLAUDE.md (per `platform-migration-evaluation.md` pain point #10); pricing tied to AI-credit business tier, not platform usage |
| Geographic | Worldwide |
| Best fit | Vibe-coding-positive solo founders + 2-founder teams who want fastest end-to-end shipping with bundled LLM credits |

## Why founders choose Base44

- **Single bundle replaces 4–5 separate vendors.** No need to wire OpenAI + Resend + Twilio + S3 + Auth0 separately. One subscription, one dashboard.
- **InvokeLLM bundled credits** — no separate OpenAI/Anthropic API key required. The platform's own LLM gateway is genuinely value-add (most competitors make you BYO LLM credits per `example-marketplace/docs/analysis/budget-bundle-evaluation.md` PART D).
- **Vibe-coding-native** — agent-first development model; entities + functions auto-generate from natural-language prompts via the Base44 builder agent.
- **Deploy story** — git push + `coding/write` + headless deploy (3-min ritual; see pain points below).

## Why founders consider migration

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` documented pain points:

1. **Headless deploys are a 3-minute, 4-step ritual** (`git push` → 120s → `POST /deploy` → 60s → bundle-grep validate). UI auto-detect requires human-open Base44 tab; agents can't trigger it.
2. **`coding/write` to `pages/*` can be reverted by `base44-builder[bot]`** with a phantom "Manual code change" commit when sandbox HEAD is behind origin (WI-066 incident).
3. **Sandbox sync randomly stalls** — requires the BuildCanary hack.
4. **`asServiceRole.update()` silently drops fields** that exist in `entities/X.json` schema but missing from stored records (WI-108→WI-113 archetype).
5. **Schema vs data drift is non-debuggable** without manually round-tripping `coding/write`.
6. **`$gte`/`$lte` filter operators silently return `[]`** (200 OK, empty result) — date-floor logic must run client-side.
7. **New functions need `coding/write functions/NAME` to register**; git-push alone returns 404 forever.
8. **Phantom git refs block deploys** when `coding/write` runs before `git push`.
9. **Vendor lock-in:** no local emulator, no docker-compose dev, no test suite, no offline mode.
10. **Pricing opacity:** monthly cost not predictable from usage patterns.

## Migration cost vs benefit (the contrarian case)

Per `example-marketplace/docs/analysis/platform-migration-evaluation.md` TL;DR:

> **DO NOT MIGRATE NOW.** Stay on Base44 through first paying customer. If migration is forced after first $100 MRR, the ranked path is **Supabase ($0–25/mo, ~9-13 working days reusing covibefusion patterns)** > Cloudflare Workers+D1 ($5/mo, 3–4 weeks) > Convex ($25/mo, 4–5 weeks). Migration today saves zero customers and burns 2+ weeks against the build-no-launch trap.

**Honest bar to clear before greenlighting migration:**
- First $100 MRR on Base44, OR
- A Base44-specific blocker that *demonstrably* loses a paying customer (not "wastes my time"), OR
- Base44 platform shutdown / pricing change >2x current cost.

## Cost projections at scale

Per `platform-migration-evaluation.md`: Base44 cost is **opaque** because pricing ties to AI-credit business tier, not per-resource usage. The cost table from `platform-migration-evaluation.md` lists "unclear (AI-credit tied)" for both 100 MAU and 1k MAU rows.

Practical implication: founders cannot model unit economics on Base44 the way they can on per-resource clouds (Cloudflare, Supabase). For revenue-positive growth, this is acceptable. For unit-economics-driven decisions, request explicit usage estimates from Base44 sales.

## Common pitfalls

- **Treating Base44 like a per-resource cloud.** Pricing tier is based on AI-credit business tier; resource use within that tier doesn't track linearly. Don't try to model it like AWS.
- **Trying to develop offline.** Base44 has no local emulator. All dev happens against the sandbox or live entities. Document the workaround patterns in `CLAUDE.md`.
- **Building features outside the InvokeLLM gateway.** Bringing your own OpenAI key alongside InvokeLLM creates two failure modes and two billing lines for no benefit. Prefer the bundled gateway unless InvokeLLM lacks a feature you need.
- **Believing migration is cheap.** Even with the covibefusion pattern reuse, migration is 9-13 working days of feature-velocity loss. Defer until customer-validated.

## Sources

- Base44 platform: https://base44.com/
- Reusable analysis: `example-marketplace/docs/analysis/platform-migration-evaluation.md` (full migration trade study)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part A (Base44 8/10 bundle equivalence score)
- example-marketplace `CLAUDE.md` operating notes (project-specific Base44 quirks)
