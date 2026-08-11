# Framework Improvement: closed-WI resume hard-return

**Status:** IMPLEMENTED (2026-04-18, commit `474139e`)

## Evidence
- **Source:** `proposals/2026-04-18-session-audit-wi-070.md` + `proposals/2026-04-18-evolution.md`
- **Finding:** `route-workflow` resume logic selected `in_progress` / `pending` tasks but lacked a closed-state branch for named WIs whose task graphs were already complete and whose WI files were already `VERIFIED`
- **Severity:** high

## Diagnosis
- **Root cause:** resume semantics assumed every named WI with a task graph was resumable work. The file-backed graph was authoritative for active work, but the router contract never defined what to do when the authoritative graph said "nothing left."
- **Category:** gap
- **Already in FRAMEWORK-STATE.md?** no (new before this implementation)

## Implementation
- **Route:** direct SKILL.md edit + framework replay
- **Files changed:**
  - `route-workflow/SKILL.md`
  - `test-framework/evals/tier-1/validate-framework-self-management.sh`
  - `platform-operating-architect/SKILL.md`
  - `references/knowledge/svc/CAPABILITIES.md`
  - `FRAMEWORK-STATE.md`
- **Commits:** `474139e`

## Replay Verification
- **Replay target:** `bash test-framework/evals/tier-1/validate-framework-self-management.sh`
- **Result:** PASS
- **Evidence:** `220 passed, 0 failed`

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** added `2026-04-18: closed-WI resume hard-return added after WI-070 replay`
- **Known Gaps:** none moved; this was a new gap
- **Decisions:** locked the closed-WI summary rule and the "fold replay-required drift into the same cycle" rule
- **Capabilities:** yes — updated `references/knowledge/svc/CAPABILITIES.md`
