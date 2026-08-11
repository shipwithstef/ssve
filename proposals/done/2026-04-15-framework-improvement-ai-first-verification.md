# Framework Improvement: AI-First Verification Ladder + AP-28

**Status:** IMPLEMENTED (2026-04-15)

## Evidence

- **Source:** User session replay, Example Marketplace WI-025 pull-to-refresh verification (2026-04-15)
- **Finding:** Agent declared "real device check by user" after ONE Playwright synthetic-TouchEvent failure, skipping 4+ available V2 mechanisms (device descriptor with `hasTouch:true`, CDP `Input.dispatchTouchEvent`, React fiber direct invocation, existing E2E suite replay, testability seam). User directive: "I don't want user feedback — it should be the last possible option."
- **Severity:** high (premature user handoff is a systemic bias across verification phases, not a one-off)

## Diagnosis

- **Root cause:** `verify-promotion/SKILL.md` had no codified escalation ladder. `test-journeys/SKILL.md` has a strong S0/S1/S2 with "S2 is LAST RESORT" at line 254, but that ladder applies to pre-landing AC verification, not post-landing production verification. Post-landing verification had no tier discipline. Also: no anti-pattern classified premature user handoff — AP-26 (skill substitution) and AP-27 (ghost execution) exist but don't cover this mode.
- **Category:** missing capability + drift (implicit doctrine not enforced)
- **Already in FRAMEWORK-STATE.md?** no (new)

## Implementation

- **Route:** Direct SKILL.md + reference edits (no pipeline needed; isolated skill surgery)
- **Files changed:**
  - `verify-promotion/SKILL.md` — new "Verification Escalation Ladder" section (V0/V1/V2/V3 + V2 Exhaustion Log + confidence tiers VERIFIED/VERIFIED-L2/VERIFIED-USER/UNVERIFIED)
  - `references/anti-patterns.md` — AP-28 (Premature User Handoff) with examples, detection, enforcement
  - `FRAMEWORK-STATE.md` — new Analysis History entry
  - `~/.claude/projects/-home-dianast-app-workspaces-example-marketplace/memory/feedback_playwright_gesture_verification.md` — new project-scoped memory with gesture-specific V2 mechanisms
  - `~/.claude/projects/-home-dianast-app-workspaces-example-marketplace/memory/MEMORY.md` — index entry
- **Commits:** (filled in after commit)

## Replay Verification

- **Replay target:** A WI-025-like session where gesture verification is needed. Would the agent now exhaust V2 before declaring V3?
- **Result:** qualitative PASS
- **Evidence:**
  - `verify-promotion/SKILL.md` now explicitly states "Verification is AI-first. User handoff is the LAST option, not a shortcut."
  - V2 tier names five specific mechanisms for gesture verification (device descriptor, CDP, fiber invocation, E2E replay, seam) — no longer a blank space where the agent has to improvise.
  - AP-28 names the failure mode explicitly with examples that match WI-025's exact path; detection heuristics catch reports that skip V2 exhaustion.
  - Memory `feedback_playwright_gesture_verification.md` gives project-level signal specific to the React closure-staleness mechanism, so future gesture-verification attempts in Example Marketplace start from a better prior.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Added entry "2026-04-15: AI-first verification ladder (V0/V1/V2/V3) + AP-28 Premature User Handoff" (top of history list)
- **Known Gaps:** N/A (this was a new finding, not a deferred gap)
- **Decisions:** Added three locked decisions (verification is AI-first by default; "I didn't think to try X" is not valid V2 exhaustion; test-journeys pre-landing vs verify-promotion post-landing both share last-resort discipline)
- **Capabilities:** No update to `svc/CAPABILITIES.md` (no new skill; refinement of existing verification contract)
