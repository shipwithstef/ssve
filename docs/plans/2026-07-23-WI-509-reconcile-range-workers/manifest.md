# WI-509 Change Manifest: Bounded receipt-range workers

**Spec:** `docs/specs/work-items/WI-509.md`
**Technical design:** `docs/specs/tech/WI-509-reconcile-range-workers.md`
**Branch:** `framework-WI-509-reconcile-range-timeout`
**Base:** `main` at `7dfe2c6292cd2bbde9330e0f74f126478c8252f1`
**Created:** 2026-07-23
**Status:** SIMULATED
**Execution mode:** `inline`

## Archetype

Incremental extension of the existing receipt validator. The mature direct-SHA
path remains authoritative; the plan adds a bounded range scheduler around it.
The existing implementation and callers were read before the WI and design.
The deprecated-foundation scan has no applicable runtime or SDK foundation:
this is dependency-free Node core plus Git.

## Implementation Summary

Add a deterministic, bounded worker pool for multi-SHA range validation, with
strict exact-SHA parsing and fail-closed worker errors. Preserve direct SHA and
PR behavior. Add a hermetic Tier-1 validator, update receipt doctrine and
framework state, then prove the exact 166-SHA range and canonical reconcile.

Invariants:

- `checkSha()` receipt semantics do not change.
- Results retain Git-log input order.
- Child failures cannot become passes or disappear from output.
- Concurrency and worker time are capped.
- The reconcile checkpoint is never edited by hand or by this changeset; it
  advances only as the existing side effect of a clean canonical reconcile run
  on promoted main (RX-06).
- No waiver, receipt-note, customer database, or host config edit.

### Policy Constants

- `resolveRangeConcurrency(env, available)` defaults to
  `min(8, max(1, availableParallelism()))`, clamps the final value to 1..16
  regardless of source, and clamps the
  `SVC_RECEIPT_RANGE_CONCURRENCY` integer override to 1..16, and throws
  `RangeConfigError` for a present non-integer override before spawning work.
- `resolveRangeWorkerTimeout(env)` defaults to 5000 ms and clamps
  `SVC_RECEIPT_RANGE_WORKER_TIMEOUT_MS` to 1000..10000 ms. A present
  non-integer also throws `RangeConfigError` before work starts.
- `RangeConfigError` is printed to stderr and exits 2. Out-of-range integers
  are clamped and reported on stderr; absent values use defaults.
- `checkShaInWorker(sha, policy)` requires exactly one matching-SHA result.
- `checkShasWithPool(shas, concurrency, worker)` stores results by input index,
  never exceeds the resolved bound, and converts thrown worker failures into an
  exact-SHA `worker-error`. It throws `RangeConfigError` if called with
  concurrency below 1.
- Only multi-SHA `--range` selects the pool; `--sha` and `--pr` remain direct.
- Mixed `--range` with `--sha` or `--pr` exits 2; no direct or PR SHA is
  silently routed through the pool.
- Available capacity resolves as
  `availableParallelism()` when callable, otherwise `cpus()?.length || 1`.

### Worker Invocation Contract

`checkShaInWorker` uses
`execFile(process.execPath, [SCRIPT_FILE, "--sha", sha], options, callback)`.
`SCRIPT_FILE` is `fileURLToPath(import.meta.url)`. Options inherit the current
environment after removing the two range-policy override variables, set
`SVC_RECEIPT_RANGE_WORKER=1`, set the resolved timeout, use UTF-8, and cap
stdout/stderr at 4 MiB. The child must emit one JSON object whose `results` array has length
one and whose sole `sha` exactly matches the request. A normal exit 0 or an
expected exit 1 with a valid matching result preserves that result. Spawn
errors, signals, timeout kills, empty/malformed JSON, wrong cardinality, or SHA
mismatch become an exact-SHA `{ok:false,type:"worker-error"}`. Exit codes other
than 0/1 and buffer overflow also become worker errors. A worker-marked process
given `--range` exits 2 before enumeration, preventing recursive pools.

### Timeout Budget

The invariant is `worker timeout < range budget < reconcile child timeout`:
5 seconds by default, 15-second range AC, and the existing 20-second maximum
reconcile child. A timed-out SHA fails closed while remaining scheduled SHAs
complete; the aggregate exits 1 and names infrastructure-failure SHAs on
stderr. There is no hidden per-SHA retry: retrying with a doubled timeout could
exceed the fixed parent deadline. The canonical whole reconcile command is the
replay-safe retry boundary. The measured real worker pool completed in 7.22 to
8.18 seconds, so the 15-second gate includes process startup and retains 6.82
seconds of observed headroom on the acceptance host.

