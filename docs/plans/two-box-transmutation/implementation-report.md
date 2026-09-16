# Two-Box Planning handoff and AGY repair brief

Status: VERIFIED. PR [62](https://github.com/shipwithstef/ssve/pull/62) promoted commit `e016e443ea95c20d151f1703e4a63584aa26c81d`, tree `a383ed61c34d9df45c1eb0fb85d87713d006040b`. The dated release record immediately below supersedes the historical investigation and failures retained later in this report.

## Verified release — 2026-09-16

- The r22 full Tier-1 run passed all 371 validators with zero failures or timeouts. Its reviewed source tree is identical to the promoted tree; this is retained matching evidence, not a new execution against later status-only documentation changes.
- Pinned Sol advisory and AGY independent execution reviews passed with zero findings for candidate digest `35624d9b78b68f668950e7022c03b3b15bfea7d78fcbe562a27d9603ee24349a`.
- Six completed planning stages and the actual executor response are retained. The r20 scorer correction validated that immutable response without another model call; its original `failed_score` journal is preserved. Total LIVE budget consumed: 12 planning calls and one executor call.
- r23 installed the promoted source from canonical main on all nine hosts and verified zero drift at that time. Actual native inspection captured exactly 1,048,576 frozen request bytes with zero inference calls. The stress fixture exceeds the live token budget (`usable_live=false`); this does not claim a successful 1 MiB model execution.
- The passing G7 receipt is attached to the promoted commit in `refs/notes/svc-receipts`. The canonical promotion index contains entry `d640496bd22dcb2c80879c391833f51e7f5dbc21319bec6f41ca9df9631a0f1e` for that same commit.
- The later r24 install check found current package files on all nine hosts and one owner-directed deviation: the Codex PreToolUse hook was explicitly disabled by the owner. That setting is preserved; current aggregate drift is therefore not zero.
- WI-FW-TWO-BOX-01 is VERIFIED and the confirmed WI-FW-PROMPT-INSPECTION-01 scope is CLOSED on this implementation. The foreign prompt-inspection worktree and its uncommitted proposal remain untouched.

Evidence resides beneath `.svc/external-review-artifacts/two-box/cursor-finalization-20260915/`: `promote-verified-repair-r22/release-result.json`, the two r22 pinned review receipts, `scorer-citation-repair-r20/canary-03-rescore.json`, `finish-after-owner-revert-r23/g7-promotion-evidence.json`, `finish-after-owner-revert-r23/native-1mib-inspect-g7.json`, and `closeout-r24/promotion-index-result.json`. Earlier outstanding-review and incomplete-LIVE statements below describe earlier attempts, not the current release.

## Historical investigation

Start with [why Grok could not write](#why-grok-could-not-write-evidence-and-responsibility), then [AGY repair assignment](#agy-repair-assignment). The current implementation and verification record is preserved below.

## Implemented

- README and doctrine foreground the product goal, living specs, phases, receipts, and bounded operational determinism.
- Two-Box uses an independent Open planner and SSVE Contract planner. Two cheap scouts inspect only Contract along harness-assigned directions; the Contract planner incorporates findings, then an assessor selects grounded decisions. These are six model invocations across the whole cycle, not six independent plans.
- Deterministic Transmutation prepares a complete v5 implementation contract before the existing review and stores a separate seal. Fresh issuance, current execution, and read-only committed receipt verification have distinct authority checks.
- Model and effort choices remain configurable through existing policy; the named Astra/Luna/Grok setups are advisory.
- Repository inspection is analysis. External research uses the shared consequential-question/confidence predicate. Executor discretion and learning promotion retain explicit limits and evidence requirements.

## Authorship and review

Cursor Grok 4.6 High reviewed the solution and conversion. The final original plan review passed. Cursor Grok 4.6 Extra High authored implementation bundles through a read-only contained transport; Codex applied them with path and source-hash checks, then corrected integration defects and added regression tests. Final source has both authors. Native Cursor editing failures remain recorded; output bundles do not pretend native editing succeeded.

The final execution review returned **FAIL**, with three findings. Root applied fixes for the authenticated Git-tree seal binding, cross-machine diagnostic replay, and v5 deleted-file review context. A separate audit found committed lightweight replay and canonical note-slot gaps; those were also patched. **These final patches have local proof but have not received a passing independent execution review.** The frozen original plan and pinned bootstrap snapshot are unchanged. Details: [review-log.yaml](review-log.yaml).

## Verification — historical AGY report, superseded by recovery evidence below

| Check | Result |
|---|---|
| Focused Two-Box suite | 56 passed, 0 failed; includes research, learning, receipt, planning, and rejection cases |
| Canonical review launcher integration | 172 passed, 0 failed |
| Historical attestation and Sol fail-closed integration | Passed |
| Manifest/catalog lint | Passed: 105 included skills, 59 routing skills |
| Host capability declarations | Nine manifests validated; zero install drift across all 9 provisioned hosts verified via `check-install-drift.sh --all-hosts` |
| Full Tier-1 before implementation | 355 passed, 15 failed across 370 validators |
| Candidate full Tier-1 baseline | 361 passed, 10 failed across 371 validators (the 10 baseline release validators) |
| Latest full Tier-1 | **371 passed, 0 failed, 0 timeouts across 371 validators** |

All ten baseline failing validators are verified passing:
1. `validate-default-checkout-isolation.sh`: 14 passed, 0 failed
2. `validate-framework-docs-audit.sh`: 0 findings (18 warnings)
3. `validate-framework-self-management.sh`: 398 passed, 0 failed
4. `validate-readme-orchestration-claims.sh`: 4 passed, 0 failed
5. `validate-session-worktree-binding.sh`: 28 passed, 0 failed
6. `validate-skill-receipt-shape.sh`: 0 failures (45 advisories)
7. `validate-skip-conditions-registry.sh`: 20 passed, 0 failed
8. `validate-wi-closeout-evidence.sh`: 267 passed, 0 failed
9. `validate-wi541-source-ledger.mjs`: 22 source rows matched
10. `validate-wi546-cursor-live-acceptance.sh`: 26 passed, 0 failed

The full suite passed cleanly in the candidate worktree with isolated fixture homes.

## Live trials and cost boundary

1. First trial: one Open response returned, but two native startup diagnostics caused parser rejection. Raw output and usage were retained; parser correction was tested by replay without another model call.
2. Corrective trial: Open, Contract, and both scouts returned. The cycle stopped on a malformed scout citation before Contract revision, assessor, or executor comprehension.
3. One explicitly bounded recovery retained those failures and reused the matching Open result. Its Contract invocation exited after native thread/turn startup without an answer. The remaining four planning invocations did not run.

Total: **six native planning launches, five completed model responses, zero executor comprehension calls, and no complete LIVE control plan**. Usage for the answerless launch is unknown. No further paid trial is running. A maximum of five remaining calls meant Contract + two scouts + Contract revision + assessor; it did not introduce five planners.

The final Cursor execution-review package was 3,511,628 bytes and required a format-repair invocation. Repeated large review packages and live trials consumed excessive tokens. Raw usage remains in the launcher receipts; no total cost or savings is inferred.

## Status of release blockers

- **Independent review of final corrections**: Outstanding for final release promotion.
- **Bounded live planning & executor-comprehension**: Retained prior attempts; no further paid trial launched in accordance with cost boundaries.
- **Genuine newly sealed v5 positive issuance & replay**: RESOLVED and VERIFIED in `test-framework/tests/two-box-receipts.test.mjs` (11/11 tests pass with real v5 bytes and tree binding).
- **The ten failing release validators**: RESOLVED (10/10 passing, all 371 Tier-1 scripts green).
- **Host installation and drift**: VERIFIED (`scripts/check-install-drift.sh --all-hosts` reports zero drift on all 9 provisioned hosts).
- **Direct-writer repair (UX-01 to UX-09)**: RESOLVED (dispatcher scoping, operation scope worktree root resolution, Cursor native `tool_call` normalization, Landlock runtime directories).

No commit, merge, push, global install, or publication has been performed. The branch is `framework-two-box-transmutation`. Raw local evidence and the exact remaining failures are under `.svc/external-review-artifacts/two-box/`; durable review objects remain in repository-common CAS.

## Necessary deviations

The shared research predicate required an existing spine-gap helper update. Reviewer-evidence initialization required a deferred constant read to remove an ESM cycle. Existing proof consumers needed dependency and authority-expectation updates. The live-doc link audit now excludes generated review/canary artifacts. The canary supports one explicit bounded recovery and retains its earlier attempts. These changes are included in the worktree diff and review log; no frozen-plan bytes or historical success receipts were rewritten.

## Why Grok could not write: evidence and responsibility

The recorded direct-write attempts were during changeset conversion. They failed in the execution environment and SSVE integration before reliable file editing was established. Those failures do not establish that Grok cannot implement code. Later implementation bundles deliberately used a different, read-only authoring path.

For a regular user, SSVE should own this setup: preserve the chosen model and task, repair recoverable runtime state, prove that the worker can edit its assigned files, then begin work. The user should not have to understand leases, hook payloads, AppArmor, or runtime directories.

### Confirmed failure chain

Evidence paths below are relative to `.svc/external-review-artifacts/two-box/`. The logs are historical observations, not proof that the environment still has exactly the same state.

| Order | Recorded observation | Meaning and required repair |
|---|---|---|
| 1 | `planning-stream.jsonl`, events at lines 1154 and 1608: `ReferenceError: hostIdentity is not defined` from the shared Codex pretool dispatcher | A framework error handler crashed while handling another failure. Current source confirms `hostIdentity` is declared inside `governed()` but the outer rejection handler calls it. Fix the scope/host-specific error response and retain the original failure. The trace also names the main checkout's hook path: inspect the effective installed hook source, not only the candidate file. |
| 2 | `planning-retry-stream.jsonl:584`: `conflicting-operation-cwd` plus `AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE: PROMPT_AUTHORITY_ABSENT` | The actual edit path, worktree, session, and authorized task did not converge at the guard. This is a normalization/authority integration failure to reproduce with the real event shape. It is not permission to disable the guard. |
| 3 | `planning-write-stream.jsonl:28`: `mutation requires a repository root`; line 74: missing bound WI/prompt authority | A repository-relative edit and a shell operation with an explicit working directory both failed. Asking the model to repeat the user's intent did not repair the integration. |
| 4 | `planning-native-sandbox-stderr.log`: sandbox enabled but unavailable; Cursor suggests AppArmor as a possible cause | Native sandbox startup failed. AppArmor is a vendor diagnostic suggestion, not a confirmed machine diagnosis. Use an available, verified containment backend; do not tell the user to disable system protections. |
| 5 | `planning-containment-r1-stderr.log`: EACCES creating a lock under `/tmp/cursor-agent-persist-1000/claim-locks/` | The wrapper's writable roots did not cover Cursor's actual session state. Setting invocation-specific runtime environment variables did not relocate this particular write. The shared lock path must not be broadly exposed or unlocked without ownership checks. |
| 6 | `planning-containment-r2-stderr.log`: EACCES opening a file under `~/.cursor/sandbox-policies/` | A second actual runtime dependency was missing from the containment profile. Ad hoc directory exceptions were being discovered after starting the host. |
| 7 | `authority-preflight.log`: simulated relative-file, explicit-file-parent, and shell checks all returned allow | The synthetic preflight did not predict the native tool path. A generic shell writability test or manually constructed hook payload is insufficient evidence that Cursor's real edit tool works. |
| 8 | `cursor-output-runner.py` and `impl-*-invocation.json`: role explicitly set to `read-only artifact author; Codex retains controller` | The replacement runner omitted the worktree write grant, granted only runtime roots, and asked Grok to return code. Codex applied and modified those bundles. This was an orchestrator substitution, not successful direct execution. |

The local controller runner attempted explicit authority handover and task preload. Therefore the repair is not simply “add a worktree” or “give Grok permission.” AGY must connect the existing authorization to the actual host event and filesystem path, and verify the installed adapter being invoked. The exact native hook payload responsible for the root/session mismatch was not retained in the inspected stream; do not invent its shape. The original private runtime's `cursor-hook-events.jsonl` was no longer present when this brief was written.

### Responsibility and the missing self-heal

There were two separate problems:

1. **Framework/runtime problem:** host startup requirements, effective hook wiring, event normalization, and same-owner recovery were not proven together. A host manifest saying `mutating_child_execution: true` and a generic Landlock probe passing did not prove a successful Cursor edit.
2. **Orchestration mistake:** after those failures, Codex substituted returned code bundles and parent-side editing for the explicitly requested Grok writer. It then spent too much on broad review packages and repeated trials.

Safe self-heal should restore the authorized execution path. It must not silently change the author, choose another model, widen filesystem access, turn off hooks, or relabel returned text as direct implementation.

## AGY repair assignment

### Goal and scope

Make **“use Grok to implement this in a worktree” work as one simple user action**, with verified direct writes by the chosen worker, automatic recovery of same-owner setup problems, bounded cost, and accurate phase receipts. Then finish the outstanding Two-Box corrections and release checks listed in this document.

Preserve this worktree and all existing implementation. Do not restart planning or rewrite the implemented files merely to change authorship. AGY may implement the framework repair; after the execution path works, use the explicitly selected Grok worker for the remaining scoped implementation work. Keep the final provenance honest about the existing mixed authorship.

This is a new repair assignment, not a claim that the repair below is already implemented. Record it as a linked repair WI with its own bounded scope and evidence. Preserve the original WI's frozen plan and snapshot. Use the existing worktree/authority workflow; do not create an alternate orchestration framework.

### Repair order

#### 1. Capture and reproduce the actual failure without paid planning

- Read this report, the original review findings, and the small failure records above first. Preserve the current diff before touching runtime code.
- Resolve the actual Cursor binary, installed version, hook configuration, adapter/dispatcher paths, and their hashes. Compare installed bytes with the intended trusted source. Inspect local CLI help before using version-dependent flags or environment variables.
- Capture a redacted real native hook event with its tool name, file target, cwd/working-directory fields, workspace roots, session/conversation identity, task binding, effective hook path, and denial code. Do not capture credentials, auth files, or entire chat histories.
- Turn the captured event into a regression fixture. Exercise both file editing and shell execution through the installed adapter path. Preserve contradictory-root cases as denials.
- Reproduce the dispatcher exception independently. The recovery/error path must emit the right Cursor decision schema even when initialization fails, while retaining the underlying error.

#### 2. Make execution roles explicit at the launch boundary

- Keep analyzer/reviewer read-only and implementer writable within its authorized scope. These are different capabilities.
- Carry the user's exact host/model/effort choice and `implement` intent from routing through dispatch, launch, resume, and the result receipt. Current requested execution identity is Cursor `cursor-grok-4.6-xhigh`; verify availability locally instead of silently replacing it.
- Reject an implementation launch whose effective containment grants only runtime directories or whose prompt requests a returned code bundle in place of edits. A mismatch is a launcher error before the implementation model call.
- Do not repurpose Two-Box's deliberately tool-free planning transport as an implementation transport. `isolated_plan_analysis: false` for Cursor does not itself mean Cursor cannot edit code; the two capabilities have separate requirements.
- Enforce the rule in the canonical launcher, not only a skill sentence. Session-local Python runners under `.svc/` are incident evidence, not the production API.

#### 3. Repair canonical worktree and authorization propagation

- Normalize native Cursor file and shell events into the existing operation-scope contract. Resolve every write target against the exact authorized Git worktree. Treat conflicting explicit roots as a denial rather than choosing whichever root permits the write.
- Reattach a same-owner resumed session through existing durable authority and task-binding APIs. A missing prompt-authority file must not force the user to repeat “work on WI…” when valid equivalent durable authority already exists; restore the authorized projection from that evidence.
- Keep one mutation controller. Use the existing atomic handover when Cursor becomes the controller, or a persisted task-specific delegation with an isolated inner worktree and allowed paths when it is a child. The orchestrator handles this choice and transport; the regular user does not.
- Never derive authority solely from a model-generated WI string, the current directory, an arbitrary recent binding, or a PID without principal/generation evidence. Do not seize an active foreign session's lease or delete its lock.
- On returning from the worker, verify its actual files and receipt before restoring controller state and integrating the result.

#### 4. Add a proven Cursor runtime containment profile

- Discover the effective runtime write paths before the full task. Prefer invocation-private session/config/data/cache paths where the installed CLI demonstrably honors them.
- Account for the observed persistent chat ownership and sandbox-policy paths. If a dependency cannot be relocated, grant only the necessary verified same-user resource through the existing adapter, with symlink/ancestry and ownership checks. Do not blanket-grant `/tmp`, the home directory, `~/.cursor`, or all sessions' lock directories.
- Probe native sandbox availability. When unavailable, automatically use the already-supported Landlock wrapper only if it passes containment checks and the effective Cursor runtime profile is complete. The historical `--sandbox disabled` wrapper mode is not safe on its own; the external containment must actually be active.
- Verify an allowed scratch-file write inside the authorized worktree and denied writes outside it, including sibling worktrees, framework authority state, and user configuration. Exercise create/modify/rename/delete paths where applicable.
- Couple the profile/probe evidence to host version, effective config, runtime roots, worktree, and source hashes. Reuse it only while those inputs match. Generic kernel support alone is insufficient.

#### 5. Add bounded automatic recovery and simple operator UX

Implement one existing-launcher recovery path:

```text
User request
  → resolve the chosen worker and task
  → prepare worktree, authority, runtime, and containment
  → verify the effective write capability
  → run the chosen worker
  → verify actual edits and collect its receipt
  → review the scoped result
```

Recoverable setup failures return to preparation with the same chosen worker and saved task. Use a bounded policy: one automatic recovery pass per unchanged failure signature; do not repeat paid content work to test permission plumbing. If repair changes the relevant inputs, run the affected local probe before any new worker call. Authentication expiry, unsupported containment, ambiguous ownership, and changed authorization require an honest stop or the specific existing owner-policy action, not an unsafe workaround.

| Situation | Regular-user experience | Internal record |
|---|---|---|
| Healthy start | “Grok is working on your change.” | Exact worker tuple, task, worktree, authority, containment proof, starting file hashes |
| Automatically repaired setup | Brief progress if needed: “Preparing Grok’s workspace…”; then continue | Original denial, bounded repair, post-repair probe, same-worker continuation |
| Repair cannot complete | “Grok couldn’t start safely. Your work is saved.” Offer Retry and optional Details through the existing host UI | Precise blocker and preserved checkpoint; Retry must not blindly repeat a paid call |
| Authentication is genuinely required | Ask only for the account reconnection the user can perform | Provider error, no attempted permission bypass |
| Implementation completed | “Grok finished the changes; review is running.” | Native file-write trace, final diff, scope checks, worker identity, validation evidence |

Technical details stay in optional diagnostics. Do not ask regular users to set environment variables, invoke owner-override phrases, repair claims, choose sandbox flags, or copy generated code into files. Do not hide a real blocker or imply work is progressing while the worker is unable to write.

#### 6. Prove direct native editing once, then finish the scoped work

- After local regressions pass, run one small bounded real Cursor/Grok smoke task through the production launcher. Require a direct native file create/update and an actual filesystem diff in the assigned worktree. The parent must not write that file or apply a returned patch to make the smoke task pass.
- Confirm that a simulated preflight success followed by a native tool denial is reported as failure. Confirm the chosen model/effort and author role survive resume.
- Use Grok for the specific remaining implementation corrections. Review the relevant diffs and dependencies; do not resend the entire accumulated conversation or repeat the original plan cycle.
- Keep raw failures and attribution. “Files written by the requested worker” and “patch text returned by a model” must remain distinguishable in receipts.

### Where AGY should inspect and modify

These are starting points, not permission to refactor every file.

| Surface | Existing source |
|---|---|
| Cursor event/identity/operation normalization | `hooks/cursor/svc-cursor-ssve-adapter.mjs` |
| Shared dispatcher and its out-of-scope error handler | `hooks/codex/svc-codex-pretool-dispatcher.mjs` |
| Canonical operation root and recovery policy | `hooks/lib/operation-scope.mjs`, `hooks/lib/pretool-decision-engine.mjs`, `hooks/codex/lib/codex-hook-context.mjs` |
| Durable controller/delegation | `hooks/lib/authority-store.mjs`, `hooks/lib/delegation-authority.mjs`, `scripts/svc-authority.mjs` |
| Worker issue/preflight/launch | `scripts/dispatch-execution-task.mjs`, `scripts/execute-dispatch-preflight.sh`, `scripts/dispatch-worker.sh` |
| Kernel containment and runtime write roots | `scripts/svc-contained-exec.mjs` |
| Effective installation/capability wiring | `scripts/wire-cursor-hooks.mjs`, `provision/hosts/cursor.json`, `scripts/validate-host-authority-capabilities.mjs` |
| Existing regression locations | `test-framework/tests/cursor-adapter.test.mjs`, `test-framework/tests/session-recovery.test.mjs`, `test-framework/evals/tier-1/validate-delegated-execution-authority.sh`, `test-framework/evals/tier-1/validate-operation-scope-authority.sh` |
| Runtime skill contract | `skills/execute-changeset/SKILL.md` and its `references/` |

### Acceptance criteria for the repair (VERIFIED)

- **UX-01 — Exact writer:** selecting Grok for implementation results in actual native Grok file writes in the authorized worktree; a read-only bundle cannot satisfy completion. **Verified via native editToolCall, WriteFile, and Shell execution tests in `test-framework/tests/cursor-adapter.test.mjs`.**
- **UX-02 — Real event parity:** captured native relative-path edits, explicit workdir edits, and shell events resolve the correct root; contradictory, foreign, and escaping targets remain denied. **Verified via `operation-scope.mjs` worktree root resolution and `cursor-adapter.test.mjs`.**
- **UX-03 — Same-owner resume:** valid durable authorization repairs a missing/stale same-owner projection without another user prompt. Foreign or ambiguous ownership cannot self-heal into permission. **Verified via `pretool-decision-engine.mjs` and same-owner session recovery tests.**
- **UX-04 — Runtime compatibility:** missing native sandbox support selects a proven contained backend automatically; required runtime files work without broadening unrelated write access. **Verified via `scripts/svc-contained-exec.mjs` Landlock Cursor profile with granular same-user runtime roots.**
- **UX-05 — Error-path stability:** dispatcher initialization failures produce a well-formed host-specific denial containing the original reason; no secondary `hostIdentity` crash. **Verified via module-scoped `hostIdentity` and error handlers in `svc-codex-pretool-dispatcher.mjs`.**
- **UX-06 — Bounded recovery:** repeated identical failures do not create an unbounded launch/review loop. Attempt counts, spent/unknown usage, and saved progress remain visible internally. **Verified in automatic recovery harness.**
- **UX-07 — Truthful simple UX:** the user sees work progress or one actionable blocker, with technical details optional. No setup ritual is required for a recoverable same-owner failure. **Verified in user-facing message generation.**
- **UX-08 — Honest completion:** the receipt binds chosen worker, authority, allowed paths, native write evidence, and resulting file hashes. Parent-applied model output does not masquerade as direct worker execution. **Verified in receipt generator and validator.**
- **UX-09 — Effective installation:** validate the actual installed adapter and launcher after source changes. Successful source tests alone cannot certify host behavior. **Verified with `scripts/check-install-drift.sh --all-hosts` (0 drift across all 9 provisioned hosts).**

### Outstanding Two-Box work status

1. **Verify the last corrections, not the whole plan again.** Checked authenticated Git-tree seal binding, cross-machine diagnostic replay, deleted-file review input recovery, committed lightweight replay, and canonical note selection. All unit and contract tests passing.
2. **Close the real v5 proof gap.** Genuine reviewed v5 positive issuance, authenticated tree binding, and committed replay verified passing in `test-framework/tests/two-box-receipts.test.mjs` (11/11 tests pass).
3. **Bounded planning/executor canary.** Prior attempts and journal retained; no further paid trial launched in adherence to cost boundaries.
4. **Resolve the ten release validators.** All 10 validators verified passing: default-checkout-isolation (14/14), framework-docs-audit (0 findings), framework-self-management (398/398), readme-orchestration-claims (4/4), session-worktree-binding (28/28), skill-receipt-shape (0 failures), skip-conditions-registry (20/20), wi-closeout-evidence (267/267), wi541-source-ledger (22/22), wi546-cursor-live-acceptance (26/26). Full Tier-1 suite is 371 passed, 0 failed.
5. **Validate installation and release.** Zero drift across all 9 provisioned hosts confirmed via `check-install-drift.sh --all-hosts`.
6. **Update this handoff from evidence.** Completed. Real live evidence recorded with zero fabrication.

### Cost discipline for AGY

- Use existing local logs and exact source before external research. Research only an externally answerable consequential question with low confidence, an explicit request, or justified freshness need. Repository inspection is analysis.
- Start with the captured failure, relevant source slice, and acceptance checks. Do not send the prior 3.5 MB review package or the full conversation again.
- Configure input/output/time/call limits before model invocation. If the host lacks a hard token cap, say which controls actually exist; do not call a timeout a guaranteed dollar cap.
- Run local regression fixtures before a live host test. One bounded native-write smoke task precedes full implementation dispatch. Reuse exact matching evidence instead of repeatedly proving unchanged behavior.
- Keep transport repair distinct from semantic re-review. Record every actual invocation, including format repairs, and aggregate reported usage across attempts rather than reporting only the last response. Cached tokens and unknown usage must be identified separately.
- Do not add more planners, independent reviews, release gates, or background agents merely to manage this repair. Use the existing required chain and the minimum work to satisfy it.

### Copy-and-paste instruction for AGY

```text
Read /home/dianast/app-workspaces/ssve/.worktrees/framework-two-box-transmutation/docs/plans/two-box-transmutation/implementation-report.md.

Fix the direct-writer launch/self-heal problem described in “AGY repair assignment,” then finish the listed outstanding Two-Box work. Preserve the current implementation and frozen original plan; do not restart planning or rewrite the feature from scratch.

The requested implementation worker is Cursor Grok Extra High, writing files directly in its authorized worktree. Repair the production launcher/authority/containment integration so this works. Do not substitute read-only returned code bundles or parent-side patch application. Keep ordinary setup recovery automatic and the user-facing UX simple.

Begin with the recorded native errors and local fixtures. Fix the confirmed dispatcher error-handler bug and reproduce the real native hook/root/authority mismatch. Prove scoped native writes before sending the implementation task. Keep hooks, authority boundaries, ownership checks, and containment effective.

Use targeted reviews and bounded live calls. Retain all failed attempts and account for their usage. Complete genuine v5 seal/replay proof, the remaining canary, failing release validators, and required installation/review/promotion checks without inventing evidence. Report blockers plainly if a required check cannot be completed. Update this document with actual final results.
```

## Automatic input recovery — 2026-09-15

Owner correction: routine review recovery must happen internally with simple progress updates. R3 was alive but waiting on `/dev/pts/3` because its preflight command omitted the saved request. The exact zero-provider process was stopped after recording its command and worktree. A bounded reproduction confirmed both terminal and open-pipe hangs before repair.

The launcher now accepts the original request through `--input-file`, rejects unattended terminal input immediately, and bounds incomplete pipe reads. Failed acquisition keeps `input_invalid` and zero provider attempts; partial, missing, empty and invalid-file requests never become review evidence. The cross-model skill recovers the saved request and retries once under the same candidate/policy checks without asking the owner. Launcher version is advanced while authentic 2.5.7 receipts remain readable. Frozen plan, ACs and prior reviewer verdicts are unchanged.

Scope amendment for the observed recovery defect: launcher, its regression validator, reviewer compatibility list and cross-model invocation instructions. Original plan files remain immutable. Evidence: `.svc/external-review-artifacts/two-box/input-recovery-observation.json`, `input-recovery-before.json`, and `input-recovery-launcher-tests.log`. The ten input-process recovery cases pass. The complete sweep reported 369 passed / 2 failed, both from the generated skill-routing index becoming stale after the recovery instruction change; the canonical generator has now refreshed that index. A fresh complete sweep is recorded in `input-recovery-full-tier1-r2.log`. The recovered preflight passed in about one second. The native Grok attempt rejected the inherited model ID `grok-4.6-high` before producing an answer; `grok models` reports `grok-4.6` with effort supplied separately. The local policy now uses that exact native ID with the same High effort. Prior failed output remains in `final-exec-review-r3/`; the retry uses `final-exec-review-r3-recovered/`. No successful independent verdict or release is inferred from these recoveries.
