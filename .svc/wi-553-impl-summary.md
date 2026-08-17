# WI-553 Implementation Summary — Risk-triggered plan and execution contracts

**Worktree:** `feature-WI-553-risk-triggered-contracts` (base `223436ab`)
**Session:** `svc-impl-wi553-01a01070`
**Scope:** WI-553 only. No other WI touched. Default checkout and other worktrees left untouched (read-only spec/proposal reads only).

## Goal (from spec)

When a change matches a small risk-flag set, extra plan/exec contracts become mandatory and are checked mechanically. Unmatched work pays zero extra model review.

## Acceptance Criteria — status

| AC | Requirement | Status | Evidence |
|---|---|---|---|
| AC-553-1 | Shared flags: `runtime_concurrency`, `external_state_writer`, `config_schema_migration`, `lossless_rmw`, `idempotent_rewriter`, plus existing `cross_runtime_integration` | **DONE** | `scripts/lib/risk-flags.mjs` (`RISK_FLAGS`) — single source of truth consumed by every other check. Tier-1 test asserts the exact 6-flag set. |
| AC-553-2 | "No product UI / no data model" cannot skip `design-tech` when any AC-553-1 flag is set or implied by planned files | **DONE** | `scripts/validate-task-graph-lane.mjs` (`validateDesignTechRiskGate`), fed by `effectiveRiskFlags()`/`designTechSkipDenialFlags()` from `risk-flags.mjs`. Denies the skip when a flag is declared (`graph.flags` / `delivery_graph.risk_flags`) OR implied by `delivery_graph.planned_files` (host wirer / session-coordinating hook / config parser-serializer path patterns). Also denies a missing `design-tech` task entirely while a flag is in effect. Documented in `skills/route-workflow/references/lane-model.md` (new "AC-553-1 Risk Flags — design-tech Skip Denial" section) and `skills/diagnose-bug/SKILL.md` Step 4.6 (flag classification is where declared flags originate). |
| AC-553-3 | `plan-contract.json` grows only the matched sections | **DONE** | `scripts/validate-plan-contract.mjs` (`validateRiskSections`, exported): each of `concurrency` / `external_writer` / `lossless_rmw` / `idempotent_rewriter` is required when its flag is declared and REJECTED when present without its flag. `schemas/plan-contract.schema.json` documents the same optional sections. `scripts/verify-plan-mechanical.sh` Check 11 closes the authoring-time loophole: a manifest `**Risk Flags:**` line naming an AC-553-1 flag requires an adjacent `plan-contract.json` whose `risk_flags` includes it, or the check fails — otherwise an author could declare risk in prose and never create the contract at all. |
| AC-553-4 | Mechanical rejection of WI-542 shapes: check-then-write under concurrency; one backup path as both immutable baseline and rolling rollback; "preserve user entries" without a fixture per entry type | **DONE** | Same `validateRiskSections`: (1) `CHECK_THEN_WRITE_RE` rejects check/exists-then-write prose in `concurrency.concurrent_invoke_behavior`, and `atomic_primitive` must be a real primitive from an allowlist (`flock`, `o_excl`, `atomic_rename`, `compare_and_swap`, `advisory_lock`, `mkdir_exclusive`); (2) rejects `external_writer.immutable_baseline === external_writer.rolling_rollback`; (3) rejects `lossless_rmw.entry_types[].fixture` missing or non-existent per documented entry type. Worked examples in `skills/plan-changeset/references/plan-contract-risk-sections.md`. |
| AC-553-5 | `execute-changeset` cannot complete without schema-valid `plan-manifest`, `review-plan`, and `exec-record` for the current tree (staging allowed pre-commit) | **DONE** | `scripts/task-graph.mjs` (`assertExecuteChangesetReceipts`, wired into the `set-status ... completed` path): resolves the current-tree receipts directory the same way `emit-receipt.mjs` does (`git write-tree` vs `HEAD^{tree}` → durable `.svc/receipts/<sha>/` when committed, `.svc/receipts/staging/<tree-hash>/` otherwise), then checks each of `plan-manifest`/`review-plan`/`exec-record` exists, parses as JSON, has the matching `receipt_type`, and passes a shallow required-field/type check against `schemas/receipts/<type>.schema.json`. Gate is scoped to graphs with a `created` timestamp on/after 2026-08-18 (WI-553 rollout) so historical/untagged graphs are never retroactively broken (Migration note: "existing completed graphs are not rewritten"). Uses a local shallow schema check (not the shared `lib/json-schema-validator.mjs`) specifically so it doesn't break reduced-copy consumers that vendor only `task-graph.mjs` + `state-io.mjs` into an isolated dir (`validate-stage-registry-single-source.sh`). |
| AC-553-6 | A docs-only or parser-only bugfix with no flags skips the extra path (negative fixture required) | **DONE** | Tier-1 fixture `T6` in `test-framework/evals/tier-1/validate-risk-triggered-contracts.sh`: zero declared/implied flags + `design-tech` skipped with a "no product UI" reason → accepted (zero extra review). |
| AC-553-7 | Synthetic WI-542-shaped plan fails; the corrected shape passes. No paid provider | **DONE** | Tier-1 fixture in the same test: a combined `runtime_concurrency` + `external_state_writer` + `lossless_rmw` WI-542-shaped contract (check-then-write concurrency text, single shared backup path, entry types with no fixture) produces 5 mechanical errors; the corrected shape (real atomic primitive, distinct baseline/rollback paths, per-entry-type fixtures) produces 0. All local/mechanical — no LLM or paid provider call. |

