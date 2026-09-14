# Framework Improvement: Evolution F-001 / F-002 / F-004 (manifest parity, hook inventory, stale proposals)

## Evidence
- **Source:** `proposals/done/2026-04-19-evolution.md` (same-session evolution proposal, 7 findings)
- **Finding:**
  - F-001: `skills-manifest.json:99` lists `"assess-market-readiness"` in `corePackForRouting`; absent from `includedSkills` (lines 2–59)
  - F-002: `FRAMEWORK-STATE.md:18` says "2 PostToolUse hooks"; `hooks/hooks.json` registers 5
  - F-004: three 2026-04-18 proposals in `proposals/` whose artifacts already shipped
- **Severity:** high (F-001 blocks auto-readiness on fresh installs), medium (F-002 stale memory), medium (F-004 queue pollution)

## Diagnosis
- **Root cause:**
  - F-001: Manifest linter (`scripts/lint-skills-manifest.mjs`) checks output-path conflicts, not set-membership parity between `corePackForRouting` and `includedSkills`
  - F-002: FRAMEWORK-STATE "Current State" block is hand-maintained; Industrial-UI and Gemini-harness pushes added PostToolUse hooks without back-propagating the count
  - F-004: Proposal-lifecycle locked decision (FRAMEWORK-STATE:1810) requires `git mv` to `done/` post-implementation; enforcement was by convention, not by any skill's output contract
- **Category:** drift (F-001, F-002), inefficiency (F-004)
- **Already in FRAMEWORK-STATE.md?** no (all three new)

## Implementation
- **Route:** quick-fix (direct edits, no pipeline)
- **Files changed:**
  - `skills-manifest.json` — added `"assess-market-readiness"` to `includedSkills`
  - `FRAMEWORK-STATE.md:18` — corrected hook inventory (4 pre / 5 post / 2 stop)
  - `FRAMEWORK-STATE.md` Analysis History — added today's entry
  - `proposals/done/2026-04-19-evolution.md` — marked F-001/F-002/F-004 as IMPLEMENTED in headings
  - `proposals/2026-04-18-framework-improvement-industrial-ui.md` → `proposals/done/`
  - `proposals/2026-04-18-session-audit-industrial-progression.md` → `proposals/done/`
  - `proposals/2026-04-18-session-audit-gemini-masterclass.md` → `proposals/done/`
- **Commits:** (will be stamped after commit lands)

## Replay Verification
- **Replay target:**
  - `jq -r '.includedSkills[]' skills-manifest.json | grep -q '^assess-market-readiness$'` → exit 0
  - `python3 -c "import json; h=json.load(open('hooks/hooks.json')); assert len(h['hooks']['PostToolUse'])==5"` → exit 0, and `grep -c "5 PostToolUse" FRAMEWORK-STATE.md` ≥ 1
  - `test ! -f proposals/2026-04-18-framework-improvement-industrial-ui.md && test -f proposals/done/2026-04-18-framework-improvement-industrial-ui.md` → exit 0
- **Result:** PASS (executed inline; all three assertions hold as of commit)
- **Evidence:** see inline verification in session transcript

## Deferred follow-ups (NOT landed this loop)
- **F-001-followup:** extend `scripts/lint-skills-manifest.mjs` with `corePackForRouting ⊆ includedSkills` assertion (mechanical enforcement)
- **F-002-followup:** add hook-count assertion to `improve-framework` Step 5.5 self-verify
- **F-003, F-005, F-006, F-007:** remain open in `proposals/done/2026-04-19-evolution.md`

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added 2026-04-19 entry summarizing F-001/F-002/F-004 closure
- **Known Gaps:** none moved (these were not previously tracked there)
- **Decisions:** no new locked decisions
- **Capabilities:** no update needed (no new capabilities added; this is housekeeping)

**Status:** IMPLEMENTED (2026-04-19)
