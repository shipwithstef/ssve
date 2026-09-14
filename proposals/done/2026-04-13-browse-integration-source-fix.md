---
**Status:** IMPLEMENTED — 2026-04-13, commit f5a57a5
---

# Framework Improvement: browse-integration.md source of truth fix

## Evidence
- **Source:** User-reported during WI-032 dark mode visual capture session
- **Finding:** `references/browse-integration.md` Option A instructed cloning `https://github.com/nichochar/gstack.git` — wrong repo, wrong approach
- **Severity:** medium — any agent reading this file would attempt a clone of the wrong repo instead of using the pre-built binary already at `~/gstack/browse/dist/browse`

## Diagnosis
- **Root cause:** browse-integration.md was written generically (for machines without gstack) without accounting for the fact that gstack is already installed at `~/gstack` on this machine. The nichochar reference was a placeholder that never got corrected.
- **Category:** drift — reference file diverged from machine reality
- **Already in FRAMEWORK-STATE.md?** No

## Implementation
- **Route:** direct SKILL.md edit (reference file, not a skill)
- **Files changed:** `references/browse-integration.md`
- **Commits:** f5a57a5

### Changes
1. Renamed section from "Standalone Setup" → "Setup"
2. Added **Step 0** as the mandatory first check: `~/gstack/browse/dist/browse status`
3. Replaced nichochar GitHub clone with "build from `~/gstack`" fallback
4. Updated verify section to show full path form first
5. Removed stale "find ~ -path" discovery command (no longer needed now that path is known)

## Replay Verification
- **Replay target:** In the WI-032 session immediately prior, `~/gstack/browse/dist/browse status` returned `Status: healthy` — browse was already working. The fix aligns the doc with demonstrated reality.
- **Result:** PASS (the correct path was confirmed operational before the fix was written)

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add entry for this fix
- **Known Gaps:** none to move
- **Capabilities:** no capability change — browse was already working; reference accuracy improved
