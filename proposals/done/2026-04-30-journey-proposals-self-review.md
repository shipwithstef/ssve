# Adversarial Self-Review — 2026-04-30 Journey Proposals

**Reviewer:** same agent (cross-temporal adversarial review)
**Scope:** `proposals/done/2026-04-30-journey-skills-contract-hardening.md` + `proposals/done/2026-04-30-journey-execution-trace-validation.md`
**Method:** Read both proposals, re-read source files, check counter-evidence, challenge confidence levels, flag overstatement and omission.

---

## Verdict Summary

| Dimension | Score | Rationale |
|---|---|---|
| Evidence quality | 7/10 | File:line citations are present, but one impact claim is conflated and one target is overstated. |
| Fix specificity | 6/10 | Several proposed fixes depend on scripts or steps that don't exist yet. Cart-before-horse in self-verify. |
| Completeness | 6/10 | Missed 4 gaps that are as important as filed findings. Duplicate finding across proposals. |
| Confidence calibration | 5/10 | Three "HIGH" confidence findings should be MEDIUM due to unverified assumptions. |
| Actionability | 7/10 | Proposals are routeable to plan-changeset. Effort estimates mostly realistic. |

**Overall:** ACCEPT with revisions. The core findings are real and justified, but the proposals need tightening before execution.

---

## Critical Findings (reject or revise)

### C1 — P0 progressive disclosure target is overstated (≤200 lines is not achievable)
**Location:** Contract-hardening.md P0
**Overstatement:** "Target: `write-journeys/SKILL.md` ≤ 200 lines."
**Counter-evidence:**
- `route-workflow/SKILL.md` achieved 81 lines, but it had 10 reference files (2542 lines total). `write-journeys/SKILL.md` is 1406 lines.
- Even extracting Mode 6 (322 lines) + journey format template (56 lines) + industry patterns (22 lines) + dedup boilerplate (~50 lines) = 450 lines removed. Result: ~956 lines.
- To reach 200 lines would require extracting Modes 1–5, Phases 1–5, Layer 3 analysis, coverage analysis, and audit mode — essentially making SKILL.md a pure table of contents.
- `build-personas/SKILL.md` (1140 lines) and `validate-feature/SKILL.md` (1093 lines) are also large and haven't been refactored. Is write-journeys special enough to demand a deeper cut than them?
**Revision:** Change target to "≤ 600 lines (extract Mode 6 + format template + industry patterns + dedup boilerplate)." Future pass can assess whether Phases 3–4 also need extraction.
**Confidence downgrade:** HIGH → MEDIUM. The exact line count after extraction is unknown until `verify-skill-refactor.mjs` is run.

### C2 — P1 self-verify check 8 depends on a skill step that doesn't exist
**Location:** Contract-hardening.md P1, check 8
**Cart-before-horse:** "Committed to git (if in worktree)" is in the proposed self-verify table, but `write-journeys/SKILL.md` has **no git commit step** in its main flow. The skill ends at "Persist State" (write to disk) with no mention of `git add` or `git commit`.
**Counter-evidence:** `test-journeys/SKILL.md` Step 6 explicitly mandates commit. `write-journeys/SKILL.md` Phase 6 only says "Write JOURNEY_INDEX.md" and "update docs/specs/INDEX.md if it exists."
**Revision:** Either (a) add a Step 6 "Commit Results" to write-journeys first, then include check 8, OR (b) remove check 8 from the self-verify proposal and file it as a separate finding.
**Confidence downgrade:** HIGH → MEDIUM. Requires skill body change, not just self-verify table edit.

### C3 — P1 self-verify checks 4 and 5 require scripts that don't exist
**Location:** Contract-hardening.md P1, checks 4 and 5
**Issue:** Check 4 (AC coverage ≥80%) requires counting `@AC-` tags across journeys and total ACs across specs. No script exists for this. Check 5 (every persona has ≥1 journey) requires parsing JOURNEY_INDEX.md tables or grepping persona IDs against journey files. Neither is a one-liner.
**Counter-evidence:** `test-journeys/SKILL.md` check 4 (scenario inventory terminal) is backed by a concrete `scenarios.json` schema. `write-journeys/SKILL.md` has no equivalent structured artifact for AC coverage or persona mapping.
**Revision:** Propose creating `scripts/verify-journey-coverage.mjs` as a prerequisite, OR reduce checks 4–5 to simpler proxies:
- Check 4: `grep -r '@AC-' docs/specs/journeys/ | wc -l` ≥ 1 (at least one AC tag exists).
- Check 5: `grep -h 'Persona:' docs/specs/journeys/*.feature.md | sort -u | wc -l` ≥ 1.
**Confidence downgrade:** HIGH → MEDIUM.

