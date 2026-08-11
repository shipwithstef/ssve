# WI-505 Changeset Manifest — Automatic Stale Complete-Tuple Reclaim

**Spec:** `docs/specs/features/wi-505-stale-binding-reclaim.md`
**Work item:** `docs/specs/work-items/WI-505.md`
**Branch:** `framework-WI-505-stale-binding-reclaim`
**Status:** SIMULATED
**Base:** `origin/main` at `d2243795a73a2792e56675afdba5fb61eb15bdd5`
**Created:** 2026-07-21
**Archetype:** architectural change
**Execution mode:** inline
**Delivery tier:** full

## 1. Implementation Summary

Replace the coarse “first unreleased binding is live” check in `svc-ensure-worktree` with one secure claim-v1 tuple classification shared by optimistic resume and the locked generation-transfer path. The existing claim generation compare-and-swap remains the authority linearization point. After it selects the new owner, the transfer retires the exact source binding before returning; the winner binding is then written at the already-selected generation and verified through the existing resolver.

The standard claim-v1 path refuses to mutate when a canonical controller-lease-v2 record exists. No authority schema, graph schema, v2 lifecycle, host payload, package dependency, worktree, branch, graph, or user file is migrated or deleted.

### Load-bearing invariants

1. Fresh foreign ownership is never preempted and returns actionable owner/generation/worktree evidence.
2. Reclaim requires one secure, exact repository/worktree/branch/WI/claim-path/owner/generation tuple.
3. Claim CAS against the exact observed generation produces one winner and increments exactly once.
4. The old binding is non-authoritative at the CAS point and durably released before success returns.
5. A crash after CAS forward-completes the winner binding without another generation increment.
6. Same-session complete resume keeps generation unchanged.
7. Any canonical v2 lease record excludes standard v1 reclaim; migration remains explicit.
8. Malformed, missing, mismatched, ambiguous, symlinked, insecure, or foreign-owned authority state denies before mutation.
9. Reclaim never removes/recreates the registered worktree or changes graph/tracked/untracked/ignored user bytes.
10. Implemented, focused green, full Tier-1 green, merged/pushed, installed, and live-replayed remain distinct closeout states.

## 2. Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| `test-framework/evals/tier-1/validate-default-checkout-isolation.sh` | MODIFY | proc-1 | Add the complete public stale/fresh/race/mismatch/idempotence/v2/crash-recovery/dirty-file red/green matrix. All helper-level “Unit” assertions are persisted as inline Node heredoc cases in this file and run by this fixture command; no undeclared test file or entrypoint is implied. |
| `hooks/lib/wi-claim.mjs` | MODIFY | proc-2 | Add secure exact tuple inspection, controller-lease exclusion, locked generation revalidation, and exact source-binding retirement. |
| `scripts/svc-ensure-worktree.mjs` | MODIFY | proc-3 | Remove `activeBindingOwner`, route existing tuple acquisition through the shared helper/transfer, forward-complete the CAS winner, preserve final resolver verification. |
| `test-framework/evals/tier-1/validate-codex-execution-integrity.sh` | MODIFY | proc-5 accepted dependency closure | Copy the existing `authority-store.mjs` dependency into isolated full-module mutant fixtures after `wi-claim.mjs` gains the static local import. No assertion or production behavior changes. |
| `test-framework/evals/tier-1/validate-task-state-compatibility.sh` | MODIFY | proc-5 accepted dependency closure | Copy the existing `authority-store.mjs` dependency into the isolated migration fixture after `wi-claim.mjs` gains the static local import. No assertion or production behavior changes. |
| `FRAMEWORK-STATE.md` | MODIFY | proc-4 | Record the corrected authority ordering at focused-green proof only; defer full-Tier-1 status to proc-5 and promoted capability status to live replay. |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | proc-4 | Document automatic stale complete-tuple reclaim, v2 exclusion, fail-closed limits, and recovery diagnostics. |
| `docs/specs/work-items/WI-505.md` | MODIFY | proc-4/closeout | Record implementation/test/review/promotion lifecycle without marking fixed before replay. |
| `proposals/2026-07-21-framework-improvement-stale-binding-reclaim.md` | PRESENT then MOVE | closeout | Retain accepted proposal during implementation; move byte-identically to `proposals/done/` only after promoted live replay. |
| `.svc/lane-tasks-WI-505.json` | MODIFY | orchestration | Durable phase/task/review/test/land/verify state. |
| `.svc/pipeline-decisions.jsonl` | MODIFY | orchestration | Route, design, plan, review, execution, landing, and replay decisions. |
| `.svc/session-contract.jsonl` | PRESENT | orchestration | Exact WI/worktree/branch/session baton; no rewrite. |

