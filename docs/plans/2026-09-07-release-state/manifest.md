# Verified release-state closeout

WI: WI-FW-RELEASE-STATE-01
Mode: inline
Lane: framework
Base SHA: 6809a074b6f47e3046b71e71234f1d1c0cfbdbb0

## Outcome
Correct current FRAMEWORK-STATE release claims that still call completed PR38 work unreleased or not installed. At the published 2026-09-07 G7 closeout for PR40 / baseline6809a074, all nine hosts resolved canonical original main at that SHA with zero drift, the six named related worktrees were absent, all five merged chains passed after removal, and final G7 notes were published. These are dated verification facts, not a claim that future HEAD stays at that SHA. Preserve historical failure descriptions and scope limitations. This correction changes documentation and its execution graph only.

## Files Planned
| Task | Action | Path |
|---|---|---|
| T1 | MODIFY | FRAMEWORK-STATE.md |
| T2 | CREATE | docs/plans/2026-09-07-release-state/manifest.md |
| T2 | MODIFY | .svc/lane-tasks-WI-FW-RELEASE-STATE-01.json |

## Decisions and acceptance
AC1: All three current unreleased headings for the clean-main follow-up state their verified release status. Remove the false current assertion that WI-FW-CLEAN-MAIN-FOLLOWUP-01 is not landed or installed.
AC2: Receipt cleanup and UX status point to their merged PRs and verified installation baseline. Describe baseline6809a074 as the verification event, not a promise that HEAD will never advance. Git notes refs/notes/svc-receipts are the durable per-SHA release evidence.
AC3: Preserve substantive implementation descriptions, archived failed attempts, the acknowledged historical review-cycle overrun, exact Cursor requested_accepted identity limitations and unknown provider balances. Do not add runtime features, rewrite signed reviews, or claim new provider usage.
AC4: Review the actual final diff using authorized Sol High advisory and exact Cursor CLI cursor-grok-4.6-high independent. Validate the required corpus once at the final boundary; no new implementation-mirroring tests for prose. Land through existing helpers, install through setup on all9hosts, verify clean canonical main and remove this additional task-owned documentation worktree. Preserve every unrelated registration.

## Task graph and commands
T1 follows approved plan review and changes only the identified status prose using published PR38/39/40 and G7 evidence. T2 records actual workflow phases. Execute review, audit, land and verify after final source freeze. Self-review compares claims with .git/svc-review-evidence/preservation/WI-FW-RECEIPT-CLEANUP-01 in the canonical repository. Native Sol is advisory; Cursor uses the existing task-specific founder resource policy; no unavailable fallback.

Run git diff --check and node scripts/lint-skills-manifest.mjs. At the required final boundary run EVALS=0 bash test-framework/evals/run-all-evals.sh. After landing use ./setup --all-hosts and bash scripts/check-install-drift.sh --all-hosts, inspect actual source identity and exact remote SHA. Use existing svc-owner-recovery promote-mint/promote-exec and merge-pr-with-review-receipt with concrete PR/head values. No reset, global bypass or unrelated cleanup.

## Risk and rollback
Documentation can overclaim completion or misattribute historical observations. Compare each changed claim with the exact published receipt/PR and preserve historical qualifications. Revert this isolated documentation commit if any release claim proves false; retain evidence.

## Execution Command Sequence
1. Review plan and published baseline G7 evidence; expect no unresolved blocking findings.
2. Edit only the named current release-status statements in FRAMEWORK-STATE.md.
3. Run `git diff --check` and `node scripts/lint-skills-manifest.mjs`; expect exit0.
4. Review final diff, audit claim-to-evidence mapping, then run `EVALS=0 bash test-framework/evals/run-all-evals.sh`; expect zero failures/timeouts.
5. Emit exact tree/SHA receipts, promote via existing land helper, and verify source/squash equality.
6. From clean promoted main run `./setup --all-hosts` and `bash scripts/check-install-drift.sh --all-hosts`; expect exit0 and all9actual sources on that main.
7. Archive closure evidence and remove only docs-WI-FW-RELEASE-STATE-01 through `bash scripts/worktree.sh remove docs-WI-FW-RELEASE-STATE-01`; expect target absent, unrelated registrations unchanged, and clean main matching remote.

```bash
git diff --check
node scripts/lint-skills-manifest.mjs
EVALS=0 bash test-framework/evals/run-all-evals.sh
```

