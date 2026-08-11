# WI-472 Changeset Manifest — Deterministic Bounded Reconcile

**Spec:** `docs/specs/work-items/WI-472.md`
**Branch:** `framework-WI-472-deterministic-bounded-reconcile`
**Status:** SIMULATED
**Base:** `origin/main` at `6b026ea9fbcee849e682d7aa47c3eec894512de3`
**Created:** 2026-07-21
**Archetype:** architectural change
**Execution mode:** inline
**Delivery tier:** full

## 1. Implementation Summary

Replace unbounded/per-SHA reconcile work with a bounded process adapter and one range validation, move auto-drive behind an atomic detached-job contract, and make watcher advancement contingent on complete durable evidence. Preserve the existing refuse/warn decision and locked legacy output projection.

Close the existing checkpoint backlog from a tracked 78-row portable ledger. Every row receives a distinct `retroactive-attestation` that records its immutable evidence and actual independent verdict without claiming historical phases ran. No waiver API is called.

### Load-bearing invariants

1. Refuse mode exits non-zero whenever any commit remains unaccounted.
2. Git notes are authoritative; a mirror-only envelope never counts as durable closure.
3. Every reconcile-owned child is bounded; timeout is evidence, not success.
4. Detached drive status is communicated only through an atomic outcome artifact.
5. Watcher cutoff never advances across an unknown/degraded drive window.
6. Historical repair is per SHA, hash-bound to the reviewed ledger/bundle, independently reviewed, and rollbackable.
7. WI-473's notes synchronization redesign remains out of scope.

## 2. Files Planned

