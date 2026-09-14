# Analysis: Candidate Reservoir

## Tradeoff Matrix

| Criterion | A1 SQLite + mirror + outbox | A2 SQLite + on-demand export | B1 locked JSON | B2 event replay | C1 Git cards | C2 remote service |
|---|---|---|---|---|---|---|
| MUST CAND-03/05 deterministic idempotency | Yes: PK/upsert + stable sort | Yes | Yes under one correct lock | Yes after deterministic replay | Git ordering convention needed | Yes |
| MUST GROUND-01..06 live contained evidence | Yes | Yes | Yes | Yes | Yes | Risk: service cannot see local checkout |
| MUST SCORE-01..06 exact formula | Yes, pure function | Yes | Yes | Yes | Yes | Yes |
| MUST TRIAGE-04/05 terminal retry + one ledger row | Yes: outbox/event ID | Risk: no terminal projection guarantee | Possible but DB requirement absent | Intrinsic audit, costly replay policy | Git commit is not local command atomicity | Service transaction cannot atomically append local ledger |
| MUST ISOLATE-04 native Node SQLite | Yes | Yes | No | No | No | No |
| MUST ISOLATE-06/07 project/concurrency | Yes: scoped PK + BEGIN IMMEDIATE | Yes | Multiple lock domains | Yes after replay | Weak before commit | Yes remotely, but violates isolation |
| SHOULD zero dependency/network | Yes | Yes | Yes | Yes | Yes | No |
| SHOULD Git-readable current terminal state | Yes | No after terminal command | Yes | Derived | Yes | Requires sync |
| SHOULD implementation simplicity | Moderate, bounded | Moderate | Low initially | Low at first, high lifecycle | Low code/high operator noise | Very high |

## Eliminated

- B1, B2, C1, C2 fail the explicit native SQLite storage AC (ISOLATE-04).
- C2 additionally fails local filesystem grounding and zero-network isolation.
- A2 underperforms TRIAGE-01/02 because a terminal command would not reliably refresh the human mirror.

## Finalists

1. **A1 baseline** — the only approach satisfying every MUST while keeping a current Git mirror.
2. **B1 locked JSON** — best simplicity runner-up if the native SQLite/concurrency requirement were removed.
3. **B2 append-only events** — best audit-first runner-up if cross-repository sync/replay becomes the dominant need.

## Key differentiator

Does the A1 outbox provide materially safer retry behavior than a file-only read/modify/write design without disproportionate code? The prototypes test exactly that: deterministic event healing versus lost whole-file updates.

## Runner-up value

B1 remains a valid simplified design for a single-project, single-writer tool. B2 preserves a future path if an immutable company-wide event protocol is ever authorized.
