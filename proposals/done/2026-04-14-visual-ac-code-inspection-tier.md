# Framework Improvement: Static AC Pre-check (Code Inspection Tier)

**Status:** IMPLEMENTED (2026-04-14)

## Evidence

- **Source:** User-reported issue during WI-048 (Example Marketplace dark mode gradients)
- **Finding:** `test-journeys/SKILL.md` Step 3 listed "code inspection" only as a fallback for "non-UI-testable ACs (background jobs, data integrity)". DM-22/DM-23 (CSS gradient dark mode coverage) were deferred to user as "awaiting visual confirmation" — but both were trivially verifiable by `grep` in 2 tool calls.
- **Severity:** medium — causes unnecessary user round-trips and breaks pipeline autonomy for structural/CSS ACs

## Diagnosis

- **Root cause:** The verification hierarchy in test-journeys was inverted. Code inspection was labeled a "fallback" when it should be the first check for static, structural ACs. The memory `feedback_manual_qa_over_playwright.md` was written to prevent expensive Playwright login flows, but was applied too broadly — covering ACs that needed no browser at all.
- **Category:** inefficiency + missing capability (no explicit S0/S1/S2 tier model)
- **Already in FRAMEWORK-STATE.md?** No (new gap)

## Implementation

- **Route:** Direct SKILL.md edit
- **Files changed:**
  - `test-journeys/SKILL.md` — inserted Step 2.5 (Static AC Pre-check) before Step 3; added S0/S1/S2 tier table; updated line 243 fallback statement; added guardrail #6
- **Key additions:**
  - S0 (code inspection): CSS class presence, Tailwind tokens, config values — grep/Read, no browser
  - S1 (browser automation): runtime behavior ACs — browse/Playwright
  - S2 (user delegation): LAST RESORT, requires explicit explanation of why S0 and S1 failed
  - Guardrail: "Do NOT delegate an AC to the user as 'awaiting visual confirmation' if a grep or file read can answer it"

## Replay Verification

- **Replay target:** WI-048 DM-22 and DM-23 — previously deferred to user, now verified via code inspection
- **Result:** PASS
  - DM-22: grep confirmed all 6 light-stop gradient instances in CustomerPoints.jsx have `dark:from-*-950/50` overrides; 3 flagged instances use `-600` stops (already dark, no override needed)
  - DM-23: grep confirmed all 10 light-stop gradient instances in LoyaltyProgram.jsx (including ternary string branches at L745/L746) have `dark:from-*-950/50` overrides
- **Evidence:** `docs/specs/features/dark-mode.md` DM-22/DM-23 updated to `✅ 04-14 (code)`; committed to Example Marketplace main `7a94812`

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry for 2026-04-14 Static AC Pre-check tier
- **Known Gaps:** None to move (this was a new gap, now fixed)
- **Decisions:** S0/S1/S2 tier model for AC verification locked — code inspection is first-tier, not fallback