| File | Action | Task | Purpose |
|---|---|---|---|
| scripts/lib/reconcile-core.mjs | CREATE | proc-1 | Pure timeout/result normalization, range parsing, drive-state paths, and watcher-advance predicate. |
| `.gitignore` | MODIFY | proc-1 | Classify `.svc/reconcile-drive/` as machine-local runtime state; durable authority remains notes plus tracked review evidence. |
| schemas/reconcile-drive-outcome.schema.json | CREATE | proc-1 | Durable terminal/running outcome contract with required schema/version, target SHA, PID, state, exit classification, timestamps, watcher cutoff, and diagnostic fields. |
| `scripts/svc-reconcile.mjs` | MODIFY | proc-2 | Bounded calls, batched Responsibility A, detached drive scheduling, strict checkpoint update. |
| `scripts/svc-auto-drive.mjs` | MODIFY | proc-2 | Accept lock/outcome paths and atomically publish terminal outcome in `finally`. |
| `hooks/git/pre-push.d/10-receipts-complete` | MODIFY | proc-3 | One `--range` receipt check per branch ref. |
| schemas/reconcile-backlog-review.schema.json | CREATE | proc-4 | Per-SHA independent-review approval contract bound to ledger and bundle hashes. |
| schemas/receipts/retroactive-attestation.schema.json | CREATE | proc-4 | Honest, tree-bound historical evidence receipt distinct from genuine phase receipts. |
| scripts/check-chain-receipts.mjs | MODIFY | proc-4 | Accept and visibly classify a valid reviewed attestation without reporting a genuine chain as complete. |
| scripts/reconcile-receipt-backlog.mjs | CREATE | proc-4 | Plan/validate/apply/rollback exact reviewed receipt repairs; no waiver path. |
| docs/specs/audit/wi-472-reconcile-backlog-bundle.json | CREATE | proc-4 | Exact hash-bound per-SHA attestation bases; contains no pre-baked verdicts or fabricated phase receipts. |
| docs/specs/reviews/wi-472-backlog-review.json | CREATE | proc-8/G6 | Independent per-row verdicts and evidence; never authored by the bundle-producing task/session. |
| test-framework/evals/tier-1/validate-svc-reconcile-golden.sh | CREATE | proc-5 | Five-state locked legacy projection plus batch/per-SHA equality. |
| test-framework/evals/tier-1/validate-svc-reconcile-legacy-binary.sh | CREATE | proc-5 | Execute the frozen old binary and new binary over the five locked states and compare canonical locked bytes. |
| test-framework/evals/tier-1/validate-retroactive-attestation.sh | CREATE | proc-5 | Prove a valid attestation is accepted distinctly and a wrong-tree attestation is rejected. |
| test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh | CREATE | proc-5 | Timeout completeness validator with prove-red mutation. |
| test-framework/evals/tier-1/validate-svc-reconcile-watcher-advance.sh | CREATE | proc-5 | Watcher strictness validator with prove-red mutation. |
| test-framework/evals/tier-1/validate-reconcile-backlog-review.sh | CREATE | proc-5 | Ledger/bundle/review coverage, hash binding, reviewer independence, zero-waiver, dry-run/apply safeguards. |
| `references/chain-receipt-contract.md` | MODIFY | proc-6 | Document drive outcome vs chain receipt and reviewed retroactive recovery. |
| `references/knowledge/svc/CAPABILITIES.md` | MODIFY | proc-6 | Record bounded deterministic reconcile capability. |
| `FRAMEWORK-STATE.md` | MODIFY | proc-6 | Record WI-472 analysis/decision after proof. |
| `docs/specs/test-evidence/WI-472/pre-post-validation.json` | CREATE | proc-5 | Machine-checked red/green corrective proof and baseline classification. |
| `docs/specs/work-items/WI-472.md` | PRESENT/FREEZE | planning | Authoritative RC-01..RC-10 child spec already produced in this planning run; execution verifies its hash and never recreates it. |
| `docs/specs/work-items/INDEX.md` | MODIFY | planning/closeout | Route WI-472 to its spec and update lifecycle. |
| `docs/specs/audit/wi-472-reconcile-backlog.json` | PRESENT/FREEZE | audit | Portable per-SHA backlog denominator already produced by the completed audit task; execution verifies its hash and never recreates it. |
| `proposals/2026-07-21-session-audit-wi-472-reconcile-backlog.md` | CREATE | audit | Execution-forensics report for backlog origin and recovery classes. |
| proposals/done/2026-07-21-framework-improvement-deterministic-bounded-reconcile.md | CREATE | closeout | Improve-framework implementation/replay record after promotion. |
| `.svc/lane-tasks-WI-472.json` | CREATE | orchestration | Durable task graph and phase receipts. |
| `.svc/session-contract.jsonl` | MODIFY | orchestration | End-to-end WI binding. |
| `.svc/pipeline-decisions.jsonl` | MODIFY | orchestration/review | Route, design, review, apply, land, and verify decisions. |

### 2a. Inline execution boundary

`mode:inline` is selected because the orchestrator that loaded the spec, audit ledger, current code, and this manifest will implement it. Per the plan-changeset contract, a duplicated changeset blueprint is intentionally omitted. The exact behavioral payload is constrained by RC-01..RC-10, task validation commands, schemas, and golden fixtures.

## 3. Task Graph

