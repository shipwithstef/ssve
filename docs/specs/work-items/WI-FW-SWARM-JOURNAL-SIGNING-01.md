# WI-FW-SWARM-JOURNAL-SIGNING-01 — Coordinator-signed journal events + anchored checkpoints

**Status:** DRAFT (follow-up from WI-FW-SWARM-COORDINATION-01 exec-review round 3, EXEC-R3-003)
**Lane:** framework
**Parent:** WI-FW-SWARM-COORDINATION-01 (single-writer coordination kernel)

## Problem

The swarm coordination journal is an append-only stream whose integrity currently
rests on an unkeyed SHA-256 digest chain plus advisory locking and fsync. A process
able to edit the state root can rewrite events and recompute every digest: replay
validates attacker-recomputable hashes only. `sign-checkpoint` writes a separate
`checkpoint.json` that replay never consumes, so checkpoints do not anchor anything.

This was explicitly deferred from the parent changeset: signing every event binds
the coordinator key into the hot append path, changes the event envelope (breaking
byte-compatibility with journals written by the parent changeset), and belongs to
the same wave as host wiring / remote transport where trust anchors are actually
distributed (Wave 4/5 of the approved architecture plan).

## Scope

1. Event envelope gains a coordinator signature over the canonical event bytes
   (DSSE, same profile as receipts); replay verifies every signature.
2. Acceptance receipts become mandatory replay inputs for ACCEPTED transitions:
   a journaled event without a verifiable persisted receipt fails replay.
3. Checkpoints anchor the chain: `sign-checkpoint` appends a CHECKPOINT_SIGNED
   event; startup verifies the last checkpoint plus every subsequent event.
4. Operator root pinning: the verifier refuses registries whose root keyid does
   not match an operator-pinned fingerprint outside the state root.
5. Migration: additive enum/envelope widening; pre-existing parent-era journals
   are readable via a legacy-verification mode that still enforces digest-chain
   integrity but skips signature checks, with an explicit banner in output.

## Acceptance criteria

1. Tampering any event byte (payload, sequence, actor) fails replay with a named
   error identifying the first bad sequence.
2. Deleting an acceptance receipt for an accepted transition fails replay.
3. A checkpoint signed at sequence N verifies; any mutation after N is detected.
4. Legacy parent-era journals replay in legacy mode and fail loudly in strict mode.
5. All existing validate-swarm-* gates stay green; two new negative gates cover 1-4.

## Non-goals

- Remote transport, multi-host shadow runs (separate follow-up WIs).
- Encrypting state roots; the threat model remains same-user processes.
