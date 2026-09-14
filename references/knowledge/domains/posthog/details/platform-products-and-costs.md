# PostHog Platform, Products, And Cost Surfaces - Detail

## Mechanism (factual)

PostHog is a multi-product platform rather than a single analytics SDK. The researched official index lists product analytics, session replay, feature flags, experiments, error tracking, surveys, web analytics, logs, LLM observability, data warehouse, and AI/MCP workflows as first-class areas. The docs also expose `llms.txt` and raw Markdown pages, which makes it possible to build deterministic manifests instead of scraping rendered navigation.

The researched npm registry state on 2026-05-27 is `posthog-js@1.376.2` and `@posthog/react@1.9.1`. `posthog-js` carries OpenTelemetry/logging, DOMPurify, Preact, fflate, web-vitals, `@posthog/types`, and `@posthog/core` dependencies. `@posthog/react` is MIT licensed and peers on React plus `posthog-js`.

PostHog distinguishes project API tokens from personal API keys. Browser/server capture uses the project token. Administrative APIs, MCP, HogQL, project configuration, and live verification use authenticated account access or personal tokens. Official cloud ingestion hosts are region-specific: `https://us.i.posthog.com` and `https://eu.i.posthog.com`.

Pricing/cost exposure is not one product line. Analytics identified events, anonymous events, feature flag requests, session replay volume, errors, logs, surveys, and experiments can all have separate usage implications. The identity docs explicitly state anonymous events can be materially cheaper than identified events, and experiments are billed through feature flag requests.

## Analysis (expert commentary)

- **Useful for:** Treating PostHog as a product instrumentation layer: analytics first, then flags/experiments/replay only when the consent, privacy, and cost model are ready.
- **Trade-offs:** One SDK can enable many products, but that is exactly why strict initialization and config discipline matter. A careless default can turn on autocapture, replay, surveys, `/flags`, or persistence earlier than the legal text implies.
- **Similar to:** A combined Mixpanel + LaunchDarkly + Hotjar + Sentry-lite stack, but with one identity graph and one MCP/API operational surface.
- **Could improve svc by:** Adding a reusable "analytics platform" checklist that separates event capture, identity, replay, flags, experiments, and backend verification instead of treating analytics SDK install as one task.
- **Assumptions:** Project teams can access a real PostHog project, configure region correctly, and keep policy text aligned with enabled products.
- **Watch out for:** Installing `posthog-js` is not the same as enabling only analytics. Session recording, surveys, feature flags, logs, and autocapture can be pulled into the runtime by config and project settings.

## Key Source Files (L4 pointers)

- `https://posthog.com/llms.txt` - canonical product/documentation index and AI assistant instructions.
- `https://registry.npmjs.org/posthog-js/latest` - current researched `posthog-js` package metadata.
- `https://registry.npmjs.org/@posthog/react/latest` - current researched React adapter package metadata.
- `https://posthog.com/docs/libraries.md` - SDK catalog and supported platforms.
- `https://posthog.com/docs/experiments/start-here.md` - feature-flag-request billing note for experiments.