### Planned unchanged authority surfaces

- `hooks/lib/resolve-wi.mjs` remains the final exact authority postcondition and requires no semantic change.
- `hooks/lib/authority-store.mjs` remains the canonical controller-lease lifecycle; existing read exports are sufficient.
- All claim/controller/delegation schemas, graph schemas, host adapters, and explicit migration commands remain unchanged.

### 2a. Inline execution boundary

`mode:inline` is selected because the current orchestrator loaded the owner report, prior authority contracts, bounded sources, hermetic reproduction, bugfix brief, and technical design and will apply the correction in this exact worktree. Per the plan contract, a duplicate code blueprint is omitted. Exact behavior is constrained by SR-01..SR-15, the function-level task descriptions below, red/green fixtures, and final review receipts.

## 3. Task Graph

| Task | Title | Files | Depends on | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| proc-1 | Add public stale complete-tuple red fixture | default-checkout isolation fixture | reviewed plan | SR-01..SR-13 | Run the focused fixture against current source and require the stale A→B assertion to fail with the reproduced conflict before implementation | `wi505-red-public-transition` |
| proc-2 | Centralize exact tuple inspection and locked transfer | `hooks/lib/wi-claim.mjs` | proc-1 red proof | SR-01, SR-03..SR-06, SR-08..SR-11 | `node --check hooks/lib/wi-claim.mjs`; helper-level focused stale/fresh/race/mismatch/v2 assertions | `wi505-authority-store` |
| proc-3 | Integrate automatic existing-worktree resume | `scripts/svc-ensure-worktree.mjs` | proc-2 | SR-01..SR-13 | `node --check scripts/svc-ensure-worktree.mjs`; complete focused fixture green twice | `wi505-bootstrap-green` |
| proc-4 | Synchronize framework authority knowledge | state, capability, WI | proc-3 focused green | SR-10..SR-15 | Markdown/state validators; statements distinguish local proof from promoted proof | `wi505-doc-state` |
| proc-5 | Freeze and validate implementation | all planned runtime/test/doc files | proc-1..proc-4 | SR-01..SR-15 | owner-named focused suite, syntax checks, full Tier-1, plan manifest mechanical check, branch diff audit | `wi505-exec-freeze` |

Tasks execute serially in the one sanctioned WI-505 worktree. No code-writing delegation or parallel worktree is used. Lane tasks then enforce adversarial execution review, security review, implementation audit, sanctioned landing, installed refresh, and live replay.

### proc-1 exact fixture obligations

Use one temporary bare origin/clone and the public `ensureWorktree()`/CLI surfaces. Preserve pre/post SHA-256 digests and Git identities. The section must assert:

1. complete claim-v1 tuple A/gen1 made stale by positive dead-PID proof automatically transfers to B/gen2 and returns `created=false`, `resumed=true`;
2. fresh A/gen1 denies B and names A;
3. B/C complete-tuple transfer calls with expected gen1 have exactly one CAS winner; loser observes changed generation/state. Each child first reads and asserts gen1, writes its own ready marker, and waits on one parent-created release marker before invoking `transferClaim`; the parent releases only after both ready markers exist, deterministically proving both attempts were based on gen1 while the production claim lock/CAS still selects one winner;
4. binding generation mismatch and binding claim-path mismatch each deny with claim/binding bytes unchanged;
5. winner B replay returns resumed at gen2 and never writes gen3;
6. an explicitly created active controller-lease-v2 beside stale-looking claim-v1 state denies standard v1 transfer and leaves both authority records unchanged;
7. standard ensure creates no v2 state;
8. a manually constructed durable post-CAS/pre-retirement state — claim owned by B at gen2 with `transfer_from_generation=1`, unreleased source binding A/gen1, and no B binding — forward-completes through public ensure: generation stays gen2, A is released, B is bound at gen2, and `resumed=true`;
9. direct stale/released `transferClaim` still succeeds when no v2 record exists, while the identical call denies with unchanged claim/binding/v2 bytes when a canonical v2 record exists;
10. tracked, untracked, ignored, graph, worktree registration, branch, and commit identity remain byte/identity stable except sanctioned claim/binding metadata.

The red proof is the existing current-source exit-2 conflict, not a synthetic assertion or break-glass path.

