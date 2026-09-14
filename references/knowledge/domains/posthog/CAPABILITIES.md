# PostHog Domain - Capabilities

**Domain:** PostHog product analytics, experimentation, replay, privacy, and AI/MCP operations
**Layer:** 2 (CAPABILITIES)
**Last updated:** 2026-05-27
**Source scope:** Official PostHog docs raw Markdown, npm registry metadata, and local Example Marketplace/CovibeFusion/Distrilicious implementation references.

---

## Platform Positioning

- PostHog is an open-source product and data platform covering product analytics, session replay, feature flags, experiments, error tracking, surveys, web analytics, logs, AI observability, data warehouse, and MCP-backed agent operations.
- Official docs expose `llms.txt` and raw `.md` pages, making direct source-manifest research practical and auditable.
- Cloud regions matter: ingestion hosts are `https://us.i.posthog.com` and `https://eu.i.posthog.com`; EU projects should stay on EU Cloud unless a project has a documented transfer basis.
- The current npm snapshot researched on 2026-05-27 is `posthog-js@1.376.2` and `@posthog/react@1.9.1`.

## Browser And React SDK

- JavaScript SDK initialization accepts `api_host`, `ui_host`, `defaults`, `autocapture`, `capture_pageview`, `persistence`, `person_profiles`, opt-out defaults, session replay config, and feature-flag tuning.
- Official vanilla React guidance currently installs both `posthog-js` and `@posthog/react`; this differs from older local guidance that only used `posthog-js/react`.
- In React, root-level `PostHogProvider` should own the initialized client, and components should use hooks instead of importing the singleton directly.
- For Vite/SPA applications, `capture_pageview: 'history_change'` or `defaults: '2026-01-30'` aligns pageview tracking with client-side navigation.

## Events, Identity, And Persons

- Capture calls require stable event names and optional properties; server/API capture requires `api_key`, `distinct_id`, and `event`.
- Anonymous and identified events have different person-profile costs; `person_profiles: 'identified_only'` and `$process_person_profile: false` are cost and privacy controls.
- `identify()` links anonymous and known IDs, creates/updates person profiles, and should use a durable user ID rather than mutable PII when possible.
- `reset()` is mandatory on logout/account switch to avoid merging unrelated users on shared devices.

## Consent, Privacy, And GDPR

- PostHog's GDPR docs explicitly place responsibility on the app to not load the SDK or to disable capture when a user opts out.
- For EU users, PostHog Cloud EU is the preferred managed hosting option and EU Cloud new projects disable IP capture by default at the organization level.
- Browser persistence defaults to `localStorage+cookie`; `memory`, `disable_persistence`, `opt_out_capturing_by_default`, and `opt_out_persistence_by_default` are available for stricter consent flows.
- Autocapture, session replay, URL capture, network capture, and person properties need explicit minimization because they can process personal data.

## Session Replay, Error Tracking, Surveys, Web Analytics

- Session replay is powerful but high-risk: inputs are masked by default, but non-input text is not globally masked unless configured.
- The replay privacy model supports input/text masking, `ph-no-capture` blocks, URL/network redaction callbacks, and manual start/stop patterns.
- Error tracking and surveys can be enabled through the SDK, but both should be treated as separate processing purposes in consent and policy text.
- Web analytics can use the same SDK surface but still depends on the analytics consent category.

## Feature Flags, Experiments, And Rollouts

- Feature flags are evaluated through `/flags` and exposed via `isFeatureEnabled`, `getFeatureFlag`, payload APIs, callbacks, and React hooks.
- First-visit flag availability is asynchronous unless bootstrapped; server pre-evaluation or earlier client evaluation avoids flicker.
- Experiments are built on feature flags, and exposures depend on `$feature_flag_called` or a valid custom exposure event.
- Canary releases can progress from internal user targeting through beta cohorts and percentage rollout, with metrics, errors, surveys, funnels, and replay filtered by flag.

## Server API, Proxy, CSP, And MCP

- Official event ingestion APIs are `/i/v0/e/` for single events and `/batch/` for batched events, both using the public project token.
- Reverse proxies and CSP configuration can improve capture reliability and ad-blocker resilience, but they add privacy and infrastructure review obligations.
- PostHog MCP exposes product operations across analytics, feature flags, experiments, errors, logs, surveys, and SQL/HogQL.
- Official Codex setup uses `npx @posthog/wizard mcp add`, plugin install, or `codex mcp add posthog --url https://mcp.posthog.com/mcp`; the local Claude config currently has an EU PostHog MCP connected.

## Example Marketplace Fit

- Example Marketplace currently has no `posthog-js` or `@posthog/react` dependency, has a consent-aware lightweight `track.js`, and defaults to EU ingestion with an empty project key.
- The existing Example Marketplace tracker uses a direct `/capture/` call; official current docs favor the SDK or `/i/v0/e/` and `/batch/` APIs for direct REST ingestion.
- Example Marketplace's cookie settings and withdrawal logic already clear `hh_distinct_id`, `hh_ab_`, `ph_`, `__ph`, and `posthog` storage prefixes, which is the right prerequisite before SDK enablement.
- The implementation-ready path is still: do not import or initialize PostHog before saved Analytics consent and a real EU project key exist; after enablement, verify no pre-consent network/storage, capture after consent, reset on withdrawal/logout, and live event visibility through MCP or API.

## Multi-product / multi-env org structure & pricing (verified 2026-06-12, gemini cross-checked 8/8)

- **No GA "environments" feature** — the documented pattern is SEPARATE PROJECTS per environment (and per product). Internal-user/property filtering in one project does NOT prevent capture: staging events still bill and pollute persons/cohorts.
- **Project limits are the real fleet constraint:** Free plan = 1 project; paid pay-as-you-go = 6 projects; unlimited needs platform packages (Boost $250/mo, Scale $750/mo, Enterprise). 6 slots = 3 products × staging+prod.
- **Free monthly allowances are per ORGANIZATION and shared across projects** (usage sums org-wide; billing limits are org-level): 1M events, 5K replays, 1M flag req, 1.5K survey responses, 100K exceptions, 1M warehouse rows, 50GB logs. Allowances persist on paid and reset monthly — set org billing limits day one and a validation-scale fleet stays $0 on the paid plan.
- Rate cards volume-discount steeply (events $0.00005 → $0.000009 @250M+; replays $0.005→$0.0015). Paid extends retention 1yr→7yr.
- **Cross-project gotchas:** dashboards/insights/actions/experiments CANNOT be copied between projects; feature flags CAN (flag → Projects tab → Copy).
- Keep a product's app + marketing site in the SAME prod project (full-journey tracking); local dev uses no key, not a project slot.
- **PostHog for Startups:** $50k credits / 12 months, then $500 transition credit. Eligibility: company <2 years old, <$5M raised, not acquired — NO VC requirement, NO geo restriction (bootstrapped Bulgarian EOOD qualifies if EIK registration <2y old). Apply: paid plan w/ card → in-app application (app.posthog.com/startups) → auto Stripe credit + manual review.