| Task | Title | Files | Depends on | AC coverage | Validation | Checkpoint |
|---|---|---|---|---|---|---|
| proc-1 | Define bounded reconcile state contracts | `scripts/lib/reconcile-core.mjs`, drive schema | reviewed plan | RC-01, RC-04, RC-05 | `node --check`; focused core fixtures | `wi472-core-contracts` |
| proc-2 | Rewire L3 reconcile and auto-drive | reconcile + auto-drive | proc-1 | RC-01, RC-02, RC-04, RC-05 | golden, bounded, watcher validators | `wi472-l3-runtime` |
| proc-3 | Batch L2 pre-push receipt validation | pre-push slot | proc-1 | RC-03 | hook fixture for new/existing/delete/notes refs | `wi472-l2-batch` |
| proc-4 | Build and validate reviewed backlog bundle | backlog schema/helper/bundle | proc-1 | RC-09, RC-10 | dry-run exact 78; schema/hash/coverage validator | `wi472-backlog-bundle` |
| proc-5 | Lock no-loss and mutation-red proof | four Tier-1 validators | proc-2..proc-4 | RC-02, RC-03, RC-05, RC-06, RC-07, RC-08, RC-09 | each self-test red then implementation green; injected hung-GitHub path completes within budget and preserves watcher | `wi472-proof-gates` |
| proc-6 | Synchronize doctrine and state | chain contract, capabilities, state | proc-2..proc-5 | RC-04, RC-09, RC-10 | manifest lint + relevant Tier-1 + full Tier-1 | `wi472-doc-state` |
| proc-7 | Freeze exact implementation and bundle | all planned branch files | proc-1..proc-6 | RC-01..RC-10 | full Tier-1; branch diff audit | `wi472-exec-freeze` |
| proc-8 | Independent G6 and backlog-row review | review artifact | proc-7 | RC-06, RC-08, RC-09 | review-exec verdict PASS; 78/78 row decisions; reviewer principal/run differs from bundle producer | `wi472-g6` |
| proc-9 | Apply reviewed notes bundle with rollback anchor | notes ref external state | proc-8 | RC-09, RC-10 | portable range check from main and fresh worktree = zero | `wi472-notes-apply` |
| proc-10 | Audit, land, and promote | receipts/PR/main | proc-9 | RC-01..RC-10 | audit PASS; sanctioned merge; nearest-rank p95 over five live preflights (the maximum) below 10s; degraded path | `wi472-promoted` |

Tasks 1-7 execute serially in the one sanctioned worktree. No code-writing fan-out is used. Task 9 is delayed until after independent review so external notes state never gets ahead of its reviewer.

## 4. Backlog Review and Mutation Protocol

### 4.1 Immutable inputs and denominators

- checkpoint: `985a8d5de2255288daaacda91c739e294b8a67d5`
- audited `origin/main`: `6b026ea9fbcee849e682d7aa47c3eec894512de3`
- portable unresolved denominator: 78
- ledger SHA-256 of record: `5b71bdf66c7a5076a819c2e7c387d4ce924826e4ad53b547454560667868ffb6`; proc-4 recomputes it, requires exact equality, and embeds only this verified value in bundle/review
- current spec SHA-256: `b5141797250fe313a814be8f487a2c1b88bd7fca1609de6a417740992957309d` (the G6 correction and pre-landing `PROMOTED` lifecycle flip leave RC-01..RC-10 and their normalized AC digest unchanged)
- frozen audit-ledger SHA-256: `5b71bdf66c7a5076a819c2e7c387d4ce924826e4ad53b547454560667868ffb6`

Execution begins by asserting `git merge-base --is-ancestor 985a8d5de2255288daaacda91c739e294b8a67d5 6b026ea9fbcee849e682d7aa47c3eec894512de3`, recomputing both frozen hashes, and refusing on ancestry or hash drift. An intentional spec or ledger revision requires a new plan hash and a new review round; execution never overwrites either file.

Every historical repair and parity check uses the immutable range `985a8d5de2255288daaacda91c739e294b8a67d5..6b026ea9fbcee849e682d7aa47c3eec894512de3`. A moving `origin/main` ref is forbidden after this point. Post-merge verification checks the WI-472 merge commit separately over `6b026ea9fbcee849e682d7aa47c3eec894512de3..<WI-472-merge-sha>`; it never folds the new commit into or changes the 78-row historical denominator.

### 4.2 Allowed per-row dispositions

| Disposition | Count at plan time | Required proof before bundle inclusion |
|---|---:|---|
| `promote_valid_main_mirror` | 6 | Default-checkout mirror envelope passes target-SHA validation; envelope hash stored; no note exists. |
| `copy_tree_equivalent_reviewed_envelope` | 27 candidates | Source envelope passes schema; source/target trees are identical; first-parent normalized patches are equivalent; intent transfer is justified per row; all hashes stored. Any candidate failing patch or intent equivalence is promoted to `retroactive_evidence_review`, never copied. |
| `reissue_mechanically_eligible_quick_fix` | 8 | `quick-fix-eligibility.mjs --sha <target>` classifies the target commit against its own parent and exits with `eligible:true`; receipt records parent SHA, per-file classification, exact target tree/files/counts. |
| `retroactive_evidence_review` | 37 | Bundle contains target tree/diff hash, changed files, and PR/artifact evidence; reviewer emits a per-SHA approve/reject verdict. No phase receipt is synthesized. |

