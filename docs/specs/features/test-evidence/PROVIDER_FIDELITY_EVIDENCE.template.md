# Provider Fidelity Evidence

Work item: `WI-000`
Feature: `<feature-name>`
Run: `<YYYY-MM-DD-feature>`

## Summary Fields

| Field | Value |
|---|---|
| provider_requested | `<provider named or implied by user/spec>` |
| primary_provider | `<canonical provider expected for PASS>` |
| provider_used | `<provider actually used by the generated/saved output>` |
| primary_capability | `<text|image|video|audio|data|auth|payment|maps>` |
| fallback_policy | `forbidden-unless-user-approved` |
| source_evidence_required | `true` |
| text_source | `N/A - image capability` |
| image_source | `<provider output id, URL, log path, or durable artifact path>` |
| fallback_used | `false` |
| fallback_user_approved | `false` |
| saved_state_verified | `PASS - <returned view/persisted display evidence>` |
| semantic_relevance_result | `PASS - <why output matches the requested subject>` |
| visual_quality_result | `PASS - <quality review path or note>` |
| final | `PASS` |

## Evidence Notes

- Primary-provider success means `provider_used` matches `provider_requested` or `primary_provider`.
- Unapproved fallback, mocks, placeholders, uploaded substitutes, or draft-only results cannot satisfy this evidence.
- Saved-state verification must prove the generated result is visible after save/return, not only present in an intermediate draft.
