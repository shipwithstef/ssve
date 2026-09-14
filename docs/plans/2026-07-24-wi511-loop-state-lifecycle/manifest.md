# WI-511 Change Manifest: Quality-Preserving Loop-State Lifecycle

**Spec:** `docs/specs/work-items/WI-511.md`
**Solution confidence:** `docs/specs/decisions/2026-07-24-wi-511-quality-preserving-optimizations/SOLUTION-CONFIDENCE.md`
**Branch:** `framework-WI-511-quality-preserving-loop-state-pruning`
**Worktree:** `.worktrees/framework-WI-511-quality-preserving-loop-state-pruning`
**Base:** `main` at `162706bc560cccda2a20926e5498c93939816531`
**Created:** 2026-07-24
**Status:** SIMULATED
**Execution mode:** `inline`

## Archetype

Incremental extension of the existing loop-guard runtime-state lifecycle.

Current invariants:

1. Per-session files prevent cross-session counter pollution.
2. State lives only in the repository/worktree-scoped `.svc`.
3. The hook fails open on unparseable input and state persistence errors.
4. The existing warn/block thresholds and host decision output are unchanged.
5. `writeJsonAtomic` state locking remains the concurrency contract.
6. Tracked task, receipt, decision, checkpoint, and audit files are never cleanup targets.

The change touches one hook owner, one internal helper, and one focused validator. It is reversible with a normal Git revert and has no schema or data migration.

## Implementation Summary

Create a dependency-free lifecycle helper that scans exact loop-state basenames only when the current session path is absent or inactive for at least 24 hours. Remove a candidate only when it is a regular non-symlink file, is not the current path, has `mtime < now - 7 days`, and its canonical state lock can be acquired with zero wait. Catch scan, metadata, lock, and unlink errors so maintenance never alters current loop detection.

Execution is inline. The active orchestrator has loaded the governing WI, current hook, state I/O contract, no-loss precedents, solution-confidence packet, and exploration artifacts. Changeset code blueprints are intentionally omitted.

## Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `hooks/lib/loop-guard-state-lifecycle.mjs` | CREATE | task-2 | Exact cadence, cutoff, file-type, current-path, and zero-wait lock boundary |
| `hooks/svc-loop-guard.mjs` | MODIFY | task-2 | Invoke owner-local maintenance before current state load |
| **test-framework/evals/tier-1/validate-loop-guard-state-lifecycle.sh** | CREATE | task-1/task-2 | Mutation-red helper and hook-process fixtures |
| **test-framework/evals/tier-1/validate-svc-reconcile-watcher-advance.sh** | MODIFY | task-4 | Promotion-discovered fixture isolation: keep the GitHub-hang test independent of a perpetually growing historical receipt range |
| `docs/specs/work-items/WI-511.md` | CREATE/MODIFY | planning/task-3 | Governing AC/design and promoted closeout |
| `docs/specs/work-items/INDEX.md` | MODIFY | planning/task-3 | WI lifecycle |
| `docs/specs/decisions/2026-07-24-wi-511-quality-preserving-optimizations/SOLUTION-CONFIDENCE.md` | CREATE | planning | Adopt/modify/defer/reject authority |
| `docs/specs/explorations/wi-511-loop-state-lifecycle/PROBLEM_BRIEF.md` | CREATE | planning | Problem and criteria |
| `docs/specs/explorations/wi-511-loop-state-lifecycle/SOLUTION_MAP.md` | CREATE | planning | Three paradigms and seven approaches |
| `docs/specs/explorations/wi-511-loop-state-lifecycle/ANALYSIS.md` | CREATE | planning | AC tradeoff matrix |
| `docs/specs/explorations/wi-511-loop-state-lifecycle/COMPARISON.md` | CREATE | planning | Mechanical cadence comparison |
| `docs/specs/explorations/wi-511-loop-state-lifecycle/DECISION.md` | CREATE | planning | Selected design |
| `docs/plans/2026-07-24-wi511-loop-state-lifecycle/manifest.md` | CREATE/MODIFY | planning/review | Execution authority |
| **docs/plans/2026-07-24-wi511-loop-state-lifecycle/review-log.yaml** | CREATE | review | Independent plan findings and dispositions |
| **docs/specs/reviews/wi-511-loop-state-lifecycle-exec-cross-model.md** | CREATE | task-4 | Human-readable cross-model execution review evidence |
| **docs/specs/reviews/wi-511-loop-state-lifecycle-exec-review-log.yaml** | CREATE | task-4 | Frozen-diff adversarial review |
| **docs/specs/audit/wi-511-loop-state-lifecycle-analysis.md** | CREATE | task-4 | AC/implementation audit |
| `FRAMEWORK-STATE.md` | MODIFY | task-3 | Verified capability and decision |
| `proposals/2026-07-24-framework-improvement-stale-loop-state-lifecycle.md` | CREATE then MOVE/MODIFY | planning/task-3 | Accepted proposal and promoted record |
| `.svc/lane-tasks-WI-511.json` | CREATE/MODIFY | all | Cross-host task/phase evidence |
| `.svc/pipeline-decisions.jsonl` | APPEND | all | Append-only route/gate decisions |
| `.svc/session-contract.jsonl` | APPEND | preflight | Fresh WI authority |
| `.svc/competitive-monitor-triggers.jsonl` | APPEND | task-4 | Automatic verify-promotion audit trigger emitted during closeout |

