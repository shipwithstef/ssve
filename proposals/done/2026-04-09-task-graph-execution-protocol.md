# Framework Improvement: Task-Graph Execution Protocol (Level A)

## Evidence
- **Source:** User feedback during Example Marketplace WI-012 session, 2026-04-09
- **Finding:** When route-workflow routes to a lane, nothing creates trackable tasks. Skills chain via prose Chaining sections. User must paste Next: text or type /skill-name. Progress invisible. Context death loses position. Already in Known Gaps as "Auto-advance state machine — HIGH."
- **Severity:** HIGH

## Diagnosis
- **Root cause:** route-workflow had no task-creation step at lane entry. The `--progressive` flag and `### Chaining` sections tried to solve this but were prose-based and session-bound. No persistence, no visibility, no condition tracking.
- **Category:** missing capability (no task execution engine)
- **Already in FRAMEWORK-STATE.md?** Yes — "Auto-advance state machine" in Known Gaps (3-4 days, HIGH). This implements Level A (the quick version).

## Implementation
- **Route:** Direct SKILL.md edits (quick-fix scope)
- **Files changed:**
  - `route-workflow/SKILL.md` — new Task-Graph Execution Protocol section with full spec: TaskCreate at lane entry, dependencies via addBlockedBy, conditional tasks via description prefixes, skip-with-reason, session persistence, relationship to Output Protocol, blanket inheritance rule for all 48 skills
  - `diagnose-bug/SKILL.md` — Chaining section updated with Task-graph mode block
  - `plan-changeset/SKILL.md` — same
  - `execute-changeset/SKILL.md` — same
  - `review-gate/SKILL.md` — same
  - `write-e2e/SKILL.md` — same
  - `land-changeset/SKILL.md` — same
  - `verify-promotion/SKILL.md` — same
  - `FRAMEWORK-STATE.md` — Analysis History entry, Known Gaps updated (Level A done, Level B deferred MEDIUM), new locked decision

## Replay Verification
- **Replay target:** Tier-1 evals + mental scenario walk: route WI-012 to Lane 4 retroactive → verify 8 tasks would be created with dependencies and conditions → verify progress visible via TaskList → verify context death preserves task state
- **Result:** PASS
- **Evidence:** Tier-1 evals 7/7 (3,141 checks). Scenario walk confirms task creation, dependency chain, condition evaluation, and persistence model are all specified.

## FRAMEWORK-STATE.md Mutations
- **Analysis History:** Added "2026-04-09: Task-Graph Execution Protocol (Level A auto-advance)"
- **Known Gaps:** "Auto-advance state machine" updated to Level B only (Level A implemented), impact reduced HIGH → MEDIUM
- **Decisions:** Added "Task-Graph Execution Protocol (Level A)" as locked decision
- **Capabilities:** No numeric change (still 48 skills, 13 reference docs)

## Status
**IMPLEMENTED** (2026-04-09, commit `ef72f1c00d31bc9c4704696f2cf4e1d1faa06dad`)
