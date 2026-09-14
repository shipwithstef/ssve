# Framework improvement: truthful Claude reviewer runtime routing

**Status:** IMPLEMENTED / UNMERGED — independent review and promotion pending
accepted_wi: WI-489
**Date:** 2026-07-16
**Source:** two promoted-launcher WI-486 Fable 5/high attempts plus explicit owner routing decision
**Candidate severity:** critical
**Severity:** critical
**Plan-changeset class:** hot-path

## Gap

The promoted WI-488 external-review launcher models the requested CLI tuple but not the complete Claude structured-output protocol or Anthropic-managed safety routing. `--max-turns 1` permits the initial provider response but can terminate before the schema tool handshake returns a final result. The resulting `error_max_turns` is classified as an unknown provider failure, which hides the actionable cause.

The same receipt model also assumes a requested Fable model either remains Fable or reaches Opus only through a launcher-created fallback. Anthropic may instead route a Fable request to Opus under provider safeguards. Treating that provider decision as an ordinary Fable success would make the effective tuple false and the content-addressed cache unsafe; treating it as launcher fallback would risk invoking Opus twice.

This is one gap: **the canonical reviewer launcher does not truthfully model the bounded Claude protocol and provider-controlled effective-model route across a scheduled reviewer-policy change**.

## Evidence

- `.svc/external-review-artifacts/WI-486/plan-primary/receipt.json` and `plan-primary-retry/receipt.json` were real Fable 5/high primary invocations through the promoted launcher. Both returned `error_max_turns`, `num_turns: 2`, `stop_reason: tool_use`, no findings, and an unhelpful `unknown_provider` classification.
- Runtime usage for those attempts showed Fable plus the CLI's auxiliary Haiku model and no Opus, so they are schema-turn failures, not provider safety routes.
- The promoted launcher sets Claude `--max-turns 1` even though schema-constrained output can require a bounded follow-up protocol turn after the single paid review inference.
- Anthropic's Fable documentation states that safeguards can route some requests to Opus in the same conversation and exposes a supported Claude Code switch setting. The installed 2.1.211 CLI also carries refusal-route provenance internally. That behavior is provider-managed and distinct from the launcher's explicit second invocation after a classified availability failure.
- The owner requires `fable-high` through `2026-07-19T20:59:59.999Z` and `opus-high` from `2026-07-19T21:00:00Z` (`2026-07-20 00:00:00 EEST`, `Europe/Sofia`), with an explicit receipted switch back to `fable-high` when desired.

## Diagnosis

- **Root cause:** WI-488 equated one paid review invocation with one CLI protocol turn and represented every Fable-to-Opus outcome as launcher-controlled fallback.
- **Category:** external provider contract and receipt/cache semantics.
- **Duplicate filter:** WI-488 established the canonical launcher and tuple discipline; WI-489 corrects runtime semantics exposed only by promoted real use. It does not create a second launcher or reopen WI-488's completed graph.
- **Adjacent scope excluded:** WI-486 session bootstrap and WI-487 installation/hook work remain paused and unchanged until this correction is promoted.

## Required behavior

- Permit four Claude CLI agentic turns for schema completion while proving exactly one primary paid review invocation and retaining timeout/dollar ceilings.
- Classify schema-turn exhaustion explicitly and never make it availability-fallback eligible.
- Record requested model, runtime-observed model usage, effective model, route kind, and whether effort is exact or provider-managed.
- Recognize provider-managed Fable-to-Opus safety routing without launching a second Opus attempt, but only from an isolated invocation with forced refusal switching and corroborating route provenance; model observation alone fails closed.
- Reject any unexplained effective-model change.
- Never reuse provider-routed Opus evidence as a Fable primary cache hit.
- Resolve Codex-orchestrated review from a versioned profile policy: `fable-high` before the cutover and `opus-high` from the owner cutover, with an explicit receipted profile override to switch back.
- Keep Claude-orchestrated review on Codex 5.6 sol/high.

## Implementation route

**Route:** normal framework pipeline: `research → diagnose-bug → write-spec → design-tech → plan-changeset → review-plan → execute-changeset → review-exec → review-security → review-gate → audit-implementation → test-framework → land-changeset → verify-promotion`.

This hot-path provider integration is not quick-fix eligible. Planning uses high reasoning and execution uses medium reasoning. The independent plan review may use a narrowly receipted bootstrap exception because the canonical Fable review path is the component under repair; implementation review must exercise the corrected launcher.

## Replay verification

- Fixture replay: schema tool handshake succeeds within the bounded turn budget after one primary invocation.
- Fixture replay: schema-turn exhaustion produces a dedicated non-fallback classification.
- Fixture replay: provider safety-routed Opus records provider routing, does not invoke Opus again, and misses a later Fable-primary cache lookup.
- Fixture replay: unexplained model changes fail closed.
- Time-zone boundary replay: before/at/after 2026-07-20 00:00 Europe/Sofia selects the expected profile, including DST-safe absolute instants.
- Override replay: status and switch commands select and receipt `fable-high` without editing code.
- Bounded real review: one canonical invocation yields schema-valid findings and a truthful receipt; no separate paid smoke probe.
- Full Tier-1: no new failures relative to the captured dirty-worktree 242/2 snapshot and clean-main 242/2 comparison, followed by the framework's current landing policy.

## FRAMEWORK-STATE.md mutations

- Add this promoted-runtime mismatch as an active Known Gap while WI-489 is open.
- On promotion, move it to Closed Gaps and record the scheduled profile, provider-route semantics, and replay evidence.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | One gap only | PASS |
| 2 | Real promoted-runtime evidence is identified | PASS |
| 3 | WI-486 and WI-487 remain excluded | PASS |
| 4 | Route includes independent review and promoted proof | PASS |
| 5 | Owner cutover and re-enable policy are explicit | PASS |