No other tracked path is authorized. Ignored receipt bodies, review receipts, and phase logs are regenerable execution evidence.

Promotion-discovered correction: the GitHub-hang watcher fixture previously
anchored reconcile to a fixed historical SHA while applying a 100 ms child
timeout to both GitHub and receipt-range subprocesses. The growing main range
made the fixture fail for an unrelated receipt timeout after PR 178. Its
checkpoint now resolves current `HEAD`, leaving the fixture focused on
GitHub timeout and watcher preservation; receipt-range behavior remains covered
by `validate-chain-receipts-range-workers.sh`'s synthetic 16-commit repository
plus reconcile bounded/golden validators.

## Changeset Blueprint

Skipped because execution mode is `inline`. The orchestrator applies the reviewed symbols and tests below with the governing design loaded.

## Required Helper Contract

`hooks/lib/loop-guard-state-lifecycle.mjs` exports:

- `LOOP_GUARD_STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000`;
- `LOOP_GUARD_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000`;
- `LOOP_GUARD_PRUNE_BATCH_SIZE = 32`;
- `shouldPruneLoopGuardState(currentStateFile, now = Date.now())`;
- `pruneExpiredLoopGuardStates({svcDir, currentStateFile, now = Date.now()})`.

The pruner:

1. requires `svcDir` and `currentStateFile` to resolve to the same directory;
2. requires the final `.svc` component to be a real, non-symlink directory and
   enumerates it without recursion;
3. matches only `loop-guard-state.json` or `loop-guard-state-<1..48 [A-Za-z0-9_-] chars>.json`, exactly mirroring `stateFileFor` at `hooks/svc-loop-guard.mjs:62-64`;
4. excludes the resolved current path;
5. requires both `Dirent.isFile()` and `lstat.isFile()` with `!lstat.isSymbolicLink()`;
6. preserves `mtimeMs >= now - MAX_AGE`;
7. calls `withStateLock(candidate, callback, {timeoutMs: 0})`; `scripts/state-io.mjs:55-80,120-126` proves that zero means one immediate acquisition attempt followed by a contention error with no sleep;
8. rechecks metadata inside the lock and unlinks only if still eligible;
9. relies on `withStateLock`'s `finally` release to remove the transient sidecar (`scripts/state-io.mjs:67-68,120-126`) and tests that no sidecar remains;
10. sorts regular candidate names and inspects a rotating cadence-derived batch
    of at most 32 per invocation, so later cadence windows retire the backlog
    without unbounded synchronous metadata/lock/unlink work;
11. catches every maintenance error and returns deterministic `{scanned, removed}` counts.

`shouldPruneLoopGuardState` returns true when the current file is absent or when
its `mtimeMs <= now - LOOP_GUARD_PRUNE_INTERVAL_MS`; exact-cutoff and
one-millisecond-newer fixtures pin that cadence boundary. The hook calls
`shouldPrune...` and then `prune...` after `stateFileFor` and before `loadState`.
The call site has its own fail-open `try/catch` and ignores the helper result.

## Task Graph

