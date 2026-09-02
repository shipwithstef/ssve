# WI-566 Bug Diagnosis: bounded review receipts

## Reproduction

Given three authentic launcher receipts in one plan-review lineage, a terminal
raw `fail`, zero Critical findings, and complete High dispositions, the WI-491
cap checker exits 0 while `verifyReviewerEvidence()` reports that launcher
findings do not carry a passing verdict and contain unresolved Highs. The real
HoursHub lineage also proves that plan rounds review successive manifest
digests, not the later promotion Git-tree digest.

## Fault location

`scripts/lib/reviewer-evidence.mjs` validates each raw launcher verdict before
there is any receipt-level adjudication object. `check-review-round-cap.mjs`
operates only on the review log. The two decisions cannot be joined or audited.
The legacy receipt contract also overloads `candidate_digest` as both reviewed
plan subject and final promotion tree, identities that are not equivalent.

## Correctness invariant

Raw reviewer bytes remain immutable. A local bounded exit is a separate,
fail-closed promotion decision bound to the exact final Git tree and complete
terminal finding census. Each round separately binds the exact reviewed
revision. HMAC cycle membership—not a caller-selected array—is complete and
ordered. It cannot waive a Critical or reset the same authoritative cycle.
Terminal rubric failures are also exact census members: each must map to a
dispositioned terminal finding and hash-bound evidence. Unread dependencies and
failed certifications remain unconditional blockers.

## Scope

One receipt-schema/validator integration defect. No model prompt, station
selection, product runtime, deployment, or database behavior changes.
