# Close resolved plan certification failures without another review round

WI: WI-FW-PLAN-CERTIFICATION-01
Mode: inline
Lane: framework
Base SHA: 6809a074b6f47e3046b71e71234f1d1c0cfbdbb0

## Outcome and authorization
Founder explicitly authorized the proposed separate plan-only correction with “rezume goal and finish it” after the concrete scope and veto change were presented. This is an incremental extension of existing bounded-exit adjudication, not a review waiver. The motivating documentation WI exhausted three actual plan reviews; terminal certifications duplicate two findings whose corrections are prepared. The existing unconditional veto admits no correction evidence. Preserve that WI's signed R1–R3 bytes and cycle inventory. Review this distinct framework change normally before using it to close the documentation WI.

## Files Planned
| Task | Action | Path |
|---|---|---|
| T1 | MODIFY | scripts/lib/bounded-exit.mjs |
| T1 | MODIFY | scripts/lib/reviewer-evidence.mjs |
| T1 | MODIFY | scripts/check-review-round-cap.mjs |
| T1 | MODIFY | schemas/receipts/bounded-exit.schema.json |
| T1 | MODIFY | schemas/receipts/bounded-exit-evidence.schema.json |
| T2 | MODIFY | scripts/build-bounded-exit-receipt.mjs |
| T3 | MODIFY | test-framework/evals/tier-1/validate-bounded-review-exit.mjs |
| T3 | MODIFY | test-framework/evals/tier-1/validate-review-round-cap.sh |
| T4 | MODIFY | skills/review-plan/SKILL.md |
| T4 | MODIFY | references/plan-review-protocol.md |
| T4 | MODIFY | references/chain-receipt-contract.md |
| T4 | MODIFY | FRAMEWORK-STATE.md |
| T4 | MODIFY | references/skill-routing-index.json |
| T5 | CREATE | docs/plans/2026-09-07-plan-certification/manifest.md |
| T5 | MODIFY | .svc/lane-tasks-WI-FW-PLAN-CERTIFICATION-01.json |

## Contract and acceptance
AC1: Add optional certification_failure_census to the existing bounded-exit schema. It is mandatory when terminal plan certifications failed, permitted only for plan reviews with exactly three authoritative rounds, and covers exactly every failed certification. Retain the old path when there are no failed certifications. Reject extra entries for passing or absent certifications, duplicates and unknown identities. No failed exec certification is admissible.
AC2: Each entry binds key, reviewer_family and for_content_sha exactly to the signed terminal certification. Require a nonempty family matching the terminal reviewer and a 64-hex content SHA matching the terminal reviewed plan digest. Missing/null identity cannot be adjudicated. Entry requires nonempty unique finding_ids, disposition, justification and hash-bound evidence. Permit only fixed; require every mapped finding to be fixed in the exact terminal finding census. Accept/reject-with-justification cannot close a failed certification. Critical mappings and unread dependencies remain blocking.
AC3: Extend existing disposition evidence with optional certification_keys. Certification evidence must bind its key and every mapped finding, WI and final candidate digest, and must validate the nested result artifact hash through the current evidence loader. Require evidence even for Medium/Low mappings. Stale/corrupt evidence fails. Raw reviewer results are not changed; the resulting receipt is pass-with-acks, never a rewritten reviewer PASS.
AC4: Builder accepts an explicit certification_dispositions array, rejects duplicate/extra/missing declarations, derives signed identity fields rather than trusting caller substitutions, hashes evidence, and runs the same verifier/schema checks before output. Existing no-certification builders remain compatible. No alternate emitter/checker bypass; their existing verifyReviewerEvidence call must consume the extended contract.
AC5: Regression coverage demonstrates success through direct validator, public verifier, builder, emitter and chain checker. Negative coverage includes early rounds, exec failure, missing/extra/duplicate census, false identity, unmapped/Critical findings, disposition mismatch, absent/incorrect/stale evidence and quoted raw artifact preservation. Existing archive, legacy producer and round-cap tests continue passing. Prove learning-lifecycle rejects failed exec certifications through its shared verifier. Tests are local fixtures only.
AC6: Self-review, Sol High advisory and exact Cursor CLI cursor-grok-4.6-high independent review apply to this plan and actual changeset. No Claude, standalone Grok, login or other fallback. Cursor evidence is requested_accepted, not a server-echo claim. Unknown remaining quota stays unknown.
AC7: Land a focused reviewed commit using existing promotion helpers; converge all nine hosts through setup, verify actual installed source and zero drift. Archive evidence before exact worktree removal. Preserve unrelated dirty work, sessions and produce-ad-video history.

