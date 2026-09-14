# Blend Plan: taskmaster (blader/taskmaster)

**Source:** https://github.com/blader/taskmaster
**SHA:** HEAD (v4.2.0)
**Date:** 2026-04-09
**Previous blend:** first blend

## Summary

2 patterns to blend, 1 hybrid, 3 to skip.

| # | Pattern | Target | What breaks without it | What changes after |
|---|---------|--------|----------------------|-------------------|
| 1 | Stop hook completion guard | `route-workflow` Task-Graph Protocol + Claude hooks | Agent stops mid-lane (WI-012: stopped at task 4/8 "to save context"), tasks 5-8 never execute | Stop is blocked when task graph has pending tasks; compliance prompt names remaining tasks |
| 2 | Anti-rationalization language | `route-workflow` Task-Graph Protocol | Agent rationalizes stopping with "recommend fresh session" or "context concerns" — treated as valid | Explicit rules: "PROGRESS IS NOT COMPLETION", "context management is not your job", "DO NOT NARRATE — EXECUTE" |
| 3 | HYBRID: File-backed task state + output-to-file | `route-workflow` Task-Graph Protocol | Task state is ephemeral (Claude TaskCreate); skill outputs flood chat consuming tokens; no persistence across sessions | Task graph written to `.svc/lane-tasks.json`; skill outputs written to WI files (not chat); compliance prompt reads from file to know what's pending |

## Dimensional Comparison

| Dimension | TaskMaster | svc | Verdict | Action |
|---|---|---|---|---|
| Completion enforcement | Done token + Stop hook blocks stop | Nothing — agent can stop anytime | **gap** | **BLEND** |
| Goal re-anchoring | 7-step compliance prompt on premature stop | Output Protocol `**Next:**` trailer (suggestive, not enforcing) | **theirs-better** | **BLEND** |
| Anti-rationalization | Explicit rules: "PROGRESS IS NOT COMPLETION", "DO NOT NARRATE — EXECUTE", honesty check | feedback_never_stop_lane_prematurely memory (per-project, not framework-wide) | **theirs-better** | **BLEND** into route-workflow |
| Same-session recovery | Codex PTY injection into running process | .continue-here.md (new session, not same session) | **different-valid** | **SKIP** — Claude Code doesn't support PTY injection; .continue-here.md is the correct Claude approach |
| Task persistence | None (TaskMaster is a completion guard, not task manager) | Claude TaskCreate (ephemeral within session) | **gap in both** | **HYBRID** — combine user's file-backed insight with TaskMaster's completion checking |
| Output routing | None (all in chat) | All in chat | **gap in both** | **HYBRID** — user's insight: write to files, read back on demand |
| Task dependencies | None | TaskUpdate addBlockedBy (in-memory) | **ours-better** | SKIP |
| Subagent bypass | Transcripts < 20 lines auto-pass | None | **theirs-better** | SKIP for now — svc doesn't use Stop hooks yet; add when implementing blend item 1 |
| Counter-based escalation | TASKMASTER_MAX limits blocks before allowing stop | diagnose-bug 3-attempt escalation (skill-specific) | **comparable** | SKIP — adopt TASKMASTER_MAX equivalent only if stop hook causes infinite loops |
| Dual-platform support | Claude + Codex from same prompt | Claude-only (Codex via separate chaining docs) | **theirs-better** | SKIP — not the current priority |
| Token efficiency | None (compliance prompt injected in full each time) | None (skills output everything in chat) | **gap in both** | **HYBRID** — file-backed state is the fix for both |

## Blend Items

### 1. Stop Hook Completion Guard → `route-workflow` + Claude hooks config

**From:** `taskmaster/check-completion.sh` (Stop hook that blocks stop when done token missing)
**Into:** New section in `route-workflow/SKILL.md` Task-Graph Execution Protocol + a shell script hook

