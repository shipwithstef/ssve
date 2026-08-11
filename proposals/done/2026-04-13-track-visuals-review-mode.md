# Framework Improvement: track-visuals review mode

**Status:** IMPLEMENTED (2026-04-13, see commit below)

## Evidence
- **Source:** User-reported during WI-032 dark mode verification pass
- **Finding:** User had 37 captured screenshots and wanted structured AI-vision analysis of dark mode correctness. No skill covered this. Task was routed ad-hoc through `/improve-framework` — wrong skill, no structured output format, no concern checklist.
- **Severity:** medium — missing capability, not a regression

## Diagnosis
- **Root cause:** `track-visuals` had four modes (baseline, diff, update, audit) but none addressed "I already have screenshots — analyze them for a specific concern." The `audit` mode covers design-doc compliance, not correctness concerns on already-captured state.
- **Category:** missing capability
- **Already in FRAMEWORK-STATE.md?** No — new finding
- **Route:** direct SKILL.md edit (user-reported, clear gap, no ambiguity)

## Implementation
- **Route:** direct SKILL.md edit
- **Files changed:**
  - `track-visuals/SKILL.md` — added `review` mode with concern checklist, structured report format, integration point row, and two self-verify checks (#4, #5)
- **Commits:** 31ed460

## Replay Verification
- **Replay target:** Run `track-visuals` in `review` mode on WI-032 screenshots (`.svc/visuals/WI-032/current-state/`, 37 files, concern: dark mode completeness)
- **Result:** PASS — mode executed, all 37 files processed, produced ranked issue report
- **Evidence:** `.svc/visuals/WI-032/review-dark-mode-completeness-2026-04-13.md` — 1 critical, 7 high, 1 low found; 29/37 clean

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add "2026-04-13: track-visuals review mode added"
- **Known Gaps:** none to move
- **Decisions:** none new
- **Capabilities:** update svc/CAPABILITIES.md — track-visuals now has 5 modes including review
