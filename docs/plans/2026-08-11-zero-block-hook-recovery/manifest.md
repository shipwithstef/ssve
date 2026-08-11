# WI-531 implementation manifest

**Spec:** `docs/specs/features/zero-block-hook-recovery.md`
**Status:** SIMULATED
**Branch:** `framework-WI-531-zero-block-hook-recovery`
**Base branch:** `origin/main`
**Base SHA:** `ac42091bc0015f87f9cdae50251570021d7c17fb`
**Created:** 2026-08-11
**Archetype:** architectural plus cross-cutting framework repair
**Lane:** framework
**Execution mode:** inline
**Phase B range:** WI-532 through WI-536, mechanically verified unused before allocation

## Implementation Summary

Remove authority UX deadlocks while retaining exact fail-closed mutation security. Prove reads before ownership checks; allow the canonical first-task loader as the sole atomic pre-task mutation; make same-owner worktree/controller recovery deterministic and bounded; canonicalize configured runtime scope; enforce manifest-exact hook topology; and make setup content-addressed and fast. The five child WIs then close every current Tier-1 failure/timeout by one-owner partition until the full suite is zero/zero.

Immutable constraints:

- Never disable hooks globally or weaken foreign/ambiguous mutation denial.
- Never ask the user for routine owner-recovery shell commands.
- Never change product HEAD/user files during metadata repair.
- Never rewrite unrelated host/plugin configuration.
- Never call synthetic fixture proof live product proof.
- Keep the eight host manifests and flat installed skill surface.

## Files Planned

| File set | Action | Task | Purpose |
|---|---|---|---|
| `hooks/codex/lib/codex-hook-context.mjs`, `hooks/codex/svc-codex-pretool-dispatcher.mjs`, `hooks/codex/svc-codex-skill-load-enforcer.mjs` | MODIFY | T1 | Read-first classification and atomic first-task routing |
| `hooks/lib/operation-scope.mjs`, `hooks/svc-session-start-healthcheck.mjs` | MODIFY | T2 | Canonical runtime scope, dangling-leaf containment, and trusted-evidence-only self-heal |
| `hooks/svc-worktree-isolation-guard.mjs`, `hooks/lib/wi-claim.mjs`, `hooks/lib/resolve-wi.mjs`, `hooks/lib/authority-store.mjs`, `scripts/svc-ensure-worktree.mjs`, `scripts/codex-load-skill.mjs` | REUSE/VERIFY | T3 | Existing WI-529/WI-530 same-owner repair, resume, lineage, ambiguity, containment, and crash recovery are preserved and replayed rather than rewritten |
| `setup`, `scripts/check-install-drift.sh` | MODIFY | T4 | Content-addressed, bounded-concurrency all-host provisioning, exact shared browse-surface rollback, and drift aggregation |
| `scripts/install-browse.sh` | MODIFY | T4 | Contain optional browse destinations; setup defers this shared add-on until after host commit |
| `scripts/review-plan-codex.sh`, `scripts/resolve-adversarial-reviewer.sh`, `scripts/review-topology-v2.mjs`, `skills/review-plan/SKILL.md`, `skills/review-exec/SKILL.md`, `test-framework/evals/tier-1/validate-persistent-review-contract-v2.mjs` | MODIFY | T8 | Adopt the external owner reviewer policy, bind plan review to its digest, and enforce different-family independent authority from the active host |
| `scripts/lib/normalize-ac-table.mjs`, `test-framework/evals/tier-1/validate-baton-ac-binding.sh` | MODIFY | T8 | Bind labeled work-item AC bullets to a non-empty revision-sensitive pipeline baton |
| `test-framework/evals/run-all-evals.sh` | MODIFY | T7 | Serialize the measured heavy receipt validator so full runs do not create contention-only timeouts |
| `scripts/svc-migrate-install.mjs`, `provision/hosts/` | REUSE/VERIFY | T4 | Existing transactional migration and eight host manifests are the unchanged denominator for setup/drift replay |
| focused `test-framework/evals/tier-1/validate-*` authority/setup fixtures | CREATE/MODIFY | T1-T4 | Regression, containment, crash, live-command, and performance proof |
| WI-531..WI-536 docs, INDEX, feature spec, plan/review/audit/verification artifacts | CREATE/MODIFY | T0,T8 | Governed plan, partition ledger, receipts, and closeout truth |
| `AGENTS.md` | MODIFY | T8 | Record current skill/host scale, zero-block authority UX, incremental provisioning, consolidated hook topology, and external reviewer policy |
| Current Tier-1 validator owners selected from the baseline | MODIFY | T5-T7 | Close partitions without hiding failures |

