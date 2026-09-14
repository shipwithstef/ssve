# WI-489 diagnosis pattern scan

## Searches

Repository-wide active-source searches covered:

- `--max-turns 1`, `error_max_turns`, `terminal_reason`, and `stop_reason`
- `modelUsage`, `effective_tuple`, `model_mismatch`, and cache reusability
- `claude-fable-5`, `claude-opus-4-8`, and external-review policy declarations
- direct `claude -p` / `codex` review consumers

Historical proposals, completed test results, and documentation examples were separated from active executable siblings.

## Active hit conclusions

- Runtime producer of `--max-turns 1`: `scripts/run-external-review.mjs` (capability parser probe and real Claude invocation).
- Behavioral fixture asserting `--max-turns 1`: `test-framework/evals/tier-1/validate-external-review-launcher.sh`.
- Active external-review policy authorities: `scripts/run-external-review.mjs`, `references/model-registry.json`, and compatibility view `scripts/resolve-adversarial-reviewer.sh`.
- Effective-model, receipt, fallback, and cache decisions are centralized in the canonical launcher and `schemas/external-review-receipt.schema.json`.
- Active independent-review consumers use `scripts/run-external-review.mjs`; other `claude -p` calls are worker, evaluation, or extraction surfaces and are outside WI-489.
- No active fixture before WI-489 replays a schema tool handshake, structured `error_max_turns`, provider safety route, reviewer-profile cutover, or profile-selection receipt.

## Claude Code capability evidence

- Installed version inspected: `2.1.211`.
- Official CLI reference defines `--max-turns` as agentic turns and says reaching the limit exits with an error; it does not define turns as paid provider invocations.
- Official Fable help says Claude Code automatic switching is enabled by default, re-runs a safeguard-blocked Fable request on Opus 4.8 in the same conversation, and can be disabled in Config.
- The installed CLI contains the supported setting key `switchModelsOnFlag`, the disable control `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK`, and refusal-route provenance headers including `x-is-refusal-fallback`, `x-cc-fallback-from-model`, `x-cc-fallback-category`, `x-cc-fallback-trigger`, and `x-cc-original-request-id`.

These controls make the route deterministic by construction: invoke the exact Fable model with CLI fallback disabled, force the supported refusal-switch setting on in isolated invocation settings, scrub the disable environment variable, and accept effective Opus only with the isolated refusal-route evidence. Any other model change remains `model_mismatch`.
