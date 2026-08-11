# WI-491 Changeset: Bounded adversarial review loop

- **Spec:** docs/specs/work-items/WI-491.md (bugfix-class; AC BRL-01..04)
- **Base:** `origin/main` at `99da8bcf873d4d2a7b2a2becfb19759c71e3d2de`
- **Branch:** `framework-WI-491-bounded-review-loop`
- **Lane:** framework (bugfix)

## Implementation Summary

Close the unbounded-adversarial-review-loop bug (WI-486 ran 9 rounds, 0 Critical, ~6 persistent High, rubric flat). Convergence is redefined by DISPOSITION with a HARD 3-round cap: after round 3, unresolved Critical escalates to the owner (blocks), and remaining High findings are dispositioned (accept-with-justification as logged execution-time risk, or reject-with-justification) so the change proceeds — never a 4th round for High-only. Made canonical in the protocol, documented in the SKILL, and enforced mechanically + in tier-1.

## Files Planned

| File | Action | Purpose |
|---|---|---|
| review-cross-model/SKILL.md | MODIFY | §Convergence Loop: 3-round cap + High-disposition terminal exit; "Mechanical enforcement" pointer to the checker |
| review-exec/SKILL.md | MODIFY | self-verify check #5: HIGH passes when fixed OR dispositioned (not "must vanish"); names the 3-round cap + checker |
| review-plan/SKILL.md | MODIFY | Step 6: HARD 3-round cap block + `check-review-round-cap.mjs` gate before `terminal_state`; review-log gains `rounds_run`/`bounded_exit` |
| references/plan-review-protocol.md | MODIFY | canonical bounded terminal condition |
| scripts/check-review-round-cap.mjs | CREATE | mechanical enforcement primitive |
| test-framework/evals/tier-1/validate-review-round-cap.sh | CREATE | tier-1 guard (promotion note in header) |
| docs/specs/work-items/WI-491.md | CREATE | work item |
| docs/specs/work-items/INDEX.md | MODIFY | index row |
| .svc/lane-tasks-WI-489.json | MODIFY | state-hygiene: record WI-489 task-15 phase receipts (fixes a pre-existing main validator failure) |

## Validation Plan

- `node --check scripts/check-review-round-cap.mjs`; `bash -n` the validator.
- `bash test-framework/evals/tier-1/validate-review-round-cap.sh` (11 assertions).
- Full Tier-1: 0 failed with the new guard added (base + 1 new guard). Also
  clears the pre-existing WI-489 phase-receipt validator failure via the
  `.svc/lane-tasks-WI-489.json` state-hygiene fix.
- The enforcement rejects the exact WI-486 9-round loop and passes a bounded exit.

## Rollback

Revert the SKILL/protocol edits and remove the script + validator together; the change only ADDS a terminal condition, so revert restores the (buggy) unbounded loop — low risk.

## Framework-Lane Compliance

bugfix-class change; upstream = diagnose-bug (root-cause in WI-491.md Problem section) + this manifest. No feature spec required for a documented-bug fix.
