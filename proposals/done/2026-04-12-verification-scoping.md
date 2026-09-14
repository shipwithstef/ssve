# Framework Improvement: Minimum-Path Verification Scoping

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** User feedback on universal verification improvement
- **Finding:** Universal Verification Principle mandated testing but gave no scoping guidance. Without it, agents either run full E2E suite (50+ min for 500+ tests) or rationalize skipping. Both are wrong — verification cost should be proportional to blast radius.
- **Severity:** high — directly affects whether verification gets done at all (too expensive = skipped)

## Diagnosis
- **Root cause:** The verification principle said WHAT (test everything) but not HOW MUCH (minimum path). No decision tree for scoping, no escalation protocol for when narrow tests fail.
- **Category:** missing capability (refinement of the universal verification principle)
- **Already in FRAMEWORK-STATE.md?** no (new — refines the just-landed universal verification)

## Implementation
- **Route:** direct SKILL.md edit (route-workflow)
- **Files changed:**
  - `~/.claude/skills/route-workflow/SKILL.md` — replaced flat verification tier table with: Minimum-Path Scoping decision tree (5 steps), scoping examples table (6 rows), Escalation Protocol (4 steps), Anti-Patterns list (4 items), refined Verification Tier Table
  - `~/.claude/skills/FRAMEWORK-STATE.md` — added analysis history entry

## Replay Verification
- **Replay target:** If WI-029 ran again under the new rules, the agent would: (1) identify changed files, (2) map them to pages, (3) visit 2-3 affected pages per batch, (4) log pass/fail — NOT run 500+ tests, NOT skip entirely.
- **Result:** PASS (contract-level)
- **Evidence:** Decision tree and scoping examples table now in route-workflow SKILL.md

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added 2026-04-12 entry for verification scoping
- **Known Gaps:** none
- **Decisions:** none (this is guidance, not a locked design choice)
