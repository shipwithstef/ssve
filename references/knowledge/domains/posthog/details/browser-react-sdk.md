# PostHog Browser And React SDK - Detail

## Mechanism (factual)

The JavaScript SDK is initialized with `posthog.init(projectToken, config)`. Relevant config for web apps includes `api_host`, `ui_host`, `defaults`, `autocapture`, `capture_pageview`, `capture_pageleave`, `persistence`, `disable_persistence`, `opt_out_capturing_by_default`, `opt_out_persistence_by_default`, `person_profiles`, `session_recording`, `before_send`, `property_denylist`, and feature flag options such as `flag_keys` and `feature_flag_request_timeout_ms`.

The official React guide now installs `posthog-js` and `@posthog/react`. It initializes the `posthog-js` client at the root and passes it to `PostHogProvider` from `@posthog/react`. Components should use `usePostHog` and React feature-flag hooks instead of importing the singleton directly. This conflicts with older local skill guidance that recommended `posthog-js/react`; the current official source should win for new implementation unless a compatibility reason is proven.

For Vite SPA routing, `defaults: '2026-01-30'` includes the newer defaults chain, while `capture_pageview: 'history_change'` explicitly makes pageviews follow history API navigation. If a project needs a reverse proxy for ingestion, `api_host` should point at the proxy and `ui_host` should point at the real PostHog UI so generated links remain correct.

The SDK requests `/flags` on initialization for runtime configuration. Disabling `/flags` disables or degrades multiple SDK features, including autocapture, session recording, compression, feature flags, toolbar, and surveys. That means a strict no-consent flow should avoid SDK initialization rather than relying only on disabled products after load.

## Analysis (expert commentary)

- **Useful for:** Vite/React apps that want instrumentation, feature flags, and replay through one provider and hook surface.
- **Trade-offs:** The React provider is ergonomic, but root-level initialization can create network/storage side effects at app startup. Consent-sensitive apps should dynamically import and initialize only after consent.
- **Similar to:** Segment/Amplitude browser SDK initialization plus React context wrappers, with extra runtime behavior from `/flags`.
- **Could improve svc by:** Recording an explicit "official docs supersede local skills" warning when a local skill contradicts current vendor docs.
- **Assumptions:** The app can expose a public project token safely and keeps private/personal API keys server-side only.
- **Watch out for:** `autocapture: false` does not disable pageview capture. `disable_session_recording` and session replay config are separate. `/flags` can still happen even when autocapture is false.

## Key Source Files (L4 pointers)

- `https://posthog.com/docs/libraries/js.md` - JavaScript web SDK setup.
- `https://posthog.com/docs/libraries/js/config.md` - full browser SDK config surface.
- `https://posthog.com/docs/libraries/js/usage.md` - SDK usage details.
- `https://posthog.com/docs/libraries/react.md` - current React provider and hook guidance.
- `https://posthog.com/docs/support/javascript-api.md` - JavaScript API reference.
- `/home/svc-user/app-workspaces/example-marketplace/.claude/skills/posthog-integration/SKILL.md` - local skill that needs review against current React docs.