### proc-2 exact function contract

In `hooks/lib/wi-claim.mjs`:

- add an exported secure inspector with one stable state vocabulary: `fresh_foreign`, `reclaimable`, `current_complete`, `current_unbound`, `v2_present`, and `deny` plus reason/evidence;
- derive the canonical claim path and binding filenames; do not trust caller-supplied relative paths;
- secure-read every binding JSON entry and fail closed on malformed/insecure mutation candidates;
- require exactly one exact current-generation source binding, allowing only secure lower-generation exact-coordinate entries as obsolete history;
- treat an exact released binding plus released/stale claim as reclaimable evidence;
- read the exact repository/WI v2 lease before v1 transfer; any secure record denies, and malformed/insecure v2 state throws/denies;
- extend the existing `transferClaim()` with an opt-in complete-tuple source binding path/snapshot. Re-read the same inspector under the claim lock and compare expected generation before calling the current transfer write logic;
- after claim generation N+1 plus `transfer_from_generation=N` is durable, atomically add `released_at`/`updated_at` and transfer diagnostics to the exact source binding before returning success;
- source-binding retirement is metadata-only (`released_at`, `updated_at`, and transfer diagnostics) and uses the existing temp-file-plus-rename atomic writer; it never unlinks the authority target;
- on source-binding retirement failure, fail the call while retaining the generation winner; expose enough classification for the same winner to forward-complete on retry;
- under the same claim lock, let `current_unbound` recovery retire the secure obsolete exact-coordinate source binding before returning acquisition success, so a durable post-CAS/pre-retirement state completes without a second generation increment;
- keep existing direct stale/released claim transfer and CLI compatibility, but apply controller-lease exclusion consistently.

Before editing, record `rg -n "transferClaim" scripts hooks test-framework/evals/tier-1`. The observed caller set is the `svc-ensure-worktree` import/call plus the `wi-claim.mjs` CLI dispatch; both the public caller and direct CLI/helper paths receive explicit no-v2 success and v2-denial coverage.

The existing cross-process linearization primitive is `withExclusiveLock("claim:<canonical-claim-path>")`: it creates the shared lockfile under the UID-scoped runtime directory with `fs.openSync(..., O_CREAT | O_EXCL)` and every transfer re-reads generation/state inside that critical section. The two-child fixture must assert its observable consequence: one gen2 result, one changed-generation denial, one final claim with `transfer_from_generation=1`, and no gen3.

### proc-3 exact caller contract

In `scripts/svc-ensure-worktree.mjs`:

- remove `activeBindingOwner()` and its uncorrelated directory scan;
- preserve the current same-session complete-tuple fast path and `authorityJson` verification;
- for the remaining registered-worktree path, consume the shared inspector result:
  - `fresh_foreign` → actionable conflict with owner/generation/worktree;
  - `reclaimable` → invoke complete-tuple `transferClaim()` against the exact observed generation/source binding;
  - `current_unbound` → skip transfer and write the winner binding at the same claim generation;
  - `v2_present` or `deny` → fail before v1 mutation;
- keep live bootstrap marker conflict ahead of authority transfer;
- call `writeSessionBinding()` only after successful acquisition; it must retain the already-selected generation;
- preserve `ensureGraph()` as non-destructive graph existence/shape handling and verify success through the existing final resolver;
- return only the current JSON fields with `created=false`, `resumed=true`, and the verified generation.

Before removal, record `rg -n "activeBindingOwner" scripts hooks test-framework/evals/tier-1`. The baseline output must contain only the local definition and local call in `scripts/svc-ensure-worktree.mjs`; any additional consumer blocks removal until the file manifest and compatibility contract are expanded.

## 4. AC-to-Task Mapping

| AC | Tasks |
|---|---|
| SR-01 | proc-1, proc-2, proc-3 |
| SR-02 | proc-1, proc-3 |
| SR-03 | proc-1, proc-2 |
| SR-04 | proc-1, proc-2 |
| SR-05 | proc-1, proc-2, proc-3 |
| SR-06 | proc-1, proc-2 |
| SR-07 | proc-1, proc-3 |
| SR-08 | proc-1, proc-2, proc-3 |
| SR-09 | proc-1, proc-2 |
| SR-10 | proc-1, proc-2, proc-3 |
| SR-11 | proc-1, proc-2, proc-3 |
| SR-12 | proc-1, proc-3 |
| SR-13 | proc-1, proc-5 |
| SR-14 | proc-4, proc-5 plus lane review/land/verify tasks |
| SR-15 | proc-4 plus `verify-promotion` |

