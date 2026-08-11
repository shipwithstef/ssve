# Framework Improvement - 2026-05-17 - Wave closeout validator

**Status:** IMPLEMENTED
Severity: HIGH - multi-WI closeout claims can hide missing docs, stale index
rows, incomplete task graphs, missing runtime evidence, or scoped worktree
residue.
**Risk class:** contract-change
risk: contract-change
validator_path: `test-framework/evals/tier-1/validate-wave-closeout.sh`
failure_class: batch-wi-false-closure
promotion_signal: A user asks whether all follow-up WIs from a wave are closed,
or an agent claims every WI in a batch is closed.

## Evidence

- **Source:** Example Marketplace exploratory testing follow-up batch `WI-284` through
  `WI-303`.
- **Finding:** The final proof required several separate checks: WI docs,
  INDEX row count, lane task graph validation, latest zero-fail runtime
  evidence, and scoped worktree cleanup.
- **Gap:** Existing framework contracts covered these as separate obligations
  but did not provide one command for the batch closeout claim.

## Diagnosis

The failure mode is not one bad WI. It is a wave-level reconciliation gap:

1. Exploratory or parallel work creates a related set of WIs.
2. Individual fixes land across the set.
3. The agent wants to say "all are closed."
4. Existing checks can still leave one missing artifact hidden in the batch.

## Goal

Add a reusable validator and route contract so batch closeout claims are
mechanically reconciled before the final answer.

## Acceptance Criteria

- [x] Validator supports contiguous ranges and explicit WI lists.
- [x] Validator checks WI docs, INDEX rows, lane task graphs, runtime evidence,
      and scoped worktrees.
- [x] Route-workflow documents the wave closeout obligation.
- [x] Dispatch-waves uses the same gate before all-WI closed claims.
- [x] Tier-1 fixtures prove pass/fail behavior.

## File Impact

- `scripts/validate-wave-closeout.mjs`
- `references/wave-closeout-validation.md`
- `route-workflow/SKILL.md`
- `dispatch-waves/SKILL.md`
- `test-framework/evals/tier-1/validate-wave-closeout.sh`
- `docs/specs/work-items/WI-348.md`
- `docs/specs/work-items/INDEX.md`
- `docs/specs/work-items/DONE.md`
- `FRAMEWORK-STATE.md`
- `references/knowledge/svc/CAPABILITIES.md`

## Rollback

Revert the validator, reference, route/dispatch contract lines, tier-1
validator, and WI records. Existing individual WI closeout validators remain
unchanged.

## Replay Verification

- `bash test-framework/evals/tier-1/validate-wave-closeout.sh`
- `node scripts/validate-wave-closeout.mjs --ids WI-348 --expect-count 1 --evidence-root docs/specs/work-items/evidence`

---

**Promoted to:** docs/specs/work-items/WI-348.md
**Promoted at:** 2026-05-17T12:07:08Z