## Prerequisite Alignment Matrix
| Input | Evidence and disposition |
|---|---|
| Founder objective | Finish authorized program with clean main and truthful status; this is same-lane closeout. |
| Baseline implementation | PR40 merged6809a074, tree42d69eed; canonical main at the 2026-09-07 verification event and published G7 notes checked. |
| Installation | Archived postcleanup-nine-identities and postcleanup-install-drift proved all9hosts resolved the baseline at that event. |
| Cleanup | Archived postcleanup-repository proves six exact removals and retained unrelated history. |
| Product/spec/UX | No product behavior changes; correct operator-facing release facts only. |
| Risk | Preserve historical failures and distinguish evidence at baseline from future HEAD identity. |

## External State
| Taxonomy | Touch and coupling | Existing lifecycle enforcement |
|---|---|---|
| 1 Host filesystem | coupled: nine managed skill installations | setup --all-hosts transaction, all-host drift and actual source/HEAD checks before this worktree removal |
| 2 Host configuration | coupled: installer-managed pointers only; no hand-authored settings | existing host manifests and setup validation/rollback; preserve foreign entries |
| 3 Other version-controlled trees | coupled: exact docs-WI-FW-RELEASE-STATE-01 and clean canonical main | ensure-worktree owner tuple, reviewed branch/squash tree equality, worktree.sh remove; compare all unrelated registrations |
| 7 External SaaS | coupled: new GitHub PR, branch and notes; authorized Cursor review | gh pr create returns PR URL; governed push/merge wrappers consume exact SHA/branch/PR; verify GitHub merged SHA and notes; launcher preserves exact-route receipts and bounded owner policy |
| 15 Runtime filesystem | coupled: task-local review artifacts, locks and graph | existing review launcher/state-io, immutable evidence archive with byte readback, same-owner binding release before exact worktree removal |

Untouched taxonomy entries: 4 package registries, 5 schedulers, 6 running application/services, 8 databases/migrations, 9 Caches (including CDN), 10 DNS / SSL / domains, 11 Search / index services, 12 Downstream framework artifacts, 13 CI/CD wires, 14 credentials/secrets. Existing authentication is read for authorized commands without login or credential mutation. Installing skills for unavailable hosts invokes no provider. No decoupled state.

If documentation must be reverted, keep the last verified durable source while the revert is reviewed; install the resulting clean source through setup, then recheck all nine source pointers and drift. Do not delete the active installed source or drop review archives as rollback. A GitHub merge with failed note finalization is recovered through the existing finalizer, not re-merged.

## Exact graph and release evidence
The intended graph is now materialized, replacing the bootstrap route-only snapshot seen in R1:
1 route-workflow -> 2 plan-changeset -> 3 review-plan -> 4 execute-changeset -> 5 review-gate -> 6 review-exec -> 7 audit-implementation -> 8 land-changeset -> 9 verify-promotion. Every task i>1 has blocked_by [i-1]. T1 source edit belongs to task4 and cannot start before task3 passes. T2 phase recording occurs when each phase is actually executed; no backdating or fabricated completed gates. This evidence-backed prose correction needs no new product spec, diagnosis or technical design; review-gate and review-exec both retain their required task slots and use the same applicable actual review evidence without a duplicate paid invocation.

| WI | PR | Merge SHA | Published evidence |
|---|---|---|---|
| WI-FW-CLEAN-MAIN-FOLLOWUP-01 | 38 | c790b42c29821bc0ba106e5a851aa42e495fc7d4 | refs/notes/svc-receipts verify-promotion slot for this WI/SHA; verified_on_descendant_sha6809a074 |
| WI-FW-UX-GRADUATION-01 | 39 | ecb217291f0b5fa8f588ded6c5f1845d4281a515 | refs/notes/svc-receipts verify-promotion slot for this WI/SHA; verified_on_descendant_sha6809a074 |
| WI-FW-RECEIPT-CLEANUP-01 | 40 | 6809a074b6f47e3046b71e71234f1d1c0cfbdbb0 | refs/notes/svc-receipts verify-promotion slot for this WI/SHA |

The exact patch below covers all five status loci: receipt cleanup, UX graduation, launcher recovery, isolated evaluation, managed-hook convergence. It preserves historical PR36/37 wording and the original three issued reviews/fourth paid call. The known plan-cycle overrun is explicitly retained; requested_accepted identity and unknown balances remain stated. No other prose changes are authorized.