## Files changed

- `scripts/lib/risk-flags.mjs` (new) — shared flag table, `impliedRiskFlags`, `effectiveRiskFlags`, `designTechSkipDenialFlags`, `DESIGN_TECH_SKIP_DENY_PATTERN`
- `scripts/validate-task-graph-lane.mjs` — `validateDesignTechRiskGate`, wired into `validateLane().pass`
- `scripts/validate-plan-contract.mjs` — `validateRiskSections` (exported), atomic-primitive allowlist, check-then-write regex, wired into `validatePlanContract()`
- `schemas/plan-contract.schema.json` — optional `risk_flags`/`concurrency`/`external_writer`/`lossless_rmw`/`idempotent_rewriter` properties (documentation parity with the validator)
- `scripts/verify-plan-mechanical.sh` — Check 11 (manifest `**Risk Flags:**` line requires a matching `plan-contract.json`)
- `scripts/task-graph.mjs` — `assertExecuteChangesetReceipts`, `shallowSchemaCheck`, `currentTreeReceiptsDir`, `receiptGateAppliesToGraph`, wired into the `completed` transition for `execute-changeset` tasks
- `skills/diagnose-bug/SKILL.md` — Step 4.6 Risk-Flag Classification (mandatory classification, optional flags), self-verify row 16, `flags` array documentation on the task-graph template
- `skills/route-workflow/references/lane-model.md` — new "AC-553-1 Risk Flags — design-tech Skip Denial (WI-553)" section
- `skills/plan-changeset/SKILL.md` — risk-triggered contract sections paragraph in Adversarial Plan Review
- `skills/plan-changeset/references/manifest-templates.md` — `**Risk Flags:**` header field
- `skills/plan-changeset/references/plan-contract-risk-sections.md` (new) — full section contract + WI-542-shape-vs-corrected worked example
- `test-framework/evals/tier-1/validate-risk-triggered-contracts.sh` (new) — 20-check fixture covering AC-553-1..7
- `.svc/lane-tasks-WI-553.json` — closed out (direct-implementation record; see note below)

## Tests run

- `node scripts/lint-skills-manifest.mjs` — PASS (103 included skills, no drift)
- `bash test-framework/evals/tier-1/validate-risk-triggered-contracts.sh` — **PASS, 20/20 checks** (new WI-553 fixture)
- `bash test-framework/evals/run-all-evals.sh --tier1` (full corpus, ~325 scripts) — **315 passed, 9 failed**, all 9 failures **confirmed pre-existing** via `git stash` bisection against the unmodified worktree (unrelated WI-542/547 drift, mobile-occlusion/scroll-position gate fixtures, session-contract freshness, learning-lifecycle, no-svc-residue, pipeline-decisions-schema — none touch WI-553's files). No regression introduced by this change.
- Targeted re-runs of every tier-1 script that exercises `task-graph.mjs`, `validate-task-graph-lane.mjs`, or `verify-plan-mechanical.sh` (18 scripts) — all PASS, including `validate-stage-registry-single-source.sh` (reduced-copy consumer; required switching the receipts schema check from the shared `json-schema-validator.mjs` import to a local shallow check, since the shared import broke that test's sparse-copy scenario).
- `node --check` on every modified `.mjs`, `bash -n` on every modified `.sh` — all clean.

## Remaining blockers / follow-ups

- None blocking. WI-553's own scope is complete against all 7 ACs.
- `.svc/lane-tasks-WI-553.json` records this as a **direct-implementation session** per the user's explicit instruction to implement WI-553 only, outside the normal `plan-changeset → review-plan → execute-changeset → review-gate → review-exec → audit-implementation → land-changeset → verify-promotion` chain. It does not carry a plan-manifest/review-plan/exec-record receipt envelope. If this repository's chain policy (`.svc/chain-policy.json`, currently "refuse mode") is enforced at push time for this branch, `land-changeset`/the pre-push hook will require that envelope before merge — out of scope for this implementation pass per the user's explicit direct-implementation instruction, but noted here so it isn't missed at promotion time.
- Not implemented (explicitly out of scope per the WI boundary "host wirers, SessionStart healthcheck, dispatch, or continuation"): no changes to `hooks/svc-session-start-healthcheck.mjs`, provisioning wirers, or the dispatch/continuation surface, even though `impliedRiskFlags()` heuristically flags file paths that look like those surfaces — that heuristic is intentionally generic/reusable and was not exercised against those specific files in this pass.
- The `IMPLIED_FLAG_PATTERNS` heuristics in `scripts/lib/risk-flags.mjs` are deliberately narrow (documented in-file: false negatives are safe, false positives cost one `design-tech` pass). Future WIs may want to widen them as more WI-542-class defects are discovered elsewhere in the codebase — the pattern scan for that is out of scope here (WI-553 built the mechanism; it did not audit the rest of the codebase against it).
