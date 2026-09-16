# WI-FW-OSS-READINESS-01: Open-source readiness — automatic recovery and truthful closeout

**Type:** enabler
**Status:** in-progress
**Severity:** high
**Filed:** 2026-09-16
**Source:** capture-idea — owner request after Two-Box closeout
**Lane:** framework
**Related:** WI-FW-TWO-BOX-01, WI-FW-PROMPT-INSPECTION-01, WI-524, WI-531, WI-533, WI-535, WI-537, WI-556, WI-FW-CLEAN-MAIN-FOLLOWUP-01

---

## Goal

Prepare SSVE for open-source users by fixing the confirmed recovery and closeout defects so ordinary use does not require owner intervention or manual receipt repair.

## Context

Two-Box and the large-input inspection repair shipped in PR #62; their status closeout shipped in PR #63. The feature is verified, but the closeout exposed framework defects: a completed-task recovery deadlock required disabling a hook, the merge helper generated invalid implementation coverage for a documentation-only squash, and legacy delivery evidence plus FRAMEWORK-STATE remain partly unreconciled. The owner asked to log these improvements in preparation for open source.

## Hypothesized Value

New users can install, resume interrupted work, and finish delivery without understanding internal leases, task bindings, or receipt notes. Maintainers get accurate completion claims and bounded recovery instead of repeated paid review loops.

## Broad Scope

1. **Automatic recovery:** reproduce the completed-task/released-lease failure and canonical-main versus operation-worktree binding mismatch. Proven reads and help must remain available; exact same-owner recovery must converge without a magic phrase or disabling protection. Keep foreign, ambiguous, mixed-repository, and escaping mutations denied. Test restart, completed-task closeout, and fresh-work routing as distinct cases. The suspected owner-lease path mismatch is a diagnosis lead, not a confirmed root cause.
2. **Correct merge finalization:** mechanically eligible documentation-only squashes must finish with valid exact-commit receipts. Do not synthesize full implementation coverage from an older WI graph with absent child receipts. Preserve strict validation for substantive changes and required coverage; validate the complete merge-to-receipt path, including interrupted finalization.
3. **Truthful state reconciliation:** align FRAMEWORK-STATE, the legacy delivery graph, and canonical release records using existing evidence. Preserve the distinction between runtime acceptance and complete framework evidence. Never invent past skill executions or turn missing evidence into a passing result.
4. **Public-user readiness:** exercise install → ordinary task → interruption/restart → resume → review → merge → closeout in a disposable fresh environment with default protection enabled. Cover the affected host adapters and all-nine-host package convergence. Review setup/contributor guidance and refresh the existing WI-537 privacy and attribution checks against the intended publication snapshot. Existing licensing and privacy work should be reused where still applicable.

## Evidence