Inline execution omits duplicated code blueprints; the orchestrator retains the reviewed spec, manifest, current source, and exact baseline context.

## Upstream Skill Compliance

| Framework lane skill | Disposition | Evidence |
|---|---|---|
| `route-workflow` | completed | task 1 receipt in `.svc/lane-tasks-WI-531.json`; lane and delivery tier recorded in `.svc/route-workflow-self-verify.log` |
| `test-framework` | completed as the required denominator pass | `docs/plans/2026-08-11-zero-block-hook-recovery/tier1-baseline.md` records two full 305-validator runs and exact child ownership |
| `evolve-framework` | not activated | owner supplied and approved the concrete target behavior; this is correction/execution, not open-ended framework evolution |
| `blend-external` / `blend-private` | not activated | no external repository or private pattern ingestion is in scope |
| `improve-framework` | satisfied by the approved framework-improvement scope | WI-531 spec and this manifest are the bounded improvement contract; no separate proposal decision remains |
| `recall-stack-knowledge` | not activated | prior authority history was recovered from WI-524/WI-529/WI-530 and current source; no missing stack knowledge question remains |
| `plan-blast-radius` | integrated | Files Planned, External State, rollback anchors, host denominator, and child partition are the blast-radius artifact |
| `track-topology-diff` | conditionally active after implementation | T8 requires exact hook/host topology comparison before land |
| `refresh-competitors` | not activated | internal authority/provisioning correction has no market-competitor freshness dependency |

The executable mandatory chain is route → plan → review-plan → execute → review-gate → review-exec → audit → land → verify in `.svc/lane-tasks-WI-531.json`; `validate-task-graph-lane.mjs` reports no missing mandatory skill.

## Task Graph

| Task | Title | Dependencies | AC | Validation | Checkpoint |
|---|---|---|---|---|---|
| T0 | Materialize parent/children, exact baseline, and reviewable graph | none | AC-531-13 | plan mechanics, lane validation, exact baseline artifact | plan-reviewed |
| T1 | Prove reads first and activate the first task atomically | T0 | AC-531-1,2,7,11 | first-task, read corpus, no-WI read, microbenchmark | phase-a-read-activation |
| T2 | Canonicalize operation and configured runtime targets | T1 | AC-531-6,12 | invalid-target matrix and Lightning reset canary | phase-a-target-scope |
| T3 | Converge same-owner worktree/controller recovery | T1 | AC-531-3,4,5,7,12 | lineage, crash points, repeat bootstrap, Sample canary | phase-a-authority-recovery |
| T4 | Make hook topology exact and provisioning incremental | T1,T3 | AC-531-8,9,10,11 | all-host setup/drift, config preservation, no-op timing | phase-a-provisioning |
| T5 | Execute WI-532/WI-533 routing and receipt partitions | T1-T4 | AC-531-13 | owned validators and full-suite delta | phase-b-routing-receipts |
| T6 | Execute WI-534/WI-535 policy and authority partitions | T5 | AC-531-13 | owned validators and full-suite delta | phase-b-policy-authority |
| T7 | Execute WI-536 timeout/performance partition and zero baseline | T6 | AC-531-10,11,13 | repeated full Tier-1: 0 fail, 0 timeout | phase-b-zero-baseline |
| T8 | Exact-candidate review, audit, land, and canonical-main verification | T7 | AC-531-14,15 | chain receipts, governed merge, all-host and live canaries | verified |

## AC-to-Task Mapping

| AC | Tasks |
|---|---|
| AC-531-1 | T1 |
| AC-531-2 | T1 |
| AC-531-3 | T3 |
| AC-531-4 | T3 |
| AC-531-5 | T3 |
| AC-531-6 | T2 |
| AC-531-7 | T1,T3 |
| AC-531-8 | T4 |
| AC-531-9 | T4 |
| AC-531-10 | T4,T7 |
| AC-531-11 | T1,T4,T7 |
| AC-531-12 | T1,T2,T3,T8 |
| AC-531-13 | T0,T5,T6,T7 |
| AC-531-14 | T8 |
| AC-531-15 | T8 |

## AC-to-Test Mapping

