# First 100 Customers — B2B SaaS Playbook

Last verified: 2026-04-26. Sources: Y Combinator startup school playbooks (https://www.startupschool.org/), First Round Review essays, founder retros published 2024–2026.

## Overview

B2B SaaS first-100-customer acquisition is **bimodal**: either you have a warm network that buys the first 10–20 (founder-network outbound), OR you have engineering-as-marketing distribution (free tool, useful blog, OSS project) that pulls inbound. **Cold outreach without one of these two flywheels is the hardest path** and rarely produces 100 customers in <6 months for first-time B2B founders.

## Channel ranking by ROI for B2B SaaS

| Channel | Best for | Time to first 10 | Time to first 100 | Founder time per customer |
|---|---|---|---|---|
| **Founder warm network outbound** | Founders with prior B2B exits or strong vertical network | 1–3 weeks | 2–4 months | 1–3 hours |
| **HN Show + relevant comments** | Dev-tools, infrastructure, productivity | 1–4 weeks | 3–6 months | <1 hour (one launch + organic) |
| **Reddit niche subs (r/sysadmin, r/Entrepreneur, r/saas)** | Tools matching subreddit's pain | 2–6 weeks | 4–8 months | 2–4 hours (AMA + replies) |
| **Indie Hackers + community participation** | Founder-tools, productivity, community-fit | 4–8 weeks | 6–12 months | 1–2 hours/week ongoing |
| **LinkedIn outbound (cold + InMail)** | Sales/marketing tools, HR tools, ops tools | 4–12 weeks | 6–12 months | 4–8 hours per closed |
| **Cold email (multi-step sequence)** | Pure-play B2B with clear ICP | 4–12 weeks | 6–12 months | 2–4 hours per closed |
| **Product Hunt** | Consumer-adjacent B2B with clean visual | 1 day (the launch) | Sometimes never | 30 min on launch day; rarely the load-bearing channel for B2B |
| **SEO / programmatic content** | Tools competing on intent ("X vs Y", "best Z for [industry]") | 6–12 months (long lead time) | 12–24 months | 4+ hours/week ongoing |
| **Paid ads (LinkedIn, Google)** | Only after channel-fit proven via organic | 2–8 weeks for first conversion | 6–18 months | $/customer-acquisition + creative review |

## The 80/20 sequence

For most first-time bootstrapped B2B SaaS founders without a strong warm network:

1. **Weeks 1–4: Founder warm network + adjacent network** — list 50 people you've worked with who could plausibly be a buyer or refer one. Reach out with "I built X, would you try it / introduce me to someone who might?" Target: first 5–10 customers.
2. **Weeks 4–8: HN Show launch + Reddit niche AMAs** — once you have early customer testimonials and a working demo, post HN Show and AMA in 2–3 vertical subreddits. Target: 20–40 more.
3. **Weeks 8–16: LinkedIn outbound or cold email to ICP** — once you have ~30 customers + clear ICP signal, structured outbound. Target: 60–100.
4. **Months 4+: Content marketing + paid ads** — only after you understand who buys + why. Premature SEO investment burns cycles.

## ICP definition (mandatory before outbound)

Before any outbound, define ICP across:

- **Company size** (employee count, revenue range)
- **Industry / vertical** (SaaS, fintech, healthcare, e-commerce, ...)
- **Geography** (US-only? EU-only? Worldwide?)
- **Pain trigger** (what bad situation makes them search for your category right now?)
- **Buyer role + budget** (CTO with $500/mo discretionary? VP Sales with $5K/mo procurement?)

Without ICP, outreach is shotgun. Conversion rate <0.5%; ROI negative.

## Common pitfalls

- **Skipping the warm-network step** because "it doesn't scale." First 10 customers are not about scale — they're about case studies + testimonials + product feedback. Cold outreach to strangers fails without these.
- **Going to Product Hunt first.** Product Hunt audience is consumer-tech-shaped. B2B SaaS often gets <100 upvotes + zero qualified leads. Use HN Show or Reddit subs instead unless your B2B SaaS happens to be designer/maker-adjacent.
- **Cold emailing without research.** Generic "I built X for companies like yours" cold emails get <0.5% reply rate. Personalized first-line based on real context (recent post, mutual connection, specific pain in their company) gets 10–20% reply rate. Use `cold-email` skill for the sequence framework.
- **Premature SEO investment.** SEO has 6–12 month lead time. For first 100 customers in <6 months, focus on faster channels.
- **Tracking activity instead of pipeline.** "I sent 200 cold emails" is activity. "I have 12 qualified replies" is pipeline. Measure pipeline.
- **Not asking for testimonials early.** First 5 customers are gold. Ask each for a case-study quote within 30 days of activation. Use these in subsequent outreach.

## Composition with existing skills

| Channel | svc skill that executes |
|---|---|
| Founder warm network outbound | (no skill — manual founder work; `mine-builder` informs the network list) |
| HN Show / Reddit launch | `launch` |
| Cold email sequence | `cold-email` |
| LinkedIn outbound prospecting | `prospect` + `cold-email` |
| AI-personalized variants | `ai-cold-outreach` |
| Free tool / lead magnet | `free-tools` + `lead-magnets` |
| SEO content | `programmatic-seo` + `seo-audit` + `ai-seo` |
| Paid ads | `ads` + `ad-creative` + `ab-testing` |

`launch-knowledge` outputs the **channel ranking** in `docs/analysis/distribution-plan.md`. The named skills above run the campaigns.

## Sources

- Y Combinator Startup School: https://www.startupschool.org/
- First Round Review essays on B2B distribution: https://review.firstround.com/
- Lenny Rachitsky's growth playbook archives: https://www.lennysnewsletter.com/
- Founder retros: published case studies (Plausible, Tailwind UI, Linear, Loom, etc.) describing first-100-customer paths
- (Specific URL refs above; founder-retro citations are best-tracked via the founder's own blog rather than a single canonical source)