## Implementation sequence
T1 REPLACES the unconditional certification veto with a conditional branch: failed exec certifications and failed plan certifications outside exactly round3 reject; round3 plan failures require the complete census validator. Do not retain the old unconditional reject in series. No failed certifications retains the legacy no-census path. Extend check-review-round-cap.mjs ALLOWED_DISPOSITIONS with fixed; the standalone checker checks log shape/count only, while bounded-exit retains hashverified evidence and exact High log/census agreement. All terminal Highs must share the single log disposition fixed for this route; mixed High dispositions remain unsupported and reject. Add standalone fixed-log PASS and malformed/missing/critical/cap regressions, plus integrated fixed-High evidence PASS and absent evidence FAIL. This is necessary for the actual High-linked certification, not a new framework layer. T2 extends the existing builder. T3 extends the existing signed fixture-based bounded-exit eval, whose existing helper already accepts certifications. T4 documents exact admission limits in plan consumers and current framework state; execution doctrine retains its veto. T5 records actual workflow evidence, no fabricated phase completion.

The nine lane tasks are route-workflow → plan-changeset → review-plan → execute-changeset → review-gate → review-exec → audit-implementation → land-changeset → verify-promotion. Sequential IDs 1–9, each blocked by the preceding task. Source edits start only after task3 passes. Task8 performs commit/push/merge using the live WI/worktree/branch/owner generation, never a hardcoded generation. No interim implementation commit. Plan is inline; duplicate code blueprints are unnecessary.

## Execution Command Sequence
```bash
node test-framework/evals/tier-1/validate-bounded-review-exit.mjs
node scripts/lint-skills-manifest.mjs
git diff --check
EVALS=0 bash test-framework/evals/run-all-evals.sh
```
Before paid plan invocation run plan mechanical and mandatory graph validation, inspect all named consumers and self-review. During implementation run node test-framework/evals/tier-1/validate-bounded-review-exit.mjs and relevant schema/receipt validators; run node scripts/lint-skills-manifest.mjs for the skill/doc change. Run git diff --check and file-persistence validation. At the final release boundary run EVALS=0 bash test-framework/evals/run-all-evals.sh once for the frozen inputs; repeat only for a real failure, changed input or required gate. Record actual elapsed wall time and source/tree identity; do not attribute premerge tests to a later installed SHA.

Stage exactly the fifteen Files Planned paths with git add -- <paths>; inspect staged diff and tree before actual review. Preserve paid review artifacts under private ignored .svc/plan-certification-review. Use existing emit-receipt and check-chain-receipts with actual final candidate identity. Use existing svc-owner-recovery promote-mint/promote-exec, bound to lane task8 and current binding generation, for commit/push/merge. Prepare the exact PR body with actual validation and scope in a runtime file before gh pr create --body-file. merge-pr-with-review-receipt receives the returned PR number, expected repository s7an-it/serious-serious-vibe-engineering, exact head branch and SHA. Verify source/squash tree equality and finalize/publish receipt notes. No hook bypass or direct main edits.

From clean promoted canonical main run ./setup --all-hosts and bash scripts/check-install-drift.sh --all-hosts. Read each durable installation source identity. Archive runtime evidence with existing review-evidence-store APIs and verify object bytes before same-owner binding release and exact worktree removal. Re-run chain checks after removal. Keep the separate documentation worktree until its own closeout completes. If main advances, reconcile reviewed scope against the new base and revalidate affected inputs rather than assuming prior evidence proves changed content.

## External State
| Taxonomy | Coupling | Existing lifecycle |
|---|---|---|
| 1 Host filesystem | coupled: nine installations | setup transaction and all-host drift/source verification |
| 2 Host configuration | coupled: managed setup pointers | installer reconciliation; preserve foreign entries |
| 3 Other version-controlled trees | coupled: this worktree, canonical main, later docs closeout | exact owner tuple and source/squash identity; no product worktree mutation |
| 7 External SaaS | coupled: Cursor review and GitHub branch/PR/notes | explicit available route; truthful receipts; governed promotion/finalization |
| 15 Runtime filesystem | coupled: evidence, graph, review cycle | existing state-io, immutable archive, exact binding release and cleanup |

Untouched: 4 package registries, 5 schedulers, 6 running application/services, 8 databases/migrations, 9 Caches (including CDN), 10 DNS / SSL / domains, 11 Search / index services, 12 Downstream framework artifacts, 13 CI/CD wires, 14 credentials/secrets. No decoupled state. Provisioning unavailable hosts invokes no providers.

## Risk, alternatives and rollback
The meaningful risk is admitting an unresolved plan defect through a weak certification mapping. Exact census, signed identities, candidate-bound evidence, common verifier and independent actual-diff review address it. Removing the veto globally, resetting the cycle, fourth paid review or rewriting verdicts are rejected. Keeping the veto would leave the demonstrated closeout impossible; founder selected the bounded extension. If a defect is found after landing, review a targeted revert, preserve historical signed artifacts, install from the resulting verified canonical source, and report any existing adjudications that depend on the reverted capability rather than erasing them. No automatic claims of retroactive approval.

## Prerequisite Alignment Matrix
| Prerequisite | Evidence | Disposition |
|---|---|---|
| Owner policy decision | Explicit resume after narrow correction proposal | Authorized |
| Current implementation | bounded-exit.mjs unconditional veto and signed docs R3 | Grounded |
| Reviewer routes | Task-local Sol advisory and exact Cursor policy | Available routes only |
| Product specs | Internal receipt contract change with no app behavior | Not applicable |
The authoritative input is current bounded-exit code and signed R3 evidence, with the founder's explicit narrow policy decision. No product UX or feature spec is required for this internal receipt correction. Product applications and host transport behavior are outside scope. Skill applicability metadata is unchanged; manifest registry changes are unnecessary. Acceptance maps directly to local fixtures and actual release evidence; no paid benchmarks or generic UX tests are added.

