# Receipt compatibility and clean-main completion

WI: WI-FW-RECEIPT-CLEANUP-01
Status: DRAFTED
Mode: inline
Lane: bugfix (framework runtime)
Branch: bugfix-WI-FW-RECEIPT-CLEANUP-01
Base SHA: ecb217291f0b5fa8f588ded6c5f1845d4281a515
Spec: founder-authorized clean-main program and accepted proposal review corrections.

## Outcome and prior work
Complete the remaining program, not earlier implementation again. Recovery PR36 merged 6d4d8b07041e4afe8859820dbc0aac5f83f21f38; skill judgment PR37 merged 848693c4c7e1abc5636479b26b1dd9b37844c2b2; Stage A PR38 merged c790b42c29821bc0ba106e5a851aa42e495fc7d4; UX PR39 merged BASE_SHA above. These are prerequisites. Their source trees match their squash merges. Retain historical manifests and failed reviews unchanged; they are not this executable DAG.

BASE_SHA is fixed above; FINAL_SHA is the reviewed merged commit containing this correction. Record authoritative remote refs before landing. Keep live hosts on the existing clean durable BASE_SHA checkout during work. Do not downgrade to 848693c4. All nine source pointers and zero drift at BASE_SHA are recorded in Stage B evidence. Its fresh-main full run passed 367/0/0 in 286149ms; it is base evidence, not proof of this changed candidate.

## Diagnosis and selected design
The current verifier compares every issued receipt launcher version to 2.5.5. Producer 2.5.4 receipts pass current schema/semantics but fail that equality. The version bump changed paid-cycle locking and issuance atomicity, not accepted receipt data semantics. Select a documented compatibility set: current 2.5.5 and specifically 2.5.4. Keep real-attempt, successful status, exact route, schema digest, full HMAC issuance provenance, complete ordered cycle census, findings, candidate and WI checks unchanged. Unknown/older/future versions fail. Merely editing an old version or fabricating provenance cannot pass. Do not change launcher version or raw receipt bytes to implement this fix.

Bounded-exit loadBoundRepositoryFile reads only original paths and rejects writable intermediate directories. Original logs already have mode 0600 and matching digests. Select the existing immutable evidence-store resolver for hash-bound .svc/docs evidence: validate the logical repository-relative namespace first; Use lookupRelocation for the logical and canonical path; a present mapping must match the declared hash and resolve via getObject, propagating every failure. With no mapping call getObject directly; only ENOENT permits the existing secure local checks. Propagate digest tamper, insecure object, malformed/conflicting relocation and all other errors. A corrupt bare object plus a valid local copy must fail. A present invalid archive must never fall back to mutable local bytes. Relative paths remain repository-relative; escaping absolute paths remain rejected. Legitimate cross-worktree historical paths must be represented by the existing repository-relative artifact plus its signed digest, not a new arbitrary external-path exemption. Apply this uniformly to review log, disposition document and nested result artifact. No chmod of shared ancestors, new store, schema, or blanket validator exemption.

## Files Planned
| Task | Action | Path |
|---|---|---|
| T1 | MODIFY | scripts/lib/reviewer-evidence.mjs |
| T1 | MODIFY | scripts/lib/bounded-exit.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-bounded-review-exit.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-clean-main-followup.mjs |
| T2 | MODIFY | test-framework/evals/tier-1/validate-learning-lifecycle.sh |
| T2 | MODIFY | test-framework/evals/tier-1/fixtures/external-review-fixture.mjs |
| T3 | MODIFY | references/chain-receipt-contract.md |
| T3 | MODIFY | FRAMEWORK-STATE.md |
| T3 | CREATE | docs/plans/2026-09-07-receipt-cleanup/manifest.md |
| T3 | CREATE | docs/plans/2026-09-07-receipt-cleanup/plan-contract.json |
| T3 | CREATE | docs/plans/2026-09-07-receipt-cleanup/dirty-inventory.json |
| T3 | CREATE | docs/plans/2026-09-07-receipt-cleanup/review-log.json |