| Task | Title | Files | Depends on | ACs | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| task-1 | Add mutation-red lifecycle validator | focused shell validator | plan review | AC1-AC6 | focused script fails specifically before helper exists | tests-red |
| task-2 | Implement helper and hook wiring | helper, loop guard, focused validator adjustments | task-1 | AC1-AC7 | node checks + focused/existing hook validators | implementation-green |
| task-3 | Persist framework records | WI, INDEX, FRAMEWORK-STATE, proposal | task-2 | AC7-AC8 | doc/state validators + exact diff scope | records |
| task-4 | Review, audit, full Tier-1, land, replay | review/audit/task graph/receipts | task-3 | AC1-AC8 | frozen review, audit, aggregate suite, promoted reconcile | final |

No tasks are parallel because task-1 defines the red contract, task-2 makes it green, and the frozen review requires the complete branch state.

## AC-to-Task Mapping

| AC | Task |
|---|---|
| WI511-AC1 | task-1, task-2 |
| WI511-AC2 | task-1, task-2 |
| WI511-AC3 | task-1, task-2 |
| WI511-AC4 | task-1, task-2 |
| WI511-AC5 | task-1, task-2 |
| WI511-AC6 | task-1 |
| WI511-AC7 | task-2, task-3, task-4 |
| WI511-AC8 | task-4 |

## AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| WI511-AC1 | Unit/integration shell | stale matching file removed |
| WI511-AC2 | Unit/integration shell | old current path retained and rewritten |
| WI511-AC3 | Unit shell | injected exact cutoff retained; one millisecond older removed |
| WI511-AC4 | Unit/integration shell | fresh, unrelated, directory, and symlink preserved |
| WI511-AC5 | Unit/integration shell | a background holder acquires the candidate lock, writes a ready sentinel, and waits for a release sentinel; only after a bounded ready poll does pruning run, return in under 500 ms, report zero removals, and preserve the candidate; unreadable/error cases continue; five-repeat hook block still fires |
| WI511-AC6 | Static mutation-red | validator checks source wiring and behavior, and fails when pruning is disabled/overbroad |
| WI511-AC7 | Aggregate | focused and existing hook/lane/phase/candidate/receipt validators plus full Tier-1 |
| WI511-AC8 | Promoted runtime | focused validator and `svc-reconcile` from promoted main |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style | Persona/competitor |
|---|---|---|---|---|
| task-1 | N/A, headless hook | WI-511 state machine/falsification | portable Bash, hermetic temp directories | N/A, system-only |
| task-2 | N/A, headless hook | exact helper and lock contract | dependency-free Node ESM, existing state-io | N/A, system-only |
| task-3 | N/A, records only | cost/ops/rollback | concise operational Markdown, append-only JSONL | N/A, system-only |
| task-4 | N/A, governance | frozen diff and promoted replay | existing receipt/PR conventions | N/A, system-only |

No UX, UI, design-system, style-contract, Base44, or persona artifact is applicable to this system-only hook lifecycle.

## Lane Compliance

| Framework skill | Disposition | Artifact or registered decision |
|---|---|---|
| route-workflow | completed | `.svc/lane-tasks-WI-511.json` task 1 |
| improve-framework | completed | `proposals/2026-07-24-framework-improvement-stale-loop-state-lifecycle.md` |
| write-spec | completed | `docs/specs/work-items/WI-511.md` |
| research | completed | solution-confidence sourced-precedent section and task 15 |
| design-tech | completed | WI-511 Technical Design and solution-confidence artifact |
| explore-solutions | completed | `docs/specs/explorations/wi-511-loop-state-lifecycle/DECISION.md` |
| design-ux | skipped | registered `design-ux:registry-skip` in delivery graph and WI-511 decision log |
| design-ui | skipped | registered `design-ui:registry-skip` in delivery graph and WI-511 decision log |
| write-e2e | skipped | registered `write-e2e:registry-skip` in delivery graph and WI-511 decision log |
| track-visuals | skipped | registered `track-visuals:registry-skip` in delivery graph and WI-511 decision log |
| test-journeys | skipped | registered `test-journeys:registry-skip` in delivery graph and WI-511 decision log |
| mandatory plan/exec/review/land/verify chain | required | executable tasks 6-14 in `.svc/lane-tasks-WI-511.json` |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | installed host hook symlinks/copies consume the shared source | coupled | pre-commit/pre-push multi-host drift checks and `./setup --host <host>` keep installed surfaces aligned |
| 12 | Downstream framework artifacts | all host hook manifests consume `svc-loop-guard.mjs` | coupled | existing hook loadability/host parity validators and full Tier-1 run before land |
| 15 | Filesystem state created at runtime | gitignored `loop-guard-state*.json` and their transient lock files | coupled | the creating hook invokes the lifecycle helper; the focused validator proves cleanup, active-writer refusal, and rollback behavior |

