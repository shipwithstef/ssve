# xAI (Grok API) — Deposit-for-Credits Perpetual Program

Last verified: 2026-04-26. Source: https://console.x.ai + `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part B + Part D.

## Overview

xAI offers a unique **deposit-for-credits perpetual program** for Grok API users. Spend $5 once + opt into Data Sharing → receive **$150/month in API credits perpetually** (as long as program runs). Lowest-friction credit program in the LLM space.

## Key facts

| Item | Value |
|---|---|
| Initial cost | **$5 deposit** (one-time) |
| Recurring credit | **$150/month** API credits, perpetual |
| Required action | Spend the $5 + opt into Data Sharing in console settings |
| Eligibility | Anyone with a credit card |
| Geographic | Worldwide (with usual exclusions) |
| Application difficulty | **1/5** — set up account + deposit + toggle |
| Approval probability | ~100% (deterministic; no review) |
| Time to credits | Same day for first month; auto-renews monthly |

## Why this matters

- $150/month × 12 = $1,800/year of LLM API credits at $5 cost. ROI = 360× — highest of any program in the catalog.
- The Data Sharing requirement means xAI uses your prompts/completions to improve Grok models. Acceptable for non-confidential workloads (most public-facing SaaS use cases). NOT acceptable for confidential customer data — turn off Data Sharing if your prompts include PII or trade secrets, but then you lose the $150/month.
- Grok models are competitive with GPT-4o-class for many tasks (chat, summarization, code-gen at modest complexity).

## Eligibility cuts (when to NOT use)

- Workload involves customer PII or confidential trade secrets → Data Sharing trade is not acceptable; either keep Data Sharing on for non-confidential routes only, or skip
- Need image-gen / video-gen → Grok API focuses on text / vision-text; check current model offerings
- Need offline / on-prem inference → API-only program

## Stackability

Universally stackable with all other credit programs. xAI's Grok credit doesn't conflict with any cloud or LLM provider.

## Setup steps

1. Visit https://console.x.ai
2. Sign up (X / Twitter account works as login)
3. Add a credit card to billing
4. Deposit $5 (one-time)
5. Spend the $5 on any Grok API call (e.g., a test "hello world" via curl or SDK)
6. Go to Settings → Data Sharing → toggle ON
7. Within 24-48 hours, $150 monthly credit appears on the account
8. Credit auto-renews monthly as long as Data Sharing remains ON and the program is offered

## Common pitfalls

- **Forgetting to spend the $5.** The $150/month doesn't trigger until the deposit is consumed. Make a real API call in the first few days.
- **Forgetting to toggle Data Sharing ON.** Without the toggle, no monthly credit is granted.
- **Using Grok API for confidential workloads.** Data Sharing means xAI sees your prompts. Only use for non-confidential routes (public-facing chatbots, content generation, code-gen on public/non-proprietary code, etc.).
- **Believing the $150/month is contractually guaranteed forever.** xAI can change the program at any time. Treat it as a recurring nice-to-have, not a load-bearing infrastructure dependency.

## Sources

- xAI Console: https://console.x.ai
- Program announcement (xAI's own social communications) — track xAI blog: https://x.ai/blog
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part B (xAI row, $25 signup + $150/mo ongoing) and Part D (Phase 2 perpetual setup)
