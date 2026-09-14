# NVIDIA Inception

Last verified: 2026-04-26. Source: https://www.nvidia.com/en-us/startups/ + `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part C.

## Overview

NVIDIA's startup program. **Critical insight:** NVIDIA Inception is a major hack for bootstrapped founders because **it does not require VC funding** — only an incorporated entity. It also acts as the on-ramp to AWS Activate **Portfolio tier ($100K credits)** which is otherwise gated.

## Key facts

| Item | Value |
|---|---|
| Total credit value | **$100K AWS Activate credits** + **$150K Nebius AI credits** + **30% off DGX Cloud** + **75% off NVIDIA AI Enterprise** + Deep Learning Institute (DLI) training credits |
| Eligibility | Incorporated entity (BG OOD/EOOD, US LLC/C-Corp, EE OÜ all acceptable) + working website + <10 years in business + at least one developer |
| Geographic eligibility | Worldwide |
| US-only flag | NO |
| Application difficulty | **2/5** — needs incorporated entity (vs 1/5 for MS Founders Hub which has no incorp gate) |
| Approval probability | High (~60–70%) for any incorporated software startup |
| Time to credits | 1–4 weeks |

## The AWS-on-ramp angle (load-bearing)

This is the **load-bearing reason** to apply for many bootstrapped founders:

- AWS Activate **Founders tier** is self-serve and gives **$1,000** credits — not enough for serious workloads.
- AWS Activate **Portfolio tier** gives **up to $100K** credits but is gated by membership in approved investor / accelerator / partner programs.
- **NVIDIA Inception is on the AWS Activate Portfolio approved-partner list.** Acceptance into Inception → automatic Portfolio-tier eligibility → $100K AWS credits.
- This is the canonical bootstrapped path to large AWS credits without raising VC.

## Nebius angle

**Nebius** (formerly Yandex's spin-off) is the GPU cloud partner of choice for NVIDIA Inception. $150K Nebius credits cover production-grade GPU inference and training. Particularly valuable for:

- LLM fine-tuning workloads
- Stable Diffusion / image-gen pipelines
- Video processing at scale
- Anything that would burn $/hour H100 / A100 time at retail prices

Nebius pricing is competitive vs AWS (cheaper $/GPU-hr in 2026). The $150K credit goes ~3x further than the same dollar spent on AWS GPU SKUs.

## Eligibility cuts (when to NOT bother)

- Not yet incorporated → form entity first (BG OOD ~€500, US LLC via Stripe Atlas $500, EE OÜ ~€700 — see jurisdictions/)
- > 10 years in business → out of program
- No developer on team → out of program
- Pure consulting business with no developed software product → out of scope
- Note: spouse-OOD or single-founder OOD/EOOD is fine — no co-founder requirement

## Stackability

- ✅ Stacks with MS Founders Hub (different cloud — Azure vs AWS)
- ✅ This IS the on-ramp to AWS Activate Portfolio (it's the linkage, not a conflict)
- ✅ Stacks with GCP for Startups
- ✅ Stacks with Cloudflare for Startups
- ✅ Stacks with PostHog, Perplexity
- ✅ Stacks with all single-vendor SaaS programs

No conflicts.

## Application steps

1. Ensure incorporated entity exists (any jurisdiction).
2. Ensure working website is live (can be a basic landing page).
3. Visit https://www.nvidia.com/en-us/startups/ → "Apply Now".
4. Fill in:
   - Company name + registration number + country
   - Website URL
   - Founder + at least one developer with technical bio
   - Product description (NVIDIA reads this — emphasize GPU/AI workloads if any)
   - Funding history ($0 is fine)
5. Submit. Initial review 1–2 weeks; full credits available 2–4 weeks after.
6. Once approved, follow the AWS Activate Portfolio enrollment link from Inception portal — separate ~1-week process for the AWS credits.

## Common pitfalls

- **Applying without incorporation.** Inception requires a registered entity. Sole-trader / личен БУЛСТАТ / sole-prop on Schedule C is NOT enough. Must be EOOD/OOD/LLC/C-Corp/OÜ etc.
- **Not following through on AWS Activate Portfolio enrollment.** Inception approval does NOT auto-enroll you in AWS Activate. You must follow the portal link and complete the AWS Activate Portfolio application separately. Many founders stop at Inception approval and miss the $100K AWS credits.
- **Treating $150K Nebius as equivalent to $150K AWS.** Different vendors, different SLAs, different region availability. Nebius is excellent for batch GPU workloads but lacks AWS's full service breadth (no S3-equivalent for general object storage, no Lambda, etc.).
- **Burning DGX Cloud discount on dev workloads.** 30% off DGX Cloud is meaningful only at scale ($/hour H100s for 100+ GPU-hours/month). At dev scale, free Workers AI / Groq tier is cheaper.

## Sources

- Program landing: https://www.nvidia.com/en-us/startups/
- AWS Activate (Portfolio tier): https://aws.amazon.com/activate/portfolio/
- Nebius pricing: https://nebius.com/prices
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part C (full eligibility breakdown)
- Reusable analysis: `example-marketplace/docs/analysis/cloud-trial-and-llm-credits.md` Part D (Phase 1 apply-now playbook)
