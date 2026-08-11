# Perplexity for Startups

Last verified: 2026-04-26. Source: https://www.perplexity.ai/startups + `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part B.

## Overview

Perplexity offers a self-serve startup program with **$5,000 in API credits + 6 months of Enterprise Pro**. Distinguishing feature: open self-apply form (no VC referral required), unlike OpenAI/Anthropic startup programs.

## Key facts

| Item | Value |
|---|---|
| Total credit | **$5,000** Perplexity API credits + **6 months Enterprise Pro** subscription |
| Duration | 12 months (API credit) + 6 months (Enterprise Pro) |
| Eligibility | <5 years old; <$20M raised |
| Geographic | Worldwide |
| Application | https://www.perplexity.ai/startups |
| Difficulty | **2/5** |
| Approval probability | ~60–70% |

## What the $5K covers

Perplexity API services:

- **Sonar models** — Perplexity's purpose-built search-and-cite models (small, large, huge variants). Optimized for answering questions with citations.
- **Online models** — models with live web-search grounding built-in. Best-in-class for "answer this with current data" workflows.
- **Chat completions** — standard OpenAI-compatible chat API with the Perplexity model selection.

The $5K credit covers ~25M tokens of Sonar Large or ~5M tokens of Sonar Huge usage in 2026 pricing.

## Why this matters for bootstrapped founders

Perplexity Sonar is the best-in-class option for **citation-grounded LLM responses** — building features like "answer with sources" or "summarize web content" or "research assistant in my product." Replacing this with OpenAI/Anthropic + manual web-search-tool plumbing is 10× the engineering effort.

Bonus: 6 months of **Enterprise Pro** (worth ~$200/seat/year) — useful for founder personal research workflows.

## Eligibility cuts (when to NOT bother)

- > 5 years incorporated → out
- Raised >$20M → out (you should be paying retail at that scale)
- Product has no LLM/search-grounding use case → no point applying
- Workload is purely embedding-based / non-chat → out of scope (Perplexity API is chat-grounded)

## Stackability

- ✅ Stacks with all cloud-credit programs
- ✅ Stacks with xAI Grok deposit, Groq free tier, OpenRouter free tier (use as fallback router)
- ✅ Stacks with MS Founders Hub (Azure OpenAI for non-search workloads)
- No conflicts.

## Application steps

1. Visit https://www.perplexity.ai/startups
2. Sign up for a Perplexity account (or use existing)
3. Fill in startup details:
   - Company name + website
   - Founder details
   - Year founded
   - Funding amount
   - Product description with **specific Perplexity API use case** described
4. Submit. Approval typically 1–3 weeks.
5. On approval: API credit applied + Enterprise Pro seat granted.

## Common pitfalls

- **Vague product description.** Perplexity wants to see a SPECIFIC use case for their API — generic "we'll use LLMs" gets rejected. Describe: which feature in your product needs Sonar; what alternative you'd use without it; expected query volume.
- **Burning the credit on the wrong models.** Sonar Huge is 5–10× the cost of Sonar Large. For most use cases, Sonar Large is sufficient and the credit lasts much longer.
- **Forgetting Enterprise Pro is consumer-side.** Enterprise Pro is a personal subscription for the founder's own search workflows — not the API key for product integration. They are separate accounts.
- **Treating Perplexity as general-purpose LLM.** Perplexity Sonar is optimized for search-grounded answers. For pure code-gen, summarization-of-known-text, or chat without web grounding, Anthropic Claude / OpenAI GPT-4 / Grok are better fits.

## Sources

- Program landing: https://www.perplexity.ai/startups
- Perplexity API docs: https://docs.perplexity.ai/
- Perplexity pricing: https://www.perplexity.ai/pricing
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part B (Perplexity row, $5K + Enterprise Pro)
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part D (Phase 1 apply-this-week list)
