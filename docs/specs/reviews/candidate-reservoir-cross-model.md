# Cross-Model Security Lens: Candidate Reservoir

**Date:** 2026-07-23
**Task:** WI-508 `review-cross-model`
**Author family:** OpenAI
**Reviewer family:** Anthropic
**Requested/effective tuple:** Claude Opus 4.8/high
**Rounds:** 3 (hard cap reached)

## Invocation Provenance

`review-exec` delegates its adversarial phase to `review-cross-model`; the
dedicated routed task therefore binds the same two canonical launcher calls
rather than issuing a duplicate paid review over the same staged content.

- Round 1 request: `8f16810c-7dd9-4aea-b1b9-51f683b61d1a`
- Round 2 request: `3b3dfc38-2f21-4cd1-a1f3-fea76659169c`
- Round 3 request: `0f438757-1286-45a4-a4fb-12a522c1dc38`
- Round 1/2 findings: `.svc/external-review-artifacts/WI-508-g6-round{1,2}/findings.json`
- Round 3 findings: `.svc/external-review-artifacts/WI-508-g6-audit-repair-full/findings.json`
- Round 3 receipt: `.svc/external-review-artifacts/WI-508-g6-audit-repair-full/receipt.json`
- Canonical evaluation: `docs/specs/reviews/candidate-reservoir-exec-cross-model.md`
- Round-cap record: `docs/specs/reviews/candidate-reservoir-exec-review-log.yaml`

## Security-Sensitive Conclusions

| Surface | Independent challenge | Outcome |
|---|---|---|
| Project isolation | URL ports were omitted and malformed config roots could drift identity | Fixed with host/port/path identity and fail-closed object validation; hostile fixtures pass |
| Mirror isolation | Same project/scope candidate could be reassigned to another mirror | Fixed transactionally; collision rolls back and originating projection remains authoritative |
| Terminal audit | Reviewer challenged strict malformed-ledger behavior and trusted mirror reconstruction | Strict ledger refusal retained to preserve append-only integrity; pending outbox remains recoverable. Fresh-DB reconstruction retained as the documented reviewed-Git trust boundary |
| Filesystem grounding | Absolute paths, escapes, symlinks, broad directories, and whitespace were challenged | Containment and no-content-read behavior verified; path whitespace now fails; contained directories remain explicitly allowed by GROUND-02 |
| Cross-process writes | Reviewer requested the imported helper contract | `state-io.mjs` is synchronous, uses O_EXCL cross-process locks, and writes JSON by temp/fsync/rename; concurrency and failure fixtures pass |
| Local permissions | Ledger-parent and SQLite creation timing were noted | Accepted as bounded local-only residuals for the following security gate; customer/project databases remain untouched |
| Audit repairs | Ancestor symlinks, forged event IDs, schema registration/shape, permission enforcement, and same-mirror re-scope were challenged | All supported defects fixed with hostile fixtures; default/shared ledger modes and operand-free outbox recovery are proven |

## Disposition Summary

- Critical: 0.
- High fixed: cross-mirror reassignment.
- High rejected with evidence: malformed-ledger skip, reconstruction reclassification,
  and cross-scope implicit selection.
- Supported Medium/Low fixes: config shape, port preservation, validator dependency,
  parsed flags, help output, and path whitespace.
- All remaining findings have explicit evidence-backed dispositions in the
  canonical G6 document.

## Verdict

`PASS-WITH-DISPOSITIONS`. Cross-family discipline and model attestation are
proven by the launcher receipts. The hard cap is reached with no unresolved
Critical and no remaining High; every round-three finding is fixed or carries
a cited disposition in the canonical G6 document.
