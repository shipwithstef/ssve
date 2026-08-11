# PostHog Feature Flags, Experiments, And Rollouts - Detail

## Mechanism (factual)

Feature flags are created in PostHog and consumed by SDK calls. Browser code can use `isFeatureEnabled('flag-key')`, `getFeatureFlag('flag-key')`, and `getFeatureFlagPayload('flag-key')`. The SDK fetches flags in the background and stores them in the configured persistence layer, so flags are normally immediate after the first visit but not guaranteed on first load. `onFeatureFlags` can wait for the request, and `reloadFeatureFlags()` refetches when user state changes.

React integrations expose hooks including enabled/variant/payload hooks. Payload-only reads do not send exposure events, so payload use should be paired with a hook/call that records `$feature_flag_called` when experiment exposure matters.

Bootstrapping lets a web or React Native app initialize with precomputed flag values, a distinct ID, an identified-ID marker, and optionally a session ID. The docs recommend server-side pre-evaluation or earlier client pre-evaluation when a SPA needs flags before rendering. Local evaluation is primarily a server-side optimization for fast and reliable pre-evaluation.

Experiments are built on feature flags. Calling `getFeatureFlag()` can automatically track exposures. Experiment metrics only count after exposure, and exposed users are identified by `$feature_flag_called` with `$feature_flag` and `$feature_flag_response`. The docs describe sample-ratio mismatch detection and emphasize verifying exposure tracking before launch.

Canary rollout guidance starts with self/internal targeting, then beta users or organizations, then expanded beta or percentage rollout, and finally full release and cleanup. Monitoring should include metrics, errors, surveys, funnels, and session recordings filtered by flag.

## Analysis (expert commentary)

- **Useful for:** Gradual release, entitlement experiments, signup/onboarding optimization, and the canary approach the user asked to use.
- **Trade-offs:** Flags add a runtime `/flags` dependency and persistence state. If consent blocks analytics storage, product-critical gating should not depend only on client-side PostHog flags.
- **Similar to:** LaunchDarkly feature flags plus Optimizely experiment exposure semantics.
- **Could improve svc by:** Making canary WIs require a flag lifecycle section: create, target, observe, expand, cleanup.
- **Assumptions:** The app has enough event volume for experiment inference; small traffic apps should prefer qualitative canary plus direct KPI inspection before formal A/B claims.
- **Watch out for:** Returning users may not emit new exposure events if the web SDK cached `$feature_flag_called` before the experiment launched unless deduplication settings are chosen intentionally.

## Key Source Files (L4 pointers)

- `https://posthog.com/docs/feature-flags/start-here.md` - feature flag overview.
- `https://posthog.com/docs/feature-flags/adding-feature-flag-code.md` - web and React flag APIs.
- `https://posthog.com/docs/feature-flags/bootstrapping.md` - precomputed flag values and distinct ID bootstrap.
- `https://posthog.com/docs/feature-flags/local-evaluation.md` - server-side local evaluation.
- `https://posthog.com/docs/feature-flags/canary-release.md` - staged rollout process.
- `https://posthog.com/docs/experiments/start-here.md` - experiment creation and analysis flow.
- `https://posthog.com/docs/experiments/exposures.md` - exposure events and analysis inclusion.
- `https://posthog.com/docs/api/flags.md` - feature flag evaluation API endpoint.
