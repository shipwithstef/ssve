# Framework Improvement: Feature Lane Process Tasks — Review Fixes

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** Self-review of just-shipped feature lane process tasks (validate-feature + write-spec Task Graph Setup sections), triggered by user `/improve-framework review for any issues/gaps`
- **Finding:** Four gaps + two advisor-identified additions
- **Severity:** 1 HIGH, 2 MEDIUM, 1 LOW, 2 advisory

## Diagnosis

- **Root cause:** First-pass implementation followed the diagnose-bug pattern closely but missed structural differences (validate-feature owns the graph vs write-spec embeds; Case c standalone needs adaptation from the shown template). Self-verify checks weren't extended from diagnose-bug to the new skills.
- **Category:** fragility (missing paths that would confuse agents in non-default flows)
- **Already in FRAMEWORK-STATE.md?** No (new, post-implementation review)

## Implementation

- **Route:** Direct SKILL.md edits
- **Files changed:**
  - `validate-feature/SKILL.md` — three-case restructure, "never re-run" line, self-verify checks #8–#9
  - `write-spec/SKILL.md` — Case (c) adaptation note, T=2 prose fix, finalize subject fix, "never re-run" line, self-verify checks #10–#11
  - `FRAMEWORK-STATE.md` — new Analysis History entry, Known Gaps entry for chaining boilerplate

### Gap details

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| 1 | validate-feature: no embed-only case (like write-spec Case b) — "write now" would overwrite existing JSON in full-lane scenario | HIGH | Three-case structure (a/b/c) matching write-spec pattern |
| 2 | write-spec Case (c): template shows `id:2, blocked_by:[1]` but prose says "use as Task 1" | MEDIUM | Explicit adaptation note: change id, all 2.X→1.X, blocked_by→[] |
| 3 | Both skills missing self-verify checks for task graph + process task completion | MEDIUM | validate-feature #8–#9 (allows skipped), write-spec #10–#11 (all completed) |
| 4 | write-spec finalize subject: `{T}` in otherwise concrete JSON template | LOW | Changed to "mark lane task completed" |
| 5 | Missing "Never re-run completed process tasks" after auto-compact blocks | Advisory | Added one-liner to both skills |
| 6 | Chaining boilerplate uses bare `lane-tasks.json` not `lane-tasks-<WI>.json` | Advisory | Logged to Known Gaps — needs bulk update across all skills |

## Replay Verification

- **Replay target:** Next validate-feature and write-spec invocations — verify three-case logic works, self-verify checks fire, "never re-run" prevents re-execution
- **Result:** PENDING — live execution verification
- **Evidence:** Structural review confirmed all edits are internally consistent. Cross-checked against diagnose-bug reference (checks #13–#14 pattern).

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Added "2026-04-12: feature lane process tasks review — four gap fixes"
- **Known Gaps:** Added "Chaining boilerplate uses bare `lane-tasks.json`"
- **Decisions:** No new locked decisions
- **Capabilities:** No change (existing skills enhanced, not new)