```diff
--- a/FRAMEWORK-STATE.md
+++ b/FRAMEWORK-STATE.md
@@ -22,8 +22,10 @@
 candidate and bounded-review checks. Bounded adjudication artifacts now resolve
 from the existing hash-addressed archive, with corruption distinct from absence.
 Actual PR36/PR37 note chains pass using the correction without changing signed
-bytes or original review verdicts. Final release, installation and worktree
-cleanup remain subject to this WI's review/landing/verification gates.
+bytes or original review verdicts. PR40 merged at `6809a074`; the 2026-09-07
+G7 closeout verified clean canonical main, all nine installed hosts with zero
+drift, and removal of the six named worktrees. Per-SHA verification receipts
+are published in `refs/notes/svc-receipts`.

 ## UX proposal graduation (WI-FW-UX-GRADUATION-01)

@@ -32,10 +34,10 @@
 or missing-evidence outcomes, with illustrative after artifacts only for proposed
 visual changes. It adds no compulsory lane step. Existing source-derived routing,
 context-family registration and focused validators cover the 105th skill. Original
-draft variants remain archived; source release and all-host installation require
-the Stage B/C gates and are not claimed by this implementation note.
-
-## Unreleased follow-up: review launcher recovery
+draft variants remain archived. PR39 merged at `ecb2172`; its G7 delivery was
+verified on descendant baseline `6809a074` at the 2026-09-07 nine-host closeout.
+
+## Released follow-up: review launcher recovery

 WI-FW-CLEAN-MAIN-FOLLOWUP-01 adds a pre-invocation check of the existing signed
 three-round inventory, serialized by a cycle lock through issuance. A later
@@ -43,9 +45,10 @@
 a non-approving failure envelope plus its pre-failure receipt; a success cache
 published by that failed request is removed under its cache lock. Offline stub
 fixtures cover cap exhaustion, concurrent last-slot requests, issuance failure,
-and cache retry. This source change does not approve the earlier overrun or
-claim landing/installation; the original three issued reviews and fourth paid
-call remain preserved in the task review log.
+and cache retry. PR38 merged at `c790b42`; its G7 delivery was verified on
+descendant baseline `6809a074` on 2026-09-07. Release does not approve the
+earlier overrun: the original three issued reviews and fourth paid call
+remain preserved in the task review log.

 ## Skill judgment and applicable context (WI-FW-SKILL-JUDGMENT-01)

@@ -750,21 +753,25 @@
 holds only actionable open items. (Link target materialized 2026-08-26,
 WI-FW-DOCS-AUDIT-01 — previously referenced but never committed.)

-### Unreleased follow-up: isolated evaluation and phase validation
-
-WI-FW-CLEAN-MAIN-FOLLOWUP-01 remains in progress and is not installed or landed.
-The candidate adds explicit plan-phase validation while preserving strict
+### Released follow-up: isolated evaluation and phase validation
+
+WI-FW-CLEAN-MAIN-FOLLOWUP-01 merged in PR38 at `c790b42` and was G7-verified
+on installed descendant baseline `6809a074` on 2026-09-07.
+The implementation adds explicit plan-phase validation while preserving strict
 execution defaults, private HOME/XDG/provider state for Tier-1 invocations,
 fixture-only dead-pointer repair tests, and fixed-clock freshness checks.
 Source-derived video skill context/continuation and two native mirrors are
 reconciled. MiMo and Claude-hook capability summaries now have fresh primary
 source provenance; unsupported old claims are withdrawn, not backdated.
 Focused recovery/phase/isolation tests: 18 passed. Sol advisory checks passed
-for the bounded launcher, phase and evaluator changes. Full corpus, remaining
-historical repairs, independent review, clean main and all-host installation
-are still required; this entry does not waive the recorded plan-cycle overrun.
-
-### Unreleased: deterministic Claude managed-hook convergence
+for the bounded launcher, phase and evaluator changes. Pre-merge validation
+of the receipt-cleanup working tree recorded 367 passed validators with zero
+failures/timeouts. The later G7 closeout separately verified clean main and
+nine-host installation. All five merged receipt chains
+also passed after worktree cleanup. The recorded plan-cycle overrun remains
+part of the historical evidence; release does not waive it.
+
+### Released: deterministic Claude managed-hook convergence

 The clean-main follow-up replaces additive Claude hook migration/dedup with
 managed-command rebuild through the existing ownership classifier. Legacy
@@ -772,4 +779,8 @@
 entry metadata survive. Subtraction-only all-disabled updates persist through
 the existing backup and atomic write path. Isolated cutover (44), compatibility
 (25), and generated-settings duplicate (8) checks pass. These are source-fixture
-results, not installed-source or whole-program release approval.
+results. Whole-program delivery was separately verified at the 2026-09-07
+closeout on baseline `6809a074`, with all nine provisioned hosts resolving
+that installed source at zero drift.
+Cursor review identity remains exact-route `requested_accepted`, without a
+server model echo; unobserved provider quota balances remain unknown.
```