**Runtime prerequisite:** Node 22 is the framework baseline.
`availableParallelism()` is used when present; a guarded `cpus().length`
fallback keeps the resolver portable to older supported Node runtimes.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `scripts/check-chain-receipts.mjs` | MODIFY | task-1 | Bounded policy, strict worker adapter, ordered pool, range dispatch |
| `scripts/lib/reconcile-core.mjs` | MODIFY | task-1 | Preserve infrastructure-vs-debt classification for consumers |
| `scripts/svc-reconcile.mjs` | MODIFY | task-1 | Report receipt validation unavailable without calling it missing debt |
| **test-framework/evals/tier-1/validate-chain-receipts-range-workers.sh** | CREATE | task-1 | Hermetic bounds/order/failure/direct-path fixture |
| `references/chain-receipt-contract.md` | MODIFY | task-2 | Document range execution and failure contract |
| `FRAMEWORK-STATE.md` | MODIFY | task-2 | Record analysis and locked decision |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | task-2 | Update bounded reconcile capability |
| `proposals/2026-07-23-framework-improvement-reconcile-range-workers.md` | MOVE/MODIFY | task-3b | Mark verified and move to `proposals/done/` |
| `docs/specs/work-items/WI-509.md` | MODIFY | task-3a | Final AC evidence and status |
| `docs/specs/work-items/WI-510.md` | CREATE | task-3a | Separate skip-integrity follow-up |
| `docs/specs/work-items/INDEX.md` | MODIFY | task-3a | WI-509/WI-510 lifecycle |
| `docs/specs/tech/WI-509-reconcile-range-workers.md` | CREATE | task-3a | Baselined design |
| `docs/plans/2026-07-23-WI-509-reconcile-range-workers/manifest.md` | CREATE/MODIFY | task-3a | Execution authority |
| **docs/plans/2026-07-23-WI-509-reconcile-range-workers/review-log.yaml** | CREATE | task-3a | Durable plan review |
| `.svc/lane-tasks-WI-509.json` | CREATE/MODIFY | task-3a | Task and phase receipts |
| `.svc/pipeline-decisions.jsonl` | ALREADY-APPENDED | pre-plan | Skip decisions at timestamps `2026-07-23T13:14:51.896Z` through `13:14:51.954Z` |
| `.svc/pipeline-decisions.jsonl` | APPEND | task-3a | Append-only closeout decisions |

No other path under `.svc/` is a tracked changeset output. Runtime receipt
staging/mirrors remain governed, gitignored chain artifacts.

## Changeset Blueprint

Skipped because execution mode is `inline`: the active orchestrator has loaded
the WI, technical design, implementation, and caller context. The manifest
still freezes exact symbols, behavior, and validation below.

## Task Graph

| ID | Title | Files | Depends | ACs | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1 | Implement and test ordered bounded range workers | script + focused validator | — | RX-01..RX-05, RX-07, RX-08 | focused validator; syntax; exact range timing | `wi509-worker-pool` |
| task-2 | Update doctrine and framework capability | receipt contract, state, capability | task-1 | RX-06, RX-08 | targeted grep + markdown review | `wi509-doctrine` |
| task-3a | Review, audit, and replay | review and evidence artifacts | task-2 | RX-01..RX-09 | review chain, full Tier-1, promoted reconcile | `wi509-verified` |
| task-3b | Close improvement record | proposal path only | task-3a | RX-06..RX-09 | guarded move, status proof, remote sync | `wi509-closeout` |

Tasks run sequentially because task-2 describes task-1's final semantics and
task-3a binds review to the complete diff. task-3b runs last and is retry-safe:
create `proposals/done/`, move the source only when it still exists, require the
destination, then require its `**Status:** VERIFIED` header.

## AC-to-Task Mapping

| AC | Task |
|---|---|
| RX-01 | task-1, task-3a |
| RX-02 | task-1 |
| RX-03 | task-1 |
| RX-04 | task-1 |
| RX-05 | task-1 |
| RX-06 | task-2, task-3a, task-3b |
| RX-07 | task-1, task-3a |
| RX-08 | task-1, task-2, task-3a |
| RX-09 | task-3a, task-3b |

## AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| RX-01 | Behavioral assertion | concurrency 8, exit 0, and measured duration below 15 seconds |
| RX-02 | Unit fixture | policy default/clamp/bounds, including available 0/undefined to 1 |
| RX-03 | Unit fixture | delayed fake workers retain input order |
| RX-04 | Unit fixture | throw/timeout/buffer/malformed/mismatch produce exact-SHA failure |
| RX-05 | Integration | direct SHA and single-SHA range spawn no worker; worker-marked range exits 2 |
| RX-06 | Behavioral assertion | canonical reconcile exits 0 below 20 seconds and checkpoint advances |
| RX-07 | Integration | focused validators and full Tier-1 |
| RX-08 | Static command | scoped diff scan shows no waiver/checkpoint mutation or fail-open addition |
| RX-09 | Static command | changed-path scan shows WI-498 untouched and only the WI-510 registration added |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style | Persona/competitor |
|---|---|---|---|---|
| task-1 | N/A headless | bounded worker contract | existing `.mjs`/portable shell conventions | N/A system-only |
| task-2 | N/A headless | operations and rollback contract | concise operational Markdown | N/A system-only |
| task-3a/3b | N/A headless | promoted replay requirements | existing chain receipts | N/A system-only |

## Lane Compliance

| Skill | Evidence / disposition |
|---|---|
| `route-workflow` | `.svc/lane-tasks-WI-509.json` task 1 and append-only route decision |
| `diagnose-bug` | `docs/specs/work-items/WI-509.md` |
| `improve-framework` | active proposal; completes only after replay/remote sync |
| `write-spec` | skipped decision `WI-509-write-spec-skip`, timestamp `2026-07-23T13:14:51.896Z`; framework lane source is `skills-manifest.json`; bug behavior and ACs live in the WI |
| `design-ux` | skipped decision `WI-509-design-ux-skip`, timestamp `2026-07-23T13:14:51.926Z`; headless CLI, no human-visible flow |
| `design-ui` | skipped decision `WI-509-design-ui-skip`, timestamp `2026-07-23T13:14:51.954Z`; no visual surface |
| `design-tech` | `docs/specs/tech/WI-509-reconcile-range-workers.md`, G4 PASS |
| `plan-changeset` through `verify-promotion` | explicit tasks 5 through 13 in the delivery graph |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 3 | out-of-tree version control | branch, PR, final squash, receipt notes | coupled | `land-changeset` plus final-SHA receipt check |
| 12 | downstream framework artifacts | receipt doctrine and capability memory | coupled | task-2 changes with implementation and full Tier-1 |
| 15 | runtime filesystem state | regenerable `.svc/receipts/<sha>` mirrors | coupled | existing `writeJsonAtomic`; authoritative notes unchanged |

Untouched environments (walked the taxonomy, found nothing): 1, 2, 4, 5, 6,
7, 8, 9, 10, 11, 13, 14. There is no decoupled external state.

## Validation Plan

1. `node --check scripts/check-chain-receipts.mjs`
2. Run the new focused range-worker validator.
3. Confirm `svc-reconcile` consumes `ok/results/missing` without exhaustive
   matching on result `type`, and force one worker-error to assert exit 1 plus
   the exact SHA on stderr.
4. `bash test-framework/evals/tier-1/validate-retroactive-attestation.sh`
5. `bash test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh`
6. `bash test-framework/evals/tier-1/validate-receipt-tier.sh`
7. `bash test-framework/evals/tier-1/validate-baton-ac-binding.sh`
8. `bash test-framework/evals/tier-1/validate-quick-fix-carve-out.sh`
9. With concurrency pinned to 8, assert exit 0 and duration below 15 seconds
   for `985a8d5de2255288daaacda91c739e294b8a67d5..7dfe2c6292cd2bbde9330e0f74f126478c8252f1`.
   Pre-change direct range: approximately 90 seconds. On a host reporting fewer
   than 8 available CPUs, record the count and use
   `166 * 0.54 / concurrency * 1.3` as the scaled diagnostic bound; promoted
   acceptance still requires this host's pinned-eight replay.
10. Full `bash test-framework/evals/run-all-evals.sh`
11. Independent plan, G5/G6, audit, and final-SHA receipt validation
12. On promoted main, time canonical reconcile and prove checkpoint advancement

## Execution Command Sequence