## Task Graph
T0 diagnose + plan + Sol advisory and exact Cursor independent plan review, then freeze scope (prerequisite to T1).
T1 implements the two selected contracts; depends T0; AC1/2.
T2 adds focused positive/negative fixtures; depends T1; AC1/2/3.
T3 updates contract/state and actual phase evidence; depends T2. Freeze source before final evaluation.
T4 runs focused tests, self-review, Sol advisory and Cursor actual changeset review, audit, required full no-LLM suite; depends T3; AC1–3. Correct findings with changed-input checks.
T5 lands through existing receipt/promotion helpers, verifies exact squash tree and notes; depends T4.
T6 verifies clean durable FINAL_SHA source, conditionally converges all nine installations, reconciles original checkout and rebinds sources; depends T5; AC4.
T7 closes actual lifecycle tasks, transfers caller cwd and task authority outside cleanup targets, archives final artifacts, removes eligible targets sequentially and verifies post-removal consumers; depends T6; AC5.

AC1: 2.5.4 producer receipts with genuine current-compatible evidence validate; unsupported versions, tampered issuance and altered bytes fail. Test through actual fixture issuance and all four callers (checker, emitter, bounded builder, learning lifecycle). Extend the isolated fixture constructor with launcherVersion defaulting to current, set before immutable issuance; this models historical producer format without rewriting issued evidence. Never alter production receipt versions. Actual historical PR36/37 evidence supplies a separate integration check. Unsupported-version and tamper negatives must reject at each authority boundary.
AC2: bounded log, disposition and nested result verify after their original paths disappear; missing/corrupt objects, conflicting relocation, escaping path and insecure local-only paths fail.
AC3: old PR36/37 actual chain checks and both candidate/cycle provenance resolve before and after cleanup; PR38/39 remain passing. No old FAIL findings relabeled.
AC4: original main clean, equal authoritative remote FINAL_SHA; all nine installed source pointers resolve clean original FINAL_SHA and zero drift. Useful original dirty bytes integrated once or archived with explicit disposition.
AC5: five preexisting exact related worktrees removed, unrelated work/history preserved; the new correction worktree retained until its own landing/evidence/authority checks pass, then removed as an explicitly task-owned sixth target. No broad orphan cleanup.

## Dirty-state disposition
Adjacent dirty-inventory.json enumerates the eight original paths with modes and hashes. Compare each against existing immutable preservation inventory and immediately recheck complete status before mutation. Hosted-media learning is already integrated on reviewed main; source-layout edit is superseded by independent census. UX skill/proposal are graduated with original variants archived; original historical UX graph remains history, not fabricated execution. Authorization/session/dispatch rows are historical and preserved before retiring obsolete bindings. Reconcile only exact unchanged originals. Preserve feat/produce-ad-video unique ref/history. Newly changed bytes suspend only their dependent mutation pending reconciliation.

## Cleanup and source handoff
Exact preexisting targets under original .worktrees/: bugfix-WI-FW-SESSION-RECOVERY-01; refactor-WI-FW-SKILL-JUDGMENT-01; refactor-WI-FW-CLEAN-MAIN-FOLLOWUP-01; wi-fw-ux-improve-mode-01; feature-WI-FW-UX-GRADUATION-01. This task additionally owns bugfix-WI-FW-RECEIPT-CLEANUP-01. Preserve all unrelated worktrees including Example Marketplace. Preserve branch history when squash ancestry is absent; use reviewed tree/patch equality plus unique-byte census.

Install from clean durable FINAL_SHA before touching original dirty copies if source differs. Reuse existing handoff when identity already matches; setup is needed for path rebinding even when bytes match. Record before/after host source paths and SHAs. Switch original checkout without force to main and fast-forward only after exact preserved dispositions. If diverged, retain both versions and repair rather than reset. Rebind once to clean canonical original FINAL_SHA using transactional setup, verify all9 identities/drift. Keep former source and handoff rollback sources through acceptance.

Before removal run from surviving original main, close actual phase evidence and transfer/release task/controller bindings through existing helpers. Confirm caller cwd and authority outside every target. Archive final A/B/current artifacts and notes in original Git-common evidence store with byte/mode readback. Never overwrite conflicting historical relocation; preserve both versions and resolve exact consumers first. Require tracked AND untracked status census, owner inactivity, unique-content disposition and no host references immediately before each sequential removal. Do not use forced removal or SVC_WORKTREE_SKIP_AP30_CHECK. An unexpected AP-30 healing requirement suspends deletion until exact host references are reconciled from FINAL_SHA. Run actual post-removal receipt/provenance checks and host drift. A remaining dirty/live target means incomplete, not success.

