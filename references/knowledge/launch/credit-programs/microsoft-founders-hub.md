# Microsoft for Startups Founders Hub

Last verified: 2026-04-26. Source: https://www.microsoft.com/en-us/startups + `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` + `example-marketplace/docs/analysis/budget-bundle-evaluation.md`.

## Overview

Microsoft's flagship startup program. **Bootstrapped-friendly** — does NOT require VC backing or institutional funding. Open to solo founders. Provides Azure credits, GitHub Enterprise, LinkedIn Premium, Microsoft 365, Visual Studio, and (critically) **Azure OpenAI Service access** which is the canonical bootstrapped path to GPT-4-class models.

## Key facts

| Item | Value |
|---|---|
| Total credit value | **Up to $150,000 Azure** + GitHub Enterprise + LinkedIn Premium + Microsoft 365 + Visual Studio Enterprise |
| Stages | 3 stages: Idea → MVP → Scale. Credits unlock progressively as milestones are met. |
| Duration | Up to 4 years across stages |
| Eligibility (entry: Idea stage) | Be a startup with a software product idea. **No incorporation required at entry.** $0 funding OK. |
| Eligibility (MVP stage) | Working product + proof of customers/users. Some traction signal. |
| Eligibility (Scale stage) | Revenue + product-market fit signals. Higher credit unlocks. |
| Geographic eligibility | Worldwide (with usual sanctioned-country exclusions) — confirmed open to BG, EE, US, UK, EU founders |
| US-only flag | NO — global program |
| Female founder fast-track | YES — program explicitly highlights female founders; discretionary review may favor applications with female-founder/CEO |
| Application difficulty | **1/5** — self-serve form, ~15 minutes |
| Approval probability (bootstrapped solo) | High (~70%+) |
| Time to credits | 2–7 days for Idea stage |

## Stages and $-value progression

| Stage | Credit unlock | What it gets you |
|---|---|---|
| **Idea** | ~$1,000 Azure + GitHub + tools | Enough to deploy a static site + small DB; explore Azure OpenAI |
| **MVP** | Up to $25,000 Azure | Production-grade for early MAU; Azure OpenAI dev usage |
| **Scale** | Up to $150,000 Azure | Production-grade through ~10K MAU; Azure OpenAI production usage |

## Azure OpenAI angle (bootstrapped path to GPT-4-class)

This is the **load-bearing reason** to apply for many bootstrapped founders:

- OpenAI Startups program requires VC referral — practically 0% approval for bootstrapped EU founders (per `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part E).
- **Azure OpenAI Service** offers the same GPT-4 / GPT-4o / o-series models routed through Azure infrastructure, with Microsoft's Founders Hub credits as the funding source.
- Practical effect: $25K–$150K of GPT-4 usage at $0 founder spend.
- Caveat: Azure OpenAI requires a separate **access request** beyond the Founders Hub enrollment — apply at https://aka.ms/oai/access. Approval is a separate gate (~1–2 weeks).

## Eligibility cuts (when to NOT bother)

- Already incorporated > 5 years AND > $5M raised → too late for entry tier
- Pure consulting business with no software product → out of scope
- Sanctioned country (e.g., DPRK, Iran) → blocked

## Stackability

- ✅ Stacks with NVIDIA Inception (different cloud, different vendor)
- ✅ Stacks with AWS Activate (different cloud)
- ✅ Stacks with GCP for Startups (different cloud)
- ✅ Stacks with Cloudflare for Startups
- ✅ Stacks with PostHog, Perplexity
- ✅ Stacks with all single-vendor SaaS programs (Notion, Linear, Sentry, etc.)

No conflicts. Universally stackable.

## Application steps

1. Create a Microsoft account (or use existing).
2. Visit https://www.microsoft.com/en-us/startups and click "Apply".
3. Fill in startup details:
   - Company name (can be пред-incorporation placeholder)
   - Founder names + roles
   - Product description (1–2 paragraphs; describe the AI angle if applicable)
   - Stage (start with Idea)
   - Funding history ($0 is fine)
4. Submit. Approval typically 2–7 days.
5. Once approved, claim Azure subscription + GitHub Enterprise + Microsoft 365 from the Founders Hub portal.
6. Optionally request Azure OpenAI access at https://aka.ms/oai/access.

## Common pitfalls

- **Forgetting to claim each benefit.** The portal lists Azure, GitHub, LinkedIn, M365 separately — each is a manual claim step. Set a reminder to visit weekly until all claimed.
- **Failing to upgrade the Azure subscription** to convert credits to spendable balance. Default Azure trial separately limits resources; the Founders Hub credit applies via a dedicated subscription type ("Microsoft Azure Sponsorship").
- **Hitting Azure region limits** — some quota requests (high-end VMs, large GPU SKUs) require a separate approval ticket; not the program's fault but adds 2–5 day delay.
- **Applying after MS Founders Hub email blast comes AFTER you've burned $300 GCP retail trial** — no penalty, just sub-optimal sequence. Apply MS first, then any cloud retail trials only after MS credits are flowing.
- **Confusing Azure OpenAI access with Founders Hub enrollment.** They are TWO DIFFERENT applications.

## Sources

- Program landing: https://www.microsoft.com/en-us/startups
- Founders Hub direct: https://foundershub.startups.microsoft.com/
- Azure OpenAI access request: https://aka.ms/oai/access
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part D (Phase 1 apply-now playbook)
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B (eligibility 1/5, $150K Azure)
