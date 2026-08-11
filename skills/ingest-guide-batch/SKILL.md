---
name: ingest-guide-batch
version: "1.0"
description: >-
  Parallel orchestrator for ingest-guide — fans a directory of pre-pasted guide files into N independent worktree sessions, aggregates per-guide decisions (discard / store / promote) into one digest with promoted-skill drafts ready for create-skill review. Failure-isolated. Use when: multiple saved guides need triage. Also: "batch ingest", "fan out guides", "process N guides in parallel". Also: "bulk ingestion".
phases:
  - id: P1-BatchEnumerateLabel
    trigger: always
    reads: ["docs/specs/ingest-guide/batch-<batch-id>/", "sources.json"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-FanoutConcurrencyDispatch
    trigger: runnable-guides-present
    reads: ["scripts/worktree.sh", "skills/ingest-guide-batch/scripts/parallel-orchestrator.mjs", "SVC_INGEST_CONCURRENCY"]
    writes: [".worktrees/ingest-<source-id>/", "docs/specs/ingest-guide/<source-id>-raw.md"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ChildResultAggregate
    trigger: children-finished
    reads: [".worktrees/ingest-<source-id>/.svc/pipeline-decisions.jsonl", "child stdout", "child exit codes"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-DigestWriteCleanupPlan
    trigger: always
    reads: ["aggregated child results", "routing decisions", "failure tails"]
    writes: ["docs/specs/ingest-guide/batch-<batch-id>/digest.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-HumanCheckpointRetention
    trigger: worktree-cleanup-needed
    reads: ["digest.md", "promote decisions", "failed child worktrees"]
    writes: ["worktree cleanup decision"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify checklist", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json", "assistant response"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/ingest-guide/batch-<batch-id>/", artifact: guide-batch }
  optional:
    - { path: ".svc/pipeline-decisions.jsonl", artifact: decision-log }
outputs:
  produces:
    - { path: "docs/specs/ingest-guide/batch-<batch-id>/digest.md", artifact: batch-digest }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

> **Cognitive routing:** 🧠 [PLAN] for orchestration; 👁️ [EXEC] delegated to per-session `ingest-guide` workers. See `references/model-routing.md`.

# ingest-guide-batch

Parallel orchestrator for bulk guide ingestion. Reuses `scripts/worktree.sh` to spawn isolated sessions; each session runs `ingest-guide` (WI-091) on one guide. Coordinator aggregates decisions into a single digest.

**Announce at start:** "I'm using the ingest-guide-batch skill to fan out N guides."

**Not a new lane** — this is a thin orchestrator on top of the existing ingest-guide skill. It does not introduce new pipeline gates; per-guide gates (domain gate, human checkpoint for promote) still run inside each child session.

## Inputs

- **Batch directory** — `docs/specs/ingest-guide/batch-<batch-id>/` containing one file per guide (`.md` or `.txt`, plus an optional `sources.json` manifest mapping filenames to source labels).
- **Concurrency (optional)** — `SVC_INGEST_CONCURRENCY=N` (default 4). Hard cap 8 to avoid worktree thrash.
- **Fail-fast flag (optional)** — `--fail-fast` aborts the batch on first child failure; default is isolated (one failure does not block others).

## Pipeline (4 steps)

### Step 1 — Enumerate and label

Scan the batch directory. For each `<filename>.md`, derive a source-id either from the `sources.json` mapping (if present) or from the filename (kebab-case). Reject guides that are < 200 chars — too small to warrant the ingest pipeline; report them in the digest as `skipped-too-short`.

### Step 2 — Fan out

For each labeled guide, invoke `skills/ingest-guide-batch/scripts/parallel-orchestrator.mjs --batch-id <id> --concurrency N`. The script:

1. Creates a per-guide worktree via `scripts/worktree.sh create ingest-<source-id>`.
2. Copies the guide file into the worktree at `docs/specs/ingest-guide/<source-id>-raw.md`.
3. Dispatches a child process to run `ingest-guide` inside that worktree (harness-agnostic; uses `scripts/dispatch-worker.sh` or equivalent).
4. Captures stdout + exit code per child.
5. Enforces the concurrency cap — no more than N children in flight.

### Step 3 — Aggregate

After all children complete (success, failure, or timeout), the coordinator reads each worktree's `.svc/pipeline-decisions.jsonl` (last entry tagged with the child's source-id) and collects:

- Per-guide: classification breakdown, routing breakdown, experiments pending, report path.
- Per-child: exit code, stdout tail (last 40 lines), failure reason if exit != 0.

### Step 4 — Digest + cleanup

Write `docs/specs/ingest-guide/batch-<batch-id>/digest.md` with:

```markdown
# Batch Ingest Digest: <batch-id>

**Date:** YYYY-MM-DD
**Guides processed:** N (N succeeded, N failed, N skipped-too-short)
**Concurrency:** N

## Per-guide Decisions

| Source-id | Decision Mix | Experiments Pending | Report |
|-----------|--------------|---------------------|--------|
| <id-1>    | store:2 promote:1 discard:0 | 1 | docs/specs/ingest-guide/<id-1>.md |
| ...       | ... | ... | ... |

## Promoted-Skill Drafts (for create-skill review)

- <source-id>: <proposed skill title> — see <report path> §Routing Decisions

## Failures

- <source-id> — exit=N — <tail>

## Next Steps

- Review promoted-skill drafts with `create-skill` (human checkpoint).
- Store decisions are already on disk under `references/knowledge/` (already passed domain gate inside each child).
- Discard decisions require no further action.
```

Then, for each successful child worktree, either:
- **Keep** — if the child produced artifacts the builder wants to inspect directly (default for `promote` decisions).
- **Remove** — `scripts/worktree.sh remove ingest-<source-id>` for `store` and `discard` decisions whose artifacts are already on disk.

The coordinator asks the builder before removing any worktree with a `promote` decision (human_checkpoint).

## Human Checkpoint

Before any worktree removal, confirm with the builder that the digest + per-guide reports capture everything they need. The orchestrator NEVER removes a worktree with a failed child — those are preserved for post-mortem.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Batch directory exists | `docs/specs/ingest-guide/batch-<batch-id>/` present with ≥1 guide file | |
| 2 | Concurrency cap respected | no more than N children observed in flight via `ps` / parent tracking | |
| 3 | Failure isolation | a failing child does not cause the coordinator to kill siblings (unless --fail-fast) | |
| 4 | Every guide accounted for | digest has a row (success OR failure OR skipped) for every input file | |
| 5 | Per-child decision log readable | each successful child has an entry in its worktree's `.svc/pipeline-decisions.jsonl` | |
| 6 | Digest written | `docs/specs/ingest-guide/batch-<batch-id>/digest.md` exists | |
| 7 | Worktree removal is opt-in for promotes | builder confirmed removal for any worktree with a promote decision | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-BatchEnumerateLabel --evidence command_output:.svc/ingest-guide-batch-enumerate.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-FanoutConcurrencyDispatch --evidence command_output:.svc/ingest-guide-batch-fanout.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ChildResultAggregate --evidence command_output:.svc/ingest-guide-batch-aggregate.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DigestWriteCleanupPlan --evidence file:docs/specs/ingest-guide/batch-<batch-id>/digest.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-HumanCheckpointRetention --evidence command_output:.svc/ingest-guide-batch-retention.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/ingest-guide-batch-self-verify.log
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

### Chaining

ingest-guide-batch is on-demand — it does not participate in progressive chains. After the digest is written, control returns to the builder for review of promoted-skill drafts.

## Scripts

- `skills/ingest-guide-batch/scripts/parallel-orchestrator.mjs` — orchestrator entry point: enumerate, fan out, aggregate, digest.