## 5. AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| SR-01 | E2E | Hermetic public ensure fresh-owner denial with exact evidence |
| SR-02 | E2E | Hermetic public ensure stale A→B in-place resume |
| SR-03 | Unit | Inline Node case in `validate-default-checkout-isolation.sh`: claim transfer expected-generation and provenance assertions; invoked by the fixture command |
| SR-04 | Unit | Inline Node cases in `validate-default-checkout-isolation.sh`: clean post-CAS retirement plus manually constructed post-CAS/pre-retirement forward completion; invoked by the fixture command |
| SR-05 | E2E | Public ensure against the constructed crash state, old-owner resolver denial, and repeated winner resume at unchanged gen2 |
| SR-06 | Unit | Inline Node two-child ready/release-barrier case in `validate-default-checkout-isolation.sh`: both pre-read gen1, then exactly one gen2 winner; invoked by the fixture command |
| SR-07 | E2E | Same-session public ensure repeated without generation change |
| SR-08 | Unit | Inline Node malformed/symlink/insecure/ambiguous negative matrix in `validate-default-checkout-isolation.sh` plus existing validators |
| SR-09 | Unit | Inline Node generation/path/coordinate mismatch matrix in `validate-default-checkout-isolation.sh` |
| SR-10 | E2E | Active controller lease plus stale-looking claim state and direct transfer regression; no claim/binding/v2 byte change |
| SR-11 | E2E | Direct stale/released transfer succeeds without v2; standard ensure leaves v2 store absent; explicit migration validator remains green |
| SR-12 | E2E | Pre/post digests for tracked/untracked/ignored/graph plus Git identity checks |
| SR-13 | E2E | The SR-12 fixture digest/identity oracle is authoritative proof of no worktree/graph/user-file deletion or rewrite; a changed-addition destructive/break-glass/impersonation scan is advisory review evidence, not a regex authorization oracle |
| SR-14 | Static | Focused/full logs plus land-phase-derived commit/PR identifiers passed to `check-chain-receipts.mjs` and the sanctioned merge wrapper bind review/security/audit and landing evidence |
| SR-15 | Manual | Installed Example Marketplace Port WI-496 replay plus second idempotent call and before/after inventory |

## Prerequisite Alignment Matrix

| Task | UX | UI | Technical design | Style | Persona / differentiation |
|---|---|---|---|---|---|
| proc-1 | Existing CLI outcome and actionable denial | N/A | Exact tuple/race/v2/data matrix in WI-505 design | Existing portable Bash + inline Node Tier-1 conventions | N/A - system-only framework authority |
| proc-2 | Deterministic denial reasons | N/A | Inspector, CAS linearization, crash table, v2 exclusion | Existing ESM exports, secure reads, exclusive locks, atomic JSON writes | N/A - system-only framework authority |
| proc-3 | Stable JSON success fields | N/A | Resume state machine and final resolver oracle | Existing `svc-ensure-worktree.mjs` transaction conventions | N/A - system-only framework authority |
| proc-4..5 | Operator docs and proof separation | N/A | Operations, rollback, close condition | Framework Markdown/state conventions | N/A - internal maintainers |

UX/UI and browser mock parity are N/A because no visual or browser-visible file changes. No Base44/backend, ORM, database, provider-fidelity, persona, or competitive mechanic is in scope.

## 7. Lane Compliance

| Skill / gate | Disposition | Evidence |
|---|---|---|
| `improve-framework` | active spanning orchestrator | Accepted single-gap proposal; closes only after promoted replay |
| `diagnose-bug` | completed | Hermetic reproduction, pattern scan, bugfix brief, WI-505 |
| `design-tech` | completed | Baselined technical design, five-option decisions, G4 PASS |
| `plan-changeset` | active | This simulated manifest |
| `review-plan` | mandatory next blocker | Lane task 6; execution remains blocked |
| `execute-changeset` | mandatory pending | Lane task 7 |
| `review-gate`, `review-exec`, `review-security`, `audit-implementation` | mandatory pending | Lane tasks 8..11; no skip path |
| `test-framework` | mandatory pending | Lane task 12; focused plus full Tier-1 |
| `land-changeset`, `verify-promotion` | mandatory pending | Lane tasks 13..14; sanctioned merge/install/live replay |
| research/UI/browser/journey gates | N/A with logged proof | Local headless authority logic; no host API, provider, UI, browser, or product journey change |