The candidate counts may change after proof recomputation, but the denominator may not shrink and no row may change to a weaker disposition. A tree-identical candidate that lacks parent-diff or intent equivalence becomes a fully retroactive-reviewed row. The helper recomputes proof at plan/apply time rather than trusting ledger strings.

### 4.3 Review artifact

docs/specs/reviews/wi-472-backlog-review.json must contain:

- exact ledger and bundle SHA-256 values;
- reviewer host/family and review-exec run reference;
- bundle producer session/run reference; the validator requires the reviewer principal and review-exec run to differ from the producer and fails closed when either identity is absent or equal;
- exactly 78 unique target SHA rows;
- per row: disposition, evidence checked, verdict `approve|reject`, and finding IDs;
- for an envelope transfer: explicit tree, first-parent patch, and intent-equivalence certification;
- global `zero_waivers_verified:true` and `verdict:pass` only when all 78 rows approve.

Any reject blocks apply. There is no partial checkpoint advance and no conversion to waiver.

### 4.4 Apply and rollback

Before notes mutation, create a namespaced backup ref exactly once and record its object ID in an apply receipt. Re-entry must never overwrite it: if the backup already exists, the helper verifies it still equals the recorded original or refuses until explicit `--rollback` restores the backup. Apply one review-derived attestation into each existing note envelope, run the real checker for all 78 SHAs, then leave the backup until post-merge verification. On failure, atomically restore the original notes ref. Remote notes synchronization remains the current sanctioned mechanism; WI-473 owns replacing its concurrency behavior.

### 4.5 G6 corrective deviation

The first execution review rejected preconstructed five-receipt historical envelopes as dishonest. WI472-F1/F2 were accepted: the implementation now uses `retroactive-attestation-v1`, derives its verdict only during apply from 78 explicit cross-family review certifications, and surfaces the checker result as `retroactive-attestation` rather than `complete`. WI472-F3/F5 are closed by exact target-tree binding plus validation through the real checker. WI472-F4 is closed by running the frozen base binary against the new binary for all five states. WI472-F6 adds stale-lock reclamation and sole child ownership of terminal outcomes. WI472-F7 is closed by the frozen-range `--compare-range` execution. This is an execution-review correction, not a return to plan review.

## 5. AC-to-Task Mapping

| AC | Tasks |
|---|---|
| RC-01 | proc-1, proc-2, proc-5 |
| RC-02 | proc-2, proc-5 |
| RC-03 | proc-3, proc-5 |
| RC-04 | proc-1, proc-2, proc-5 |
| RC-05 | proc-1, proc-2, proc-5 |
| RC-06 | proc-2, proc-5, proc-8 |
| RC-07 | proc-5, proc-10 |
| RC-08 | proc-5, proc-8 |
| RC-09 | proc-4, proc-8, proc-9, proc-10 |
| RC-10 | proc-9, proc-10 |

## 6. AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| RC-01 | Unit/Tier-1 | bounded validator enumerates every child call; timeout mutation must fail |
| RC-02 | Unit/Tier-1 | fixture compares sorted per-SHA vs one-range missing sets |
| RC-03 | Unit/Tier-1 | pre-push protocol fixture asserts one validator call per branch ref and unchanged verdicts |
| RC-04 | Unit/Tier-1 | duplicate schedule fixture observes one lock/job and atomic terminal outcome |
| RC-05 | Unit/Tier-1 | state matrix and loosened-predicate mutation |
| RC-06 | Golden | byte comparison of legacy projection across five states |
| RC-07 | Tier-1 + Runtime | pre-merge injected hung-GitHub fixture proves bounded completion/watcher preservation; five live promoted preflights remain an additive smoke |
| RC-08 | Mutation | both validators execute their own known-bad mutation before source green |
| RC-09 | Integration | 78-row bundle/review/apply coverage, zero waiver-ledger delta, notes range green |
| RC-10 | Integration | default checkout and newly created disposable worktree report identical zero set |

