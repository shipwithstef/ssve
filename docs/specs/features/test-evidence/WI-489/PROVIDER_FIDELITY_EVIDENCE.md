# WI-489 Provider Fidelity Evidence

| Field | Design requirement |
|---|---|
| provider_requested | Explicit `claude-fable-5` at high for the bounded real review |
| primary_provider | Anthropic Claude through the canonical launcher |
| provider_used | Must be read from receipt-v2 runtime evidence, never assumed from request |
| provider_route | `explicit_profile_primary` or corroborated `provider_safety_route` |
| route_attestation | Controlled Fable settings/env/argv envelope plus same-process runtime model usage; safety-route causation is labeled envelope-inferred, not provider-attested |
| fallback_policy | Separate Opus/xhigh only after model unavailable, entitlement, or provider overload |
| fallback_used | Must be false for EXTREV-122 |
| process_invocations | Exactly one primary process; no paid smoke call |
| protocol_turns | Configured CLI ceiling and provider-reported turn metric are recorded separately; they are not falsely asserted to be the same counter |
| effective_effort | Exact runtime value or null with `provider-managed` provenance for a safety route |
| saved_state_required | Findings, receipt, and human-readable independent-review disposition |
| fixture_policy | PASS — current full targeted replay: 137 passed, 0 failed (incl. 8 phase-to-review-kind guard fixtures); every provider process resolved inside the fixture root |
| capability_preflight | First real attempt stopped with `capability` before any provider process because 2.1.211 omits documented `--max-turns` from help; configured parser probe accepts it, and a negative parser fixture now covers true absence |
| bounded_provider_attempt | One explicit Fable/high process reached the 300-second timeout; receipt records exit 143, no findings/effective tuple, no fallback, and no Opus process |
| retry_authority | Owner authorized the unchanged complete package at a 1,200-second production timeout; no package scope reduction |
| complete_package_retry | One Fable/high process ran 424.98 seconds and stopped after two turns at Claude's separate `$5` ceiling; `$5.519469` usage, no Opus, no findings |
| authorized_review_ceiling | `$50` for the complete launcher review; fallback receives only the primary's unspent remainder |
| successful_complete_review | PASS — one Fable/high process, two turns, 497.18 seconds, `$6.20431`, no fallback, schema-valid findings |
| live_four_route_canary | PASS — Codex `gpt-5.6-sol/high`, Fable 5/high, Opus 4.8/high, and AGY all authenticated and returned the schema/output expected by the reusable canary |
| live_fable_settings_canary | PASS — Claude Code 2.1.211 accepted `switchModelsOnFlag`, inherited model controls were scrubbed, and `modelUsage` server-observed Fable plus allowed Haiku only |
| final | PENDING clean frozen-diff review after plan convergence |

The deterministic implementation evidence is complete. The final conclusion
remains pending until `review-exec` performs the one bounded canonical
`fable-high` invocation against the frozen diff and records its exact findings,
receipt, route, protocol-turn count, and no-fallback proof.

The zero-process capability failure is preserved at
`.svc/external-review-artifacts/WI-489/provider-fidelity/capability-preflight-failure-receipt.json`;
it is not counted as the bounded paid primary review.

The bounded provider timeout is preserved at
`.svc/external-review-artifacts/WI-489/provider-fidelity/provider-timeout-receipt.json`.
It proves that timeout does not trigger Opus, but it cannot satisfy EXTREV-122
because no schema-valid findings completed. The temporary explicit Fable
selection was cleared after the failure.

The authorized 20-minute retry is preserved at
`.svc/external-review-artifacts/WI-489/provider-fidelity-20m/receipt.json`. It
did not reach the wall-clock limit: Claude returned
`subtype=error_max_budget_usd`, `terminal_reason=budget_exhausted`, and
`Reached maximum budget ($5)` after reporting `$5.519469`. This real terminal
exposed and now fixtures the missing `budget_exhausted` classification.
The owner subsequently approved a `$50` complete-review ceiling. The corrected
launcher receipts that limit and subtracts reported primary usage before a
separate fallback, preventing two attempts from doubling the authorized review
limit. The next frozen-candidate review is authorized under that bound.

The authorized review completed at
`.svc/external-review-artifacts/WI-489/provider-fidelity-50/receipt.json` with
requested, invoked, and effective Fable 5/high; route
`explicit_profile_primary`; `process_invocations=1`; `reported_turns=2`;
`fallback.used=false`; reusable exact-primary cache evidence; and a `$50`
configured ceiling. The independent findings are retained and every actionable
item is dispositioned before the clean re-review.

The reusable four-route hello-world canary completed at
`/tmp/svc-wi489-live-canary-LQdgar`. A focused post-finding Fable settings
canary completed at `/tmp/svc-wi489-fable-settings-canary-qr1MPX` and records
Claude Code `2.1.211`, accepted `switchModelsOnFlag`, scrubbed inherited model
controls, exact server-observed `claude-fable-5` plus allowed Haiku, no Opus,
and `$0.095596` reported cost. These short 120-second canaries do not change
the launcher's exact 1200-second production review default.
