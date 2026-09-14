# Cross-Model Execution Review: WI-505 stale binding reclaim

**Date:** 2026-07-21
**Author/orchestrator:** Codex (OpenAI)
**Independent reviewer:** Claude Opus 4.8, high effort (Anthropic)
**Branch:** `framework-WI-505-stale-binding-reclaim`
**Current corrected-freeze rounds:** 2 of 3
**Verdict:** PASS WITH ACKNOWLEDGED LOW RISK

## Review surface

The canonical launcher reviewed the staged production and focused-fixture diff against WI-505 SR-01 through SR-15, with explicit authority, CAS, crash, v1/v2, fail-open, and data-preservation lenses. Every invocation used the scheduled Opus/high tuple with no fallback or owner override.

An initial three-round review cycle found and closed an idempotent same-winner finalizer race and certified the final-resolver v2 postcondition. The later full implementation audit then found two issues outside that frozen review: transfer's first durable winner write preceded current provenance, and a different-session binding at the same generation was ignored. Those findings reopened execution and invalidated the initial receipt. The current record below is a fresh bounded review cycle over the corrected staged diff.

## Corrected-freeze round 1

Receipt: `.svc/external-review-artifacts/exec-wi505-post-audit/receipt.json`
Request: `19c8fa13-0aa2-4613-8bed-12688a06c033`
Rubric: 8/10
Result: 0 Critical, 0 High, 1 Medium, 2 Low, 2 Info.

- The reviewer certified the one-write generation CAS, first-write provenance, exact source retirement, forward-only crash recovery, ambiguity denial, data preservation, and no silent v2 migration.
- `F1` Medium was a dependency-proof request: v2 exclusion is fail closed only if `readController()` throws for present corrupt evidence. Exact unchanged source proved `readJson()` returns null only for absence and throws for present corrupt/insecure evidence; `assertLease()` then rejects schema/coordinate mismatches.
- To close the proof gap behaviorally, the fixture now corrupts a present canonical v2 lease and requires public and direct v1 denial with unchanged v1 and malformed-v2 bytes.
- Removed-symbol and legacy-incomplete-transfer observations were dispositioned as no-reference evidence and a fail-closed compatibility limit respectively.

## Corrected-freeze round 2 — final

Receipt: `.svc/external-review-artifacts/exec-wi505-post-audit-round2/receipt.json`
Request: `891c455c-bf97-4bc3-ba1c-e130e07d3884`
Rubric: 9/10
Result: 0 Critical, 0 High, 0 Medium, 1 Low, 2 Info.

- Present malformed, symlinked, foreign-owned, or mismatched v2 evidence is certified as denial, never absence.
- The claim winner is built in memory and its first durable write contains the exact current `transfer_from_generation` and source session.
- A same-generation different-session binding denies before mutation.
- Post-CAS recovery retains generation N+1, retires the exact source, and treats concurrent same-winner finalization as idempotent.
- The bounded two-child race has one CAS winner and preserves tracked, untracked, and ignored user bytes.
- `WI505-R2-2` Low is accepted: a noncanonical symlink spelling can cause a false denial because stored coordinate comparison is lexical after resolution. It cannot grant authority, and normal ensure/binding paths are canonical.
- Info notes retain the explicitly required crash failpoint and document that the legacy direct transfer compatibility path does not retire a source binding; public complete-tuple reclaim does.

## Final disposition

- Unresolved Critical: 0
- Remaining High: 0
- Remaining Medium: 0
- Remaining Low: 1, fail-closed false-denial robustness only
- Corrected-freeze round cap: 2 of 3; converged without a third round
- Mandatory continuation: renewed security review, completed implementation audit, focused validators, full Tier-1, sanctioned landing, installed refresh, and live WI-496 replay