| AC | Type | Proof |
|---|---|---|
| AC-531-1,2,7 | E2E | installed-dispatcher read and first-task fixtures plus unbound live command |
| AC-531-3,4,5 | E2E | controller/v1 lineage crash, repeat, ambiguity, foreign, symlink, and preserved-worktree fixtures |
| AC-531-6 | E2E | operation-scope target matrix and Lightning reset replay |
| AC-531-8 | E2E | host wirer/config preservation validators for all hook-capable manifests |
| AC-531-9,10,11 | E2E | byte-stable setup, all-host locking, native p50/p95 benchmark |
| AC-531-12 | Manual | real Sample, Lightning, and unbound-session canaries with command evidence |
| AC-531-13 | E2E | full Tier-1 summary with zero failures and zero timeouts |
| AC-531-14 | Manual | self, Sol, and configured AGY exact-digest review receipts |
| AC-531-15 | E2E | final-SHA chain, canonical-main setup/drift, repeat bootstrap, and live replays |

## Prerequisite Alignment Matrix

| Task | UX/UI | Technical design | Style/pattern | Persona/competitor |
|---|---|---|---|---|
| T0-T3 | N/A, terminal authority UX only | operation-scope, v1 claim, controller-v2 lease, task-graph atomic activation | dependency-free Node ESM; CAS/no-follow containment; structured JSON | P-operator: product builder continues without framework shell rituals |
| T4 | N/A | host manifests, governed wirers, effective config, digest/lock installer | portable Bash plus Node helpers; preserve unrelated bytes | P-framework-maintainer: all hosts converge predictably and quickly |
| T5-T7 | N/A | Tier-1 registry and validator ownership | first failing authoritative assertion assigns one owner | P-contributor: failures are actionable and non-duplicated |
| T8 | N/A | mandatory receipt chain and final-SHA installed/live evidence | exact candidate digest and governed squash merge | P-owner: implemented, installed, and live-proven stay distinct |

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | Installed skills, launcher materialization, enforcement state | coupled | `setup`, `scripts/check-install-drift.sh`, rollback snapshots in `scripts/svc-migrate-install.mjs` |
| 2 | Host config files | Effective Claude/Codex/Gemini/Kimi/OpenCode/MiMo configuration | coupled | manifest wirers, command-bound verification, byte-exact rollback |
| 3 | Out-of-tree version control | WI/product worktrees, branch, PR, final SHA | coupled | `svc-ensure-worktree`, `land-changeset`, final-SHA receipts, scoped cleanup |
| 6 | Running services | Existing Codex sessions cache loaded hooks | decoupled-justified | installed-command canary separates current-session state and verifies a new disposable session |
| 12 | Downstream framework artifacts | routing, task graph, receipts, manifests, skills, validators | coupled | manifest lint, focused validators, full Tier-1, receipt checker |
| 15 | Runtime filesystem state | locks, leases, migration intent/backup/receipt, setup digest cache | coupled | atomic writers, deterministic keys, retry/rollback validators, expiry/GC contract |
| ad-hoc: consumer runtime roots | Product `.svc` authority and configured DB/test paths used by live canaries | coupled | explicit worktree selection, runtime-scope validation, pre/post byte snapshots |
| ad-hoc: GitHub repository metadata | Repository description and topics, without visibility/default-branch changes | coupled | owner-authorized update after merge, followed by `gh repo view` readback |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 7, 8, 9, 10, 11, 13, 14.

Running sessions are intentionally decoupled because a host cannot safely rewrite an already loaded process hook table. Migration proves the installed effective command immediately and a newly started disposable Codex session before closeout.

## Simulation Report

| Claim | Scope and probe | Result |
|---|---|---|
| Parent/child IDs are free | tracked repository and active graph; `rg -n 'WI-53[1-6]'` before creation | PASS |
| Eight host manifests exist | `provision/hosts/` at base SHA, enumerated by `rg --files provision/hosts` | PASS: 8 |
| Read classification covers every agent read | live default-checkout/worktree command corpus | WARN: reproduced false mutation denial |
| First-task loader works from ensured worktree | exact repo-local and central `codex-load-skill` commands | WARN: central PASS, worktree DENY |
| Exact fresh v2 bootstrap is idempotent | repeated exact WI-531 ensure command | PASS |
| Full Tier-1 denominator | base SHA isolated worktree, full runner; exact list in `docs/plans/2026-08-11-zero-block-hook-recovery/tier1-baseline.md` | PASS denominator captured: run 1 = 22 fail/0 timeout, run 2 = 21 fail/0 timeout; variance owned by WI-536 |
| Product task depends on deploy | lane graph deploy-dependency checker | PASS: none |

