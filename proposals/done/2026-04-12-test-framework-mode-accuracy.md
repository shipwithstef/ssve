# Framework Improvement: Test-Framework Mode Accuracy

**Status:** IMPLEMENTED (2026-04-12, see commits below)

## Evidence
- **Source:** `evolve-framework` analysis — `proposals/2026-04-12-test-framework-mode-viability.md`
- **Finding:** 5 of 6 test-framework modes were either misdocumented or had no implementation
- **Severity:** P0 (live, autopilot), P1 (comparison, fixture), P2 (skill-test, path reference)

## Diagnosis
- **Root cause:** The mode table was written aspirationally (documenting intended behavior) rather than tracking actual behavior. As infrastructure was partially implemented, the docs were never reconciled.
- **Category:** Drift — documented capabilities diverged from what the scripts actually do
- **Already in FRAMEWORK-STATE.md?** No — new finding

## Implementation
- **Route:** Direct SKILL.md edits — documentation accuracy fixes, no infrastructure added
- **Files changed:** `test-framework/SKILL.md`

**Changes made:**

1. **Mode table `static`** — command corrected from `bash scripts/run-all.sh --static-only` to `bash test-framework/evals/run-all-evals.sh --tier1` (the actual working command).

2. **Mode table `live`** — description corrected from "spins up server from generated code" to "probes a pre-existing server from a prior comparison run; does NOT generate code."

3. **Mode table `autopilot`** — description updated to "Doc-phase autopilot (skills 1–12)"; note added that skills 13–17 are currently SIMULATED because they require a running server. Removes false impression that the full loop works end-to-end.

4. **Mode table `comparison`** — description adds "Requires manual foreground orchestration — cannot be automated." Reference to Fairness Rules added.

5. **Mode table `fixture` → renamed `scenario`** — renamed to "Scenario Mode (LLM-driven)" and given accurate command (`run-tier2.sh`). Fixture-based variant moved to a "Planned" subsection within the Fixture/Scenario section.

6. **Mode table `skill-test`** — marked as "not yet implemented."

7. **Comparison section** — added orchestration warning blockquote citing the 2026-04-04 run's UNFAIR verdict as evidence.

8. **Fixture Mode section** — renamed "Scenario Mode (Tier-2 LLM-Driven Behavioral Testing)"; implementation status block added; planned fixture pattern documented separately so the long-term intent is preserved.

## Replay Verification
- **Replay target:** `bash test-framework/evals/run-all-evals.sh --tier1`
- **Result:** PASS — 9/9 scripts, 3,893 assertions, 0 failures
- **Evidence:** Run at 13:41:15+03:00

## FRAMEWORK-STATE.md Mutations
- Add to Analysis History: test-framework mode accuracy fix
- Known Gaps: add "skills 13–17 require running server (doc-phase autopilot is current ceiling)"
- No new decisions locked
- CAPABILITIES.md: no capability added, no update needed