## Exact promotion adapter
Use the following existing-helper adapter contract from this worktree. The task-local implementation is .svc/release-state-review/promote-reviewed.py (prepared before execution). Its prerequisites are exact final tree identity, passing final full-release.json and successful final Cursor exec receipt. It uses --repo /home/dianast/app-workspaces/seriousvibecoding, this exact worktree, --state-root <this-worktree>/.svc/release-state-review/promotion-runtime, --wi WI-FW-RELEASE-STATE-01, --generation from the live exact binding, --task 8. Read generation from actual binding if recovery changes it; never guess.

```bash
# Stage precisely the three source artifacts before freezing the review candidate.
git add -- FRAMEWORK-STATE.md docs/plans/2026-09-07-release-state/manifest.md .svc/lane-tasks-WI-FW-RELEASE-STATE-01.json
# Only after final review/audit/validation of that exact staged tree:
python3 .svc/release-state-review/promote-reviewed.py commit
# Emit canonical notes for the actual new HEAD and verify its chain.
python3 .svc/release-state-review/promote-reviewed.py push
# PR is created separately; promote-mint DOES NOT create or print a PR number.
gh pr create --repo s7an-it/serious-serious-vibe-engineering --base main --head docs-WI-FW-RELEASE-STATE-01 --title 'Correct verified framework release status' --body-file .svc/release-state-review/pr-body.md
# Read new PR number from returned URL, validate PR-specific receipt for exact HEAD.
python3 .svc/release-state-review/promote-reviewed.py merge "$PR_NUMBER"
```

Expected exit0 for each. The adapter calls node scripts/svc-owner-recovery.mjs promote-mint with the above common flags plus --environment local --operation local-land -- git commit -m MESSAGE; it parses capability.capability_id and token, then promote-exec with identical argv plus --capability and --token. Push uses --environment remote --operation remote-promotion -- git push origin HEAD_SHA:refs/heads/docs-WI-FW-RELEASE-STATE-01. Merge uses that remote tuple with -- node scripts/merge-pr-with-review-receipt.mjs --pr PR_NUMBER --squash --delete-branch --expected-repo s7an-it/serious-serious-vibe-engineering --expected-head docs-WI-FW-RELEASE-STATE-01 --expected-head-sha HEAD_SHA. HEAD_SHA is git rev-parse HEAD after commit; PR_NUMBER comes only from this new PR, never prior PR38/39/40. No raw merge bypass. On merged-unverified exit inspect GitHub state and repair evidence instead of re-merging.

R1 dispositions: accept F001 external lifecycle, F002 exact patch/evidence map and F004 dated outcome. F003 route-only observation was accurate for its earlier snapshot and is superseded by the materialized nine-task graph; supply exact helper contract. Reject only the proposed claim that promote-mint returns PR/head: gh pr create and git rev-parse provide those values.

Sol R2 semantic correction: scripts/lib/mandatory-delivery-chain.mjs requires both review-gate and review-exec. The nine-task graph now passes validateMandatoryDeliveryChain, and the prepared adapter targets land task8. Mechanical plan checks alone were insufficient to detect this graph omission.

## Runtime artifacts and checkpoint contract
Create `.svc/release-state-review/pr-body.md` before execution (now present) as a task-local operational artifact, not a fourth shipped source file. Its exact initial text is:

> Correct stale release-status statements in FRAMEWORK-STATE.md using the published PR38/39/40 and G7 evidence from the 2026-09-07 closeout. Date the nine-host installation baseline, preserve the historical review-cycle overrun, and distinguish installed source identity from host-specific hook behavior.
>
> Validation and exact final review evidence will be recorded before PR creation. No executable behavior changes.

Before creating the PR, replace the pending validation sentence with actual results. The owner resource policy, phase-binding, review packages, final-candidate-identity.json, full-release.json, raw reviewer receipts and promote-reviewed.py are also runtime artifacts under that exact private directory. Preserve them in the existing evidence archive before worktree removal. They are not installed or committed source, and never count as approval merely because a file exists.

