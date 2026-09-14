# WI-FW-HOOKS-SAFETY-01 Changeset: Self-healing tool-hook safety

- **Spec:** `docs/specs/work-items/WI-FW-HOOKS-SAFETY-01.md`
- **Approved source design:** `/home/user/app-workspaces/example-marketplace-worktrees/wt-lane-fw-hooks-safety/docs/specs/plans/wi-framework-hooks-safety-plan.md`
- **Branch:** `feat/wi-fw-hooks-safety`
- **Lane:** framework
- **Execution mode:** inline
- **Planning base:** `494f074`
- **Status:** READY_FOR_REVIEW

## Implementation Summary

Introduce one typed pre-tool decision engine with thin host translation, a
literal Git-ref validator, argv round-trip normalization, exact existing-
worktree adoption, generation-aware v2 lease renewal, and replay-safe pre/post
correlation. Preserve default-checkout, foreign-owner, cross-root, no-follow,
and mixed-command fail-closed controls.

## Files Planned

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | CREATE/MODIFY | hooks/lib/literal-branch.mjs; `hooks/codex/lib/bootstrap-command.mjs`; `scripts/svc-ensure-worktree.mjs`; test-framework/evals/tier-1/validate-literal-branch-worktree.sh | Git-valid refs and path-independent worktree identity |
| T02 | CREATE/MODIFY | hooks/codex/lib/argv-encode.mjs; `hooks/codex/lib/codex-hook-context.mjs`; hooks/lib/pretool-decision-engine.mjs; `hooks/codex/svc-codex-pretool-dispatcher.mjs`; `test-framework/evals/tier-1/validate-codex-zero-block-reads.sh`; test-framework/evals/tier-1/validate-pretool-decision-engine.sh | one proof-based observation decision and safe Git normalization |
| T03 | MODIFY | `hooks/codex/svc-codex-prompt-authority.mjs`; `scripts/svc-ensure-worktree.mjs`; `hooks/lib/pretool-decision-engine.mjs`; `test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh` | fresh-intent exact adoption without takeover |
| T04 | CREATE/MODIFY | `hooks/lib/authority-store.mjs`; hooks/lib/tool-call-receipt.mjs; hooks/codex/svc-codex-posttool-heartbeat.mjs; hooks/lib/pretool-decision-engine.mjs; `test-framework/evals/tier-1/validate-controller-lease-handover.sh`; test-framework/evals/tier-1/validate-tool-call-heartbeat.sh | threshold renewal and replay-safe post-tool heartbeat |
| T05 | MODIFY | `scripts/review-plan-codex.sh`; `scripts/wire-codex-hooks.mjs`; `scripts/wire-hooks.mjs`; `hooks/hooks.json`; `hooks/hook-coverage-spec.md`; `test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh`; `test-framework/evals/tier-1/validate-cross-host-hook-firing-parity.sh`; `test-framework/evals/tier-1/validate-settings-no-duplicate-hooks.sh` | namespaced-WI review compatibility, one deny-capable policy path, and installed parity |
| T06 | CREATE/MODIFY | `docs/specs/work-items/WI-FW-HOOKS-SAFETY-01.md`; `docs/plans/2026-08-25-wi-fw-hooks-safety/manifest.md`; docs/plans/2026-08-25-wi-fw-hooks-safety/plan-contract.json; docs/plans/2026-08-25-wi-fw-hooks-safety/review-log.yaml; docs/specs/reviews/wi-fw-hooks-safety-exec-cross-model.md; docs/specs/audit/wi-fw-hooks-safety-analysis.md; `.svc/lane-tasks-WI-FW-HOOKS-SAFETY-01.json`; `FRAMEWORK-STATE.md` | durable plan, review, audit, state, and closeout evidence |

## Task Graph

```json
{"tasks":[
  {"id":"T01","title":"Literal branch and worktree identity","blocked_by":[]},
  {"id":"T02","title":"Unified observation decision","blocked_by":["T01"]},
  {"id":"T03","title":"Exact existing-worktree self-heal","blocked_by":["T01","T02"]},
  {"id":"T04","title":"Bounded lease continuity and post correlation","blocked_by":["T02","T03"]},
  {"id":"T05","title":"Cross-host wiring and install parity","blocked_by":["T02","T04"]},
  {"id":"T06","title":"Evidence, audit, and closeout","blocked_by":["T01","T02","T03","T04","T05"]}
]}
```

## AC-to-Task and AC-to-Test Mapping

| AC | Tasks | Proof |
|---|---|---|
| AC-1 | T01 | literal-ref table, slash branches, collision and traversal cases |
| AC-2 | T02 | zero-block corpus, mixed mutation mutants, no-state assertion, latency |
| AC-3 | T03 | fresh/negated/stale/foreign/ambiguous/default/root mutation fixtures |
| AC-4 | T04 | exact renewal, threshold, idle expiry, override exclusion, concurrency |
| AC-5 | T04 | success/replay/mismatch/expiry/generation handover receipt fixtures |
| AC-6 | T05,T06 | cross-host decision parity, duplicate-hook gate, setup drift, full tier-1 |

