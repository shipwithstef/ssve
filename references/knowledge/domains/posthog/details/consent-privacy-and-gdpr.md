# PostHog Consent, Privacy, And GDPR - Detail

## Mechanism (factual)

PostHog's GDPR docs put controller responsibility on the app operator when using PostHog Cloud: PostHog acts as processor, while the app decides why and how end-user data is processed. The docs recommend PostHog Cloud EU for robust GDPR compliance because it is hosted in Frankfurt. They also state that if a user opts out, the app must stop data capturing and processing, either by not loading SDKs or by disabling data capture.

Consent must be specific, informed, unambiguous, withdrawable, and documented. For cookies on logged-out users, a cookie banner and withdrawal path are expected. PostHog persistence defaults to `localStorage+cookie`, stores values such as distinct ID, session ID, feature flag state, super properties, and configuration, and uses a `ph_<project_api_key>_posthog` cookie with a 365-day default expiration. Persistence can be changed to `localStorage`, `sessionStorage`, `cookie`, `memory`, or disabled.

The JavaScript SDK offers `opt_out_capturing_by_default` and `opt_out_persistence_by_default`, but the strictest consent pattern is to avoid SDK import/initialization until the user grants the relevant category. If the SDK is initialized in memory-only mode before consent, `/flags` and other requests may still create a processing event; this is weaker than no initialization.

PII controls exist at several layers: autocapture controls, property denylist, `before_send`, session replay masking, URL/network redaction, realtime transformations before storage, IP capture settings, and data deletion for right-to-be-forgotten requests. For new PostHog Cloud EU projects, IP capture is disabled by default at the organization level according to the researched GDPR page.

## Analysis (expert commentary)

- **Useful for:** Building analytics that is explainable in privacy policy, cookie policy, and data subject request flows.
- **Trade-offs:** Opt-out config reduces risk but still loads code and can produce runtime requests. Consent-first dynamic import has less product data before consent but aligns better with strict EU cookie expectations.
- **Similar to:** Any ePrivacy/GDPR analytics stack where cookie consent, localStorage, and SDK side effects must match policy wording.
- **Could improve svc by:** Requiring analytics WIs to state "SDK initialized before consent: yes/no" and "storage prefixes cleared on withdrawal: yes/no."
- **Assumptions:** The app's legal basis for analytics is consent, not legitimate interest. If that changes, policy and implementation need a new review.
- **Watch out for:** Session replay can capture non-input text unless globally masked. Query strings can leak tokens or identifiers into replay unless redacted.

## Key Source Files (L4 pointers)

- `https://posthog.com/docs/privacy/gdpr-compliance.md` - controller/processor, consent, EU Cloud, IP capture, deletion.
- `https://posthog.com/docs/privacy.md` - privacy compliance index.
- `https://posthog.com/docs/privacy/data-collection.md` - controls during collection.
- `https://posthog.com/docs/privacy/data-storage.md` - storage, transformations, deletion, access control.
- `https://posthog.com/docs/libraries/js/persistence.md` - browser persistence and cookie behavior.
- `https://posthog.com/docs/libraries/js/config.md` - opt-out and persistence configuration.
- `https://posthog.com/docs/session-replay/privacy.md` - replay masking and redaction.
- `/home/svc-user/app-workspaces/example-marketplace/src/lib/cookieConsent.js` - current Example Marketplace category consent and cleanup implementation.