## Execution Command Sequence
From implementation worktree:
```bash
node test-framework/evals/tier-1/validate-bounded-review-exit.mjs
node test-framework/evals/tier-1/validate-clean-main-followup.mjs
bash test-framework/evals/tier-1/validate-consumer-evidence-root.sh
bash test-framework/evals/tier-1/validate-learning-lifecycle.sh
node scripts/skill-router.mjs validate
node scripts/lint-skills-manifest.mjs
```
All exit0. Preserve unknown/global/unmapped selector semantics; existing test surfaces remain selected. One frozen candidate full run before commit: EVALS=0 bash test-framework/evals/run-all-evals.sh, exit0, zero failures/timeouts. Postcommit focused validators verify committed state. Real chain checks use full merged SHA and matching WI, never literal HEAD. Actual all-host setup/drift uses existing tooling after reviewed landing; tests use isolated fixture homes and no paid providers. Failure: preserve output, diagnose exact cause, repair then rerun invalidated checks, no bypass.

## External State
| Surface | Effect | Coupling/rollback |
|---|---|---|
| Host skills and configs | final source convergence on nine hosts | setup transactional restoration; check-install-drift.sh; before/after source identities |
| Sibling worktrees | exact six targets including this task | worktree.sh removal only after archival, owner/content checks; retained refs/objects |
| Git refs/remote/notes | reviewed branch landing, main FF, canonical receipts | existing promotion/emitter helpers; expected head and squash tree; preserve original refs |
| Review provider account | Sol advisory + Cursor exact route only | existing task policy; unknown quota; no other launch/login/credential changes |
| Runtime logs/evidence | append real observations and immutable archive | existing state-io/evidence store; byte/mode hashes and relocation conflict checks |
| Sessions/controller | release or transfer own authority | existing wi-claim/owner helpers; preserve unrelated live bindings |
| Local source checkouts | canonical main reconciliation | immutable eight-file snapshot, concurrent recheck; safe branch switch and git apply --check rollback |
Untouched environments (walked taxonomy): MCP servers, databases, cloud deployments, application stores, DNS, registries, schedulers, credentials, billing, external communication, product application files. No new security-policy layer or global policy override.

## Simulation, risks and rollback
Code diagnosis identifies all consumers through verifyReviewerEvidence and validateBoundedExitAdjudication; direct bounded-exit test consumers are included. Archive fallback must distinguish missing from corrupt/conflicting state; test that distinction explicitly. Live root has concurrent work: exact inventory rechecks bound every mutation. Source truth is FINAL_SHA and actual installed paths, not stale local origin/main. Compatibility is version-specific plus existing issuance/schema semantics, never commit allowlisting. If tests reveal incompatible semantics, revise the chosen contract before widening source scope. Revert this reviewed correction to roll back code, retaining immutable evidence. For original checkout rollback preserve its branch/ref, binary patch, all untracked bytes/modes; git apply --check before restoring, never overwrite concurrent changes. Keep clean handoff serving hosts if original convergence fails. Report actual measured elapsed time and unresolved acceptance precisely.

## Prerequisite Alignment Matrix
| Input | Disposition | Evidence |
|---|---|---|
| Founder purpose | Preserve product/spec/UX judgment, reduce recoverable framework stalls | Original authorized program; merged recovery/judgment/UX prerequisites |
| Runtime architecture | Extend two existing consumers, reuse immutable store | Diagnosis above and exact Files Planned |
| UX/UI/personas | No application UI changes; operator is dedicated-session founder | Recovery without repeated approval; truthful cleanup and final installed source |
| Style | Existing Node ESM and fixture conventions | Target source files and adjacent tests |
| Prior proposal review | Both REVISE, dispositions incorporated | /home/user/app-workspaces/seriousvibecoding/.worktrees/feature-WI-FW-UX-GRADUATION-01/.svc/clean-main-review/stage-b/founder-followup-review/accepted-corrections.md (read-only historical input) |