## Prerequisite Alignment Matrix

| Task | UX | UI | Technical design | Style | Persona / differentiation |
|---|---|---|---|---|---|
| tasks 1-3 | N/A CLI-only | N/A | WI-472 Locked design + approved P1 packet | existing `.mjs`/portable Bash conventions | N/A internal framework enforcement |
| proc-4 | N/A ledger/operator evidence | N/A | WI-472 Evidence and review boundary | JSON schema + atomic state writers | N/A internal governance |
| proc-5 | N/A deterministic diagnostics | N/A | WI-463 no-loss pattern | Tier-1 self-test conventions | N/A |
| tasks 6-10 | N/A | N/A | chain receipt contract + task graph | framework markdown/state conventions | N/A |

## Lane Compliance

| Skill / gate | Disposition | Evidence |
|---|---|---|
| `route-workflow` | completed | `.svc/lane-tasks-WI-472.json` lane task whose `skill` is `route-workflow`; `.svc/pipeline-decisions.jsonl:769` |
| `audit-session-execution` | completed mandatory retroactive insert | `proposals/2026-07-21-session-audit-wi-472-reconcile-backlog.md`; machine ledger; `.svc/lane-tasks-WI-472.json` lane task whose `skill` is `audit-session-execution` |
| `write-spec` | satisfied by reviewed existing packet and frozen child spec | `docs/specs/work-items/WI-471.md:14`, `docs/specs/work-items/WI-472.md`; delivery-graph skip ledger in `.svc/lane-tasks-WI-472.json` |
| `design-tech` | satisfied by prior reviewed design | `docs/analysis/framework-3x-proposals-2026-07-06.md:14`; judge verdict at line 52; explicit delivery-graph skip ledger |
| `explore-solutions` | satisfied by prior multi-lens selection | `docs/analysis/framework-3x-proposals-2026-07-06.md:3-8,52`; explicit delivery-graph skip ledger |
| `improve-framework` | required close-loop after replay | lane task whose `skill` is `improve-framework` is blocked by the `verify-promotion` lane task so it cannot claim replay early |
| `plan-changeset` | completed before this review | this manifest + `.svc/lane-tasks-WI-472.json` lane task whose `skill` is `plan-changeset` |
| `review-plan` | active blocker | lane task whose `skill` is `review-plan`; the `execute-changeset` lane task remains blocked |
| `execute-changeset` → `review-exec` → `audit-implementation` → `land-changeset` → `verify-promotion` | mandatory pending chain | named lane-task nodes in `.svc/lane-tasks-WI-472.json` have strict blockers and no skip path |

## 7. External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 3 | Out-of-tree version-controlled | `refs/notes/svc-receipts`, default checkout mirror, other worktrees reading the same note ref | coupled | backlog helper records/validates exact notes-ref backup, applies only G6-hash-bound bundle, and supports atomic rollback; cross-worktree parity test |
| 7 | External SaaS | bounded `gh auth status/switch`, merged PR query, eventual PR merge | coupled | before switching, atomically record the original active account in a `gh-auth-restore.json` recovery record under the runtime-state directory; startup restores any stranded prior identity before new work; `finally` restores and removes the recovery record only after confirmation; land-changeset owns PR lifecycle |
| 15 | Runtime filesystem state | .svc/reconcile-checkpoint.json, per-SHA drive lock/outcome/log files | coupled | atomic writers, schema validator, stale-lock rule, terminal outcome retention, cleanup after verified watcher advance |