`node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-505.json` passes with all framework mandatory skills present.

## 8. External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | Installed svc skills/hooks for all provisioned hosts after merge | coupled | Repository pre-commit multi-host check plus `./setup --host <host>` and `bash scripts/check-install-drift.sh --host <host>`; installed behavior is replayed before closeout |
| 3 | Out-of-tree version-controlled | Protected main residue stash object `c4f5b0193894dc6a353e45e010b19350715f2cd1`, WI-504 worktree, and Example Marketplace Port WI-496 worktree/graph/files | coupled | WI-505 never applies/drops/rewrites the stash or touches WI-504; verify-promotion snapshots Example Marketplace graph/files before the sanctioned metadata-only replay and compares afterward |
| 7 | External SaaS | Remote branch, PR, review receipt, branch protection, and merge result | coupled | `land-changeset` sanctioned PR/review-receipt wrapper; no direct dirty-main edit or unreviewed merge |
| 12 | Downstream framework artifacts | `FRAMEWORK-STATE.md` and svc capability/authority documentation consumed by later sessions | coupled | Updated only after behavioral proof; final wording and proposal-done move are gated on installed live replay |
| 13 | CI/CD wires | Existing required receipt/check names relied on during PR; no workflow or required-check mutation | coupled | `land-changeset` verifies the existing receipt chain; any missing required check blocks merge |
| 15 | Runtime filesystem state | Bootstrap lock, claim/binding JSON, controller lease fixture state, installed replay ownership metadata | coupled | Secure owned dirs, atomic writes, `finally` lock cleanup, temp fixture trap, exact before/after replay inventory, generation-bound metadata retention |

Untouched environments (walked and found no created/mutated/relied-on state): 2, 4, 5, 6, 8, 9, 10, 11, 14. No ad-hoc environment class was found.

The Example Marketplace Port replay is intentionally decoupled from the implementation commit until after merge/install: changing live ownership with an unpromoted helper would make local code the authority. `verify-promotion` couples it to the promoted installed script by recording the resolved installed source, pre-state hashes, exact command/result, post-state hashes, and idempotent second call. A failure leaves the promoted change classified as not live-proven and triggers a corrective PR; it never authorizes deleting the existing worktree.

## 9. Simulation Report

| Task | Check | Disk / planned result | Status | Action |
|---|---|---|---|---|
| proc-1 | Fixture MODIFY target exists | `validate-default-checkout-isolation.sh` exists and already builds registered complete tuples | PASS | Extend one clearly named WI-505 section |
| proc-1 | Current public transition is genuinely red | Hermetic A/gen1 stale tuple exits with exact existing binding conflict while direct transfer succeeds | PASS | Preserve as red baseline |
| proc-2 | Store MODIFY target and primitives exist | `transferClaim`, `claimFreshness`, `readClaimAbsolute`, `atomicWriteJson`, binding path/read all present | PASS | Extend existing module, no dependency |
| proc-2 | Existing transfer caller set is bounded | `rg -n "transferClaim" scripts hooks test-framework/evals/tier-1` resolves only the ensure import/call, helper definition, and helper CLI dispatch | PASS | Preserve no-v2 compatibility and test v2 denial for both direct and public acquisition paths |
| proc-2 | Canonical v2 read exists | `authority-store.mjs` exports `repositoryId`, `authorityStateRoot`, `readController`; no import back to `wi-claim.mjs` | PASS | Static import has no cycle |
| proc-3 | Caller MODIFY target exists | `resumeExisting`, `activeBindingOwner`, `verifyCompleteTuple` signatures confirmed | PASS | Remove only coarse helper and replace foreign branch |
| proc-3 | Coarse helper is local-only | `rg -n "activeBindingOwner" scripts hooks test-framework/evals/tier-1` resolves only its definition and call inside `svc-ensure-worktree.mjs` | PASS | Remove without compatibility shim; any changed caller set invalidates this plan assumption |
| proc-3 | Final resolver is available | `authorityJson` already imported and used by `verifyCompleteTuple` | PASS | Keep postcondition unchanged |
| proc-4 | State/capability targets exist | Both tracked framework knowledge files exist | PASS | Update after green proof |
| proc-5 | Referenced framework validators exist | `scripts/task-graph.mjs`, `scripts/validate-task-graph-lane.mjs`, and `scripts/verify-file-persistence.sh` all resolve on disk; the lane validator and persistence verifier have already returned PASS in plan review | PASS | Invoke the checked-in paths exactly as reviewed |
| proc-1..3 | New package dependency | None; Node built-ins and existing local modules only | PASS | No install step |
| proc-1..5 | ORM/Base44 schema | No ORM, Base44, persistence, RLS, or database surface | N/A | No migration task |
| proc-1..5 | Browser/visual parity | No component, route, CSS, asset, or browser-visible state | N/A | UI/browser gates remain logged N/A |

