---
name: sync-work-items
version: "1.0"
description: >
  Sync repo-canonical svc work items to GitHub Issues. Use after onboard-repo or
  whenever work-item files change and the team wants external execution visibility without
  making GitHub the source of truth. GitHub is the first-class integration target in v1.
  Linear is deferred.
phases:
  - id: P1-RepoWorkItemRead
    trigger: always
    reads: ["docs/specs/project-state.md", "docs/specs/work-items/INDEX.md", "docs/specs/work-items/WI-*.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-WorkItemSchemaProjectionPlan
    trigger: always
    reads: ["docs/specs/work-items/WI-*.md", "references/work-item-schema.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-GitHubIssueCreateUpdate
    trigger: sync-required
    reads: ["docs/specs/work-items/WI-*.md", "GitHub Issues"]
    writes: ["GitHub Issues"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-RepoIssueNumberWriteback
    trigger: sync-required
    reads: ["GitHub Issues", "docs/specs/work-items/WI-*.md"]
    writes: ["docs/specs/work-items/WI-*.md", "docs/specs/work-items/INDEX.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-SyncSelfVerify
    trigger: always
    reads: ["docs/specs/work-items/INDEX.md", "docs/specs/work-items/WI-*.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-LaneCompletionRouting
    trigger: always
    reads: [".svc/lane-tasks-<WI>.json", "docs/specs/work-items/INDEX.md"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/work-items/INDEX.md", artifact: work-item-index }
  optional: []
outputs:
  produces:
    - { path: "docs/specs/work-items/INDEX.md", artifact: synced-work-items }
chain:
  lanes:
    brownfield-conversion: { position: 3, prev: audit-coverage, next: null }
    drift: { position: 3, prev: write-journeys, next: null }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Work Item Sync

Serious Vibe Coding keeps project state in the repo. External trackers are projections for execution,
assignment, and visibility.

This skill syncs `docs/specs/work-items/WI-*.md` to GitHub Issues and writes the issue
number back into each work item. Repo files stay canonical.

**Announce at start:** "I'm using the sync-work-items skill to project repo-canonical work items to GitHub Issues."

## Source of Truth

- Canonical: repo files under `docs/specs/work-items/`
- Projection: GitHub Issues
- Deferred: GitHub Projects and Linear

## Inputs

Read:

- `docs/specs/project-state.md`
- `docs/specs/work-items/INDEX.md`
- `docs/specs/work-items/WI-*.md`

## Expected Fields

Each work item should include:

- ID
- title
- type
- status
- severity
- lane
- source skill
- source artifact
- GitHub issue number (optional on first sync)

## Sync Behavior

### Create issue

If a work item has no issue number:

- create a GitHub Issue
- use the work-item title as the issue title
- use the repo item body as the issue body
- apply labels for:
  - `type:*`
  - `status:*`
  - `lane:*`
  - `severity:*`
- write the resulting issue number back into the work item

### Update issue

If a work item already has an issue number:

- update the issue title/body if the repo item changed materially
- update labels to reflect current repo state

## Label Convention

Recommended labels:

- `type:feature`
- `type:bugfix`
- `type:regression`
- `type:refactor`
- `type:drift`
- `type:conversion`
- `type:chore`

- `status:identified`
- `status:triaged`
- `status:planned`
- `status:in_progress`
- `status:blocked`
- `status:resolved`
- `status:verified`
- `status:deferred`

- `lane:greenfield`
- `lane:conversion`
- `lane:brownfield-feature`
- `lane:bugfix`
- `lane:drift`

- `severity:critical`
- `severity:high`
- `severity:medium`
- `severity:low`

## Rules

- Do not treat GitHub as canonical
- Do not overwrite repo state from ad hoc tracker edits
- Do not attempt bidirectional sync in v1
- If a GitHub issue diverges from the repo item, prefer the repo item and resync outward

## Future Compatibility

Keep the work-item schema neutral enough that `linear_issue_id` can be added later.
Do not design dual-canonical sync rules in v1.

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-RepoWorkItemRead --evidence command_output:.svc/sync-work-items-read.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-WorkItemSchemaProjectionPlan --evidence command_output:.svc/sync-work-items-plan.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-GitHubIssueCreateUpdate --evidence command_output:.svc/sync-work-items-github.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RepoIssueNumberWriteback --evidence file:docs/specs/work-items/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SyncSelfVerify --evidence command_output:.svc/sync-work-items-self-verify.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-LaneCompletionRouting --evidence command_output:.svc/sync-work-items-lane-completion.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Work items synced to GitHub Issues (or logged for sync) | Check each WI-*.md for GitHub issue number or sync log | |
| 2 | INDEX.md updated | `test -f docs/specs/work-items/INDEX.md` and entries reflect current state | |
| 3 | No unresolved questions | grep for TBD, TODO, open questions in work item files | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If `--progressive` flag is present AND self-verify passed:**
- This is the end of the brownfield-conversion and drift lanes. Report completion.

**If `--progressive` flag is absent:**
- Report results to user
- Pipeline complete for this lane. Route each work item by type to the appropriate next skill.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