Untouched environments (walked and found no state): 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14. Environment 12 documentation changes are repository artifacts, not downstream contract mutations; no skill frontmatter/manifest arrays change.

The notes ref is intentionally external to the branch commit. Decoupling is not accepted: task-9 requires the exact reviewed bundle hash, emits a backup/apply record, and task-10 verifies notes from both default checkout and a fresh worktree before the backup is eligible for deletion.

## 8. Simulation Report

| Check | Disk / planned result | Status |
|---|---|---|
| `scripts/svc-reconcile.mjs` exists and owns every target call | `execSync`/`spawnSync` sites and checkpoint write confirmed | PASS |
| `check-chain-receipts.mjs --range` exists | parser and range result confirmed | PASS |
| pre-push slot exists and loops per SHA | exact target confirmed | PASS |
| auto-drive has a terminal verdict and note merge path | current synchronous implementation confirmed | PASS |
| checkpoint is local runtime state | main checkout file exists; worktree absence reproduced | PASS |
| notes vs mirror inconsistency is real | portable 78 vs main 72 reproduced | PASS |
| backlog rows have unique target SHAs | JSON ledger length 78; uniqueness checked by validator task | PASS |
| create targets absent | core helper, schemas, backlog helper, focused validators absent | PASS |
| modify targets present | all three runtime targets and docs present | PASS |
| imports remain dependency-free | Node built-ins and existing state helpers only | PASS |
| ORM/Base44 schema | no ORM/Base44 surface | N/A |
| visual/browser parity | no browser-visible surface | N/A |

No unresolved FAIL or product question remains. The only execution-time uncertainty is whether all 37 retroactive rows survive independent evidence review; a rejection is a designed fail-closed stop, not permission to narrow scope.

## 9. Validation Plan

Task-level:

```bash
node --check scripts/lib/reconcile-core.mjs
node --check scripts/svc-reconcile.mjs
node --check scripts/svc-auto-drive.mjs
node --check scripts/reconcile-receipt-backlog.mjs
bash -n hooks/git/pre-push.d/10-receipts-complete
bash test-framework/evals/tier-1/validate-svc-reconcile-golden.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-watcher-advance.sh
bash test-framework/evals/tier-1/validate-reconcile-backlog-review.sh
node scripts/reconcile-receipt-backlog.mjs --ledger docs/specs/audit/wi-472-reconcile-backlog.json --bundle docs/specs/audit/wi-472-reconcile-backlog-bundle.json --dry-run
```

Branch-level:

```bash
node scripts/lint-skills-manifest.mjs
bash test-framework/evals/run-all-evals.sh
node scripts/check-chain-receipts.mjs --range 985a8d5de2255288daaacda91c739e294b8a67d5..6b026ea9fbcee849e682d7aa47c3eec894512de3
node scripts/validate-capability-blocker-ledger.mjs --ledger .svc/capability-blockers.jsonl
```

Promoted runtime:

```bash
node scripts/svc-reconcile.mjs
# repeat 5 times; nearest-rank p95 uses rank ceil(0.95 * 5) = 5,
# therefore require max(all five durations) < 10s
# pre-merge Tier-1 already proved an injected gh hang completes < 20s with watcher unchanged
# repeat 5 promoted live preflights as additive runtime evidence
# run identical portable range check from default checkout and fresh disposable worktree
```

## Execution Command Sequence