### Scenario Coverage

| Journey | Scenario | Steps | Tasks | Coverage |
|---|---|---:|---|---|
| J-FW-05 S8 | Existing complete tuple and residue preservation | complete tuple, resume, preserve | proc-1..3 | 3/3 |
| J-FW-05 S9 | Concurrent acquisition | race, one winner, loser deny | proc-1..2 | 3/3 |
| J-FW-05 S10 | Exact binding | identity/path/generation validation | proc-1..3 | 3/3 |
| J-FW-05 S11 | Explicit migration only | v2 present, v1 no mutation | proc-1..3 | 2/2 |
| J-FW-05 S14 | Atomic generation handover | CAS, provenance, old denial, same-session no bump | proc-1..3 | 4/4 |

No unresolved FAIL, WARN, product question, capability blocker, dependency, or upstream contradiction remains.

## 10. Validation Plan

### Red/green task validation

```bash
# proc-1: after adding the fixture, current source must fail specifically at stale A -> B automatic reclaim.
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh

# proc-2/proc-3 syntax and focused transition.
rg -n "transferClaim" scripts hooks test-framework/evals/tier-1
rg -n "activeBindingOwner" scripts hooks test-framework/evals/tier-1
node --check hooks/lib/wi-claim.mjs
node --check scripts/svc-ensure-worktree.mjs
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
```

### Owner-required focused verification

```bash
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-controller-lease-handover.sh
bash test-framework/evals/tier-1/validate-operation-scope-authority.sh
bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
node --check scripts/svc-ensure-worktree.mjs
node --check hooks/lib/wi-claim.mjs
node --check hooks/lib/resolve-wi.mjs
bash test-framework/evals/run-all-evals.sh --tier1
```

### Plan/branch checks

```bash
bash scripts/verify-plan-mechanical.sh docs/plans/2026-07-21-wi505-stale-binding-reclaim/manifest.md
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-505.json
node scripts/lint-skills-manifest.mjs
git diff --check
bash scripts/verify-file-persistence.sh --from-git-status

# SR-13 advisory: surface suspicious additions for human/security disposition.
# The pre/post digest and Git-identity fixture is the authoritative safety gate.
git diff -U0 d2243795a73a2792e56675afdba5fb61eb15bdd5 -- \
  hooks/lib/wi-claim.mjs scripts/svc-ensure-worktree.mjs | \
  rg '^\+.*(rmSync|unlinkSync|worktree[[:space:]]+remove|break.?glass|impersonat)' || true
```

### Land-phase receipt verification and sanctioned merge

Run only inside `land-changeset`, after the reviewed commit is frozen and its PR exists. Derive both identifiers from current branch/remote state; never inherit them from a prior shell:

```bash
WI505_COMMIT_SHA="$(git rev-parse HEAD)"
test "$(git branch --show-current)" = "framework-WI-505-stale-binding-reclaim"
WI505_PR_NUMBER="$(gh pr list --head framework-WI-505-stale-binding-reclaim --state open --json number --jq '.[0].number')"
test -n "$WI505_COMMIT_SHA"
case "$WI505_PR_NUMBER" in (*[!0-9]*|'') exit 1 ;; esac
node scripts/check-chain-receipts.mjs --sha "$WI505_COMMIT_SHA"
node scripts/merge-pr-with-review-receipt.mjs --pr "$WI505_PR_NUMBER" --squash --delete-branch
```

### Promoted installed replay

This is intentionally an owner-machine-only acceptance replay against the exact Example Marketplace tuple named in the user report, not a portable CI command. From `/home/svc-user/app-workspaces/example-marketplace`, record `pwd -P`, `realpath /workspace/seriousvibecoding/scripts/svc-ensure-worktree.mjs`, and that script's SHA-256 after promoted install. Before mutation, use the promoted `readSessionBinding`/`readClaimAbsolute`/`claimFreshness` exports to assert and record the old session `019f7d76-65f3-73d0-9dd8-46379d081e21`, claim generation 1, exact WI/worktree/branch/path coordinates, and positive stale evidence. If this live precondition has drifted, SR-15 is blocked and must be reported to the owner; a hermetic substitute cannot satisfy the owner-required promoted live replay. Only after that guard passes, run the owner-mandated command byte-for-byte:

