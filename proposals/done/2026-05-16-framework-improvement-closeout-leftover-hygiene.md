# Framework Improvement - 2026-05-16 - Closeout leftover artifact hygiene

**Status:** DRAFT
Severity: HIGH - ambiguous untracked or modified leftovers after a successful run create hidden state, missed evidence, accidental commits, or repeated cleanup work.
**Risk class:** contract-change
risk: contract-change
validator_path: `test-framework/evals/tier-1/validate-leftover-disposition-closeout.sh`
failure_class: closeout-leftover-artifact-drift
promotion_signal: A task closes while `git status --short` still contains unclassified generated evidence, logs, worktree files, screenshots, reports, or validation artifacts.

## Evidence

- **Source:** Example Marketplace location-card bugfix closeout on 2026-05-16.
- **Finding:** The implementation and production deploy were valid, but the validation worktree still had local evidence/log leftovers after closeout: a modified `docs/logs/base44-environment.md` and untracked production validation JSON files. They were not wrong, but they were ambiguous because they were neither committed, ignored, cleaned, nor explicitly carried forward by a closeout artifact.
- **Severity:** HIGH

## Diagnosis

- **Root cause:** Current closeout discipline checks publication state and verification, but it does not force a final per-path disposition ledger for generated or modified artifacts left in the active repo/worktree after task completion.
- **Category:** route-workflow / verify-promotion / land-changeset / artifact lifecycle / git hygiene.
- **Already in FRAMEWORK-STATE.md?** Partially adjacent, not covered. Existing work covers landing-state verification, visual baseline cleanup, auto-learning storage, worktree helpers, and proposal promotion hygiene. It does not generalize to all task-created leftovers at closeout.

The failure mode is:

1. Agent completes a real task and verifies the live behavior.
2. Verification produces JSON, screenshots, logs, reports, or local operation notes.
3. Some artifacts are useful evidence and some are transient.
4. The final answer says the task is done while `git status --short` still contains unclassified leftovers.
5. A later session has to guess whether each file should be committed, gitignored, deleted, or preserved as local evidence.

## Relationship to existing skills and WIs

- `route-workflow` already requires publication-state closeout for mutating framework work, but that check is about branch/remote divergence, not per-leftover artifact disposition.
- `land-changeset` and `verify-promotion` already own late-stage commit/promotion proof, but they do not require a machine-readable classification for each remaining dirty path.
- `track-visuals` and the visual baseline proposal already handle screenshot promotion and cleanup for visual baselines, but this gap also covers non-visual evidence like API JSON, deploy logs, validation summaries, temporary reports, and worktree-local operation logs.
- `proposals/done/2026-05-12-auto-learning-capture-hook.md` already uses gitignored default storage for auto-learning logs; this proposal applies the same principle to task-specific closeout artifacts.
- `WI-220` requires landing-state verification before audit-session closeout; this proposal extends the closeout scope from "did we land?" to "is every leftover path intentionally disposed?"

## Goal

Add a closeout rule and validator so any end-to-end task that leaves generated or modified files must classify every remaining path before declaring completion.

## Non-Goals

- Do not require every evidence artifact to be committed. Local-only evidence is allowed when explicitly classified.
- Do not auto-delete files. The guard should report and require disposition, not silently remove user data.
- Do not make docs-only proposal capture heavy. Proposal/WI authoring can leave the intended proposal/WI/index/ledger files dirty until they are committed in the same closeout.

## Acceptance Criteria

- [ ] Add a closeout artifact or ledger format for leftover path disposition. Each row must include `path`, `status`, `reason`, and optional `follow_up`.
- [ ] Supported statuses include at least: `committed`, `gitignored`, `deleted`, `local-evidence`, `deferred`, and `user-owned`.
- [ ] `route-workflow` final closeout for mutating/end-to-end work requires running `git status --short` and either a clean tree or a leftover-disposition ledger that covers every remaining path.
- [ ] `verify-promotion` and `land-changeset` reference the same leftover-disposition rule before declaring a task complete.
- [ ] Add a tier-1 validator fixture where a task leaves untracked validation JSON and a modified operation log; closeout fails until both paths are classified.
- [ ] Add a positive fixture where generated evidence is either committed or marked `local-evidence` with a reason, and closeout passes.
- [ ] Update framework guidance so generated evidence paths should be created under intentional directories, and transient caches/logs should be gitignored by default.
- [ ] Closeout language must state whether leftovers remain and how they were disposed, not just whether tests and deploy passed.

## File Impact

- `route-workflow/SKILL.md`
- `verify-promotion/SKILL.md`
- `land-changeset/SKILL.md`
- `_shared/` closeout reference or new `references/leftover-disposition.md`
- `scripts/` validator for leftover-disposition coverage
- `test-framework/evals/tier-1/` fixture and shell gate
- `FRAMEWORK-STATE.md`
- `references/knowledge/svc/CAPABILITIES.md` if the closeout capability is added to the capability catalog

## Rollback

Revert the SKILL/reference/validator changes and remove the tier-1 validator entry. Existing committed evidence files remain ordinary repository history; local-only evidence remains untouched because the proposed guard does not auto-delete paths.

## Replay Verification

- Run the new tier-1 leftover-disposition validator against failing and passing fixtures.
- Run `bash test-framework/evals/tier-1/validate-proposal-triage-sla.sh`.
- Run the nearest aggregate tier-1 contract check that covers modified skill/reference manifests.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Proposal file exists | PASS |
| 2 | Every finding cites source evidence or measurement | PASS |
| 3 | FRAMEWORK-STATE.md and adjacent proposals/WIs were checked to avoid duplicate scope | PASS |
| 4 | Findings ranked by impact and confidence | PASS |


---

**Promoted to:** docs/specs/work-items/WI-345.md
**Promoted at:** 2026-05-16T17:31:23.802Z
