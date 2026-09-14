# Framework Improvement: validate-feature K7 must check coverage, not just existence

## Evidence

- **Source:** WI-185 misroute, 2026-05-08 example-marketplace session
- **Finding:** validate-feature Step 0 + Step 3b K7 ("existing solution in codebase") fired because `MobileNav.jsx` and `MobileHeader.jsx` existed. Skill concluded "pattern already implemented; user perception is wrong" and routed to NO-SHIP-AS-FRAMED. Reality: `ROOT_PAGES.customer = ["Home", "Favorites", "Profile"]` covered only 3 of the 16 sidebar destinations the user was describing as inconsistent — the user's complaint was real and specific. Same-level pages (sidebar peers) had genuinely different headers. The escape-hatch verdict was wrong.
- **Severity:** medium (caused one bad routing decision; would cause more if not corrected)

## Diagnosis

- **Root cause:** K7's check is "does a component matching this concept exist in the codebase?" The skill answers yes/no. It does NOT check: "does the existing solution cover the full surface area the user is describing?" When the user describes inconsistency across N pages and the existing solution covers only a subset M < N, K7 wrongly fires because the skill confuses "implementation exists" with "implementation is complete for the described surface."
- **Category:** fragility (escape hatch over-fires when user's described problem is partial-coverage of an existing pattern)
- **Already in FRAMEWORK-STATE.md?** no (new finding)

## Implementation

- **Route:** `quick-fix` (single section in validate-feature/SKILL.md)
- **Files to change:**
  - `validate-feature/SKILL.md` — Step 3b K7 definition
- **Fix:**
  - When K7 considers firing, the skill MUST enumerate the user's described problem surface (e.g., "all sidebar destinations", "all customer mobile pages", "every checkout step") and compare against the existing solution's scope (e.g., ROOT_PAGES list, route-config, etc.).
  - K7 fires ONLY when existing solution covers ≥95% of the described surface.
  - When existing solution covers <95%, K7 does NOT fire and the skill must continue with business questions OR route to a bugfix/audit task that closes the gap.
  - Add a worked example to the skill: "If user says '16 sidebar pages have inconsistent headers' and codebase has a header component that handles only 3 of them, K7 does not fire — the user's complaint is real."

## Replay Verification

- **Replay target:** Re-run validate-feature against WI-185 with the corrected K7 logic. Expected: K7 does NOT fire (3/16 = 19% coverage < 95% threshold). Skill proceeds to either business questions OR routes directly to a bugfix to extend ROOT_PAGES.
- **Result:** PENDING

## FRAMEWORK-STATE.md Mutations (when implemented)

- **Analysis History:** add 2026-05-XX entry
- **Known Gaps:** none changed (new finding, addressed in same loop)
- **Decisions:** none new

## Origin

WI-185 misroute. User pasted clear description of inconsistency; agent's escape-hatch logic over-fired K7 by checking existence-of-component rather than coverage-of-described-problem.

**Status:** IMPLEMENTED (2026-05-08, see commit on this branch)