Untouched environments (walked the taxonomy, found nothing): 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

Expired generated files are intentionally not backed up: they are bounded loop-detection history, not audit authority, and regenerate on the next call. Monitoring/recovery is the focused validator plus normal Git revert; cleanup failures preserve files and continue enforcement.

## Validation Plan

1. Capture pre-implementation focused red with the exact missing-helper reason.
2. Syntax-check the new helper, modified hook, and focused shell.
3. Run the focused lifecycle validator.
4. Run existing `validate-loop-guard.sh`, `validate-svc-state-dir-no-tmp-pollution.sh`, and `validate-hook-scripts-loadable.sh`.
5. Run the user-named candidate, phase-receipt, and lane-task validators.
6. Run receipt-range workers and canonical reconcile to prove excluded subsystems remain unchanged.
7. Run full Tier-1.
8. Freeze and review the exact branch diff with a different-family adversary; audit all eight ACs.
9. Commit the reviewed tree, emit all final-SHA chain receipts, push, merge, and replay focused/full/reconcile from promoted main.

## Execution Command Sequence

```bash
CODEX_THREAD_ID=019f8cd3-5ff3-7302-852c-1729ef9167eb node scripts/svc-ensure-worktree.mjs --wi WI-511 --branch framework-WI-511-quality-preserving-loop-state-pruning --from origin/main --authority-v2 --json --print-cd
cd /workspace/seriousvibecoding/.worktrees/framework-WI-511-quality-preserving-loop-state-pruning
BASE_SHA=162706bc560cccda2a20926e5498c93939816531
test "$(git merge-base HEAD "$BASE_SHA")" = "$BASE_SHA"
test "$(git branch --show-current)" = "framework-WI-511-quality-preserving-loop-state-pruning"

# task-1: apply the reviewed focused validator, then capture only the intended red.
set +e
PRE_IMPL_OUTPUT=$(bash test-framework/evals/tier-1/validate-loop-guard-state-lifecycle.sh 2>&1)
PRE_IMPL_EXIT=$?
set -e
test "$PRE_IMPL_EXIT" = "1"
printf '%s\n' "$PRE_IMPL_OUTPUT" | grep -q 'loop-guard lifecycle helper unavailable'

# task-2: apply the reviewed helper and hook wiring, then prove the focused surface.
node --check hooks/lib/loop-guard-state-lifecycle.mjs
node --check hooks/svc-loop-guard.mjs
bash -n test-framework/evals/tier-1/validate-loop-guard-state-lifecycle.sh
bash test-framework/evals/tier-1/validate-loop-guard-state-lifecycle.sh
bash test-framework/evals/tier-1/validate-loop-guard.sh
bash test-framework/evals/tier-1/validate-svc-state-dir-no-tmp-pollution.sh
bash test-framework/evals/tier-1/validate-hook-scripts-loadable.sh

# task-3/task-4: prove named non-regression and aggregate behavior.
bash test-framework/evals/tier-1/validate-candidate-harness.sh
bash test-framework/evals/tier-1/validate-phase-receipt-skip-integrity.sh
bash test-framework/evals/tier-1/validate-lane-tasks-integrity.sh
bash test-framework/evals/tier-1/validate-chain-receipts-range-workers.sh
node scripts/svc-reconcile.mjs
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-511.json
node scripts/validate-delivery-graph.mjs .svc/lane-tasks-WI-511.json
bash test-framework/evals/run-all-evals.sh
git diff --check

# The focused fixture mechanically proves that 109 non-candidate entries cause
# zero metadata/lock work. Its printed wall-clock median is advisory; investigate
# a stable >5 ms median outside the aggregate runner rather than making Tier-1
# scheduler load a correctness failure.

# RECOVERY_IF_FAIL:
# Preserve the isolated worktree, append-only decisions, task graph, and receipt notes.
# Correct only the first failing reviewed task, rerun from that command, and never
# delete unrelated loop-state files, bindings, claims, checkpoints, or audit history.

# Freeze only manifest-authorized tracked paths, complete reviews/audit, and commit
# the unchanged reviewed tree through land-changeset. Receipt bodies are generated
# under ignored .svc/receipt-bodies and emitted for plan-manifest, review-plan,
# exec-record, review-exec, and audit-implementation on FINAL_BRANCH_SHA.
git diff --name-only "$BASE_SHA" | sort
git status --short --untracked-files=all
git commit -m "Prune expired loop-guard session state" -m "Co-Authored-By: Codex CLI <contact-b6b620a2d4@example.invalid>"
FINAL_BRANCH_SHA=$(git rev-parse HEAD)
node scripts/check-chain-receipts.mjs --sha "$FINAL_BRANCH_SHA"
git push -u origin framework-WI-511-quality-preserving-loop-state-pruning

# land-changeset creates/reuses the exact-head PR and merges only after review
# and final-SHA receipt checks. verify-promotion then runs from updated main:
cd /workspace/seriousvibecoding
git fetch origin main
bash test-framework/evals/tier-1/validate-loop-guard-state-lifecycle.sh
bash test-framework/evals/run-all-evals.sh
node scripts/svc-reconcile.mjs
```

