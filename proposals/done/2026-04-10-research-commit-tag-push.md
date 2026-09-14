# Framework Improvement: Research skill must commit, tag, and push

**Status:** IMPLEMENTED (2026-04-10)

## Evidence
- **Source:** User-reported gap — `/research` completed full knowledge extraction but did not commit, tag, or push. User had to prompt manually.
- **Finding:** `research/SKILL.md` analysis protocol mentions incremental commits (steps 4, 6) but has no final step to commit + tag + push the completed research. Question mode (Steps 1-5) had no git finalization at all. Self-verify table lacked a git check.
- **Severity:** medium — research output is always safe to land; requiring manual git steps adds friction and breaks the skill's promise that "research that isn't persisted is wasted tokens."

## Diagnosis
- **Root cause:** The analysis protocol's step 9 ("Done — source can be forgotten") assumed git work was handled by the incremental commits in steps 4 and 6, but those only cover partial progress during extraction. The final commit + tag + push was never specified. Question mode had no git steps at all.
- **Category:** fragility (skill contract incomplete)
- **Already in FRAMEWORK-STATE.md?** No (new)

## Implementation
- **Route:** direct SKILL.md edit (skill contract surgery)
- **Files changed:**
  - `research/SKILL.md` — analysis protocol step 9 expanded to "Commit, tag, and push" with specific commit message and tag format; renumbered step 10 as "Done"
  - `research/SKILL.md` — question mode: new Step 6 "Commit, Tag, and Push" after Step 5
  - `research/SKILL.md` — self-verify table: new check #8 "Committed, tagged, and pushed"

## Replay Verification
- **Replay target:** tier-1 evals (skill structure, self-verify, contracts, chain references)
- **Result:** PASS
- **Evidence:** `bash test-framework/evals/run-all-evals.sh --tier1` → 9 scripts, 3,813 checks, 0 failures

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added entry for research commit-tag-push gap
- **Known Gaps:** N/A (new finding, fixed immediately)
- **Decisions:** Research output is always safe to commit without user confirmation
- **Capabilities:** No new capability — existing skill contract hardened