```bash
# 1. Assert sanctioned territory; do not recreate it.
test "$(git branch --show-current)" = "framework-WI-472-deterministic-bounded-reconcile"
node scripts/task-graph.mjs validate .svc/lane-tasks-WI-472.json
git merge-base --is-ancestor 985a8d5de2255288daaacda91c739e294b8a67d5 6b026ea9fbcee849e682d7aa47c3eec894512de3
test "$(sha256sum docs/specs/work-items/WI-472.md | cut -d' ' -f1)" = "1279e4fca59e0a05e1d9e6e8b1a1598e9c2c0c04818146739cece5a3e5db2ac1"
test "$(sha256sum docs/specs/audit/wi-472-reconcile-backlog.json | cut -d' ' -f1)" = "5b71bdf66c7a5076a819c2e7c387d4ce924826e4ad53b547454560667868ffb6"

# 2. Implement tasks 1-6 with apply_patch; validate after each checkpoint.
node --check scripts/lib/reconcile-core.mjs
node --check scripts/svc-reconcile.mjs
node --check scripts/svc-auto-drive.mjs
bash -n hooks/git/pre-push.d/10-receipts-complete

# RECOVERY_IF_FAIL: patch forward inside this worktree. Do not reset or touch sibling worktrees.

# 3. Generate exact bundle without notes mutation.
node scripts/reconcile-receipt-backlog.mjs \
  --ledger docs/specs/audit/wi-472-reconcile-backlog.json \
  --bundle docs/specs/audit/wi-472-reconcile-backlog-bundle.json \
  --plan

# 4. Run proof gates and full Tier 1.
bash test-framework/evals/tier-1/validate-svc-reconcile-golden.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-bounded.sh
bash test-framework/evals/tier-1/validate-svc-reconcile-watcher-advance.sh
bash test-framework/evals/tier-1/validate-reconcile-backlog-review.sh
# validate-svc-reconcile-watcher-advance includes a deterministic hung-gh stub:
# completion within timeout budget and byte-identical watcher value.
bash test-framework/evals/run-all-evals.sh

# 5. Commit/freeze only after plan receipt and implementation receipt are staged.
git diff --check

# 6. A separate canonical external-review invocation (not the bundle authoring process)
# independently reviews branch diff AND exact backlog bundle; proc-8 exclusively emits
# the per-row review artifact. The review validator rejects absent or equal producer/reviewer
# principals and run identifiers.
# RECOVERY_IF_FAIL: patch findings, regenerate bundle/hash, invalidate stale review, rerun G6.

# 7. After G6 PASS and audit PASS, apply the exact hash-bound bundle locally.
node scripts/reconcile-receipt-backlog.mjs \
  --ledger docs/specs/audit/wi-472-reconcile-backlog.json \
  --bundle docs/specs/audit/wi-472-reconcile-backlog-bundle.json \
  --review docs/specs/reviews/wi-472-backlog-review.json \
  --apply

# RECOVERY_IF_FAIL: never rerun over a new backup. The helper resumes only when the
# write-once backup ref still equals the apply receipt; otherwise use --rollback first,
# then prove the original notes ref restored.

# 8. Land only through land-changeset sanctioned merge wrapper; sync notes using the current sanctioned mechanism.
# 9. Verify on promoted main, run five timed preflights, degraded hang, and cross-worktree parity.
```

## 10. Checkpoint and Rollback Plan

| Checkpoint | Rollback anchor | Recovery |
|---|---|---|
| `wi472-core-contracts` | branch parent | revert helper/schema commit |
| `wi472-l3-runtime` | prior checkpoint | revert reconcile/auto-drive commit; no external job launched by tests |
| `wi472-l2-batch` | prior checkpoint | revert hook slot |
| `wi472-backlog-bundle` | ledger + bundle hashes | regenerate before review; no notes mutation |
| `wi472-exec-freeze` | frozen branch SHA/tree | findings patch forward and re-freeze |
| `wi472-notes-apply` | write-once backup notes ref + apply receipt object ID | idempotent exact-hash resume or mandatory `--rollback <backup-ref>`; backup overwrite is refused |
| `wi472-promoted` | merge SHA + retained notes backup | sanctioned revert PR plus notes rollback if promotion fails |

No command uses `git reset --hard`, forced branch push, or blanket note overwrite. Notes mutation is exact per target SHA and retains the pre-apply ref.

## 11. Promotion Readiness Checklist