### C4 — GPS-toggle drift is conflated with self-verify weakness
**Location:** Contract-hardening.md P1, impact paragraph
**Overstatement:** "The 2026-04-15 GPS-toggle drift would not have been caught by these 3 checks."
**Counter-evidence:** The GPS-toggle drift (`FRAMEWORK-STATE.md:1105–1122`) occurred because `write-journeys --refresh` was **never invoked between WIs**, not because the skill's self-verify was weak. Even with 8 checks, if the skill never runs, the gap is invisible. The correct fix is the milestone trigger (Execution-Trace.md P0), not self-verify expansion.
**Revision:** Remove the GPS-toggle reference from the self-verify finding. Replace with a weaker but accurate claim: "Weak self-verify allows a write-journeys run to complete without verifying AC coverage or persona mapping, making journey quality invisible to downstream skills."

---

## Moderate Findings (revise or note)

### M1 — P2 deterioration guard fix is insufficient
**Location:** Execution-Trace.md P2
**Issue:** "grep the SUMMARY.md for S2 justifications" is fragile. SUMMARY.md is prose. A model could emit the three conditions in a different order or paraphrase them.
**Better fix:** Two-tier guard:
1. **Static tier:** Add a tier-1 script that checks `test-journeys/SKILL.md` still contains the three-condition AND gate text (exact phrases from lines 248–260). This catches contract drift.
2. **Dynamic tier:** The tier-2 scenario should include a fixture AC that is borderline S1/S2 (e.g., "user sees their own profile photo" — personalised but provisionable via fixture). The scenario must classify as S1, not S2. If the skill classifies it as S2, the scenario fails.
**Confidence:** Keep MEDIUM but strengthen the fix.

### M2 — P2 E2E bridge score has vague criteria
**Location:** Contract-hardening.md P2 (bridge score)
**Issue:** "Scenario steps contain specific UI element names" is subjective. "When I click the primary CTA" — is "primary CTA" specific? Unclear.
**Better criteria:**
- `## E2E Coverage` section exists (mechanical).
- At least one `*.spec.ts` file is referenced (mechanical).
- AC tags above scenarios match the regex `` `@[A-Z]{2,3}-\d+` `` (mechanical).
- No scenario exceeds 7 steps (mechanical).
- **Removed:** "specific UI element names" — too subjective for tier-1.
**Confidence:** Keep MEDIUM.

### M3 — Duplicate finding across proposals
**Location:** Both proposals mention task-graph boilerplate dedup
**Issue:** In a single plan-changeset, this would be one task affecting both skills. Splitting it across two proposals risks double-scheduling.
**Fix:** In the plan-changeset, merge the two dedup findings into a single task: "Dedup task-graph boilerplate in write-journeys and test-journeys." Reference both proposals in the task description.

### M4 — Effort estimate for tier-3 prompts is understated
**Location:** Execution-Trace.md P1
**Issue:** The proposal says "Only the prompts and fixture need creation." But to judge test-journeys, we need a **realistic tier-2 output fixture** (SUMMARY.md + scenarios.json + updated spec files). The existing `test-journeys-runtime.md` is a scenario *definition*, not a fixture *output*. Creating a representative output requires either:
- Hand-crafting a full fake QA run (2–3 hours), OR
- Actually running the tier-2 scenario against a scaffolded project and capturing the output (requires a working app + browse daemon).
**Revised effort:** 0.5 days for prompts + 0.5–1 day for fixture creation = 1–1.5 days total. Not "only prompts."

---

## Missing Findings (omissions)

### O1 — write-journeys is the LARGEST skill, not merely large
**Evidence:** `wc -l */SKILL.md | sort -n` — write-journeys at 1406 lines is #1. design-ui is #2 at 1301. The proposal says "the largest skill still non-compliant" which is true, but the *scale* of the problem is bigger than implied.
**Implication:** If progressive disclosure is a locked decision (2026-04-19), the #1 offender should have been fixed before #3, #4, etc. This suggests the framework's own prioritization has drifted.
**Should be added:** A note in the progressive-disclosure finding that write-journeys is not just "non-compliant" but the **most egregious violator** in the skill corpus.

