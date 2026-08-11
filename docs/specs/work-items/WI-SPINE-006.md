# WI-SPINE-006: Recall gate must require .sources.jsonl on knowledge domains

**Type:** framework-bugfix
**Status:** validated-advisory
**Severity:** high
**Filed:** 2026-04-30
**Source:** session 2026-04-30 — bullshit-knowledge-domain incident
**Lane:** framework
**Depends on:** WI-SPINE-001 (recall-stack-knowledge skill)

## Goal

Close the structural gap exposed when commit 5607ad9 (reverted by 46728e8) wrote training-data-confabulated knowledge files into `references/knowledge/domains/{github-actions,terraform,kubernetes}/` and the Spine had no mechanism to refuse them.

## Actual State Audit — 2026-05-11

The advisory fix exists:

- `recall-stack-knowledge/SKILL.md` documents the `.sources.jsonl` provenance check and `legacy-unverified` behavior.
- `test-framework/evals/tier-1/validate-knowledge-domain-provenance.sh` exists and runs.
- `references/knowledge/domains/legacy-backfill-queue.json` covers all 13 legacy unverified domains.
- `test-framework/evals/tier-1/validate-knowledge-legacy-backfill.sh` exists and passes.
- full tier-1 sweep on 2026-05-11 passed: `139 scripts passed, 0 failed`.

Current validator result:

- 10 verified domains
- 13 legacy-unverified domains
- 0 post-gate failures

Remaining gap: this is still advisory for legacy domains. The hard block belongs to WI-SPINE-005's Phase E flip, after infra lane mechanics and gap-closure proof are ready.

## Original Gap

`recall-stack-knowledge` (the Spine gate) currently treats any `references/knowledge/domains/<topic>/CAPABILITIES.md` as authoritative content. It has no provenance check. Result: training-data confabulations are recall-served as if cited.

## Hypothesized fix

Two-layer protection:

1. **Recall-side:** `recall-stack-knowledge` SKILL.md adds a check — before returning a slice from `domains/<topic>/CAPABILITIES.md`, verify that domain has a non-empty `.sources.jsonl`. If absent or empty, mark the slice as `unverified` in the recall log AND prepend a warning header to the slice in-context.

2. **Write-side:** new tier-1 validator `validate-knowledge-domain-provenance.sh` — for every `references/knowledge/domains/<topic>/CAPABILITIES.md`, require `.sources.jsonl` with ≥1 entry. Phase A: warn-only. Phase E: blocking.

## Acceptance Criteria

- AC1: `recall-stack-knowledge` SKILL.md updated with provenance-check step before returning slices.
- AC2: `validate-knowledge-domain-provenance.sh` exists, runs in <5s, identifies all domains lacking `.sources.jsonl`.
- AC3: Existing domains audited — those without `.sources.jsonl` flagged or backfilled.
- AC4: Tier-1 baseline preserved. Current expected baseline is full tier-1 PASS, with legacy provenance domains reported as warnings rather than failures until Phase E.

## Notes

This is the structural fix for what was a session-level discipline failure: the agent skipped research and wrote training-data into the Spine. The validator turns the discipline into a gate the framework enforces, so the next agent (or this one) cannot make the same mistake silently.
