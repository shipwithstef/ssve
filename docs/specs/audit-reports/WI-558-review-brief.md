# Adversarial Session Review — WI-558 tier-1 repair (post-implementation)

You are an adversarial reviewer. Review the COMPLETED work described below against the live repo at /home/dianast/app-workspaces/seriousvibecoding (branch main, commits c44d512..d599c1c merged from bugfix-tier1-regressions). Do NOT modify files. Judge correctness, security posture, test honesty, and approach.

Reply format — findings as `[severity: critical|major|minor] <finding>`, then exactly one final line:
VERDICT: APPROVE | APPROVE-WITH-FINDINGS | REJECT

## Mission
`bash test-framework/evals/run-all-evals.sh` had 25 failing tier-1 validators on main 65717d8. Goal: all green without weakening fail-closed contracts. Owner constraints: state edits only where they benefit repo consumers; hermetic tier-1; worktree-isolated fix merged to main; hosts converged; push.

## What was done (inspect the diff: `git diff 65717d8..HEAD`)

### Production code (3 files)
1. scripts/lib/reviewer-evidence.mjs — verifyExternalReviewProvenance now receives receiptPath as an absolute STRING plus explicit bytes (7bca62f regression: object hint dropped issuance-root derivation → ENOENT vs ~/.svc).
2. bin/svc-enforce.mjs — break-glass audit dir created with mode 0o700 (default-mode creation self-rejected under umask 0002). Pre-existing insecure dirs still refused, never chmod-healed.
3. setup — new SVC_STATE_HOME parent (~/.svc) secured 0700 on first creation; a pre-existing group/other-writable home FAILS CLOSED (no healing); symlinked home left to the canonical ancestry walk's own diagnostic (test requires exact message + zero side effects).
4. scripts/run-external-review.mjs — writeSelection refuses symlinked or non-0600 existing selection stores (parity with O_NOFOLLOW read path); optional contract.volatile_paths support added to scripts/validate-plan-contract.mjs (session-owned .svc/ excluded from plan parity both directions).

### Test infrastructure (~15 validators)
5. New shared helper test-framework/evals/tier-1/lib/stage-governed-hooks.sh stages ALL FOUR governed bash hooks owner-executable into fixture sources (WI-545 registry check); wired into actionable-hook-denial (4 blocks), all-host-install-migration, governed-wirer-fail-fast, self-heal-double-dead-pointer, setup-worktree-canonical-resolution (2 blocks).
6. validate-sol-r2-fail-closed.mjs — GC'd pin f57d1a93 replaced by dynamically resolving the newest commit reachable from HEAD that is NOT an ancestor of the v3 cutoff.
7. validate-company-fleet-integration.sh — mirror-indexing expectations replaced with fail-closed assertions (WI-546 note-authority contract).
8. validate-enforcement-escape-and-readonly.sh — break-glass markers chmod 600 (umask-proof) while keeping refusal semantics tested.
9. validate-codex-execution-integrity.sh — fixture HOME explicitly 755 (umask-proof ancestor check).
10. validate-sdkg-router-fail-closed.sh — fixture now copies dependency scripts/state-io.mjs.
11. validate-wi546-{cursor,grok}-live-acceptance.sh — AP-30 setup-refusal asserted only under .worktrees/ (from main, success expected); operator-HOME pins (~/.svc/dispatch-policy.json, cursor-exec-default.json, ~/.grok/config.toml) demoted to skip-with-notice; f27a143a consume probe skips loudly while refs/notes/svc-receipts is empty in this clone (lost evidence documented; restore re-enables).
12. validate-external-review-launcher.sh — rewritten to the current owner-topology contract: hermetic legacy-v2 SVC_REVIEWER_POLICY fixture (per-orchestrator stations mirroring retired fixed tuples: claude→codex/gpt-5.6-sol, codex→claude/claude-fable-5); every invocation binds frozen candidate digest; dead fixed/schedule/fallback-engine assertions replaced (no unapproved substitution; single attempt carries full $50 ceiling; selections inert in review path; selection-store hardening asserted via select operations).
13. validate-plan-product-safety.sh — active-contract pointer moved wi541→wi558.
14. validate-session-contract-freshness.sh — terminal/unbound rows (bound_to != "wi" or wi:null) are not active contracts; gate passes instead of aging out forever.
15. validate-quick-fix-carve-out.sh — legacy notes carry explicit wi ownership (WI-555 rule).
16. validate-git-isolation-meta compliance: notes reads use git -C.

### Honest state backfills
17. .svc/lane-tasks-WI-555.json task 3 ghost-completion REVERTED to pending (per dual adversarial review; no fabricated receipts). WI-552 task 1 + WI-556 tasks 4,6,7,8,9,10 phases_executed backfilled ONLY from artifacts that exist on disk (plan manifests/contracts, external-review receipts+findings, audit report, landed code files); timestamps derive from recorded loaded_at / landing commits.
18. docs/specs/work-items/WI-548..553,556 — headers renamed to case-exact `## Affected Files`; WI-548 marked unknown: planning-only (per its Status); WI-556 lists actual e0cf025 surface.
19. proposals/: 5 improvement proposals dispositioned accepted_wi=WI-{551,552,553,555,556} (all landed), archived under proposals/done/ per registry convention; 2 expired deferrals honestly closed as accepted_wi=WI-512 (their recorded executor); residual maps created for each (existing-artifact evidence); promotion ledger rows appended.
20. .svc/pipeline-decisions.jsonl line 27 wi schema-conformed (range preserved in details.wi_range).
21. .svc/session-contract.jsonl stale WI-557 row closed by an explicit terminal user-request row (written during the Grok plan review).
22. New docs/specs/work-items/WI-558.md + docs/plans/2026-08-23-wi558-tier1-regressions/{manifest.md,plan-contract.json} (base_sha 65717d8; volatile_paths [.svc/]; census denominator 23; triage claim denominator 42).

### Explicitly rejected
23. PHASE_ENFORCEMENT_ANCHOR repoint — REJECTED after adversarial plan review (Grok 4.6 High): any reachable commit postdates PHASE_ENFORCE_AFTER; repointing would grandfather phase-free receipts (reopen WI-510 fail-open). Externalized legacy authority path left authoritative. Cursor review concurred via its own guardrail list.

## Validation evidence
- Full tier-1 sweep GREEN three consecutive times at the end (worktree x2 pre-merge; main x2 post-merge including immediately after final commit): 335 passed, 0 failed.
- node scripts/lint-skills-manifest.mjs PASS. validate-pipeline-integrity PASS.
- ./setup --all-hosts converged; check-install-drift --all-hosts OK for claude/codex/gemini/opencode/mimo-code/antigravity/cursor/grok. kimi host not verifiable on this machine (kimi CLI binary absent — pre-existing environment gap, unrelated to the change).

## Known judgment calls you may challenge
A. volatile_paths mechanism (new optional validator field) — justified vs alternatives?
B. wi546 f27a143a consume probe SKIP-with-notice instead of synthesizing a five-receipt fixture chain (forging review evidence into the real note store considered worse).
C. external-review-launcher rewrite scope (dead engine assertions replaced rather than deleted wholesale; transport-level argv expectations preserved via mirrored station tuples).
D. session-contract freshness semantic (terminal/unbound rows exempt from aging).
E. Proposal dispositions mapping two 2026-07/08 deferred proposals to WI-512 based on their recorded triage reasons.