```bash
node scripts/svc-ensure-worktree.mjs --wi WI-509 --branch framework-WI-509-reconcile-range-timeout --from origin/main --json --print-cd
cd /workspace/seriousvibecoding/.worktrees/framework-WI-509-reconcile-range-timeout
node --check scripts/check-chain-receipts.mjs
bash test-framework/evals/tier-1/validate-chain-receipts-range-workers.sh
bash test-framework/evals/tier-1/validate-retroactive-attestation.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh
bash test-framework/evals/tier-1/validate-receipt-tier.sh
bash test-framework/evals/tier-1/validate-baton-ac-binding.sh
bash test-framework/evals/tier-1/validate-quick-fix-carve-out.sh
RANGE_FROM=985a8d5de2255288daaacda91c739e294b8a67d5
RANGE_TO=7dfe2c6292cd2bbde9330e0f74f126478c8252f1
RANGE="$RANGE_FROM..$RANGE_TO" SVC_RECEIPT_RANGE_CONCURRENCY=8 node -e 'const {spawnSync}=require("node:child_process");const start=Date.now();const r=spawnSync(process.execPath,["scripts/check-chain-receipts.mjs","--range",process.env.RANGE],{stdio:["ignore","inherit","inherit"],env:process.env});const seconds=(Date.now()-start)/1000;console.error(`range_elapsed_seconds=${seconds}`);if(r.status!==0)process.exit(r.status??1);if(seconds>=15)process.exit(1)'
bash test-framework/evals/run-all-evals.sh
node scripts/check-chain-receipts.mjs --sha HEAD

# RECOVERY_IF_FAIL:
# Keep the worktree, commits, graph, and historical receipt notes intact.
# Correct through a new focused commit and rerun the failed validator.
# A failed reconcile leaves its checkpoint unchanged; never edit it by hand.

# LAND:
# Run the land-changeset task using this manifest and the reviewed final SHA.

# POST-MERGE ON MAIN:
cd /workspace/seriousvibecoding
BEFORE=$(node -e 'process.stdout.write(require("./.svc/reconcile-checkpoint.json").last_reconciled_sha)')
SVC_RECONCILE_CHILD_TIMEOUT_MS=20000 node -e 'const {spawnSync}=require("node:child_process");const start=Date.now();const r=spawnSync(process.execPath,["scripts/svc-reconcile.mjs"],{stdio:["ignore","inherit","inherit"],env:process.env});const seconds=(Date.now()-start)/1000;console.error(`reconcile_elapsed_seconds=${seconds}`);if(r.status!==0)process.exit(r.status??1);if(seconds>=20)process.exit(1)'
AFTER=$(node -e 'process.stdout.write(require("./.svc/reconcile-checkpoint.json").last_reconciled_sha)')
echo "checkpoint $BEFORE -> $AFTER"
test "$AFTER" != "$BEFORE"
test "$AFTER" = "$(git rev-parse HEAD)"
```

Receipt emission uses the canonical `scripts/emit-receipt.mjs` sequence after
the reviewed staged tree is stable. The range and reconcile durations are bound
into the exec/audit evidence. Final squash receipts are recomputed on the
promoted SHA.

## Checkpoint Plan

| Checkpoint | Rollback anchor |
|---|---|
| `wi509-worker-pool` | add a corrective commit before push; after push, use `git revert <checkpoint-sha>` |
| `wi509-doctrine` | revert doctrine/state in the same corrective/revert commit as implementation |
| `wi509-verified` | preserve prior commits and rerun only the failed gate |
| `wi509-closeout` | proposal tree mutates only here, using the guarded move |

No rollback rewrites history. After merge, revert the squash through the normal
protected-branch workflow. Historical `refs/notes/svc-receipts` entries remain
in place, and the reconcile checkpoint is never rewound by hand.

## Simulation Report

| Task | Check | Result | Action |
|---|---|---|---|
| task-1 | `scripts/check-chain-receipts.mjs` and `checkSha` exist | PASS (MODIFY) | Reuse direct path |
| task-1 | focused validator target absent | PASS (CREATE) | Add executable shell fixture |
| task-1 | Node supplies `execFile`, `availableParallelism`, URL/path primitives | PASS | No dependency |
| task-1 | real fixture can create 16 docs-only commits and quick-fix notes | PASS | Exercise real range, mirror creation, rerun, and cleanup |
| task-2 | receipt contract, state, and capability files exist | PASS (MODIFY) | Targeted edits |
| task-3a | review and evidence paths are explicit | PASS | Bind full diff |
| task-3b | `proposals/done/` exists | PASS | Guarded content-aware move only after replay |

## Scenario Coverage

No customer journey applies. The system scenario has four steps: enumerate
range, validate concurrently, emit ordered aggregate, and advance checkpoint
only after a clean aggregate. task-1 covers the first three; task-3a covers the
fourth. Coverage: 4/4.

## Integrity Inspection Commands

The focused Tier-1 validator contains self-asserting RX-08/RX-09 checks using
the pinned base: no added fail-open token, no WI-498 path, and exactly the
registered WI-510 scope. These assertions run non-interactively and never use a
bare interactive-shell `exit`.

## Promotion Readiness Checklist

- [x] Every RX criterion maps to a task and proof.
- [x] Every planned file maps to a task.
- [x] No ORM, migration, external API, visual, or database surface exists.
- [x] External-state taxonomy is explicit.
- [x] CREATE/MODIFY targets match disk state.
- [x] Rollback preserves notes, checkpoint, graph, and audit history.
- [ ] Plan review approves with no unresolved High/Critical.
- [ ] Implementation, review, audit, full Tier-1, and promoted replay pass.
