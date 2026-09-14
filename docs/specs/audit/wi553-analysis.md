# Systems Analysis: WI-553 risk-triggered contracts (remediations)

**Date:** 2026-08-18T11:46Z
**Branch:** feature-WI-553-risk-triggered-contracts
**HEAD:** d97ae473f3585ac0cf5c4de9311eb3a22af7720a
**Spec:** `git show origin/main:docs/specs/work-items/WI-553.md`
**Mode:** full correctness against AC-553-1..7 + closed reviewer HIGHs

## Verification Contract

| AC | What code must do | Verified? |
|----|-------------------|-----------|
| AC-553-1 | Shared 6-flag set in `scripts/lib/risk-flags.mjs` | Confirmed — validator line AC-553-1 |
| AC-553-2 | design-tech skip denied when flags declared or implied, including live dirty hook and CLI `--planned-files` | Confirmed — 27/27 includes T2-cli and T2-live-diff-skip |
| AC-553-3 | plan-contract grows only matched sections | Confirmed — section-without-flag / flag-without-section |
| AC-553-4 | Reject WI-542 shapes; period-split check-then-write; real concurrency_test file | Confirmed — period-split and concurrency-test-none fixtures |
| AC-553-5 | execute-changeset completion needs schema-valid plan-manifest/review-plan/exec-record | Confirmed — omit/missing/valid fixtures |
| AC-553-6 | Flagless docs-only skip stays cheap | Confirmed — T6 |
| AC-553-7 | Synthetic WI-542 plan fails; corrected passes | Confirmed |

## Coverage Ledger

| Subsystem | Risk | Status | Findings |
|-----------|------|--------|----------|
| Flag table + implication | High | done | none |
| design-tech skip / live-diff | High | done | none remaining after d97ae473 |
| plan-contract mechanical checks | Medium | done | none |
| execute receipt gate | High | done | none |
| review schema cutoff | High | done | none |
| merge named-WI | High | done | none |
| overlay scope.wi | Medium | done | none |

## Hypotheses tested

1. CLI compile still emits empty `planned_files` — **falsified** by T2-cli-planned-files.
2. `set-status skip` still ignores a dirty session-start hook — **falsified** by T2-live-diff-skip.
3. `"Check if the file exists. Then write it."` still passes — **falsified** by period-split fixture.
4. A v1 review envelope on f57d1a93 is still accepted — **falsified** by `reviewEnvelopeRequiresSchemaV3('f57d1a93') === true`.
5. `feat(WI-553)` in a squash subject with no WI-553 path still merges — **falsified** by merge-guard named-WI fixture.

## Findings

None Critical/High in the remediations tree. Process gap (not a code defect): the 5-receipt envelope is not yet emitted; land is blocked until independent Fable review returns and `emit-receipt.mjs` writes notes.

## Residue

Untracked Fable launch prompt/log; dirty session-contract and lane-tasks. Not product residue.

## Unverified Surfaces

Independent Fable review of d97ae473 is in flight (`cursor-agent --model claude-fable-5-thinking-high`). This audit does not substitute for that station.

## Verdict

- [x] CONDITIONAL — code remediations ready; land blocked on independent review-exec pass + real receipt envelope
- [ ] READY TO LAND
- [ ] BLOCKED
