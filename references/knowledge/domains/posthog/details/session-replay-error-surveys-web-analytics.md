# PostHog Replay, Error Tracking, Surveys, And Web Analytics - Detail

## Mechanism (factual)

Session replay records user sessions for debugging and analysis. Web replay privacy controls run in the browser, so masked values are not sent to PostHog. Inputs are masked by default, but general text is not masked by default. The SDK supports `maskAllInputs`, input-specific masking, `maskTextSelector`, `maskTextFn`, `ph-no-capture` blocks, URL and network redaction callbacks, and manual recording control for sensitive third-party screens.

Console log recording is separate from replay and can be enabled as part of session recording. If enabled, it increases the amount of diagnostic data collected and can include sensitive text from application logs unless the app already redacts logs.

Error tracking can capture exceptions through SDK functions such as `captureException(error)` and can link to session replay and other context when configured. Surveys are in-app experiences configured in PostHog and can be rendered automatically by the JS SDK. Web analytics uses the SDK to collect traffic and pageview data.

These products share the browser SDK surface but are distinct processing purposes. Consent and policy text should not say "analytics only" if replay, surveys, logs, or error tracking are enabled. For Example Marketplace, the safe first implementation is product analytics only, with replay, surveys, error tracking, logs, and web analytics expansion gated behind separate review.

## Analysis (expert commentary)

- **Useful for:** Debugging UX problems and understanding funnels after explicit user consent.
- **Trade-offs:** Replay has the highest privacy blast radius because it can capture on-screen content, URLs, and console/network context if configured broadly.
- **Similar to:** Hotjar/FullStory style replay plus Sentry-like error context, but coupled to the analytics identity graph.
- **Could improve svc by:** Splitting "analytics SDK" from "recording SDK features" in route-workflow acceptance criteria.
- **Assumptions:** Browser UI contains personal, business, booking, loyalty, and payment-adjacent data that should be masked or excluded by default.
- **Watch out for:** `ph-no-capture` also prevents autocapture events from that element. This is usually good for sensitive UI, but can surprise analytics owners.

## Key Source Files (L4 pointers)

- `https://posthog.com/docs/session-replay/start-here.md` - session replay product start.
- `https://posthog.com/docs/session-replay/privacy.md` - masking, blocking, URL/network redaction, mobile controls.
- `https://posthog.com/docs/session-replay/console-log-recording.md` - console log recording behavior.
- `https://posthog.com/docs/error-tracking/capture.md` - exception capture.
- `https://posthog.com/docs/surveys/creating-surveys.md` - survey creation and rendering flow.
- `https://posthog.com/docs/web-analytics/installation.md` - web analytics installation.
