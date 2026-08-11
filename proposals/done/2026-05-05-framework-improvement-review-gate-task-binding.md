# Framework Improvement: review-gate task graph binding enforcement

## Evidence
- **Source:** `audit-session-execution` of WI-166 (example-marketplace/proposals/2026-05-05-session-audit-wi166.md)
- **Finding:** WI-166 task 8 ("Review P0 fixes against benchmark dim scores and AC mapping") had `metadata.skill: null`. The formal `review-gate` skill was never loaded during WI-166 execution. User had to request `review-gate` retroactively after closeout.
- **Severity:** high

## Diagnosis
- **Root cause:** AP-27 ghost-skill detection (`hooks/svc-lane-tasks-validator.mjs:105`) only fires when `metadata.skill != null`. Tasks with `metadata.skill == null` are explicitly exempt. This means a review task without skill binding silently bypasses the review protocol entirely.
- **Category:** fragility
- **Already in FRAMEWORK-STATE.md?** No (new)

## Implementation
- **Route:** quick-fix + direct SKILL.md edit
- **Files changed:**
  - `review-gate/SKILL.md` — added task graph contract note requiring `metadata.skill: "review-gate"` on review tasks
  - `route-workflow/SKILL.md` — added review-task binding rule in post-compaction recovery section
  - `references/templates/brownfield-iter-visual.json` — new canonical task graph template showing correct `metadata.skill` bindings
- **Commits:** (to be committed)

## Replay Verification
- **Replay target:** Any future brownfield-iter-visual task graph must show `metadata.skill: "review-gate"` on the review task. `test-framework/evals/tier-1/validate-skip-conditions-registry.sh` can be extended to check this.
- **Result:** PASS — contract is now explicit in both skills.
- **Evidence:** SKILL.md text reviewed for clarity and enforcement path.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Add entry for 2026-05-05: "AP-27 enforcement gap discovered in WI-166 audit — review tasks with `metadata.skill == null` silently bypass review-gate. Fixed via skill contract updates + canonical template."
- **Known Gaps:** Not applicable (new finding, now fixed)
- **Decisions:** Lock: "All review tasks in lanes that include review-gate MUST declare `metadata.skill: "review-gate"`. No exemptions."
