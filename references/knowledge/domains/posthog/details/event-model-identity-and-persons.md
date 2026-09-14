# PostHog Event Model, Identity, And Persons - Detail

## Mechanism (factual)

Events are the base data object. Browser SDK capture can send custom events with optional properties. API capture requires `api_key`, `distinct_id`, and `event`; `properties` and `timestamp` are optional. Current official REST ingestion docs identify `/i/v0/e/` as the single-event endpoint and `/batch/` as the batched endpoint.

PostHog has a distinction between anonymous and identified processing. Browser SDKs generate anonymous IDs automatically. Calling `identify(distinct_id, properties)` links the anonymous ID to a known ID and creates or updates a person profile. Backend SDKs do not have the same anonymous-session context, so server-side identify mostly updates person profiles. Direct API calls are identified by default unless `$process_person_profile` is set to `false`; if a `distinct_id` has already been used with identified events, later events can still be treated as identified.

Identity quality is load-bearing. Distinct IDs must be unique and stable. The docs warn that duplicate or generic IDs merge users. On logout, the frontend should call `reset()` so future events on the same device are not associated with the previous user. Passing `true` to reset also resets the device ID.

Person properties can be passed in `identify()` or via event properties such as `$set`. Group analytics can associate events with organizations or teams when group calls/properties are used. Feature flags also rely on person and group properties, so identity timing affects rollout and experiment correctness.

## Analysis (expert commentary)

- **Useful for:** Designing a clean product event taxonomy and avoiding cost/privacy drift from over-identification.
- **Trade-offs:** Identifying early improves cross-device analysis and flags, but it increases person profile processing and data subject obligations.
- **Similar to:** Mixpanel distinct ID and alias semantics, where bad identity keys cause irreversible-looking analytic confusion.
- **Could improve svc by:** Making "reset on logout/account switch" a standard acceptance criterion for analytics WIs.
- **Assumptions:** The product has a stable non-PII user ID. If only email is available, use it cautiously and disclose it as personal data.
- **Watch out for:** Alias has strict constraints; an alias cannot already be associated with multiple IDs or previously used in conflicting ways.

## Key Source Files (L4 pointers)

- `https://posthog.com/docs/product-analytics/capture-events.md` - event capture patterns and naming guidance.
- `https://posthog.com/docs/api/capture.md` - direct capture and batch endpoint contract.
- `https://posthog.com/docs/product-analytics/identify.md` - identify, reset, and alias behavior.
- `https://posthog.com/docs/product-analytics/identity-resolution.md` - identity strategy and timing.
- `https://posthog.com/docs/data/anonymous-vs-identified-events.md` - anonymous versus identified event processing.
- `https://posthog.com/docs/data/persons.md` - person data model.
- `https://posthog.com/docs/product-analytics/person-properties.md` - person property update patterns.