**The problem in svc today:**
When a task graph is active (e.g., WI-012 Lane 4 with 8 tasks), the agent can stop at any point — between tasks, mid-task, or after deciding "context is getting large." On 2026-04-09, the agent stopped at task 4/8 and recommended "starting Task 5 in a fresh session." Tasks 5-8 (write-e2e, land-changeset, verify-promotion, close WI-012) never executed. The user had to explicitly say "why you stopped on task 5?" The Output Protocol's `**Next:**` trailer SUGGESTS the next step but doesn't ENFORCE it. The feedback memory says "don't stop mid-lane" but memories are per-project, not framework-wide, and are advisory not enforcing.

**How TaskMaster solves it:**
A Claude Stop hook (`check-completion.sh`) that:
1. Reads the session transcript
2. Checks for a done signal
3. If missing: returns `{ decision: "block", reason: "<compliance prompt>" }`
4. The compliance prompt is a 7-step checklist that forces goal confrontation

**What this changes in svc:**
1. New hook script: `hooks/svc-task-completion-guard.sh` — runs on Claude Code Stop event. Reads task state. If ANY tasks are `pending` or `in_progress`, blocks stop with a compliance prompt that names the remaining tasks.
2. Task state source: reads `.svc/lane-tasks.json` (see blend item 3). This is the file-backed task graph — not Claude's ephemeral TaskCreate.
3. Compliance prompt adapted for svc: "You have N of M tasks remaining: [list]. PROGRESS IS NOT COMPLETION. Continue with Task [next]." Plus the anti-rationalization rules from blend item 2.
4. Subagent bypass: if the transcript is < 20 lines, allow stop (don't block short agent dispatches).
5. Escape hatch: `SVC_COMPLETION_MAX` env var (default 3) — after N blocked stops, allow stop but write .continue-here.md with remaining tasks. This prevents infinite loops if the agent is genuinely stuck.

**What NOT to take:**
- The done token (`TASKMASTER_DONE::session_id`) — svc's task graph completion (all tasks `completed`) is a richer signal than a flat string
- The Codex PTY injection path — not applicable to Claude Code
- The exact transcript-parsing approach — svc reads a JSON file, not the JSONL transcript

**Why this matters:**
The WI-012 incident is the evidence. 4 hours of framework improvements produced a task graph protocol, but the agent still stopped mid-lane because nothing ENFORCED completion. The Output Protocol is suggestive; the Stop hook is enforcing. This is the difference between "please continue" and "you cannot stop."

**Hybrid opportunity:**
TaskMaster's Stop hook checks for a flat string token. svc can do better: the hook reads `.svc/lane-tasks.json`, checks which tasks are `completed` vs `pending`/`in_progress`, and names the specific remaining tasks in the compliance prompt. This is more informative than TaskMaster's generic "check the task list" — it tells the agent exactly what to do next without re-reading the conversation.

---

### 2. Anti-Rationalization Language → `route-workflow` Task-Graph Protocol

**From:** `taskmaster/taskmaster-compliance-prompt.sh` (the 7-step compliance prompt)
**Into:** `route-workflow/SKILL.md` Task-Graph Execution Protocol section

**The problem in svc today:**
The agent rationalizes stopping with plausible-sounding reasons: "this session has used significant context," "recommend starting in a fresh session," "given the heavy context use on framework work." These sound reasonable but violate the task graph contract. The feedback memory (`feedback_never_stop_lane_prematurely.md`) catches this per-project, but it's advisory — the agent can ignore it. There's no framework-wide anti-rationalization rule.

**How TaskMaster solves it:**
Explicit anti-rationalization rules in the compliance prompt:
- "PROGRESS IS NOT COMPLETION"
- "DO NOT NARRATE — EXECUTE" — if incomplete work remains, do it, don't describe it
- "'Diminishing returns' is NOT a valid stop reason"
- "'Would require broader architectural changes' is narrating, not doing"
- "Honesty check: did you actually TRY, or are you rationalizing?"

**What this changes in svc:**
Add an **Anti-Rationalization Rules** block to `route-workflow/SKILL.md` Task-Graph Execution Protocol, after the "Skill contract obligation" section. These rules apply whenever a task graph is active:

```markdown
## Anti-Rationalization Rules (when task graph is active)

These rationalizations are INVALID reasons to stop mid-lane. If you catch yourself thinking any of them, that is a signal to CONTINUE, not to stop:

- "Context is getting large" — auto-compact handles this. Not your job.
- "Recommend starting in a fresh session" — the task graph persists. Keep going.
- "This session has used significant context on framework work" — irrelevant. Tasks remain.
- "Given the heavy context use" — auto-compact. Keep going.
- "This is a significant context-consuming task" — so? Do it.
- "Diminishing returns" — not a valid stop reason when tasks are pending.
- Progress summaries instead of execution — DO NOT NARRATE. EXECUTE.

PROGRESS IS NOT COMPLETION. A lane with 4/8 tasks done is not "good progress" — it is an incomplete lane. The only valid stop reasons are: (a) all tasks completed, (b) user explicitly said stop, (c) a blocker that requires user input, (d) the escape hatch counter (SVC_COMPLETION_MAX) was exceeded.
```

**What NOT to take:**
- The full 7-step compliance prompt — svc's per-skill self-verify checks are more precise. Take the anti-rationalization LANGUAGE, not the entire checklist structure.
- "Check the plan" / "Check for loose ends" — svc already has self-verify tables per skill.

**Why this matters:**
Same evidence as blend item 1. The agent stopped at task 4/8 with a rationalization ("given the heavy context use"). The anti-rationalization rules make this explicitly invalid. Combined with the Stop hook (blend item 1), the agent cannot rationalize AND cannot silently stop.

**Hybrid opportunity:**
TaskMaster's rules are generic ("check the task list"). svc's rules reference the specific task graph: "You have tasks 5-8 pending: write-e2e, land-changeset, verify-promotion, close WI-012." This is more actionable because the agent doesn't need to figure out what's left — it's told.

---

### 3. HYBRID: File-Backed Task State + Output-to-File → `route-workflow` Task-Graph Protocol

**From:** User's own insight (not from TaskMaster — TaskMaster doesn't have file persistence)
**Into:** `route-workflow/SKILL.md` Task-Graph Execution Protocol

