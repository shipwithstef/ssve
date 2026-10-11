# Task-Graph Chaining Protocol

Canonical contract for how svc skills hand off control when a task graph exists. Every skill used to embed a ~150-line copy of this protocol; this file is the single source of truth so skills can link instead of duplicating.

**Source of truth:** `.svc/lane-tasks-<WI>.json` — cross-host, cross-session, cross-subagent.

---

## When a task graph exists

A "task graph" is an active `.svc/lane-tasks-<WI>.json` file for the current work item. Its presence switches skill behavior from "standalone execution" to "task-graph mode."

### Routing — read the task, don't re-derive

- `Invoke: /skill-name` in the task description, and `metadata.skill`, are **routing instructions**, not explanatory prose. Honor them.
- The JSON file is the source of truth. Host-UI mirroring is a view on top, not the truth:
  - **Claude Code:** mirror file state with `TaskList` / `TaskUpdate`.
  - **Kimi CLI:** use `/task` or `TaskList` / `TaskOutput` only as **observation**; the file remains authoritative.
  - **Codex and other hosts without native task-mutation APIs:** mirror only the active step in `update_plan` (never the full graph).

### Host mirroring — parent session only

Host UI mirroring is ONLY performed when running in the parent / top-level session. Detect via:

- Host exposes `TaskList` tool, AND
- No `SVC_SUBAGENT=1` marker in env

If either check fails → **skip host mirroring**. The file state is the durable record; the orchestrator parent will re-read and re-mirror after the subagent returns.

Subagents MUST NOT attempt `TaskUpdate` calls. Trying and failing is not graceful — it creates silent drift between the subagent's intent and the host UI.

### Lifecycle actions in every skill

A skill running in task-graph mode MUST:

1. **Read and update `.svc/lane-tasks-<WI>.json` first.** This is the cross-host source of truth for task status, skip reasons, and resume.
2. **Mark this skill's task `completed` in the JSON before leaving.** Then update the host-specific mirror (if in parent session).
3. **Evaluate the next task's conditions** from its description.
4. If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill **before doing work** (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex).
5. Record the load receipt with `node scripts/task-graph.mjs load-skill ...` before the task can be completed without a skip reason.
6. If skippable: mark the next task `completed` in `lane-tasks.json` with a `skip_reason`, mirror that status, and evaluate the one after.
   **Never ghost-complete:** a task is `completed` only with a `skill_receipt` (or an explicit `skip_reason`).
7. **When creating or resuming a task graph, validate it against its lane model:**
   ```bash
   node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-<WI>.json
   ```
   This checks that all mandatory skills for the lane (e.g., `review-gate`, `audit-implementation`) are represented as tasks, and that root status is consistent with task statuses. If validation fails, fix the graph before proceeding — do not let omissions silently pass through the pipeline.

### Per `route-workflow` Task-Graph Execution Protocol

The authoritative spec lives in `route-workflow/references/task-graph-protocol.md`. This file is the skill-facing quick contract.

---

## Post-compaction recovery

Applies on every host (Claude Code, Kimi CLI, Codex, Gemini, others) when context was compacted and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth.
2. **Find the next task** — first `in_progress`, else first `pending` with blockers satisfied.
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`.
4. **Re-read that skill's SKILL.md** — refresh context for the current step.
5. **Resume execution** — continue from where the task left off.
6. **Never ghost-complete** — verify `skill_receipt` exists before marking any task complete.

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

---

## Invocation convention

Skills carry only the minimal pinned form plus skill-local notes (tier-1 validators pin the heading text and the source-of-truth / `update_plan` line):

```markdown
## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume; on Codex, mirror only the active step in `update_plan`.
- Routing, parent-only host mirroring, completion/skip/next-task loading: `references/task-graph-chaining-protocol.md`.

<optional skill-specific chaining notes here — next-skill default, terminal-skill behavior, etc.>

## Post-Compaction Recovery

Follow `references/task-graph-chaining-protocol.md` § Post-compaction recovery.
```

That pointer replaces the embedded block skills used to carry. Skill-specific chaining notes (e.g., "this skill does not chain progressively" or "default next skill: design-ui") are kept inline because they're skill-local, not protocol.

---

## History

- 2026-04-20: extracted from 56 skill SKILL.md files per F-005 of `proposals/done/2026-04-20-evolution-orchestrator-parsimony.md`. Duplication was ~224K aggregate tokens across the skill corpus.
- 2026-04-22: added lane-model validation step (step 7) and `scripts/validate-task-graph-lane.mjs` per `proposals/2026-04-22-evolution-review-gate-skipped.md`.
- 2026-10-11: absorbed the remaining inline copies (per-host mirroring bullets, subagent rule, completion/skip loop, Post-Compaction Recovery) from ~80 skills; skills keep only the pinned minimal form.