- [ ] RC-01..RC-10 all map to task and proof.
- [ ] Plan review verdict passes with no HIGH/CRITICAL residual.
- [ ] Every planned source/test/schema/doc file exists and is substantive.
- [ ] Five golden states pass byte-identical legacy projection.
- [ ] Timeout and watcher validators each prove red then green.
- [ ] Bundle contains 78 unique rows and zero waiver disposition.
- [ ] G6 review artifact contains 78 unique approve verdicts, matching hashes, and mechanically distinct producer/reviewer principals and run IDs.
- [ ] Notes backup exists before apply and rollback is dry-run proven.
- [ ] Portable pinned historical range is zero-unaccounted after apply.
- [ ] WI-472 merge commit envelope is checked separately from the historical range.
- [ ] Full Tier 1 passes before commit and after commit.
- [ ] Sanctioned PR merge completes; remote notes synchronized.
- [ ] Promoted main passes nearest-rank p95 over five preflights (exactly the maximum) below 10s, degraded hang, and cross-worktree parity.
- [ ] Final worktree/main status and leftover disposition are explicit.

## Adversarial Review History

Round 1 used the canonical Codex-orchestrated tuple `claude/anthropic/claude-opus-4-8/high` and returned rubric 6 with 8 findings. All were accepted and applied; detailed symmetric responses are persisted at `docs/plans/2026-07-21-wi472-deterministic-bounded-reconcile/review-round-1-responses.yaml`.

| Finding | Applied resolution |
|---|---|
| F-001 High | Historical denominator pinned to checkpoint..`6b026ea9`; WI-472 merge commit checked separately. |
| F-002 High | Notes backup is write-once; resume verifies object ID or requires rollback. |
| F-003 High | Hung-GitHub bounded/watcher proof moved into pre-merge Tier-1; promoted p95 remains additive. |
| F-004 Medium | Backlog review artifact belongs exclusively to task-8 separate canonical review. |
| F-005 Medium | Envelope transfer requires tree + first-parent patch + intent equivalence; otherwise full retroactive review. |
| F-006 Medium | Existing spec/ledger are PRESENT/FREEZE with exact SHA-256 preconditions. |
| F-007 Medium | Exact lane-compliance artifact/decision citations added. |
| F-008 Low | Quick-fix reissue binds target parent SHA and per-file classification. |

Round 2 used the same canonical tuple and returned rubric 7 with no Critical/High findings and seven Medium/Low refinements. All were accepted and applied; symmetric responses are persisted at `docs/plans/2026-07-21-wi472-deterministic-bounded-reconcile/review-round-2-responses.yaml`. The plan review is terminal after this infrastructure round because the round-cap policy requires another round only for Critical/High findings.

| Finding | Applied resolution |
|---|---|
| F-001 Medium | Process nodes are namespaced `proc-*`; lane nodes are cited by skill name. |
| F-002 Medium | Proc-4 must equal-check the frozen ledger hash before embedding it. |
| F-003 Medium | Review validation mechanically rejects equal or missing producer/reviewer identities and runs. |
| F-004 Medium | Five-sample p95 is nearest-rank and exactly the maximum. |
| F-005 Low | Frozen checkpoint ancestry is a refusing precondition. |
| F-006 Low | GitHub auth switching has a durable crash-recovery record and startup reconciliation. |
| F-007 Low | The drive-outcome field contract is enumerated before execution. |

Execution metadata correction: the repository metadata validator requires the
exact `## Affected Files` heading. The frozen child spec was corrected from the
semantically equivalent `## Affected surfaces` heading, producing the updated
full-file hash above. The normalized AC-table digest remains
`476aff71f9ebe4c669f58b6c3cbf396d7da7620b1506dd9bdb7f3073465de5be`;
no requirement, task, external-state rule, or implementation choice changed.
Per the execution phase boundary, this mechanical metadata-only adjustment is
included in the single finished-diff G6 review rather than reopening plan review.
The execute-changeset evidence contract also added the machine-checked
`docs/specs/test-evidence/WI-472/pre-post-validation.json`; it records the
already-planned TDD red/green commands and does not expand product scope.