```bash
node /workspace/seriousvibecoding/scripts/svc-ensure-worktree.mjs \
  --wi WI-496 \
  --branch wi-496-native-splash-transition \
  --from 939f0321d6fa80edbed45f8415f12f408f4644fb \
  --json --print-cd
```

Require exit 0, current Codex thread ownership, generation 1→2 exactly once, `created=false`, `resumed=true`, old-session non-authority, unchanged graph/user files outside sanctioned ownership metadata, and an idempotent second call at generation 2.

## Execution Command Sequence

```bash
# 1. Assert exact sanctioned territory and baton; never recreate or switch worktrees.
test "$(git branch --show-current)" = "framework-WI-505-stale-binding-reclaim"
test "$(git rev-parse HEAD)" = "d2243795a73a2792e56675afdba5fb61eb15bdd5"
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-505.json
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-505.json

# 2. proc-1: use apply_patch to add the full hermetic fixture matrix, then prove
# the existing automatic stale A->B transition red with the reproduced conflict.
# Do not commit at any point in this intentional red window. The proc-1/proc-2
# checkpoints are logs and staged-diff hashes only; the first commit-eligible
# tree is after proc-3 makes this always-run Tier-1 fixture green.
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
# RECOVERY_IF_FAIL: distinguish the expected new WI-505 red assertion from any
# pre-existing fixture failure. Patch only the fixture setup/assertion; do not weaken it.

# 3. proc-2: record the transfer caller set, use apply_patch in wi-claim.mjs,
# then parse and run the inline helper-level cases in the focused fixture.
rg -n "transferClaim" scripts hooks test-framework/evals/tier-1
node --check hooks/lib/wi-claim.mjs
# RECOVERY_IF_FAIL: patch forward under the existing claim lock and preserve direct CLI compatibility.

# 4. proc-3: record that activeBindingOwner is local-only, use apply_patch in
# svc-ensure-worktree.mjs, then run the public fixture twice.
rg -n "activeBindingOwner" scripts hooks test-framework/evals/tier-1
node --check scripts/svc-ensure-worktree.mjs
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
# RECOVERY_IF_FAIL: patch forward in the WI-505 worktree. Never reset, delete a
# worktree, claim, binding, graph, tracked, untracked, or ignored test/user file.

# 5. proc-4: update state/capability/WI language to the exact proof level reached.
node scripts/lint-skills-manifest.mjs

# 6. proc-5: focused suite, syntax, full Tier-1, persistence, and branch audit.
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-default-checkout-isolation.sh
bash test-framework/evals/tier-1/validate-controller-lease-handover.sh
bash test-framework/evals/tier-1/validate-operation-scope-authority.sh
bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
node --check scripts/svc-ensure-worktree.mjs
node --check hooks/lib/wi-claim.mjs
node --check hooks/lib/resolve-wi.mjs
bash test-framework/evals/run-all-evals.sh --tier1
git diff --check
bash scripts/verify-file-persistence.sh --from-git-status
git diff -U0 d2243795a73a2792e56675afdba5fb61eb15bdd5 -- \
  hooks/lib/wi-claim.mjs scripts/svc-ensure-worktree.mjs | \
  rg '^\+.*(rmSync|unlinkSync|worktree[[:space:]]+remove|break.?glass|impersonat)' || true

# 7. Freeze staged diff only after review-plan receipt is current. Run independent
# review-exec, review-security, and audit-implementation against that exact diff.
# RECOVERY_IF_FAIL: disposition findings, patch forward, invalidate stale receipts,
# rerun affected focused/full proof, and re-freeze. Do not return to plan review after implementation starts.

# 8. Commit/push/PR/merge only through land-changeset and its review-receipt path.
# Re-emit tree-bound git notes after any rebase.

# 9. On promoted main, refresh every provisioned host installation, rerun Tier-1,
# then snapshot and execute the exact Example Marketplace Port WI-496 replay and second call.
# RECOVERY_IF_FAIL: report implemented/merged/installed/live-replay states separately;
# use a corrective PR. Never repair the live tuple by deletion or break-glass.
```

## 12. Checkpoint and Rollback Plan

