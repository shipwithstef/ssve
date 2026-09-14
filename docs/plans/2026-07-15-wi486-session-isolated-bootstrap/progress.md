# WI-486 — TDD progress / checkpoints

Logical red/green checkpoints for the session-isolated multi-WI bootstrap.
Implementation stays uncommitted until the task-6a aggregate freeze (§Checkpoint Plan).

## Checkpoint 1 — `wi486-red-contract` (task-1) — RED established ✅

- **Date:** 2026-07-16
- **Base:** `$BASE = 99da8bcf873d4d2a7b2a2becfb19759c71e3d2de` (HEAD == `$BASE`)
- **Scope:** foundational red-first slice only — NO authority/bootstrap/migration
  behavior authored. Adds failing fixtures + deterministic evidence generators.

### Delivered

| Artifact | State |
|---|---|
| `test-framework/evals/tier-1/validate-session-authority-isolation.sh` | CREATED — red-first; `bash -n` clean |
| `test-framework/evals/tier-1/validate-task-state-compatibility.sh` | CREATED — red-first; `bash -n` clean |
| `scripts/inventory-graph-readers.sh` | CREATED — inventory + `--emit-declared-file-set` modes; `bash -n` clean |
| `docs/specs/test-evidence/WI-486/graph-reader-inventory.txt` | GENERATED — `graph_reader_count=100` (deterministic, pinned to `$BASE`) |
| `docs/specs/test-evidence/WI-486/declared-file-set.txt` | GENERATED — 40 paths, sorted, self-including |
| `docs/specs/test-evidence/WI-486/pre-change-tier1-baseline.md` | CAPTURED — see discrepancy note below |
| `docs/plans/.../progress.md` | CREATED — this file |

### RED proof (fails ONLY for the declared reason)

```
$ bash test-framework/evals/tier-1/validate-session-authority-isolation.sh ; echo exit=$?
  EXPECTED-RED: exact-tuple mutation authority not yet implemented
  0 passed, 1 failed
exit=1

$ bash test-framework/evals/tier-1/validate-task-state-compatibility.sh ; echo exit=$?
  EXPECTED-RED: task-state compatibility classifier not yet implemented
  0 passed, 1 failed
exit=1
```

Each fixture guards its real assertions behind a feature-detection gate:
- authority-isolation → probes the exact-tuple authority JSON CLI on
  `resolve-wi.mjs` (authored by **task-2**); absent today ⇒ marker + exit 1.
- task-state-compat → probes `hooks/lib/task-state-compatibility.mjs` +
  `scripts/svc-migrate-task-state.mjs` + the receipt schema (authored by
  **task-4**); absent today ⇒ marker + exit 1.

The real assertions (temporary git repos + local node/bash only, zero
network/model calls) are structured to GREEN once task-2 / task-4 land.

### Baseline discrepancy (flagged for owner — see pre-change-tier1-baseline.md)

The manifest pins `BASELINE = 245/0/0` at `$BASE`; it does **not** reproduce.
Measured (worktree, HEAD==`$BASE`, full host state, before the 2 new validators):
**242 passed / 3 failed / 0 timed out**. Attribution:
- 2 failures = WI-486 planning/working-tree residue (untracked spec Industry
  Grounding subsections; this session's `lane-tasks-WI-486.json`).
- 1 failure = **pre-existing, `$BASE`-inherent, unrelated to WI-486**:
  `validate-skill-receipt-shape.sh` on tracked `.svc/lane-tasks-WI-489.json`
  task-15 (reproduced in a clean detached `$BASE` worktree).

True tracked-`$BASE`-with-host-state baseline = **244 passed / 1 failed**. The
task-6a zero-failure gate will block on the WI-489 debt unless it is remediated
outside WI-486 or the pinned baseline is corrected to 244/1. Not fixed in task-1
(out of scope; task-1 touches no authority/migration/validator/state source).

### Next

- **Checkpoint 2 (`wi486-shared-authority`, task-2):** unify exact mutation
  authority in `resolve-wi.mjs` (+ JSON CLI) and reorder Codex safe reads; the
  authority-isolation fixture flips GREEN.
