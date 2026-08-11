# Framework Improvement: assess-market-readiness score literacy + artifact commit

**Status:** IMPLEMENTED 2026-04-15

## Evidence
- **Source:** User report — Example Marketplace launch assessment (73/100). User response: "these scores look low, why doesn't it give feedback how to get to 100, shouldn't this be the goal?"
- **Finding:** `assess-market-readiness/SKILL.md` produced dimension scores without explaining what those scores mean in context, without distinguishing traction-locked from action-locked gaps, without a score evolution trajectory, and without committing the output to git.
- **Severity:** medium — causes builder to misread a passing score (73 = GTM first) as "almost there" and potentially delay launch unnecessarily

## Diagnosis
- **Root cause:** The 0–100 scale implies 100 is the goal. Without a ceiling interpretation, builders read 73 as 73% of the way to done — when actually it's 3 points above the launch threshold. Separately: the output template ended with "Routing Decision" but never instructed the skill to commit the file, leaving milestone evidence uncommitted.
- **Category:** inefficiency (confusion about scoring semantics) + missing capability (git commit + trajectory)
- **Already in FRAMEWORK-STATE.md?** No — new finding

## Implementation
- **Route:** direct SKILL.md edit (4 targeted insertions)
- **Files changed:** `assess-market-readiness/SKILL.md`
- **Changes:**
  1. Score ceiling note after dimension weight table (Step 2): explains 78–82 is realistic pre-launch ceiling, 70+ is the win condition, traction-locked vs action-locked distinction defined
  2. Step 4 gap classification split: "Action-locked non-blocking" vs "Traction-locked non-blocking" with rule "never block a 70+ scoring product on traction-locked gaps"
  3. Step 6 routing table: score interpretation reminder added — instructs the output to include one contextual sentence after the score
  4. Step 7 output template: added "Score Evolution Roadmap" table template (today → 10 customers → 100 customers per dimension) + Step 8 "Commit the assessment to git" with why-commit and optional-tag guidance
  5. Self-verify: added checks 8 (git commit) and 9 (evolution roadmap present)

## Replay Verification
- **Replay target:** qualitative — would the Example Marketplace builder have understood the 73/100 score with these changes in place?
- **Result:** PASS qualitatively. The ceiling note + traction-locked split directly answers "why are scores low?" (expected for pre-launch, traction-locked dimensions can't score higher). The evolution roadmap answers "how do I get to 100?" (you don't pre-launch; distribution goes 42→55→75 as customers arrive). The commit step answers the second user question (artifacts now tracked in git).
- **Evidence:** Changes verified in place via Read of SKILL.md

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for this improvement
- **Known Gaps:** none to move (new finding, not previously deferred)
- **Decisions:** score ceiling for first-time launch = 78–82 realistic max; 70+ = win condition; traction-locked gaps never block launch
- **Capabilities:** no new skills added; assess-market-readiness output quality improved
