# Task-Graph Chaining Protocol

Canonical contract for how svc skills hand off control when a task graph exists. Every skill used to embed a ~150-line copy of this protocol; this file is the single source of truth so skills can link instead of duplicating.

**Source of truth:** `.svc/lane-tasks-<WI>.json` — cross-host, cross-session, cross-subagent.

---

## When a task graph exists

A "task graph" is an active `.svc/lane-tasks-<WI>.json` file for the current work item. Its presence switches skill behavior from "standalone execution" to "task-graph mode."

### Routing — read the task, don't re-derive

- `Invoke: /skill-name` in the task description, and `metadata.skill`, are **routing instructions**, not explanatory prose. Honor them.
- The JSON file is the source of truth. Host-UI mirroring (Claude Code `TaskList`/`TaskUpdate`; Kimi `/task` + `TaskList`/`TaskOutput` for observation; Codex `update_plan`) is a view on top, not the truth.

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
7. **When creating or resuming a task graph, validate it against its lane model:**
   ```bash
   node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-<WI>.json
   ```
   This checks that all mandatory skills for the lane (e.g., `review-gate`, `audit-implementation`) are represented as tasks, and that root status is consistent with task statuses. If validation fails, fix the graph before proceeding — do not let omissions silently pass through the pipeline.

### Per `route-workflow` Task-Graph Execution Protocol

The authoritative spec lives in `route-workflow/references/task-graph-protocol.md`. This file is the skill-facing quick contract.

---

## Invocation convention

To reference this protocol from a skill's `SKILL.md`, use a single line in the skill's Pipeline Continuation / Chaining section:

```markdown
## Pipeline Continuation

Follow the canonical task-graph chaining contract: see `references/task-graph-chaining-protocol.md`.

<optional skill-specific chaining notes here — next-skill default, terminal-skill behavior, etc.>
```

That one pointer replaces the ~150-line embedded block skills used to carry. Skill-specific chaining notes (e.g., "this skill does not chain progressively" or "default next skill: design-ui") are kept inline because they're skill-local, not protocol.

---

## History

- 2026-04-20: extracted from 56 skill SKILL.md files per F-005 of `proposals/done/2026-04-20-evolution-orchestrator-parsimony.md`. Duplication was ~224K aggregate tokens across the skill corpus.
- 2026-04-22: added lane-model validation step (step 7) and `scripts/validate-task-graph-lane.mjs` per `proposals/2026-04-22-evolution-review-gate-skipped.md`.
