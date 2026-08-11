# Framework Improvement: WI Close-Out Enforcement

**Status:** IMPLEMENTED (2026-04-12)

## Evidence
- **Source:** Live WI-038 execution on Example Marketplace — retroactive bugfix declared VERIFIED without updating INDEX.md, without creating a task graph, and without a Pillar Revisit Audit section in the WI file.
- **Finding:**
  1. `route-workflow/SKILL.md` Lane 4 step list had 7 steps — step 8 "Close WI" existed only in the task graph *example* (line 2089) but not in the formal prose step table for either forward or retroactive execution.
  2. `verify-promotion/SKILL.md` self-verify check #1 only checked `docs/specs/features/<name>.md` — did not check `docs/specs/work-items/INDEX.md` for bugfixes/WIs.
  3. Retroactive Lane 4 section did not explicitly state that the task graph must be created FIRST, before any diagnostic work — contrast with forward execution where `diagnose-bug` opens with "Before any diagnosis work, establish a task graph."
- **Severity:** medium — enforcement gap causes silent non-compliance; does not affect production correctness but degrades framework auditability

## Diagnosis
- **Root cause:** All three gaps are downstream of the same failure — WI-038 fix was applied ad-hoc during WI-036 work, without `route-workflow` being formally invoked to route it to Lane 4 and create the task graph. Once the task graph was missing, every enforcement mechanism depending on it (stop hook, eval gate hook, pillar audit eval_matrix) was also silently bypassed. INDEX.md was missed because step 8 "Close WI" was not in the formal step list — only in the task graph example.
- **Category:** fragility (enforcement gap)
- **Already in FRAMEWORK-STATE.md?** No — new finding

## Implementation
- **Route:** direct SKILL.md edits (2 files)
- **Files changed:**
  - `route-workflow/SKILL.md`:
    - Lane 4 forward step list: added step 8 "Close WI — update WI file Status to VERIFIED, update INDEX.md row, update project-state.md if exists, append learnings to memory"
    - Lane 4 retroactive section: added MANDATORY FIRST ACTION block — "Create .svc/lane-tasks-<WI>.json BEFORE any diagnostic work. The task graph is the enforcement mechanism."
    - Retroactive step table: added step 8 with same Close WI definition
    - Updated prose: "all eight retroactive steps" (was "all seven")
  - `verify-promotion/SKILL.md`:
    - Self-verify check #1 split into two checks: #1 "Spec/WI status updated to VERIFIED" (now covers both features and bugfixes), #2 "INDEX.md row updated (for WI-tracked work)". Old checks #2-6 renumbered to #3-7.

## Replay Verification
- **Replay target:** Next retroactive Lane 4 execution — task graph must be created first; verify-promotion must block on INDEX.md check; WI file must have VERIFIED status when closing
- **Result:** PENDING — next live execution
- **Evidence:** PENDING

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** add "2026-04-12: WI close-out enforcement" entry
- **Known Gaps:** none to move (new finding, immediately fixed)
- **Decisions:** none new
- **Capabilities:** no new capabilities — enforcement strengthening only