### O2 — No tier-1.5 comprehension prompt for write-journeys
**Evidence:** `grep` of tier-1.5 comprehension prompts found **zero** matches for write-journeys or test-journeys. `FRAMEWORK-STATE.md:79` says tier-1.5 covers 56 skills with 62 prompts. But the prompt directory has no write-journeys coverage.
**Implication:** The framework cannot verify that hosts correctly comprehend and route to write-journeys. This is a trigger-accuracy gap.
**Should be added:** A P1 finding in Contract-Hardening.md: "Missing tier-1.5 comprehension prompt for write-journeys. No automated check verifies host trigger accuracy for journey generation."

### O3 — No journey fixtures in test-framework/fixtures/
**Evidence:** `ls test-framework/fixtures/ | grep -i journey` returns nothing. The contract-validation fixtures (`test-framework/fixtures/contract-validation/`) have track-visuals and test-journeys closeout fixtures, but no journey *documents*.
**Implication:** Any new tier-1 journey format validator or tier-2 scenario needs fresh fixture creation. No reusable corpus exists.
**Should be added:** A P2 note in Contract-Hardening.md under the tier-2 scenario proposal: "Requires new fixture creation — no existing journey fixtures in test-framework/fixtures/."

### O4 — test-journeys is not in any lane definition
**Evidence:** `skills-manifest.json` laneDefinitions — test-journeys appears in `corePackForRouting` and `includedSkills`, but is absent from all 7 lane `skills` arrays. write-journeys is in greenfield (pos 7), brownfield-feature (pos 3), and drift (pos 1).
**Implication:** test-journeys is treated as a standalone/verification skill, not a pipeline step. This is *probably* correct (it's invoked by verify-promotion or ad-hoc), but the proposal should acknowledge this rather than implicitly assume it belongs in a lane.
**Should be noted:** In Execution-Trace.md, add a sentence: "test-journeys is intentionally lane-less (invoked standalone or by verify-promotion); tier-2 scenarios test standalone invocation, not pipeline progression."

---

## Positive Findings (keep as-is)

1. **P0 test-journeys tier-2 surface-level finding** — strongest and best-evidenced finding. The 10 proposed criteria are specific, mechanical, and directly address the phase-contract gap.
2. **P0 write-journeys refresh milestone trigger** — directly closes a known pending gap from FRAMEWORK-STATE with a concrete, machine-checkable condition.
3. **P1 tier-3 judge prompts** — good decomposition into completeness/actionability/consistency. Matches the diagnose-bug-typo precedent.
4. **Stale proposal audit** — correctly flags the missing `2026-04-23-evolution-phase-contracts-and-execution-trace-validation.md` file.

---

## Recommended Revisions (priority order)

| Priority | File | Change |
|---|---|---|
| 1 | Contract-Hardening.md P0 | Change target from ≤200 lines to ≤600 lines. |
| 2 | Contract-Hardening.md P1 | Remove check 8 (git commit) OR add a Step 6 commit to write-journeys body first. |
| 3 | Contract-Hardening.md P1 | Simplify checks 4–5 to one-liner proxies, or propose `verify-journey-coverage.mjs` as prerequisite. |
| 4 | Contract-Hardening.md P1 | Remove GPS-toggle reference; replace with generic quality-invisibility claim. |
| 5 | Execution-Trace.md P2 | Strengthen deterioration guard to static + dynamic two-tier fix. |
| 6 | Execution-Trace.md P2 | Replace "specific UI element names" with mechanical criteria. |
| 7 | Execution-Trace.md P1 | Revise effort estimate to 1–1.5 days (includes fixture creation). |
| 8 | Both proposals | Add cross-reference note merging the dedup finding into a single changeset task. |
| 9 | Contract-Hardening.md | Add O1 (largest skill), O2 (missing tier-1.5 prompt), O3 (no fixtures) as new findings or notes. |
| 10 | Execution-Trace.md | Add O4 note acknowledging test-journeys is lane-less by design. |

---

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Every challenge cites file:line or measurement | PASS |
| 2 | No finding accepted without scrutiny | PASS |
| 3 | Omissions identified with evidence | PASS |
| 4 | Revisions are specific, not "consider X" | PASS |
| 5 | Effort estimates challenged where understated | PASS |
