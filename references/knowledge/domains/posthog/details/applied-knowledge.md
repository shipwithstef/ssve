# PostHog Applied Knowledge - Detail

## 1. Distilled positions

- PostHog is not "just analytics"; it is a multi-product SDK and operations platform. Interpretation: implementation must explicitly choose which products are enabled, not merely install the package. Source: `CAPABILITIES.md`, `details/platform-products-and-costs.md`.
- Strict EU consent posture means no browser SDK import or initialization before saved Analytics consent. Interpretation: `opt_out_capturing_by_default` is useful but not as strong as delayed dynamic import. Source: `details/consent-privacy-and-gdpr.md`.
- Current official React docs use `@posthog/react` with `posthog-js`. Interpretation: the older local skill guidance needs a freshness correction before implementation. Source: `details/browser-react-sdk.md`.
- Identity must use a stable unique ID and must reset on logout. Interpretation: Example Marketplace should not identify by email if a Base44 user ID exists. Source: `details/event-model-identity-and-persons.md`.
- Live verification is a separate capability from browser E2E. Interpretation: use Playwright for no-consent/no-key/capture behavior and MCP/API for ingestion, identity, flags, and deletion. Source: `details/server-api-mcp-and-verification.md`.

## 2. Cross-domain implications

For Example Marketplace, the safest path is incremental: keep the current consent UI and storage cleanup, replace or wrap the lightweight tracker with a dynamic PostHog SDK client only after Analytics consent and a real EU project key, keep replay/surveys/error/logs disabled at first, and verify live ingestion through Claude's connected PostHog MCP. If direct REST remains as a fallback, update it from the current `/capture/` path to the official `/i/v0/e/` or `/batch/` endpoints.

For legal/compliance work, policy text should list PostHog only for the products actually enabled. Product analytics is one purpose; session replay, surveys, error tracking, logs, and experiments are separate enough that enabling them should trigger policy/cookie copy review.

For release strategy, PostHog feature flags can support the user's canary approach, but product-critical entitlement or payment gates should not rely only on client-side flags. Use PostHog flags for UI rollout and measurement, and server-side/Base44 enforcement for authority.

## 3. Contradictions / open questions

- Official React docs now say `@posthog/react`; local Example Marketplace skill says `posthog-js/react`. This must be resolved in the local skill before using it as implementation authority.
- CovibeFusion enables SDK initialization before consent but opts out by default. Example Marketplace's stricter legal posture should not copy that exact pattern for web.
- PostHog Cloud EU project settings cannot be verified yet because no real Example Marketplace PostHog project key or Codex-accessible MCP tool is configured.
- IP capture should be verified in the actual EU project, even though docs state new EU org projects disable it by default.

## 4. Recency-weighted insights

- The npm package snapshot is current as of 2026-05-27: `posthog-js@1.376.2`, `@posthog/react@1.9.1`.
- The docs defaults chain includes `2026-01-30`, so new implementation should not copy older defaults from stale guides.
- Official MCP docs list Codex support, but this session's Codex environment has no callable PostHog MCP. Host-specific MCP availability must be checked at implementation time.
- Existing Example Marketplace consent work from 2026-05-27 is already aligned with the prerequisite storage cleanup and settings UI.

## 5. Source map

- `CAPABILITIES.md` - all major capabilities and Example Marketplace fit.
- `details/browser-react-sdk.md` - SDK config, current React package guidance, and initialization risks.
- `details/event-model-identity-and-persons.md` - event capture, distinct ID, identify/reset, person profiles.
- `details/consent-privacy-and-gdpr.md` - EU Cloud, consent, persistence, IP, deletion, and privacy controls.
- `details/session-replay-error-surveys-web-analytics.md` - replay masking and adjacent product risk.
- `details/feature-flags-experiments-and-rollouts.md` - flags, experiments, exposures, and canary rollout.
- `details/server-api-mcp-and-verification.md` - ingestion endpoints, MCP setup, and verification ladder.
- `details/local-implementation-comparison.md` - Example Marketplace, CovibeFusion, and Distrilicious comparison.
- `.sources.jsonl` - URL/file hashes and retrieval metadata.

## 6. What this distillation does NOT capture

This research does not verify a live Example Marketplace PostHog account, project settings, event ingestion, HogQL results, deletion behavior, billing limits, or feature flag definitions. Those require a real PostHog Cloud EU project key and authenticated MCP/API access. It also does not replace legal advice; it translates official docs into implementation constraints for engineering work.