## Checkpoint Plan

| Checkpoint | State | Rollback anchor |
|---|---|---|
| tests-red | focused validator fails only for unavailable helper | base SHA |
| implementation-green | focused and existing hook validators pass | tests-red diff |
| records | spec/state/proposal match implemented behavior | implementation-green diff |
| final | reviewed/audited tree, aggregate green, final-SHA receipts | base SHA normal revert |

## Simulation Report

| Check | Result |
|---|---|
| Governing spec/ACs exist | PASS |
| MODIFY target `hooks/svc-loop-guard.mjs` exists and owns state creation | PASS |
| Existing `withStateLock` supports zero-wait contention | PASS — `scripts/state-io.mjs:55-80,120-126`; timeout 0 throws before the retry sleep |
| `withStateLock` removes its sidecar | PASS — release callback unlinks in `finally` at `scripts/state-io.mjs:67-68,120-126` |
| Helper basename contract matches the producer | PASS — `stateFileFor` sanitizes to `[A-Za-z0-9_-]` and slices to 48 at `hooks/svc-loop-guard.mjs:62-64` |
| CREATE helper and validator targets do not exist | PASS |
| No dependency/package/schema change | PASS |
| Focused validator auto-enumerated by Tier-1 runner | PASS — `test-framework/evals/run-all-evals.sh:84-86` enumerates every Tier-1 `.sh` and `.mjs` |
| Codex co-author trailer is guard-compatible | PASS — `hooks/svc-workflow-guard.mjs:699` maps Codex to `Codex CLI <contact-b6b620a2d4@example.invalid>` |
| External-state taxonomy walked | PASS |
| No browser journey or production mock needed | PASS |
| All ACs map to tasks and tests | PASS |
| No unresolved simulation failures | PASS |

## Promotion Readiness Checklist

- [x] All planned files and external state are declared.
- [x] All eight ACs map to tasks and executable proof.
- [x] No ORM schema or migration exists.
- [x] Exact worktree, branch, base SHA, and authority are fixed.
- [x] Focused red and green commands are deterministic.
- [x] Existing and excluded subsystem validators are named.
- [x] Full Tier-1, frozen review, audit, final-SHA receipts, PR merge, and promoted replay are mandatory.
- [x] Rollback is a normal reviewed Git revert; deleted generated state needs no restore.

## Plan Review Round 1 Dispositions

Primary reviewer: Claude Opus 4.8, Anthropic, high effort. Rubric 6,
`pass-with-findings`; canonical receipt:
`.svc/external-review-artifacts/plan/1dfc84dc1d0792f18e951d8203b835230260ffe8490fc3da65b5ce06bb4d8fb8/20260723T222549Z-3530856/receipt.json`.

