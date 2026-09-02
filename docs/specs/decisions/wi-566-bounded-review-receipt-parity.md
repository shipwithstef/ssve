# WI-566 Technical Design: hash-bound bounded-exit adjudication

**Decision:** Add a standalone `bounded-exit` schema and a dual-identity review
model. The promotion receipt remains bound to the final Git tree, while each
launcher round remains bound to the exact artifact revision it reviewed.

## Design

1. Preserve launcher receipts and findings byte-for-byte and validate their HMAC provenance, schema, command, output, reviewed-subject digest, and cross-family properties.
2. Keep `candidate_sha`, `tree_hash`, and `candidate_digest` as the final promotion target. They never stand in for a plan-manifest digest.
3. Give every `round_identity` its own `review_target_digest`. Plan rounds may review successive manifest revisions inside one cycle; execution rounds remain bound to one Git-tree digest.
4. Derive a plan cycle from the immutable launcher tuple `{review_kind, phase_guard.wi, phase_guard.pre_execution_base, phase_guard.override.actual_sha256}`. Modern HMAC markers persist that cycle plus a locked monotonic sequence; legacy markers are classified from the same receipt tuple.
5. Treat the complete HMAC issuance inventory—not the caller array—as cycle authority. Modern issuance refuses round four before writing it; validation requires exact inventory membership, order, unique request IDs, and unique receipt digests.
6. Treat terminal rubric failures as a second exact census. Each rubric ID must map to one or more terminal finding IDs that are themselves dispositioned, carry a justification, and bind repository-owned hash evidence. Unread dependencies and failed certifications remain inadmissible.
6. Require terminal raw verdict `fail`, local receipt verdict `pass-with-acks`, and the deterministic round-cap result bound to the review log.
7. Reconcile terminal findings as an exact ID/severity census. Critical always blocks; every High requires local hash-verified evidence and exact review-log agreement.
8. Preserve ordinary raw-pass compatibility. A plan pass may bind a phase-guarded plan revision distinct from the promotion tree; an execution pass must still match the promotion tree.

## Alternatives rejected

- Prompt the reviewer to say pass: nondeterministic and rewrites governance around model wording.
- Accept every raw fail after round three: turns the cap into a blanket waiver.
- Run round four: directly violates WI-491 and creates unbounded pressure.
- Use only `review_kind + WI` as the cycle: incorrectly joins every future
  review of the same WI and eventually makes a legitimate later cycle look
  like round four.
- Require every plan round to equal the final Git-tree digest: overloads two
  different identities and makes the immutable HoursHub replay impossible.

## Security and failure posture

Repository evidence is limited to owner-controlled regular files below `.svc/`
or `docs/`, with no symlinks, foreign ownership, group/other write bits, or hash
mismatch. Any ambiguity accumulates a rejection reason; no fallback accepts.
Sequence allocation is serialized under the host authority root, and modern
issuance refuses a fourth marker for the same authoritative cycle.
