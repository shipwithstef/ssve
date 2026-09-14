# WI-491 — Independent finished-code review (exec)

**Change:** Bounded adversarial review loop — HARD 3-round cap + high-disposition + fail-closed mechanical enforcement.
**Author family:** anthropic (Claude). **Reviewer:** gpt-5.6-sol / high (openai) — different-family, via `scripts/run-external-review.mjs --review-kind exec` (launcher 2.2.0, `classification: success`).
**Risk tier:** HIGH (executable-or-config-path, host-hook-task-graph, structural-symbol-or-control-flow) — required by the change-impact-triad.
**Bounded loop:** 3 adversarial rounds (the HARD cap this change installs). Terminated by DISPOSITION, never by the reviewer running dry.

## Round 1 — 5 findings (4 high, 1 medium) — all ACCEPTED + FIXED
- F-001 [high] checker accepted >3 rounds if later dispositioned → made a HARD cap.
- F-002 [high] Critical could certify terminal without escalation → escalation required.
- F-003 [high] parser did not prove every High dispositioned → `remainingHigh>dispositionedHigh` fails.
- F-004 [high] SKILL self-verify demanded HIGH disappear → reworded to fixed-OR-dispositioned.
- F-005 [medium] checker existed but was unwired → wired into review-cross-model + review-plan.

## Round 2 — 4 findings (3 high, 1 medium) — all ACCEPTED + FIXED
Artifact: `.svc/review-artifacts/wi-491-exec/receipt.json` (gitignored raw output).
- EXEC-001 [high] `--log` parser was fail-OPEN (whole-file regexes, prose escalation, NaN, blanket `bounded_exit` credit). → **Rewrote `--log` to fail-closed**: required exactly-once integer `rounds_run`/`unresolved_critical`/`remaining_high`; `bounded_exit` must ENUMERATE one `residual_highs` entry per remaining High; escalation only via exact `terminal_state: ESCALATED_TO_USER`; malformed args exit 2.
- EXEC-002 [high] escalated Critical exited 0 (promote) despite BRL-03. → **Escalated Critical now HALTS with blocking exit 3**, never 0; review-plan/review-exec promote only when `unresolved_critical == 0`.
- EXEC-003 [high] contracts still contradictory. → normalized review-cross-model summary/verdict/self-verify; review-exec P4 is an adversarial-round cap with an explicit checker-gate step; protocol `when >3` typo fixed.
- EXEC-004 [medium] tier-1 exercised only the numeric API. → added negative log fixtures for every fail-open path + boundary + escalated-Critical-blocks + obsolete-language assertions.

## Round 3 (the cap) — 2 findings (2 high) — FIXED at the cap, verified MECHANICALLY (no 4th round)
Artifact: `.svc/review-artifacts/wi-491-exec-r3/receipt.json` (gitignored raw output).
- EXEC-005 [high] `--log` trusted the declared `rounds_run` counter without cross-checking actual `round_N` records → a completed 4th round could pass with `rounds_run:3`. → **Cross-check added**: any `round_<N>` with N>3 fails; declared `rounds_run` must equal the number of `round_N` records; a `status: PENDING` round cannot certify a terminal pass. Guarded by tier-1 fixtures f9–f12.
- EXEC-006 [high] review-exec Failure Modes still said unresolved Critical + exhausted patches → re-execute/re-plan, contradicting exit-3 escalation. → **Replaced the stale row**: an unresolved Critical at any round records `terminal_state: ESCALATED_TO_USER`, returns exit 3, BLOCKS to the owner — never re-loops. Grep assertion added to tier-1.

### Disposition at the cap (BRL-02)
Round 3 IS the HARD cap. The 3-round cap limits adversarial *review* rounds; a *fix* whose correctness is verifiable **mechanically** (tier-1) is permitted at the cap and is a stronger disposition than accept-as-risk. Both round-3 Highs were fixed and verified by `validate-review-round-cap.sh` (31 assertions) — **no 4th adversarial review round**. Final state: `rounds_run=3`, `unresolved_critical=0`, `remaining_high=0`; `check-review-round-cap.mjs --log … → exit 0`.

## Verdict
**PROMOTED.** The loop converged by disposition at the 3-round cap — the exact behavior this WI installs, demonstrated on its own review. Full round record: `docs/plans/2026-07-16-wi491-bounded-review-loop/review-log.yaml`.