## Validation Plan

```bash
bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh
bash test-framework/evals/tier-1/validate-pretool-decision-engine.sh
bash test-framework/evals/tier-1/validate-tool-call-heartbeat.sh
bash test-framework/evals/tier-1/validate-codex-zero-block-reads.sh
bash test-framework/evals/tier-1/validate-enforcement-escape-and-readonly.sh
bash test-framework/evals/tier-1/validate-operation-scope-authority.sh
bash test-framework/evals/tier-1/validate-existing-worktree-self-heal.sh
bash test-framework/evals/tier-1/validate-session-worktree-binding.sh
bash test-framework/evals/tier-1/validate-codex-session-rebinding.sh
bash test-framework/evals/tier-1/validate-codex-execution-integrity.sh
bash test-framework/evals/tier-1/validate-controller-lease-handover.sh
bash test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh
bash test-framework/evals/tier-1/validate-cross-host-hook-firing-parity.sh
bash test-framework/evals/tier-1/validate-hook-coverage.sh
bash test-framework/evals/tier-1/validate-hook-latency.sh
bash test-framework/evals/tier-1/validate-settings-no-duplicate-hooks.sh
bash test-framework/evals/tier-1/validate-actionable-hook-denial.sh
bash test-framework/evals/tier-1/validate-hook-payload-not-argv.sh
node scripts/lint-skills-manifest.mjs
bash test-framework/scripts/validate-pipeline-integrity.sh .
bash test-framework/evals/run-all-evals.sh
bash scripts/check-install-drift.sh --all-hosts
```

## Rollback

Revert the WI squash commit, run `./setup --all-hosts`, and rerun hook coverage,
cross-host parity, installation drift, and the full tier-1 suite. Runtime v2
receipts and leases are additive; rollback does not delete or downgrade them.

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|---|---|---|---|
| 1 | Host filesystem outside repo | installed hook scripts and private runtime correlation receipts | coupled | `setup`, content-addressed install receipts, `scripts/check-install-drift.sh --all-hosts`, bounded sweeper |
| 2 | Host config files | per-host hook event wiring | coupled | `scripts/wire-hooks.mjs`, `scripts/wire-codex-hooks.mjs`, settings schema/duplicate-hook validators, setup rollback |
| 3 | Out-of-tree version-controlled | approved linked worktrees | coupled | Git registration + configured canonical roots + same-UID/no-symlink checks; no consumer writes |
| 12 | Downstream framework artifacts | hook coverage and host manifests | coupled | hook coverage/parity validators and pipeline integrity |
| 15 | Runtime filesystem | controller lease heartbeats and pre/post receipts | coupled | atomic private writes, threshold renewal, expiry/replay checks, owner-age sweeper |

Untouched environments (walked the taxonomy, found nothing): 4, 5, 6, 7, 8, 9, 10, 11, 13, 14.

Host installation is deliberately post-merge deployment state. Source changes
land first; `./setup --all-hosts` converges every managed host and installation
drift validation supplies rollback detection. Runtime receipt loss is safe: it
suppresses heartbeat and records a no-op; it cannot grant authority.

## Simulation and Assumptions

| Claim | Scope/denominator | Evidence/probe |
|---|---|---|
| Planned files exist or are CREATE targets | all 26 paths in this manifest, at base `494f074` | `scripts/verify-plan-mechanical.sh` plus CREATE/MODIFY table inspection |
| No product deploy or database migration is part of execution | repository diff and all 15 external-state taxonomy entries | exact manifest file set and external-state table; deployment is post-merge framework setup only |
| Observation creates no authority state | complete named read corpus plus mutation mutants | `validate-codex-zero-block-reads.sh` and `validate-pretool-decision-engine.sh` |
| Foreign/ambiguous ownership is byte-preserved | every inverted self-heal predicate in the fixture ledger | `validate-existing-worktree-self-heal.sh` before/after digests |
| No non-deploy task depends on deploy | all six tasks in the embedded task graph | `scripts/check-plan-deploy-dependency.mjs` against lane graph |

## Execution Sequence

TDD red/green per executable task; checkpoint after each task; run the exact
focused validators after every affected semantic lens; freeze the cumulative
diff for one self-review and the owner-configured independent review; remediate
within the three-round cap; run full audit, full tier-1 twice, install all hosts
after merge, then verify installed parity from the promoted source.

## Prerequisite Alignment Matrix

| Prerequisite | Status | Trace |
|---|---|---|
| UX/UI | N/A | headless authorization/runtime framework |
| Technical design | satisfied | approved source plan sections 5–10 |
| Security | required | invariants and adversarial corpus in source plan |
| Style | satisfied | existing ESM, portable Bash, atomic state helpers |
| Dependency | satisfied | current authority v2 and operation-scope primitives on origin/main |

## Execution Command Sequence

```bash
bash test-framework/evals/tier-1/validate-literal-branch-worktree.sh
bash test-framework/evals/tier-1/validate-pretool-decision-engine.sh
bash test-framework/evals/tier-1/validate-tool-call-heartbeat.sh
bash test-framework/evals/run-all-evals.sh
```
