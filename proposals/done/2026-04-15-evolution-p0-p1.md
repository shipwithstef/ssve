# Framework Improvement: WI Label Routing + AP-27 Ghost Execution + Loop Guard + Lane-Consistency Check

**Status:** IMPLEMENTED (2026-04-15, commit d21de9a)

## Evidence

- **Source:** Session replay — WI-031 execution where agent routed `console.error` chore to Lane 3 (feature), skipped Skill tool invocations, ignored `/loop` instruction, built 6-task graph for 17-step lane
- **Finding:** 4 distinct gaps in `route-workflow/SKILL.md`, `references/anti-patterns.md`, `review-gate/SKILL.md`
- **Severity:** P0 (2 items), P1 (2 items)
- **Proposal source:** `example-marketplace/proposals/2026-04-15-evolution.md`

## Diagnosis

| Finding | Root Cause | Category |
|---------|-----------|----------|
| WI `**Type:**` field used as routing signal | No rule saying code change wins over WI label | Gap / Fragility |
| Skills declared in tasks but Skill tool never called | No enforcement mechanism; AP-26 only covers substitution, not skipping | Gap (enforcement missing) |
| `/loop` instruction silently dropped | No freeform routing row for loop requests | Gap |
| Task graph omits lane steps without SKIP reason | No consistency check before writing lane-tasks JSON | Gap / Fragility |

## Implementation

**Route:** Direct SKILL.md edits (quick-fix for isolated contract additions)

**Files changed:**
- `route-workflow/SKILL.md` — 3 additions:
  1. WI type field routing rule (after change-type detection table)
  2. Loop routing row in freeform intent table + Loop guard block in task-graph section
  3. Lane-consistency check (task graph step 2, before writing lane-tasks JSON)
- `references/anti-patterns.md` — AP-27 Ghost Skill Execution (new section before Cross-References)
- `review-gate/SKILL.md` — G5 checklist item 11 (AP-27 ghost execution detection)

**Commits:** `d21de9a` on `s7an-it/seriousvibecoding` main

## Replay Verification

**Qualitative gaps (not testable by test-framework):** verified via contract inspection.

| Check | Result |
|-------|--------|
| WI type field rule is unambiguous | ✅ "the code change wins" — no edge case |
| AP-27 has clear detection criterion | ✅ `metadata.skill != null` + `status == completed` + no Skill invocation found |
| G5 item 11 references AP-27 by name | ✅ reviewers can look up the anti-pattern |
| Loop guard fires after task graph exists (not before) | ✅ "Do not set up the loop before the task graph exists" |
| Lane-consistency check requires documented SKIP (not just absence) | ✅ "silently omits = contract violation" |

## Adjustment from proposal

Proposal said "G4 checklist" for AP-27. G4 is the Technical Design Review (pre-execution). Ghost execution can only be checked post-execution → placed in **G5** (Executed Change Set Review) instead. G5 item 11 is the correct gate. The proposal's intent (catch ghost executions at review time) is fully preserved.

## FRAMEWORK-STATE.md Mutations

- Analysis History: WI-031 session replay — 4 gaps identified and fixed (P0×2 + P1×2)
- Known Gaps: none of these were previously logged; all new
- Decisions: placed AP-27 in G5 not G4 (execution review, not design review)
- CAPABILITIES.md: no new capabilities added — enforcement tightening only