## Operational touches (outside source diff, only after reviewed landing)
T4 writes only this task .svc/receipt-cleanup-review evidence and canonical graph/receipt mirrors. T5 uses refs/heads/bugfix-WI-FW-RECEIPT-CLEANUP-01, remote PR and refs/notes/svc-receipts via existing promotion tooling. T6 may reconcile only the eight paths in dirty-inventory.json within the original checkout, its saved original/main branch pointers, the existing durable source checkouts, and nine host managed surfaces from provision/hosts/*.json through setup. T7 may archive under original .git/svc-review-evidence, release this task's and completed related same-owner bindings, and remove exactly the six named worktrees. Other paths are read-only. This table authorizes operational effects, not arbitrary source edits; source ownership remains the Files Planned table.

## Review dispositions and phase ordering
Diagnosis is the concrete code inspection in this manifest, with exact PR36/37 checker failures preserved in the historical Stage B pre-cleanup-chain JSON. Use the bugfix lane: route-workflow, diagnose-bug, plan-changeset, review-plan, execute-changeset, review-exec, audit-implementation, land-changeset, verify-promotion. Record actual skill loads/phases before marking their tasks complete; never backdate them. Prior historical A/B graph completion is not inherited as this WI execution.
Sol R1: accept both findings, explicit typed absence distinction and four-caller census included. Cursor R1: accept archive failure distinction, operational surface and command specificity, exact historical references, phase evidence. Clarify F001: a test-only historical-format fixture issued with the real provenance signer before freezing bytes is legitimate simulation, not relabeling a production receipt. Retain production historical evidence as an additional integration check. Do not require historical live credentials/data inside isolated portable unit tests. No paid provider is invoked by fixture tests.

## Operational command contract
Run promotion from this reviewed worktree using svc-owner-recovery.mjs promote-mint/promote-exec with exact repository/worktree/WI/task/owner-generation and merge-pr-with-review-receipt.mjs --expected-repo s7an-it/serious-serious-vibe-engineering --expected-head bugfix-WI-FW-RECEIPT-CLEANUP-01 --expected-head-sha COMMITTED_SHA. Construct concrete tuple through the existing land-changeset helper once COMMITTED_SHA and PR number exist; do not invent them in the plan. Record commands and actual returned merge SHA as FINAL_SHA. Expected exit0 and exact source/squash tree equality.
```bash
# Read-only probes, all expected exit 0; replace the required values with recorded outputs.
git ls-remote origin refs/heads/main
git rev-parse HEAD^{tree}
# In the clean durable FINAL_SHA source, then canonical original FINAL_SHA:
bash scripts/check-install-drift.sh --all-hosts
# Only when managed source/path identity differs, converge then repeat the drift check:
./setup --all-hosts
# Four historical chain checks use their exact WIs and SHAs given above.
node scripts/check-chain-receipts.mjs --sha 6d4d8b07041e4afe8859820dbc0aac5f83f21f38 --wi WI-FW-SESSION-RECOVERY-01 --consumer push
node scripts/check-chain-receipts.mjs --sha 848693c4c7e1abc5636479b26b1dd9b37844c2b2 --wi WI-FW-SKILL-JUDGMENT-01 --consumer push
node scripts/check-chain-receipts.mjs --sha c790b42c29821bc0ba106e5a851aa42e495fc7d4 --wi WI-FW-CLEAN-MAIN-FOLLOWUP-01 --consumer push
node scripts/check-chain-receipts.mjs --sha ecb217291f0b5fa8f588ded6c5f1845d4281a515 --wi WI-FW-UX-GRADUATION-01 --consumer push
# From surviving clean original main ONLY, after all per-target preconditions:
bash scripts/worktree.sh remove bugfix-WI-FW-SESSION-RECOVERY-01
bash scripts/worktree.sh remove refactor-WI-FW-SKILL-JUDGMENT-01
bash scripts/worktree.sh remove refactor-WI-FW-CLEAN-MAIN-FOLLOWUP-01
bash scripts/worktree.sh remove wi-fw-ux-improve-mode-01
bash scripts/worktree.sh remove feature-WI-FW-UX-GRADUATION-01
bash scripts/worktree.sh remove bugfix-WI-FW-RECEIPT-CLEANUP-01
git status --porcelain --untracked-files=all
git worktree list --porcelain
```
These are sequential guarded actions, not a paste-and-ignore-errors batch. Each removal follows a fresh full status/ownership/evidence/host-reference check. Exit0 alone is insufficient: assert exact target absent and all unrelated registrations unchanged. Release exact same-owner binding with hooks/lib/wi-claim.mjs binding release --worktree-root EXACT_TARGET --session-id CURRENT_SESSION only after closure and archive; use existing authority handoff to surviving original operation root before deleting the caller's worktree. Never invent identity values. Post-removal rerun four chain commands plus this task FINAL_SHA chain, provenance inventories and all-host drift.

Contract clarification for Cursor F003: source resource-writer census concerns the executable changes, which remain read-only validators/consumers. Existing setup, promotion, review-launcher and removal helpers retain their own resource/authority contracts. The operational table explicitly bounds their use; do not add fabricated quota balances or new mandatory ledgers. Completeness denominators are four verifier callers, eight original inventory entries, nine provisioned host manifests, and six exact cleanup targets. Final evidence must report each row, not infer completion from those counts alone.
