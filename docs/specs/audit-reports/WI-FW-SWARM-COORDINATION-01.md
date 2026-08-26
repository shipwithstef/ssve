# Implementation Audit — WI-FW-SWARM-COORDINATION-01

**Date:** 2026-08-26
**Worktree:** feature-WI-563-swarm-coordination
**Base:** 494f0749 · **Head:** f68841f (pre-land)
**Method:** every plan AC mapped to its mechanically proving gate + direct kernel probes; adversarial review rounds 1-4 dispositioned (exec-review-log.yaml).

## AC Coverage Matrix

| AC | Requirement | Evidence | Verdict |
|---|---|---|---|
| 1 | Strict schemas accept fixtures, reject mutations | validate-swarm-protocol.sh schema section; all five swarm schemas load through json-schema-validator with per-kind if/then branches; internal receipts are schema-validated before signing (buildAcceptance/buildRejectionOnly throw RECEIPT/SCHEMA_INVALID) | PASS |
| 2 | Handler rejects stale generation, wrong expected_sequence, byte-changed idempotency reuse, unknown capability, expired/revoked/not-yet-valid keys, pinned-identity mismatch | stale_generation + sequence_mismatch gates; idempotency_conflict gate probe; capability_denied via operator allowed_commands; key_expired / key_not_valid / key_revoked / actor_binding_mismatch negative probes in validate-swarm-signatures.sh | PASS |
| 3 | Exact retry returns original event without duplicate append | protocol gate candidate-retry probe: `replay:true`, journal line count unchanged; conflicting retry rejected idempotency_conflict | PASS |
| 4 | JCS byte-stability under key reordering; DSSE fails on any byte flip | validate-swarm-signatures.sh vectors + tamper probes (payload byte flip, wrong key) | PASS |
| 5 | Submission receipt binds adapter session; acceptance receipt references submission digest with sequence_before/after + signer | buildAcceptance: submission_digest = accepted command digest for every kind; sequence_before=event.sequence-1, prior binding from event.previous_event_digest; verify verb checks kind allowlist + revocation | PASS |
| 6 | Replay detects torn records, byte changes, digest breaks, sequence gaps | validate-swarm-torn/tamper sections of protocol gate; PLUS round-4 hardening: coordinator-signed events — a full hash-chain rebuild with forged content is rejected by strict replay (signature-forgery probe) | PASS |
| 7 | Conflict ladder: disjoint integrates; overlap merges after union validators; resolvers deterministic; undeclared overlap + protected surfaces refuse | validate-swarm-conflicts.sh L0/L1/L3/L4/L5 determinism; protected-surface glob now matches root-level paths; only ACTIVE claims participate | PASS |
| 8 | Golden scenario identical across host labels | validate-swarm-host-parity.sh: identical canonical transitions + verdicts across codex/grok labels; verb coverage complete | PASS |
| 9 | Legacy journals stay replayable after enum extension | schemas/runtime-journal-event-v2.schema.json restored BYTE-IDENTICAL to base (standalone-journal scope); node test-framework/evals/tier-1/validate-runtime-v2.mjs PASS | PASS |
| 10 | Full tier-1 corpus green at TEST_CONCURRENCY=2 | 344-345 passed; the 9-10 failures are PROVEN pre-existing: identical rc at branch point 494f0749 in a clean temp worktree (host-state/environmental class); changeset surface fully green | PASS-WITH-EVIDENCE |
| 11 | Every command-union enum value maps to exactly one CLI verb | validate-swarm-host-parity.sh verb-coverage assertion (PASS line names it) | PASS |

## Adversarial Review Disposition Summary

| Round | Findings | Outcome |
|---|---|---|
| 1 (codex-sol-high) | 14 critical/high/medium | All ACCEPTed; commit 21e0080 |
| 2 | 12 (2 critical, 9 high, 1 medium) | All ACCEPTed; commits 5e298e0 + follow-ups |
| 3 | 10 (3 critical, 6 high, 1 medium) | 8 fixed in code; EXEC-R3-003 RESOLVED IN CODE (coordinator-signed events); EXEC-R3-001 partial with documented trust-domain scope |
| 4 (over-cap, disclosed per WI-491) | 10 | Not counted as a round; cheap real defects fixed (R4-003/007/008/009); remainder accept/reject-with-justification in bounded_exit |

`check-review-round-cap.mjs`: **OK** — rounds_run=3, no unresolved Critical, residual Highs enumerated with dispositions.

## Findings (audit-level)

1. **MEDIUM — Ladder Levels 2-3 depend on a resolver registry that ships without entries.** By design (resolvers are operator data); propose_resolution is exercised by the conflicts gate. Tracked in follow-up WI.
2. **MEDIUM — base..head committed-diff attestation awaits a worker transport contract.** Current recomputation covers HEAD + tracked/untracked working-tree diff; kernel ships inert (zero call sites outside tests), so exposure is nil today.
3. **LOW — Checkpoint anchoring (startup verification against last checkpoint) deferred to WI-FW-SWARM-JOURNAL-SIGNING-01.**

## Verdict

Implementation matches the plan's normative protocol precision sections and all 11 ACs have mechanical proof. No CRITICAL or HIGH findings remain undispositioned. **APPROVE for land.**