Scenario walkthrough: J1 reproduces the worktree loader denial; J2-J4 are explicit live canaries after synthetic proof; J5 is measured before/after with byte hashes. No journey uses file presence as completion evidence.

## Validation Plan

- Run focused validators after each task and record exact command, exit, and output digest.
- Freeze Phase A before installed/live canaries; repair Critical/High findings and re-freeze.
- Classify every full-suite non-pass into WI-532..WI-536 exactly once.
- Rerun full Tier-1 after child merge-backs; completion requires zero failed and zero timed out.
- Run diff-check, manifest lint, pipeline integrity, all-host drift, chain receipts, and exact-candidate reviews.

## Execution Command Sequence

```bash
node /workspace/seriousvibecoding/scripts/svc-ensure-worktree.mjs --wi WI-531 --branch framework-WI-531-zero-block-hook-recovery --from origin/main --authority-v2 --json --print-cd
node /workspace/seriousvibecoding/scripts/codex-load-skill.mjs --graph /workspace/seriousvibecoding/.worktrees/framework-WI-531-zero-block-hook-recovery/.svc/lane-tasks-WI-531.json --task 2 --skill plan-changeset
bash scripts/verify-plan-mechanical.sh docs/plans/2026-08-11-zero-block-hook-recovery/manifest.md
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-WI-531.json
SVC_HOST=codex bash scripts/review-plan-codex.sh docs/plans/2026-08-11-zero-block-hook-recovery/manifest.md
bash test-framework/evals/tier-1/validate-codex-first-task-activation.sh
bash test-framework/evals/tier-1/validate-codex-session-rebinding.sh
bash test-framework/evals/tier-1/validate-operation-scope-authority.sh
bash test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh
bash test-framework/evals/tier-1/validate-all-host-setup.sh
bash test-framework/evals/run-all-evals.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
node scripts/check-chain-receipts.mjs --sha HEAD
git push -u origin framework-WI-531-zero-block-hook-recovery
PR_NUMBER="$(gh pr view framework-WI-531-zero-block-hook-recovery --json number --jq .number)"
node scripts/merge-pr-with-review-receipt.mjs --pr "$PR_NUMBER" --squash --delete-branch
./setup --all-hosts
bash scripts/check-install-drift.sh --all-hosts
```

RECOVERY_IF_FAIL: preserve the exact candidate branch/worktree and receipt evidence; revert only the failing task checkpoint, restore host config from the migration snapshot, and rerun the invalidated lens. Never reset the repository, delete protected residue, bypass hooks, or synthesize receipts.

## Checkpoint Plan

| Checkpoint | Rollback anchor |
|---|---|
| plan-reviewed | base SHA plus reviewed plan digest |
| phase-a-read-activation | previous checkpoint commit |
| phase-a-target-scope | previous checkpoint plus runtime pre-snapshot |
| phase-a-authority-recovery | previous checkpoint plus v1/v2 migration receipt |
| phase-a-provisioning | previous checkpoint plus all-host config snapshots |
| phase-b-routing-receipts | Phase A frozen commit |
| phase-b-policy-authority | prior Phase B checkpoint |
| phase-b-zero-baseline | prior Phase B checkpoint plus full-suite baseline |
| verified | final squash SHA and installed/live evidence |

## Promotion Readiness Checklist

- [ ] Mechanical plan and deploy-dependency checks pass.
- [ ] Independent plan review has zero unresolved Critical/High.
- [ ] Every changed file belongs to a manifest task and one child partition where applicable.
- [ ] Phase A focused fixtures and three live canaries pass.
- [ ] Full Tier-1 reports zero failures and zero timeouts.
- [ ] Read and provisioning p95 budgets pass without proof removal.
- [ ] Self, Sol, and configured AGY exact-candidate reviews pass.
- [ ] Mandatory receipt chain is schema-valid and bound to final SHA.
- [ ] Governed merge and canonical-main all-host setup/drift pass.
- [ ] Final repo/worktree/branch residue is classified and cleaned without touching unrelated state.

No ORM schema is modified; no database migration task is required.
