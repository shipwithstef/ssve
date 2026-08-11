# System Contract Map: Candidate Triage Projection

**Work item:** WI-508
**Flow:** committed candidate transition to durable audit and Git mirror
**Status:** IMPLEMENTED — local probes pass; independent review and promotion pending

## Flow Diagram

```text
CLI -> SQLite transaction -> committed outbox -> decision JSONL -> atomic Git mirror

CLI process
   |
   | BEGIN IMMEDIATE + UPDATE + INSERT event
   v
SQLite candidates + outbox
   |
   | COMMIT (durability boundary)
   v
pending outbox row
   |
   | state-file lock + event_id scan/append
   v
.svc/pipeline-decisions.jsonl
   |
   | mark logged_at, then contained atomic export
   v
docs/specs/candidates/<topic>.json
```

## Handoff Table

| From | To | Transport | Data Shape | Sender Storage | Receiver Storage | Next Reader | Failure Mode |
|---|---|---|---|---|---|---|---|
| CLI validator | SQLite transaction | prepared statements | scoped candidate row + deterministic event payload | process memory | `candidates`, `candidate_decision_outbox` | outbox flusher | validation or contention aborts transaction |
| SQLite outbox | decision ledger | locked JSONL append | canonical pipeline event with `event_id` | committed SQLite row | `.svc/pipeline-decisions.jsonl` | framework audit tools | append fails; outbox remains pending |
| decision ledger | SQLite outbox | prepared update | `logged_at` for one `event_id` | JSONL line | outbox projection status | replay command | crash leaves pending row but ledger dedupe prevents another line |
| SQLite candidates | Git mirror | temp + fsync + rename | deterministic mirror JSON | committed candidate rows | repository-contained JSON file | operator/Git/re-import | export fails; prior mirror remains intact |

## Origin / Storage Matrix

| Storage Layer | Origin / Owner | Written By | Readable By | Lifetime | Failure Mode |
|---|---|---|---|---|---|
| `~/.svc/store.db` or override | local SVC operator | candidate harness | candidate harness | until operator removes/backs it up | unavailable/busy/corrupt DB fails command |
| `.svc/pipeline-decisions.jsonl` or override | current SVC repository | candidate outbox flusher and framework skills | framework audit/report tools | append-only repository history | append/lock failure leaves pending outbox |
| `docs/specs/candidates/*.json` | current SVC repository | contained mirror exporter and humans | Git, humans, future imports | Git history | stale/malformed edit rejected; atomic export preserves prior file |

## External Platform Invariants

No external platform participates in this flow.

| Claim | Verification Source | Probe | Status |
|---|---|---|---|
| Node runtime exposes `DatabaseSync` | installed Node runtime | import `DatabaseSync` from `node:sqlite` in focused validator | local PASS |
| SQLite commit cannot atomically include JSONL/mirror writes | storage-boundary design | force each post-commit projection seam and replay | local PASS |
| mirror export stays in current repository after move | path-containment contract | import, move temp repo, transition, assert only moved mirror changes | local PASS |

## Falsification Probes

| Hypothesis | Confirmation Check | Falsification Check | Result | Evidence |
|---|---|---|---|---|
| A crash after ledger append cannot duplicate an event | clear `logged_at`, replay, ledger count remains one | duplicate count would increase without event-ID scan | local PASS | `test-framework/evals/tier-1/validate-candidate-harness.sh` |
| A failed ledger append does not erase the committed transition | force a directory ledger path, observe command failure, replay to valid ledger | event appears exactly once after recovery | local PASS | `test-framework/evals/tier-1/validate-candidate-harness.sh` |
| A moved repository cannot export to its old checkout | move temp repository, replay transition, and inspect moved mirror | absolute source path would make replay fail or touch the old location | local PASS | `test-framework/evals/tier-1/validate-candidate-harness.sh` |
| A failed mirror rename preserves the previous mirror | make destination directory read-only and compare prior bytes | no truncated/partial JSON is observable; replay heals | local PASS | `test-framework/evals/tier-1/validate-candidate-harness.sh` |

## Old Path / New Path Proof

This is a new capability, not a migration or symptom fix. Pre-change proof is the exact requested command failing with `MODULE_NOT_FOUND`; post-change proof is the same command passing with the seed pool.

| Same Input | Old Path Result | New Path Result | Conclusion | Evidence |
|---|---|---|---|---|
| `node scripts/candidate-harness.mjs --file docs/specs/candidates/consumer-experience-pool.json --top 10` | module not found | ten ranked evidence rows | WI-508 introduces the requested path without replacing another storage path | `.svc/improve-framework-evidence.log`; focused validator |

## Iteration Escalation

WI-508 is a first implementation, not a repeated diagnosis. Any future third repair attempt within 14 days must mark the WI `cross-system-suspected`, review this map, and invoke `review-cross-model` before execution.
