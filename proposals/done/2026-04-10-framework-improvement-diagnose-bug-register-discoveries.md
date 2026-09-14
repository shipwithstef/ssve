# Framework Improvement: diagnose-bug Register Discoveries Step

**Status:** IMPLEMENTED (2026-04-10)

## Evidence
- **Source:** User-reported anti-pattern
- **Finding:** diagnose-bug sessions end with "want me to implement or file?" instead of deterministically decomposing and routing — gap between Step 5 (smallest safe fix) and Step 6 (proof of fix)
- **Severity:** medium

## Diagnosis
- **Root cause:** No contract step between diagnosis completion and proof-of-fix planning to evaluate whether findings decompose into multiple independent work items. The agent had no instruction for what to do when pattern scan, pillar audit, or root cause analysis surfaces work beyond the original bug report.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No (new)

## Implementation
- **Route:** Direct SKILL.md edits (skill contract surgery + router sync)
- **Files changed:**
  - `diagnose-bug/SKILL.md` — new Step 5.5, expanded Outputs, self-verify 11→12 checks
  - `route-workflow/SKILL.md` — Lane 4 step 1 output list expanded with "register discoveries"; Cross-Skill Routing table expanded with multi-WI decomposition row
  - `references/knowledge/svc/CAPABILITIES.md` — updated diagnose-bug description
  - `FRAMEWORK-STATE.md` — new Analysis History entry
- **Commits:** pending

## Replay Verification
- **Replay target:** tier-1 evals must pass; diagnose-bug SKILL.md must contain "Register Discoveries" section with decompose/register/prioritize/route protocol
- **Result:** PASS
- **Evidence:** `bash test-framework/evals/run-all-evals.sh --tier1` → 9 scripts, 3,813 checks, 0 failures

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added 2026-04-10 entry for Register Discoveries step
- **Known Gaps:** No change (this was a new finding, not a deferred gap)
- **Decisions:** None locked (this is a process step addition, not a design debate)
- **Capabilities:** Updated diagnose-bug row in svc/CAPABILITIES.md
