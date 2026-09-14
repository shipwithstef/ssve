# Framework Improvement: Decision Logging Enforcement

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** Valluri project replay — auto-mode pipeline ran 11 skills (2026-04-12)
- **Finding:** `.svc/pipeline-decisions.jsonl` was never created. `scripts/pipeline-log.mjs` exists with enum validation but zero skills invoke it. The framework documents the decision log contract in `route-workflow` but no downstream skill implements it.
- **Severity:** high — auto-mode without decision logging is a black box; user cannot audit WHY decisions were made

## Diagnosis
- **Root cause:** The decision log contract was added to `route-workflow` documentation and the helper script was hardened (`pipeline-log.mjs` validates type/decided_by enums), but no skill received actual logging instructions. The contract was aspirational, not operational.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** Partially — the 2026-04-09 analysis hardened the helper, but the "no skill calls it" gap was not identified

## Implementation
- **Route:** direct SKILL.md edits + new tier-1 eval
- **Files changed:**
  1. `route-workflow/SKILL.md` — added decision log initialization step (creates file, writes lane-start entry with WI-based run_id)
  2. `validate-feature/SKILL.md` — added Decision Logging section after SHIP/NO-SHIP decision table (type: gate-result)
  3. `build-personas/SKILL.md` — added Decision Logging section after persona selection (type: taste)
  4. `write-spec/SKILL.md` — added Decision Logging section after G0 scope review (type: gate-result)
  5. `design-tech/SKILL.md` — added Decision Logging section after Technology Decisions table (type: taste per row)
  6. `plan-changeset/SKILL.md` — added Decision Logging section after adversarial review (type: mechanical)
  7. `land-changeset/SKILL.md` — added Decision Logging section after merge/wait decision (type: mechanical)
  8. `quick-fix/SKILL.md` — replaced inline JSON with `pipeline-log.mjs` helper invocation
  9. `test-framework/evals/tier-1/validate-decision-logging.sh` — new eval: verifies 8 required skills reference the decision log

## Replay Verification
- **Replay target:** tier-1 evals (all 10 scripts)
- **Result:** PASS — 10/10 scripts passed, 0 failed
- **Evidence:** `validate-decision-logging.sh` confirms all 8 skills reference `pipeline-log.mjs` or `pipeline-decisions.jsonl`

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for decision logging enforcement
- **Known Gaps:** close "decision log never written" gap
- **Capabilities:** update svc/CAPABILITIES.md with decision audit trail capability
