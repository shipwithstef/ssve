# Prototype Comparison: Candidate Reservoir

## Predeclared criteria

1. One terminal state after an uncertain retry.
2. Exactly one audit event after a crash between append and acknowledgement.
3. No partial/persisted lost update between concurrent logical writers.
4. No residue outside the temporary prototype directory.

## Results

| Prototype | Result | Evidence |
|---|---|---|
| A1 SQLite outbox | PASS | `{"status":"promoted","ledger_events":1,"pending_outbox":0}` after simulated post-append crash and retry |
| B1 JSON-only writers | EXPECTED WEAKNESS REPRODUCED | `{"lost_promotion":true,"final_revision":1}` when two readers overwrite one whole-file state without a shared multi-file transaction |

Commands:

```bash
node docs/specs/explorations/candidate-reservoir/prototypes/sqlite-outbox-probe.mjs
node docs/specs/explorations/candidate-reservoir/prototypes/json-file-probe.mjs
```

The comparison does not claim SQLite makes JSONL/mirror writes atomic. It proves why the durable outbox plus event-ID replay is necessary and why file atomicity alone is not a substitute for mutation serialization.
