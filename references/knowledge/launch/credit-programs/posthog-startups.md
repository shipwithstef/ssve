# PostHog for Startups

Last verified: 2026-04-26. Source: https://posthog.com/startups + `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B.

## Overview

PostHog (open-source product analytics + feature flags + session replay + experiments) offers a generous startup program. **$50,000 in PostHog platform credits** for qualified startups.

## Key facts

| Item | Value |
|---|---|
| Total credit | **$50,000** in PostHog platform usage |
| Duration | 12 months |
| Eligibility | <2 years old; <$5M raised |
| Geographic | Worldwide |
| Application | https://posthog.com/startups |
| Difficulty | **2/5** |
| Approval probability | ~50–70% |

## What the $50K covers

PostHog's product surface:

- **Product analytics** — events, funnels, retention, dashboards
- **Session replay** — record user sessions with privacy controls
- **Feature flags + experiments** — A/B testing infrastructure
- **Surveys** — in-app NPS / feedback
- **Web analytics** — privacy-friendly alternative to GA
- **AI / LLM observability** — track LLM calls + costs (NEW in 2025)
- **CDP (customer data platform)** — destination forwarding to Hubspot, Mailchimp, etc.

$50K is a LOT — most early-stage startups would use <$5K/year of PostHog. The credit covers usage well beyond practical scaling.

## Why this matters for bootstrapped founders

Without analytics, founders fly blind on funnel + retention. Without feature flags, every change is risky. Without session replay, debugging UX issues requires guesswork. PostHog provides all of this at $0 founder spend for the credit-window — replacing what would otherwise be 3 separate paid tools (e.g., Mixpanel + LaunchDarkly + Hotjar).

## Eligibility cuts (when to NOT bother)

- > 2 years incorporated → out (the <2yr age cut is the main filter)
- Raised >$5M → out
- Pure consulting / agency → out
- Already on PostHog with high usage → contact sales for direct discount instead

## Stackability

- ✅ Stacks with all cloud-credit programs
- ✅ Stacks with all single-vendor SaaS programs
- No conflicts.

## Application steps

1. Visit https://posthog.com/startups
2. Sign up for a PostHog Cloud account (or use existing)
3. Fill in startup details:
   - Company name + website
   - Founder details
   - Year founded (must be <2)
   - Funding amount (must be <$5M)
   - Product description (1–2 paragraphs)
4. Submit. Approval typically 1–3 weeks.
5. On approval: credit applied to PostHog Cloud project.

## Common pitfalls

- **Forgetting to install the SDK day 1.** Credit means nothing if you're not capturing events. Install the JS SDK on launch; capture key product events ASAP.
- **Over-instrumenting.** PostHog charges per event. Sending every page-view AND every micro-interaction can burn credit faster than expected. Track meaningful events (signup, activation, retention milestones, conversion); skip noise.
- **Using PostHog for ALL analytics.** PostHog is excellent for product analytics but not the right tool for SEO / marketing analytics (use GA4 or Plausible for that) or revenue analytics (use ChartMogul / RevenueCat for that).
- **Letting session replay capture PII.** Configure privacy masking BEFORE deploying session replay. Default settings may capture sensitive form inputs.

## Sources

- Program landing: https://posthog.com/startups
- PostHog pricing: https://posthog.com/pricing
- Reusable analysis: `example-marketplace/docs/analysis/budget-bundle-evaluation.md` Part B ($50K credit, 2/5 difficulty)
