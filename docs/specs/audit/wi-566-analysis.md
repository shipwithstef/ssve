# Systems Analysis: WI-566 bounded-review receipt parity

**Date:** 2026-09-02
**Branch:** `proposals/2026-09-02-bounded-review-receipts`
**Spec:** `docs/specs/work-items/WI-566.md`
**Mode:** full

## Scope Drift

The implementation matches the manifest's runtime, schema, review-contract,
test, and lifecycle surfaces. `scripts/lib/external-review-provenance.mjs` and
the retroactive-attestation fixture were added during audit because the first
candidate could not prove complete cycle membership and reduced fixtures did
not copy the new import boundary. Both are necessary dependencies, not scope
expansion. No application, deployment, database, or customer-data file changed.

## Verification Contract

| AC | Required behavior | Evidence | Status |
|---|---|---|---|
| AC-1 | Plan and exec raw-fail bounded exits emit as schema v3. | Focused test invokes `emit-receipt.mjs` for both kinds. | Confirmed |
| AC-2 | Bind WI, kind, SHA/tree/digest, cycle, complete ordered rounds, log and cap result. | Mutation matrix plus HMAC issuance inventory reconciliation. | Confirmed |
| AC-3 | Exact terminal finding census. | Omitted, duplicate, unknown, severity and log-ID negatives. | Confirmed |
| AC-4 | Critical and unproved High findings block; rubric failures require an exact mapped/evidenced census. | Critical, missing evidence, disposition drift, rubric census mutations, dependency/certification negatives. | Confirmed |
| AC-5 | Stale, altered, replayed, reordered, hidden-fourth and abnormal-checker cases fail closed. | Focused authority tests and reviewer-evidence regression suite. | Confirmed |
| AC-6 | Existing passing evidence remains valid. | Raw `pass` and `pass-with-findings` fixtures. | Confirmed |
| AC-7 | HoursHub successive-revision cycle with rubric failures 2/6/7/10 validates without round four. | Real legacy HMAC inventory resolves `cf89… → 7e3d… → 124a…`; installed receipt emission remains the post-promotion gate. | Pending promotion proof |

## Coverage Ledger

| Subsystem | Risk | Audit result |
|---|---|---|
| Candidate and cycle identity | High | Complete signed issuance membership and sequence now required. |
| Finding census and dispositions | High | Exact terminal census plus review-log ID/disposition agreement. |
| Evidence filesystem trust | High | Regular-file, no-symlink, owner/mode and SHA-256 checks retained. |
| Round-cap subprocess | High | Error, signal, or null status now rejects instead of coercing to success. |
| Compatibility | Medium | Existing pass paths and reduced receipt fixtures pass. |

## Hypotheses and Findings

Three read-only specialist lenses (testing, security, correctness) tested these
hypotheses against the first candidate:

1. A caller can fabricate three rounds by replaying one authentic receipt.
2. A caller can reorder authentic receipts and choose a safer terminal result.
3. A caller can omit an authentic fourth receipt from the declared array.
4. A killed or unspawnable round-cap checker can be mistaken for exit zero.
5. A raw fail can hide rubric, dependency, or certification blockers outside
   the terminal finding census.

All five were confirmed in the first candidate. The first three were one High
authority defect; the latter two were Medium fail-closed defects. Corrections:

- HMAC-authenticated issuance markers now carry review kind and a monotonic
  candidate-cycle sequence. Validation re-reads the complete authority
  inventory, requires contiguous unique membership, and fixes terminal order.
- Request IDs and receipt digests must be unique.
- Round-cap subprocess errors, signals, and null status reject.
- Rubric failures reject unless every rubric ID is mapped to dispositioned terminal findings with hash-bound repository evidence; unread dependencies and failed certifications always reject.
- Review-log residual High IDs/disposition must agree with the exact census.

The expanded test suite reproduces each defect and passes after correction.
No Critical or High finding remains in the local specialist audit.

## Test Quality

- Expected values come from independent identities/digests and explicit
  mutations, not from the system output being asserted.
- Both positive receipt types use the real emitter.
- Negative coverage includes replay, reorder, hidden fourth issuance, binding,
  census, raw-fail side channels, evidence absence, Criticals and checker spawn
  failure.
- No disabled, skipped, timing-dependent, or network-dependent WI-566 test was
  introduced.

## Pre/Post Classification

Pre-change evidence is the original HoursHub receipt rejection documented in
the proposal and diagnosis. Post-change focused replay is classified
`fixed-by-change`: the bounded shape passes while raw fail without adjudication
still rejects. The original immutable HoursHub replay is deliberately deferred
until the corrected framework is merged and installed; it is the final
acceptance-critical post-promotion delta, not replaced by the synthetic test.

## Residue and Unverified Surfaces

No TODO/FIXME/HACK or orphaned import was introduced. Full Tier-1 has known
branch-independent host/session-state failures; the exact candidate/base
comparison will be rerun after the audit corrections. External Grok review,
promotion, installation drift, and original HoursHub replay remain open gates.

## Verdict

- [x] CONDITIONAL — local audit has no unresolved Critical/High finding.
- [ ] READY TO LAND — requires fresh final candidate review, full-suite
  comparison, promotion/install verification, and original HoursHub replay.
