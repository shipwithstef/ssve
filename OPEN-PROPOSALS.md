# svc Framework — Improvement Backlog

## LANDED: WI-557-v2 Governance Speed Pass Completion (2026-08-23)

Branch WI-557-v2 squash-merged to main. Results:

- 10/10 tier-1 regressions fixed (see table below); validate-worktree-safety was already passing.
- FP-030 surface-scoped runner implemented (`run-all-evals.sh --surface`, selector `selectTier1ValidatorsForSurfaces`).
- FP-029 AC-table gate wired into write-spec Self-Verify #12 via normalize-ac-table acSignatures.
- Final tier-1: 316 passed / 19 failed — all 19 failures also fail at base commit 75986ebe (pre-existing environmental), zero NEW failures vs base.

**Branch:** WI-557-governance-speed-pass-v2 (worktree exists)
**Scope:** Fix ~8 validator regressions from WI-556/557 hook deletions + schema enum removals + implement FP-030 surface-scoped runner + FP-029 AC-table gate

> **Historical planning residue** (marked 2026-08-26, WI-FW-DOCS-AUDIT-01):
> everything below this banner is the WI-557-v2 execution plan, already landed
> 2026-08-23. The tables read as record only — they are NOT open work.

### Tier-1 Regressions to Fix (caused by WI-556/557)

| Validator | Why broken | Fix |
|-----------|------------|-----|
| validate-impact-triad | Hook deleted but module still imported by quick-fix-eligibility | Restore hook OR remove import |
| validate-tier1-pre-push-gate | Push gate modified to HEAD-only | Update validator fixtures for HEAD-only model |
| validate-receipt-tier | cognitive-family rewrite changed family mappings | Update expected families in fixtures |
| validate-git-hooks-installed | Hooks deleted but wire-hooks.mjs still installs them | Remove from wire-hooks.mjs station list |
| validate-risk-triggered-contracts | Risk flag schema may reference removed hooks | Update contract references |
| validate-worktree-safety | Worktree safety check may depend on removed hooks | Verify + update |
| validate-quick-fix-carve-out | quick-fix-eligibility imports impact-triad-guard module | Refactor import or restore stub |
| validate-quick-fix-retirement | Same dependency chain | Same fix |

### Pre-existing Environmental Failures (NOT ours — do NOT fix in this changeset)

| Validator | Reason |
|-----------|--------|
| validate-chain-receipts-schema | Pre-existing on base |
| validate-kimi-host | Needs kimi CLI |
| validate-plan-product-safety | Pre-existing |
| validate-lane-tasks-integrity | Other session's lane file ghost-completion |
| validate-skill-receipt-shape | Pre-existing |
| validate-state-io-discipline | Pre-existing |
| validate-governed-wirer-fail-fast | Needs wiring state |
| validate-setup-worktree-canonical-resolution | Worktree state |
| validate-self-heal-survives-double-dead-pointer | Session state |
| validate-codex-session-rebinding | Needs Codex env |
| validate-company-fleet-integration | Fleet config |
| validate-auto-learning-promote-replay | Learning state |
| validate-learning-lifecycle | Learning state |
| validate-proposal-triage-sla | Proposal state |
| validate-wi546-*-live-acceptance | Live acceptance tests |
| validate-actionable-hook-denial | Hook state |

### Efficiency Improvements (FP-030 + FP-029)

| Item | File(s) | Change |
|------|---------|--------|
| FP-030: Surface-scoped runner | run-all-evals.sh + select-tier1-validators-v2.mjs | Accept --surface paths; select only relevant validators; full suite at CP-PRELAND only |
| FP-029: AC-table gate | skills/write-spec/SKILL.md | Wire normalize-ac-table.mjs into self-verify so malformed AC tables fail at authoring |

### Review Protocol (already documented in FRAMEWORK-STATE)

Compressed 2+1 protocol: self-pass → ONE external station → terminal confirm only if HIGHs fixed.
Station preference order from dispatch-policy.json config. Availability-probed at runtime.

## Execution Plan

1. Fresh worktree from origin/main
2. Run full tier-1 → identify exact regression set
3. Fix each regression (restore hook stubs, update fixtures)
4. Implement FP-030 + FP-029
5. Full tier-1 re-run → target: zero regressions vs base (only pre-existing env failures remain)
6. External review (cursor-agent auto mode)
7. Fix findings
8. Squash merge to main