| Finding | Response | Justification and action |
|---|---|---|
| F-001 HIGH | ACCEPT | Added source-line proof for zero-wait semantics, required an outer hook `try/catch`, and retained focused contention proof. |
| F-002 MEDIUM | ACCEPT | Cited the exact aggregate runner discovery loop. |
| F-003 MEDIUM | ACCEPT | Pinned the helper basename language to the producer's exact charset and 48-character bound; the focused hook fixture must use a producer-valid session id. |
| F-004 MEDIUM | REJECT WITH COUNTER-EVIDENCE | `withStateLock` releases in `finally` and its release callback unlinks the sidecar (`scripts/state-io.mjs:67-68,120-126`). Added an explicit absence assertion so this proven contract remains guarded. |
| F-005 MEDIUM | ACCEPT | Added the explicit lane-compliance table and append-only registered skip decisions. |
| F-006 LOW | ACCEPT | Defined the cadence against current-file `mtimeMs`, inclusive at the 24-hour cutoff, with exact-boundary fixtures. |
| F-007 LOW | ACCEPT | Confirmed the planned trailer exactly matches the Codex mapping enforced by the repository hook. |

Because this is an infra-path plan and one finding is rejected with
counter-evidence, the revised package requires the mandatory convergence review
before execution.

## Plan Review Round 2 Dispositions

Convergence reviewer: Claude Opus 4.8, Anthropic, high effort. Rubric 7,
`pass-with-findings`; canonical receipt:
`.svc/external-review-artifacts/plan/8e83a134d641e3957ae817004c57b0d171815890f73928d32f0b5df455689c2f/20260723T223220Z-3546478/receipt.json`.

The reviewer agreed with the Round-1 F-004 counter-evidence: canonical lock
release plus the explicit sidecar-absence fixture resolves that dispute in the
orchestrator's favor.

| Finding | Response | Justification and action |
|---|---|---|
| F-CONV-001 MEDIUM | ACCEPT | The focused contention fixture now has a 500 ms upper bound in addition to preservation and continued enforcement. This mechanically guards fail-fast semantics. |
| F-CONV-002 MEDIUM | REJECT WITH COUNTER-EVIDENCE | The measured cost is approximately 0.092 ms to enumerate the current 109-entry `.svc` before per-candidate work, and the scan runs once per new/inactive session, not per hook event. A persistent cadence marker would add a new state/lock lifecycle and invalidation surface contrary to WI511's no-extra-cache design for a sub-millisecond session-entry cost. Revisit only if the specified >5 ms median hook-regression stop condition fires. |
| F-CONV-003 LOW | ACCEPT | The intended missing-helper red now exits 1; exit 2 remains reserved for usage/input errors. |

These are plan-only clarifications. The third and final bounded review round
must confirm the changed package before execution; any residual non-Critical
findings are dispositioned under the three-round cap.

## Plan Review Round 3 Dispositions

Final bounded reviewer: Claude Opus 4.8, Anthropic, high effort. Rubric 8,
`pass-with-findings`; canonical receipt:
`.svc/external-review-artifacts/plan/e0e5fe7a37199e66a813d5468495618a1717a0a248044ed0b059549fe08af3de/20260723T223608Z-3555138/receipt.json`.

| Finding | Response | Justification and action |
|---|---|---|
| F-R3-001 MEDIUM | ACCEPT | The AC5 fixture now requires a bounded ready/release sentinel handshake before timing the foreground prune, then asserts under-500-ms return, zero removals, and candidate preservation. This prevents a vacuous uncontended pass. |
| F-R3-002 LOW | ACCEPTED BOUNDED RISK | If current-state persistence is already failing open, the absent path can cause the measured ~0.092 ms enumeration to recur. A process-local flag cannot survive the one-process-per-hook-event host model, while a durable marker adds the extra lifecycle deliberately rejected by the design. The risk is local, sub-millisecond at measured scale, non-authoritative, and guarded by the >5 ms median stop condition. |

Bounded conclusion: three rounds, zero unresolved Critical, zero remaining High.
The plan is `REVISED_AND_REVIEWED` and may enter execution after the final
mechanical, delivery-graph, and round-cap checks pass.