**The problem in svc today:**
Two problems compound:

1. **Task state is ephemeral.** `TaskCreate`/`TaskUpdate` live in Claude Code's session memory. If the session restarts or a hook needs to check task state, there's no file to read. The Stop hook from blend item 1 REQUIRES a file to check — it's a bash script, it can't call `TaskList`.

2. **Skill outputs flood chat.** The diagnose-bug output for WI-012 was ~300 lines in chat (root cause, pillar revisit, pattern scan, affected artifacts, learnings, pillars matrix). Every token of that stays in context. Downstream skills (write-e2e, review-gate) need parts of it but must wade through the entire chat history. This is wasteful — write once to a file, read specific sections on demand.

**How to solve it (hybrid — neither TaskMaster nor svc has this today):**

**Part A: File-backed task graph.**

When `route-workflow` creates a task graph, ALSO write it to `.svc/lane-tasks.json`:

```json
{
  "wi": "WI-012",
  "lane": "bugfix-retroactive",
  "created": "2026-04-09T...",
  "tasks": [
    {"id": 1, "skill": "diagnose-bug", "subject": "...", "status": "completed", "completed_at": "..."},
    {"id": 2, "skill": "plan-changeset", "subject": "...", "status": "completed", "skip_reason": "no delta"},
    {"id": 5, "skill": "write-e2e", "subject": "...", "status": "pending", "conditions": "MANDATORY user-facing"}
  ]
}
```

When a skill completes, update BOTH `TaskUpdate` (for UI) AND `lane-tasks.json` (for persistence + hooks). The file is the source of truth; `TaskCreate`/`TaskUpdate` are the display layer.

The Stop hook (blend item 1) reads this file: `jq '[.tasks[] | select(.status != "completed")] | length' .svc/lane-tasks.json`. If > 0, block stop.

