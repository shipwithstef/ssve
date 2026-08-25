# Swarm Coordination Protocol — Normative Contract (WI-FW-SWARM-COORDINATION-01)

Status: ratified by plan review (3 bounded adversarial rounds, terminal state
`PROMOTED_WITH_DISPOSITIONS`; see
`docs/plans/2026-08-25-wi-fw-swarm-coordination/review-log.yaml`).

## 1. Authority model

Workers (Sol/Codex, Grok, Cursor adapters) submit **commands**. The coordinator is
the single writer: it validates each command against deterministically replayed
journal state, appends one event under an advisory process-death-proof lock,
fsyncs, signs the acceptance/rejection receipt over exact bytes, persists the
receipt durably, and only then responds. A model-authored PASS string, timestamp,
or local state is never authority; every verdict comes from replayed state plus
recomputation performed by the coordinator.

Rejections never append and never advance the sequence.

## 2. Commands and events

| Command | Event | CLI verb |
|---|---|---|
| register_session | SESSION_REGISTERED | register |
| acquire_task | TASK_LEASE_ACQUIRED | acquire |
| heartbeat_task | TASK_HEARTBEAT | heartbeat |
| report_progress | CAUSAL_PROGRESS_RECORDED | progress |
| submit_candidate | CANDIDATE_SUBMITTED | submit |
| request_handoff | HANDOFF_PREPARED | handoff-prepare |
| accept_handoff | HANDOFF_ACCEPTED | handoff-accept |
| request_cancel | TASK_CANCELLED | cancel |
| propose_resolution | CONFLICT_RESOLUTION_PROPOSED | resolve |
| ack_state | ACK_STATE_RECORDED | ack |

Every command carries `schema_version`, `command_id` (UUIDv7), `run_id`,
`command_type`, `actor{principal_id,host,model_family,session_id}`,
`authority_generation`, `expected_sequence`, `idempotency_key`, and `payload`.
Schemas default to `additionalProperties:false`.

## 3. Ordering, CAS, idempotency

- The coordinator **sequence**, not wall time, orders everything.
- A command whose `expected_sequence` differs from replayed sequence is rejected
  with `sequence_mismatch` (CAS).
- Idempotency classification happens on canonical command bytes:
  `sha256(JCS(command))`. An exact retry returns the original event plus its
  persisted receipt without a duplicate append. Any other digest under a used key
  fails closed (`idempotency_conflict`). The journal binds
  `idempotency_key -> (command_digest, event_digest)`; a matching command digest
  with divergent event digest during replay is corruption and fails replay.
- Stale `authority_generation` rejects with `stale_generation`. Handoff acceptance
  increments the generation and consumes a one-time token.

## 4. Attempt state machine

```
PLANNED -> LEASED -> CANDIDATE_SUBMITTED(VERIFYING) -> ACCEPTED -> CONSUMED
                    |                         \-> CONFLICTED -> RESOLVING -> VERIFYING
                    |                         \-> RETRYABLE -> PLANNED (new attempt)
                    \-> HANDOFF_PREPARED -> (new principal) LEASED
PLANNED/LEASED/RUNNING -> CANCELLED (monotonic)
```

`CONSUMED`, `CANCELLED`, `FAILED`, `BLOCKED` are attempt-terminal. Illegal
transitions reject with `capability_denied`.

## 5. Signed receipts

Two stages:

1. **submission receipt** — signed by the adapter session key over the exact
   command bytes; proves provenance, not correctness.
2. **acceptance/rejection receipt** — signed by the coordinator key after
   recomputation; references the submission digest via `submission_digest`, binds
   `sequence_before`/`sequence_after`, `authority_generation`,
   `coordinator_epoch`, `prior_receipt_digest`, and `event_digest`.

Serialization: payload = RFC 8785 JCS bytes of the receipt document. Signature =
Ed25519 over the DSSE PAE prelude `DSSEv1 SP LEN(type) SP type SP LEN(payload) SP
payload`, where LEN is the BYTE length in ASCII decimal without leading zeros.
Payload types: `application/vnd.svc.swarm-receipt+json;version=1` and
`application/vnd.svc.swarm-command+json;version=1`. Ed25519 signing is
deterministic, so crash-window re-signing reproduces byte-identical receipts.

Receipt files persist at `<state-root>/receipts/<sha256-of-canonical-command>.json`
inside the same critical section that appended the event; responses are sent only
after that write is durable.

## 6. Trust registry

- `init` generates an operator root keypair and coordinator keypair (node:crypto
  Ed25519) into a 0700-mode `keys/` directory with 0600 key files.
- The root self-signs the registry body (JCS bytes sans `root_signature`).
- Adapter session keys are provisioned operator-side (`provision` verb); private
  keys never cross any protocol surface.
- Expiry windows gate NEW commands only (+/-300s skew). Historical verification
  ignores wall time entirely and applies sequence-aware revocation
  (`revoked_at_sequence`): events below that sequence still verify.

## 7. Crash-atomicity and recovery

One advisory mkdir-mutex critical section per append (process-death reclaim via
/proc start tokens, inherited from runtime-v2). Crash windows:

- before fsync: zero effect; retry recomputes cleanly;
- after fsync, before persisted receipt: retry re-signs deterministically;
- after receipt persistence: retry returns the stored receipt verbatim.

Startup (`replay`) refuses torn final records, mid-stream JSON damage,
digest-chain breaks, idempotency-key conflicts, and sequence gaps.

## 8. Conflict ladder

Deterministic, no last-writer-wins anywhere:

| Level | Condition | Outcome |
|---|---|---|
| 0 | stale generation / base mismatch | REJECT |
| 1 | disjoint paths and resources | INTEGRATE |
| 2 | overlapping, clean textual merge | MERGE_WITH_VALIDATORS |
| 3 | registered structured resolver applies | RESOLVE (digest-bound) |
| 4 | text conflict / divergent same-key writes / no resolver | CONFLICTED |
| 5 | both claims touch the same protected surface | REFUSE |

Protected-surface and resolver registries live in
`references/swarm-conflict-policy.json`. Bounded adjudication caps at two
attempts, then BLOCKED.

## 9. Host parity

The protocol is host-neutral: identical golden commands from different actor
hosts produce identical canonical transition sequences and verdicts. This is
mechanically asserted, not assumed.

## 10. Rollout posture

This kernel ships inert: nothing outside tests invokes the coordinator. It
activates only when an operator starts it against an explicit state root.
Default-off by construction; shadow/enforce modes arrive with the follow-up
host-adapter work item.