For this one-file prose change, execute-changeset checkpoints are staged content plus runtime evidence; it does not create interim task commits. The first source commit occurs in land-changeset after the actual staged tree passes review and validation. The explicit git add above includes the task graph because it is a shipped artifact. Do not silently stage unrelated runtime files. Once a candidate is reviewed, any restaging that changes its tree requires evidence bound to the actual new tree; unchanged content is not a reason to spend on another review.

## Direct evidence for numerical release statements
All paths below are in the surviving canonical repository archive (not the removed worktrees). At the 2026-09-07 closeout, the source commit and PR40 squash had the same tree42d69eedb169595e837689c4fbd65d55689c853a. The archived validation records the pre-merge working-tree run; later G7 and install records independently support merged baseline claims. Do not collapse the pre-merge HEAD coordinate into a post-merge test invocation.

- `/home/dianast/app-workspaces/seriousvibecoding/.git/svc-review-evidence/preservation/WI-FW-RECEIPT-CLEANUP-01/runtime-evidence/full-release.json` SHA256 `ddc3812edd106e88b87352a9705ab93481a15f90faebcdf3c6ee60c44e8bec7e`. Exact fields: totals.passed=367, totals.failed=0, totals.timed_out=0, inputs_stable=true; elapsed_ms=303118.
- `/home/dianast/app-workspaces/seriousvibecoding/.git/svc-review-evidence/preservation/WI-FW-RECEIPT-CLEANUP-01/postcleanup-chains.json` SHA256 `ddb6885d90b0c40cea4cc29e19fb4d5ec377a009ac6bd0940879a90f73c90315`. Five rows each have ok=true and exit_code=0: WI-FW-SESSION-RECOVERY-01 at 6d4d8b07041e4afe8859820dbc0aac5f83f21f38, WI-FW-SKILL-JUDGMENT-01 at 848693c4c7e1abc5636479b26b1dd9b37844c2b2, WI-FW-CLEAN-MAIN-FOLLOWUP-01 at c790b42c29821bc0ba106e5a851aa42e495fc7d4, WI-FW-UX-GRADUATION-01 at ecb217291f0b5fa8f588ded6c5f1845d4281a515, WI-FW-RECEIPT-CLEANUP-01 at 6809a074b6f47e3046b71e71234f1d1c0cfbdbb0.
- `/home/dianast/app-workspaces/seriousvibecoding/.git/svc-review-evidence/preservation/WI-FW-RECEIPT-CLEANUP-01/postcleanup-nine-identities.json` SHA256 `737b3a3f8c04acf624dd9b84c1ac21e54e5036c93149f3ab856098167ebc3fdd`. Nine rows bind source to canonical original and SHA6809a074; this is installed-source identity, not identical host runtime capability.
- `/home/dianast/app-workspaces/seriousvibecoding/.git/svc-review-evidence/preservation/WI-FW-RECEIPT-CLEANUP-01/postcleanup-install-drift.log` SHA256 `b2b8a308d90d7816aedfd5b93eb1f00c3bbae54bdb892a81082cb2393759d1ab`. Terminal result: OK: all 9 provisioned hosts have zero install drift.
- `/home/dianast/app-workspaces/seriousvibecoding/.git/svc-review-evidence/preservation/WI-FW-RECEIPT-CLEANUP-01/postcleanup-repository.json` SHA256 `29b7abe3a1885f20a8a1662faae8a20b67ffe50becc9f9be3d003c84ef3b2631`. Exact six removed paths, unchanged unrelated registration census, retained branch histories and clean HEAD/main/origin-main equality.

R2 dispositions: F001 fixed in all actual graph/manifest/adapter consumers with nine tasks and land8; R2 described an earlier frozen snapshot. F002 addressed with exact staging and prepared runtime PR body plus explicit no-interim-commit policy. F003 canonical taxonomy labels now copied from the protocol, not recalled. F004 direct hash-bound numerical evidence above. No further product/framework scope is introduced.

R3 dispositions prepared: accept F001 wording precision by distinguishing pre-merge receipt-cleanup working-tree validation from later G7 installation verification. F002 fixed: prepared adapter reads generation through wi-claim binding status and validates WI/worktree/branch/released state before minting. Raw R3 failure/certifications remain immutable. PR41 installed the founder-authorized fixed-only plan certification census at main811d56de. Close this original three-round cycle through that existing builder and hash-bound correction evidence; preserve raw R3 FAIL and both false flags. No fourth paid plan review. Original review-cycle pre_execution_base remains6809a074; execution now inherits verified main811d56de. The new Plan certification recovery section is preserved by applying only the five original status-locus corrections.
