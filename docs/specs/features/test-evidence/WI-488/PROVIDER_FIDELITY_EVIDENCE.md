# WI-488 Provider Fidelity Evidence

| Field | Value |
|---|---|
| provider_requested | claude-fable-5 |
| primary_provider | Anthropic Claude claude-fable-5 |
| provider_used | Anthropic Claude claude-fable-5 |
| primary_capability | text |
| text_source | .svc/external-review-artifacts/WI-488/review-exec-round7-core-final/receipt.json |
| fallback_policy | Opus xhigh is allowed only after structured model_unavailable, model_entitlement, or provider_overload classification |
| source_evidence_required | true |
| fallback_used | false |
| fallback_user_approved | false |
| saved_state_verified | true - findings and receipt persisted with requested, invocation, and effective tuples |
| final | PASS verified |

The primary receipt records `claude-fable-5` at `high` for the requested,
invocation, and effective tuples. Its fallback record is `used: false`. The
tracked human-readable disposition is
`docs/specs/reviews/wi-488-exec-cross-model.md`.