## R1 review dispositions and exact consumer handoff
F-001 fixed in this plan: include the existing round-cap checker and its focused validator; allow fixed logs, retain exact High IDs/count and evidence checks. Restricting certification mappings to Medium/Low would fail the founder-authorized High case and is rejected. Exec certifications still cannot use this path even if their findings have fixed log dispositions.
F-002 fixed: replace the unconditional veto with the explicit branch above.
F-003 clarified: census identity must equal the raw terminal certification. reviewer_family additionally equals terminal.findings.reviewer.family; for_content_sha equals terminal.receipt.candidate_digest, also bound by reviewed_plan_digest and phase_guard.plan_manifest_sha256. It does not equal the findings JSON digest or final promotion tree digest. Evidence candidate_digest separately equals body.candidate_digest. Builder input entries contain only key, finding_ids, disposition, justification, evidence paths; reject caller-supplied identity fields. Test null content SHA, promotion-tree digest, findings JSON digest and substituted family/SHA.
F-004 clarified: this WI's own release acceptance ends at its independently reviewed contract commit, all-host installation and verified cleanup. Then resume WI-FW-RELEASE-STATE-01 as the separate subsequent consumer under the overall founder goal. Its worktree is /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01 and its plan is docs/plans/2026-09-07-release-state/manifest.md. Its raw rounds are below; none are part of this WI staging set. Use the existing externalReviewCycleIdFromReceipt and listExternalReviewCycleProvenance functions to reconcile the signed issuance inventory for that WI and original pre_execution_base; do not reset it for the newly installed framework.
F-005 disposition: this bounded internal incremental extension uses its in-manifest ACs as the behavior contract, replacing a duplicate write-spec artifact. evolve-framework and improve-framework discovery are already satisfied by the reproduced terminal-certification failure and founder decision; test-framework is satisfied by the named focused and release validators. No external blend, stack research, infra blast-radius/topology, market/competitor refresh or product design is applicable. These conditional lane steps are omitted with this explicit rationale; all mandatory plan/exec/review/audit/land/verify slots remain present.

| Original round | Exact launcher receipt and raw findings | SHA256 receipt / findings |
|---|---|---|
| R1 | /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01/.svc/release-state-review/cursor-plan-r1/receipt.json ; /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01/.svc/release-state-review/cursor-plan-r1/findings.json | d6fd87d84b1baf783fa4dea14b569911bd1b7b03dd76edda08e1e54e1fb9b296 / bb6b7df5e9478b60e9116c735648507d43a8c4ba37766005b2633706efabc407 |
| R2 | /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01/.svc/release-state-review/cursor-plan-r2/receipt.json ; /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01/.svc/release-state-review/cursor-plan-r2/findings.json | aed37a5e1e0e939dec5eaf537e72a2013c2ba263945cde5b6407b5988f03cc7c / 1bf5a20bbf16f80229ef5eb404f516fc17f83cd93c50cd1c5ede762ef4871df7 |
| R3 | /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01/.svc/release-state-review/cursor-plan-r3/receipt.json ; /home/dianast/app-workspaces/seriousvibecoding/.worktrees/docs-WI-FW-RELEASE-STATE-01/.svc/release-state-review/cursor-plan-r3/findings.json | fefff8ab0fc5e336ca32ca6b18efc43a610e74bd91bd7e4971dd4772a27b7cc8 / 0e625e8a3eae75b981a0bebf2c254a37ead4751e26353df50812029746012709 |

## R2 non-blocking dispositions
F-001 fixed: AC7 now ends at this contract release and its worktree cleanup. The subsequent WI-FW-RELEASE-STATE-01 consumer remains part of the overarching founder goal, not this changeset AC.
F-002 fixed: T3 must invoke the real check-chain-receipts.mjs subprocess after emitting the fixture plan receipt, using the fixture SHA/WI and --consumer stop --expected-stage review-plan with an appropriate plan-manifest fixture. Assert exit0 on the valid census and nonzero on tampering; do not substitute a direct verifier result for this boundary.
F-003 fixed: the existing lane graph carries conditional_skip_reasons with the F-005 rationale; no additional graph nodes, empty skills or paid invocations are needed.

## Execution review correction
Sol found that the ordinary passing-verdict branch in reviewer-evidence.mjs did
not inspect failed certifications. Extend the shared verifier to reject terminal
failed certifications even when raw verdict says pass or pass-with-findings;
only the raw-fail bounded plan branch can adjudicate them. Add four signed
public-verifier negatives across both review kinds and both passing verdicts.
Regenerate references/skill-routing-index.json via
node scripts/compile-skill-router-index.mjs after the skill content change.
These two additional consumer paths bring the exact source set to fifteen.
The initial full suite was 365 pass / 2 fail / 0 timeout; both failures were
index drift. Preserve that result; corrected release validation remains required.
