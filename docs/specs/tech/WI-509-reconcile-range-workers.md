# WI-509 Technical Design: Bounded receipt-range workers

**Status:** BASELINED
**Work item:** `docs/specs/work-items/WI-509.md`
**Surface:** headless framework preflight

## Architecture

Keep `checkSha()` and direct `--sha` behavior as the single validation
authority. For a multi-SHA `--range`, the parent validator starts a bounded
pool of self-located Node child processes, each invoking the unchanged direct
SHA path. The parent writes each result into its original input index, converts
worker failures into an exact-SHA fail-closed result, then emits the existing
JSON envelope once.

```text
range argument
     |
     v
git log -> ordered SHA list
     |
     v
bounded scheduler (max 8 by default, hard cap 16)
     |
     +----> node check-chain-receipts --sha SHA[0] --+
     +----> node check-chain-receipts --sha SHA[1] --+--> indexed results
     +----> ...                                      --+
                                                        |
                                                        v
                                  existing { ok, results } JSON + exit code
```

Direct SHA validation remains synchronous inside each worker. This preserves
the mature receipt, tree, baton, tier, and retroactive-attestation checks
without creating a second validation implementation.

## Components

| Component | Type | Responsibility | Change |
|---|---|---|---|
| Range option parser | CLI | Distinguish range work from direct/PR modes | Modify |
| Worker policy resolver | Pure function | Parse, clamp, and default concurrency and timeout | New in existing script |
| Ordered worker pool | Pure async scheduler | Bound active work and retain input order | New in existing script |
| Direct-SHA child adapter | Process boundary | Parse one exact result or fail its SHA closed | New in existing script |
| Tier-1 fixture | Shell/Node test | Prove bounds, order, failures, and CLI selection | New file |

## Alternatives

| Option | Decision | Rationale |
|---|---|---|
| Increase reconcile timeout above 90 seconds | Reject | Violates WI-472's bounded child contract and only postpones denominator growth. |
| Rewrite `checkSha()` asynchronously | Reject | Broadens the security-sensitive validation diff and duplicates Git/error semantics. |
| Worker threads | Reject | The validation path is dominated by synchronous Git subprocesses and filesystem state; child processes provide isolation and reuse the CLI contract. |
| Bounded self-invocation | Choose | Smallest safe change, easy rollback, exact direct-SHA parity, and measured under the existing 20-second parent bound. |

## Detailed Contract

- Default concurrency is `min(8, availableParallelism())`, never below 1.
- `SVC_RECEIPT_RANGE_CONCURRENCY` may tune the value but is clamped to 1..16.
- Per-worker timeout defaults to 5 seconds and is clamped to 1000..10000 ms.
  This preserves the explicit budget: worker 5s < range AC 15s < reconcile
  child maximum 20s.
- Only multi-SHA range mode uses the pool. Direct `--sha` and `--pr` retain
  their current execution path.
- Mixed `--range` with `--sha` or `--pr` is rejected as a usage error rather
  than silently changing the direct/PR execution path.
- Final concurrency is always clamped to 1..16, including a host that reports
  zero or unavailable parallelism.
- A worker must return parseable JSON with exactly one result whose SHA matches
  the requested SHA. Exit 1 with a valid failed result is accepted as evidence;
  spawn, timeout, signal, empty, malformed, multiple, or mismatched output is
  converted to `{ok:false,type:"worker-error"}` for that exact SHA.
- Pool scheduling stores by input index and never emits partial streaming JSON.
  Infrastructure failures are named separately from receipt debt and the
  replay-safe recovery is to rerun the whole reconcile command, never edit its
  checkpoint.
- No customer database, network service, checkpoint edit, waiver, or new
  dependency is involved.

## Cost Model

| Dimension | Unit cost | Expected volume | Monthly estimate | Scaling |
|---|---|---|---|---|
| Compute | up to 8 local Node/Git workers | one session preflight over unreconciled commits | $0 | linear work, bounded parallel wall time |
| Storage | existing receipt mirrors only | unchanged | $0 | unchanged |
| Bandwidth | none | none | $0 | none |
| External APIs | none in receipt range | none | $0 | none |
| Background jobs | none | none | $0 | none |

Scaling trigger: if the exact promoted range exceeds 15 seconds at the hard cap,
profile Git/note reads before changing either bound. The red line is any design
that makes session preflight unbounded or weakens per-SHA validation.

## Operations & Ownership

| Dimension | Answer |
|---|---|
| Owner | svc framework maintainers |
| On-call | best effort; no paging |
| SLO | current checkpoint range below 15 seconds; reconcile child below 20 seconds |
| Monitoring | Tier-1 worker fixture and promoted canonical timing replay |
| Alerting/dashboard | none |
| Runbook | rerun the exact range directly; preserve checkpoint and decision history |
| Failure modes | worker timeout, malformed output, spawn error, SHA mismatch, aggregate parent timeout |
| Recovery | fail closed with exact SHA; repair implementation or receipts, never waive |
| Backup/restore | N/A; authoritative receipts remain in Git notes |
| Dependency impact | local Git/Node failure stops reconcile and preserves checkpoint |

## Feasibility Matrix

| AC | Persona pressure | Feasible? | Design proof |
|---|---|---|---|
| RX-01 | N/A - system-only | Yes | Measured 8-worker prototype completed in 8.18 seconds. |
| RX-02 | N/A - system-only | Yes | Pure bounded policy resolver with hard cap. |
| RX-03 | N/A - system-only | Yes | Indexed result storage. |
| RX-04 | N/A - system-only | Yes | Strict one-result SHA-bound parser and worker-error result. |
| RX-05 | N/A - system-only | Yes | Pool selected only for multi-SHA range. |
| RX-06 | N/A - system-only | Yes | Existing reconcile child and checkpoint logic remain unchanged. |
| RX-07 | N/A - system-only | Yes | Focused fixture plus full Tier-1. |
| RX-08 | N/A - system-only | Yes | No state/receipt mutation in design. |
| RX-09 | N/A - system-only | Yes | WI-510 is separately registered. |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Concurrent mirror creation | Corrupt cache | Workers address distinct SHA directories and atomic JSON writes remain authoritative. |
| Child output ambiguity | False pass | Require exactly one matching result; otherwise fail closed. |
| Resource spike | Host contention | Default 8, hard cap 16, configurable downward. |
| Nested pool recursion | Process explosion | Direct child uses `--sha`; only `--range` selects the pool. |
| Historical semantic drift | Receipt weakening | Reuse unchanged `checkSha()` through the direct CLI. |

## G4 Review

[Layer 1] [Confidence: 10/10] Reusing the direct-SHA validator avoids a second
security-sensitive implementation.
[Layer 3] [Confidence: 9/10] Bounded concurrency solves the measured denominator
while preserving the parent's hard bound.
[Layer 1] [Confidence: 9/10] The design is stateless, dependency-free, locally
replayable, and reversible with one implementation/test revert.

**G4 verdict:** PASS. All nine ACs are feasible; no unresolved product,
provider, data-model, or one-way-door question remains.
