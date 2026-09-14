# PostHog Local Implementation Comparison - Detail

## Mechanism (factual)

Example Marketplace currently has no `posthog-js` or `@posthog/react` dependency. Its `.env.example` exposes `VITE_POSTHOG_KEY=` and `VITE_POSTHOG_HOST=https://eu.i.posthog.com`. `src/lib/track.js` is a lightweight consent-aware direct sender: it checks `hasCookieCategoryConsent('analytics')`, creates/stores `hh_distinct_id` only after consent, assigns A/B variants only after consent, and no-ops if the key is missing. Its direct endpoint is `${POSTHOG_HOST}/capture/`, while the current official docs identify `/i/v0/e/` and `/batch/` as the main direct ingestion APIs.

Example Marketplace's `src/lib/cookieConsent.js` stores granular consent in `example-marketplace_cookie_consent`, defaults optional categories to false, dispatches `example-marketplaceCookieConsentChange`, and clears analytics storage when analytics consent is false. Cleanup includes `hh_distinct_id`, `hh_ab_`, `ph_`, `__ph`, and `posthog` prefixes. `CookieConsentBanner.jsx` provides accept all, reject, manage, and persistent settings flows.

The existing WI-316 plan is mostly aligned with current research: no SDK import before analytics consent, EU host, no key/no-consent network silence, withdrawal cleanup, non-email user IDs, logout reset, and live backend verification through Claude's PostHog MCP. Needed corrections: official React docs now use `@posthog/react`; direct REST fallback should use current `/i/v0/e/` or `/batch/`; and the old local skill's `posthog-js/react` import guidance should be treated as stale until revalidated.

CovibeFusion has a fuller but less strict implementation. Its web app initializes `posthog-js` at root if key is present, sets `opt_out_capturing_by_default: true`, disables autocapture, uses identified-only person profiles, captures history-change pageviews, configures replay masking, then re-opts-in if a local consent key is granted. Its tracking service wraps every typed capture in `!posthog.has_opted_out_capturing()`. Its Flutter service initializes, immediately disables to avoid lifecycle-event races, persists consent, gates identify/capture/flags, and resets on logout.

Distrilicious is weak as an implementation reference. It has privacy policy text mentioning PostHog and a `window.posthog?.capture` call in `Layout.jsx`, but no full consent lifecycle, provider setup, identity, replay masking, or live verification pattern was found in the inspected files.

## Analysis (expert commentary)

- **Useful for:** Translating official PostHog research into the actual Example Marketplace codebase without repeating another project's compromises.
- **Trade-offs:** Example Marketplace's current direct tracker is minimal and consent-safe, but it lacks official SDK features, React hooks, flags, replay, identity helpers, and current endpoint alignment.
- **Similar to:** A staged migration from custom `sendBeacon` analytics to an SDK/provider, with existing cookie consent as the gate.
- **Could improve svc by:** Marking local skills as "needs freshness review" when they contradict current official docs.
- **Assumptions:** Example Marketplace wants strict GDPR/ePrivacy posture, so "load SDK then opt out" is a weaker fallback than "do not load until analytics consent."
- **Watch out for:** Capturing a `consent_granted` event may itself be analytics processing; it should happen only after consent and should not be mirrored for denial in PostHog.

## Key Source Files (L4 pointers)

- `/home/svc-user/app-workspaces/example-marketplace/package.json` - no PostHog SDK dependency today.
- `/home/svc-user/app-workspaces/example-marketplace/.env.example` - EU host and empty key placeholder.
- `/home/svc-user/app-workspaces/example-marketplace/src/lib/track.js` - current lightweight consent-aware tracking.
- `/home/svc-user/app-workspaces/example-marketplace/src/lib/cookieConsent.js` - consent storage and cleanup.
- `/home/svc-user/app-workspaces/example-marketplace/src/components/CookieConsentBanner.jsx` - settings/withdrawal UI.
- `/home/svc-user/app-workspaces/example-marketplace/docs/plans/2026-05-27-wi316-posthog-integration/manifest.md` - prior WI-316 implementation plan.
- `/home/svc-user/app-workspaces/covibefusion/web/src/lib/posthog.ts` - web SDK configuration reference.
- `/home/svc-user/app-workspaces/covibefusion/lib/services/posthog_service.dart` - Flutter SDK consent-gating reference.
- `/home/svc-user/app-workspaces/distrilicious/src/Layout.jsx` - weak optional-capture reference.
- `/home/svc-user/app-workspaces/distrilicious/src/pages/PrivacyPolicy.jsx` - policy-only reference.