- Published release record: [implementation report](../../plans/two-box-transmutation/implementation-report.md); [runtime PR #62](https://github.com/shipwithstef/ssve/pull/62); [closeout PR #63](https://github.com/shipwithstef/ssve/pull/63).
- Runtime release: `e016e443ea95c20d151f1703e4a63584aa26c81d`; documentation closeout: `355f3c9279e609110da08c553bb4fd8a19766807`.
- Local supporting evidence is retained in the original Two-Box worktree under `.svc/external-review-artifacts/two-box/cursor-finalization-20260915/closeout-r24/`: `root-finalization.json`, `metadata-receipt-correction.json`, `metadata-squash-invalid-generated-envelope.json`, `metadata-squash-eligibility.json`, and `framework-state-proposal.patch`. These are local diagnostic artifacts, not published repository evidence; preserve them and derive sanitized reproductions before cleaning that worktree.
- The receipt correction records the erroneous generated coverage and the successful exact-squash exemption check. It repaired this release's note; the helper source still needs fixing.
- Current host packages are installed on all nine hosts. The owner-disabled Codex hook is an intentional local deviation, not proof of successful automatic recovery.

## Affected Files

- `hooks/codex/svc-codex-pretool-dispatcher.mjs`
- `hooks/codex/svc-codex-skill-load-enforcer.mjs`
- `hooks/codex/svc-codex-owner-recovery.mjs`
- `hooks/codex/lib/owner-lease.mjs`
- `hooks/codex/lib/codex-hook-context.mjs`
- `scripts/svc-owner-recovery.mjs`, `scripts/svc-ensure-worktree.mjs`, `scripts/codex-load-skill.mjs`, `scripts/task-graph.mjs`
- `scripts/merge-pr-with-review-receipt.mjs`, `scripts/check-chain-receipts.mjs`, `scripts/quick-fix-eligibility.mjs`, `scripts/lib/skill-coverage.mjs`
- `FRAMEWORK-STATE.md`, `.svc/lane-tasks-WI-FW-TWO-BOX-01.json`, and related release records
- `test-framework/evals/tier-1/` — exact regression fixtures to be selected after reproduction
- `README.md`, `CONTRIBUTING.md`, `LICENSE`, `NOTICES`, `NOTICES.md` — readiness review only; preserve owner edits

## Affected Specs

- `docs/specs/features/two-box-transmutation.md`
- `docs/specs/work-items/WI-524.md`
- `docs/specs/work-items/WI-531.md`
- `docs/specs/work-items/WI-537.md`
- `docs/specs/work-items/WI-556.md`

## Persona Fit

Independent builders and contributors using SSVE on their own repositories and agent hosts.

## Similar Items

- **Related:** WI-524, WI-531, and WI-535 address recovery and authority. This item records later failures observed during the Two-Box closeout rather than assuming those earlier verifications cover them.
- **Related:** WI-533 and WI-556 cover receipt correctness; reuse their contracts and tests for the documentation-only finalization regression.
- **Related:** WI-FW-CLEAN-MAIN-FOLLOWUP-01 covers broader recovery and installation convergence. Coordinate implementation ownership to avoid competing changes.
- **Related:** WI-537 records completed privacy sanitization. Its WI says VERIFIED while its index entry still says IN_PROGRESS; reconcile that discrepancy and assess subsequent changes without repeating a destructive history reset.

## Product-Grounded Assessment

Yes: SSVE already has an MIT LICENSE, contribution guidance, a nine-host installer, and verified Two-Box runtime evidence. The remaining release gap is trustworthy operation for a fresh user. Prioritize the observed recovery deadlock and invalid merge receipt, then reconcile evidence and demonstrate the complete user workflow in a fresh environment. Existing passing tests do not prove these specific failure paths are fixed. Public readiness also needs a current privacy/attribution check because prior sanitization predates subsequent work. This intake records the work; it does not certify publication readiness.

## Notes

- On 2026-09-16 the owner authorized Cursor Grok 4.6 Extra High Fast to prepare an early public release: privacy triage, history/ref inventory, sanitized changes, and known-issue documentation. Broader recovery/receipt repairs remain follow-ups. GitHub visibility and any remote history rewrite require a concrete reviewed publication decision. The 2026-09-16 slice produced a reviewable sanitized candidate and `docs/specs/reviews/2026-09-16-oss-early-preview-publication-decision.md`; it does **not** close this WI's recovery, merge-receipt, or fresh-user proof work.
- ID corrected from the provisional WI-569 intake: another live session already owns WI-569 for GitHub CI. Its worktree and records are preserved.
- Keep WI-FW-TWO-BOX-01 VERIFIED and WI-FW-PROMPT-INSPECTION-01 CLOSED. Track these residual framework repairs here.
- Preserve the owner's disabled Codex hook, unrelated main edits, foreign worktrees, and the reverted centralized worktree change. Prove default hook behavior in an isolated environment.
- No additional Two-Box LIVE planning/executor calls are authorized by this capture. Start with retained evidence and local reproductions; avoid repeating unchanged paid reviews.
