# WI-FW-SWARM-JOURNAL-SIGNING-01 — Checkpoint anchoring + operator root pinning

**Status:** DRAFT (follow-up from WI-FW-SWARM-COORDINATION-01 exec-review rounds 3-4)
**Lane:** framework
**Parent:** WI-FW-SWARM-COORDINATION-01 (single-writer coordination kernel)

## Already landed in the parent changeset (round-4 remediation)

- Every journaled event carries the coordinator's Ed25519 signature over its
  canonical digest bytes (`coordinator_sig`); `replay(..., {verifyCoordinatorSignatures,
  coordinatorPublicKey})` verifies each one and refuses forged history even when
  the attacker rebuilds the full SHA-256 chain (proven by the protocol gate's
  signature-forgery probe).
- Acceptance/rejection receipts are DSSE-signed and schema-validated.
- Registry rows are operator-written, root-signed, and schema-checked on load.

## Remaining scope

1. **Checkpoint anchoring:** `sign-checkpoint` appends a CHECKPOINT_SIGNED event;
   startup verifies the last signed checkpoint plus every subsequent event, so a
   corrupted tail cannot silently diverge from the last anchored state.
2. **Operator root pinning:** an out-of-band pinned root fingerprint must match
   the registry's root keyid before any verification succeeds (protects against
   full state-root rewrites including keys/).
3. **Receipt-bound replay:** accepted transitions require their persisted
   acceptance receipt to verify during strict replay.

## Acceptance criteria

1. Tampering any event byte fails replay with the first bad sequence named.
2. Deleting an acceptance receipt for an accepted transition fails strict replay.
3. A mutation after the last anchored checkpoint is detected at startup.
4. A rewritten state root (journal + registry + keys) fails against a pinned
   operator fingerprint.
5. All validate-swarm-* gates stay green; new negative gates cover 1-4.

## Non-goals

- Remote transport, multi-host shadow runs (separate follow-up WIs).
- Encrypting state roots; the threat model remains same-user processes with
  operator-held roots.
