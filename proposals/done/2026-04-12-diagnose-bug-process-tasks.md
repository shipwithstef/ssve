# Framework Improvement: diagnose-bug process steps as trackable tasks (P1–P9)

**Status:** IMPLEMENTED (2026-04-12)

## Evidence

- **Source:** User architectural proposal during improve-framework iteration (Example Marketplace, 2026-04-12)
- **Finding:** The diagnose-bug process steps (spec anchor, targeted read, reproduce, pillar audit, pattern scan, etc.) are prose in the SKILL.md. The agent may skip or reorder them — there's no enforcement. The framework already has a task graph system (lane-tasks.json + TaskCreate/TaskUpdate + eval gate hook) that enforces lane-level task ordering. Why not encode intra-skill process steps as tasks too, using the same mechanism?
- **Severity:** high — this is the architectural gap that explains why all three previous improve-framework iterations were needed. Prose instructions are weak enforcement; task graphs with blocked_by are strong enforcement.

## Diagnosis

- **Root cause:** The task graph (lane-tasks.json) encoded LANE-level steps (diagnose-bug → plan-changeset → ... → verify-promotion) but left INTRA-SKILL steps as untracked prose. The eval gate hook already knows how to enforce task completion — it just had no sub-tasks to enforce for the diagnosis process itself.
- **Category:** missing capability — process-level task encoding
- **Already in FRAMEWORK-STATE.md?** No

## Implementation

- **Route:** Direct SKILL.md edit
- **Files changed:** `diagnose-bug/SKILL.md`

**Change 1:** After the "In Claude Code — mirror to TaskList" block in Step 0, added "Process Sub-tasks" section:
- 9 process tasks (P1–P9) created via TaskCreate immediately after the 7 lane tasks
- P1–P4 encode the spec-anchor → targeted-read → match/drift/gap → causal-classification sequence (the steps added in previous two improve-framework iterations)
- P5 is dynamic: after P4 completes, its description is updated to match the causal classification (Propagation/Action/Rendering)
- P6–P9 encode pillar audit, pattern scan, register discoveries, changeset brief
- Process tasks live in Claude task system only (not lane-tasks.json): lane-tasks tracks lane state across sessions; process tasks track intra-skill state within a session
- Naming convention: P1–P9 vs 1–7 (lane tasks) — distinguishable in UI

**Change 2:** Self-verify check #14 added: "All process tasks P1–P9 must be completed. P5 subject must reflect causal classification from P4 (not placeholder text)."

## Replay Verification

- **Replay target:** Manual — next diagnose-bug invocation
- **Contract:** After Step 0, agent creates 9 process tasks (P1–P9) in addition to 7 lane tasks. P5 is updated dynamically after causal classification. All P-tasks are visible in Claude UI. P6 (pillar audit) triggers the existing eval gate hook on TaskUpdate(completed).
- **Result:** MANUAL PENDING

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add entry
- **Decisions:** "diagnose-bug intra-skill process steps are tasks (P1–P9), not prose. The task graph encodes both lane-level ordering (1–7) and intra-skill ordering (P1–P9). Both are enforced via TaskUpdate/blocked_by/eval gate. P5 is dynamic — updated after causal classification in P4."
- **Capabilities:** New capability: process-level task encoding in diagnose-bug
