# Credit Programs Knowledge

Startup credit programs cataloged with eligibility cuts, $-value, application difficulty, stackability matrix.

Last reviewed: 2026-05-03.

| File | Program | Max value | Stackable with | Difficulty |
|---|---|---|---|---|
| [euipo-sme-fund.md](euipo-sme-fund.md) | **EUIPO SME Fund — "Ideas Powered for Business"** (EU IP voucher: trademarks, designs, patents, plant varieties, IP scan) | €700 (TM/Design) / €1,620 (IP Scan) / €3,500 (Patents) / €1,500 (Plants) | All — independent IP grant | 2/5; ⚠️ TM/Design budget historically exhausts within 2-4 months of Feb 1 cycle open |
| [microsoft-founders-hub.md](microsoft-founders-hub.md) | Microsoft for Startups Founders Hub | $150K Azure + GitHub + LinkedIn + OpenAI access | Most others; sister to NVIDIA Inception | 1/5 |
| [nvidia-inception.md](nvidia-inception.md) | NVIDIA Inception | $100K AWS Activate + $150K Nebius + DGX/AI Enterprise discounts | MS Founders Hub, AWS Activate (escalation path) | 2/5 |
| [aws-activate.md](aws-activate.md) | AWS Activate (Founders/Portfolio/Builders) | $1K self-serve → $100K via NVIDIA Inception or VC | NVIDIA Inception (entry path); MS Founders Hub | 1/5 self-serve, 3/5 Portfolio |
| [google-cloud-startup.md](google-cloud-startup.md) | Google for Startups Cloud Program | $2K bootstrapped → $200K+ VC-referred | Stacks with most; replaces personal $300 trial | 1/5 self-serve |
| [xai-grok-deposit.md](xai-grok-deposit.md) | xAI (Grok API) deposit-for-credits | $150/month perpetual | Universally stackable | 1/5 |
| [cloudflare-startups.md](cloudflare-startups.md) | Cloudflare for Startups | $5K (bootstrap tier); $250K+ Workers/AI for VC tier | Most | 1/5 |
| [posthog-startups.md](posthog-startups.md) | PostHog for Startups | $50,000 platform credits | Most | 2/5 |
| [perplexity-startups.md](perplexity-startups.md) | Perplexity for Startups | $5K API credits + 6mo Enterprise Pro | Most | 2/5 |

## Stackability matrix

|  | MS FH | NVIDIA | AWS | GCP | xAI | CF | PostHog | Perplexity |
|---|---|---|---|---|---|---|---|---|
| **MS FH** | – | ✅ | ✅ | ✅ (different cloud) | ✅ | ✅ | ✅ | ✅ |
| **NVIDIA** | ✅ | – | ✅ (this is its on-ramp) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AWS** | ✅ | ✅ | – | conflict if both pre-funded | ✅ | ✅ | ✅ | ✅ |
| **GCP** | ✅ | ✅ | conflict | – | ✅ | ✅ | ✅ | ✅ |
| **xAI** | ✅ | ✅ | ✅ | ✅ | – | ✅ | ✅ | ✅ |
| **CF** | ✅ | ✅ | ✅ | ✅ | ✅ | – | ✅ | ✅ |
| **PostHog** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – | ✅ |
| **Perplexity** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | – |

> The "AWS ↔ GCP conflict" line means programs that explicitly demand exclusive primary-cloud commitment. In practice, you can hold both program credits but workload should pick one primary; that's a usage decision not an eligibility conflict.

## Apply order (per `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part D)

**Phase 1 (today):** MS Founders Hub, NVIDIA Inception, Perplexity for Startups.
**Phase 2 (today):** Cloudflare account + R2/D1/Workers AI, xAI deposit, Groq + Google AI Studio + OpenRouter free accounts.
**Phase 3 (when needed):** GCP/Azure/AWS retail trials (only after Founders Hub credits are exhausted).

Total realistic stack: **~$250K+** of credits at $0 commitment, 12–24 months of enterprise infra runway.

## Deferred to on-demand `/research`

| Program | Trigger to populate |
|---|---|
| mongodb-startups.md | First MongoDB-backed project |
| stripe-atlas.md | First non-US-resident asking about US incorporation (note: covered partially in `jurisdictions/us-de.md`) |
| notion-linear-sentry.md | First request for SaaS-tooling credits |
| brex-mercury.md | First US-incorporated project asking for banking |
| ycombinator-deals.md | First request for non-YC accessible deals |
| female-founder-programs.md | First eligible profile (AWS Impact Accelerator, Pipeline Angels referrals, Backstage Capital, Google for Women Founders) |

## Calendar-bound programs

| Program | Next cycle window | Action |
|---|---|---|
| **EUIPO SME Fund Voucher 2 (Trademarks/Designs)** | ~1 February 2027 — apply within first 24-72h before budget exhausts | Pre-prep EUIPO User Area + SME proof + trademark name(s) by 2027-01-25 |
| EUIPO SME Fund Voucher 3 (Patents) | Available 2026, opens annually Feb 1 | Apply when patent-applicable innovation is identified |