| Checkpoint | Rollback anchor | Recovery |
|---|---|---|
| `wi505-red-public-transition` | frozen failing assertion and current base SHA | Correct fixture only; preserve the exact reproduced conflict. Any forced checkpoint leaves the isolated worktree uncommitted, records `git status` plus a binary-diff SHA-256, and resumes in place; no stash, commit, push, or PR is permitted while red. |
| `wi505-authority-store` | pre-proc-2 branch diff | Patch forward or revert the uncommitted helper slice; no external state changed by hermetic tests. A forced checkpoint uses the same intact-worktree status/diff-hash evidence, never a commit or the repository-global stash. |
| `wi505-bootstrap-green` | focused fixture log + staged diff hash | Patch caller/store forward and rerun focused twice; never roll generation backward |
| `wi505-doc-state` | proof logs | Reword claims to actual proof level; do not mark promoted before replay |
| `wi505-exec-freeze` | frozen tree/staged hash and review receipts | Findings patch forward, invalidate/reissue receipts, rerun mapped tests |
| `wi505-promoted` | merge SHA, prior installed source, Example Marketplace pre-state hashes | Sanctioned revert/corrective PR and installed refresh; live ownership metadata remains generation-forward and auditable |

Whole-change rollback reverts runtime/test/docs as one reviewed commit. Existing tuples transferred by the promoted code remain schema-compatible current-generation claim-v1 tuples. Rollback never decrements generation, restores an old owner, deletes authority state, mutates controller leases, or discards user files.

## 13. Promotion Readiness Checklist

- [ ] SR-01..SR-15 each map to an implementation task and exactly one test tier.
- [ ] Current source proves the new public stale A→B assertion red before runtime edits.
- [ ] Exact shared tuple inspector and locked transfer semantics match the baselined design.
- [ ] Fresh, mismatch, malformed, ambiguity, v2, and race negatives fail closed.
- [ ] Tracked, untracked, ignored, graph, worktree, branch, and commit preservation assertions pass.
- [ ] Same-session and transferred-winner replays do not bump generation.
- [ ] No claim/controller/graph/host schema, dependency, or implicit migration is introduced.
- [ ] Mechanical plan validation and adversarial review-plan have no unresolved HIGH/CRITICAL finding.
- [ ] Independent frozen-diff execution/security/implementation reviews pass or have explicit accepted dispositions.
- [ ] Owner-required focused validators and syntax checks pass.
- [ ] Full Tier-1 passes before commit, after commit, and on promoted installed source.
- [ ] Final branch diff contains only manifest-listed runtime/test/doc/state/orchestration artifacts.
- [ ] All provisioned host installations are current and drift-free.
- [ ] Original Example Marketplace Port WI-496 command succeeds at generation 2 with current owner and in-place resume.
- [ ] Old owner is never authoritative; graph/user files are unchanged outside ownership metadata; second call is idempotent.
- [ ] Proposal moves to `proposals/done` and WI/state/capability status becomes verified only after live replay.
- [ ] Protected stash object and WI-504 worktree remain byte/object-identical and untouched.

## 14. Adversarial Self-Review

1. **Missing tasks:** PASS — SR-01..SR-15 and all five journey scenarios map to proc-1..5 plus mandatory lane review/land/verify tasks.
2. **Dependency correctness:** PASS — test-first proc-1 precedes store proc-2, caller proc-3, proof-bound docs proc-4, and freeze proc-5.
3. **Scope reduction:** PASS — the full owner matrix, full Tier-1, security/audit, installed refresh, and live replay remain mandatory.
4. **Validation strength:** PASS — helper cases prove CAS/negative rules; public Git fixture proves resume/data preservation; promoted replay proves installed behavior.
5. **First-task viability:** PASS — exact worktree/base/baton, existing fixture harness, current failure, and assertions are all named.
6. **Pattern-family completeness:** PASS — the plan covers every active unreleased-binding consumer classification; only the authority blocker changes, conservative non-granting consumers remain documented.
7. **Visual-rendering tier:** N/A — no UI or visual AC.
8. **Production mock parity:** N/A — no browser-visible MODIFY.
9. **Provider fidelity:** N/A — no provider/generated output.
10. **Persona trace:** N/A — system-only framework authority.

**Self-review result:** PASS. `review-plan` remains the mandatory independent adversarial gate before execution.

**Next:** `review-plan` must mechanically and adversarially review this simulated manifest before any runtime or fixture implementation begins.