On session resume: read `lane-tasks.json`, recreate `TaskCreate` entries from it, resume from first non-completed task.

**Part B: Output-to-file convention.**

Skill outputs go to the work-item file (for bugfixes: `docs/specs/work-items/WI-012.md`) or a dedicated output file. Chat carries a 3-5 line summary + the `**Next:**` trailer. When a downstream skill needs the full output, it reads the file.

Example for diagnose-bug:
- **File:** Full brief (root cause, pillar revisit, pattern scan, affected artifacts, learnings, pillars matrix) → `docs/specs/work-items/WI-012.md` (already done this session)
- **Chat:** "diagnose-bug complete. Root cause: prop-shape mismatch on PhotoUpload. 3 pillars affected (journey, AC, cost). Pattern scan: 0 additional mismatches in 31 components. Full brief in WI-012.md."
- **Next skill reads:** `docs/specs/work-items/WI-012.md` — not the chat history

This cuts chat tokens by ~80% for verbose skills while preserving all information in files.

**What this changes in svc:**
1. `route-workflow/SKILL.md` Task-Graph Protocol: add "File-Backed Persistence" section. When creating task graph, write `.svc/lane-tasks.json`. When updating task status, update the file. On session start, check if file exists and recreate tasks from it.
2. `route-workflow/SKILL.md` Task-Graph Protocol: add "Output-to-File Convention" section. Skill outputs go to files. Chat carries summaries. Downstream skills read files.
3. All lane skills: update chaining sections to note "update `.svc/lane-tasks.json`" alongside `TaskUpdate`.

**What NOT to take:**
- TaskMaster's approach (it doesn't have file persistence — it reads the JSONL transcript)
- A complex file format — keep it simple JSON, one file per active lane

**Why this matters:**
1. The Stop hook REQUIRES a file to read (bash can't call TaskList). Without file persistence, blend item 1 doesn't work.
2. Token savings of ~80% on verbose skill outputs compound across every skill in a lane. A 21-skill greenfield lane that writes to files instead of chat saves thousands of tokens.
3. Session resume becomes deterministic — read the file, resume from the first pending task. No .continue-here.md needed as a separate mechanism.

**Hybrid opportunity:**
This is pure hybrid — neither TaskMaster nor svc has file-backed task persistence. TaskMaster contributes the Stop hook enforcement; the user contributes the file-backed + output-to-file insight; svc contributes the task graph structure with dependencies and conditions. The result is better than any individual source.

---

## Skipped Items

| External | Reason for skip |
|----------|----------------|
| Done token (`TASKMASTER_DONE::session_id`) | svc's task graph completion (all tasks `completed` in lane-tasks.json) is a richer signal than a flat string token. The Stop hook checks the JSON file, not a string in the transcript. |
| Codex PTY injection | Not applicable to Claude Code. The Stop hook path is the Claude equivalent. |
| Full 7-step compliance checklist structure | svc has per-skill self-verify tables that are more precise. Take the anti-rationalization LANGUAGE, not the full checklist. |
| Subagent bypass (< 20 lines) | Add later when implementing the Stop hook if subagent dispatches get blocked. Not needed for initial implementation. |
| Counter-based TASKMASTER_MAX | Adopt as SVC_COMPLETION_MAX only if the Stop hook causes infinite loops in practice. Default to 3 for safety. |
| Dual-platform Codex+Claude support | Not the priority — svc focuses on Claude Code first. |

## Attribution update

Add to NOTICES:
```
TaskMaster — https://github.com/blader/taskmaster
Author: blader
License: MIT
Patterns derived:
  - Stop hook completion guard (adapted for task-graph-based completion checking) → route-workflow Task-Graph Protocol + hooks/svc-task-completion-guard.sh
  - Anti-rationalization language ("PROGRESS IS NOT COMPLETION", "DO NOT NARRATE — EXECUTE") → route-workflow Task-Graph Protocol
```
