---
name: list-work-items
version: "1.0"
description: List local svc work items ordered by dependency and priority. Use when you need to see the backlog, understand what to build next, and see why each item is needed without syncing to GitHub.
phases:
  - id: P1-WorkItemGlobRead
    trigger: always
    reads: ["docs/specs/work-items/WI-*.md", "docs/specs/work-items/DONE.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-MetadataParseBucket
    trigger: always
    reads: ["docs/specs/work-items/WI-*.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-PrioritySortRender
    trigger: always
    reads: ["parsed work-item metadata"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-DoneIndexRegeneration
    trigger: closed-items-present-and-linked-worktree
    reads: ["parsed closed work items"]
    writes: ["docs/specs/work-items/DONE.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-UserVisibleOutputReplay
    trigger: user-facing-run
    reads: ["script stdout"]
    writes: ["assistant response"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/work-items/", "docs/specs/work-items/DONE.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/work-items/", artifact: work-items-directory }
  optional:
    - { path: "docs/specs/work-items/DONE.md", artifact: done-index }
outputs:
  produces:
    - { path: "docs/specs/work-items/DONE.md", artifact: done-index }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# List Work Items

**Announce at start:** "I'm using list-work-items to show the local backlog."

Compact, status-aware view of the local project backlog from `docs/specs/work-items/`.

## Usage

```bash
node skills/list-work-items/scripts/list_work_items.mjs            # linked worktree: open backlog + refresh DONE.md
node skills/list-work-items/scripts/list_work_items.mjs --all      # linked worktree: also include closed items inline
node skills/list-work-items/scripts/list_work_items.mjs --detail WI-087   # full body of a single item
node skills/list-work-items/scripts/list_work_items.mjs --json     # read-only machine-readable dump
```

`--json` and `--detail` are read-only and may run from the default checkout.
Default table mode and `--all` regenerate `DONE.md`, so ensure and enter a bound
linked worktree before running them. Never refresh `DONE.md` from the default
checkout as a side effect of listing.

## What it does

1. Globs `WI-*.md` in `docs/specs/work-items/`.
2. Parses each file's YAML frontmatter `status:` field or legacy `**Status:**` field and routes:
   - **Done bucket** — `VERIFIED`, `DONE`, `CLOSED`, `BASELINED`, `SHIPPED`, `COMPLETED`, `IMPLEMENTED`, `RESOLVED`, `MERGED`, `RELEASED` (case-insensitive). In mutating table mode, written to `docs/specs/work-items/DONE.md` from a linked worktree; **not** dumped to stdout unless `--all` is passed.
   - **Open deployed bucket** — `DEPLOYED-UNVERIFIED` remains visible in the default backlog until `verify-promotion` or delivery-graph closeout moves it to `VERIFIED`.
   - **Open bucket** — everything else (`backlog`, `in-progress`, `BLOCKED`, `READY`, missing). Printed to stdout as a compact table.
3. Sorts open items by priority (Critical → Low) using `**Priority:**` or `**Severity:**` (whichever the WI uses), then by ID.
4. Sorts closed items by `**Closed:**` date, most recent first.

## Output contract

- **Default stdout** is a single-screen table (~92 items fits comfortably). One line per WI: `ID | Status | Priority | Subject (truncated)`.
- **Execution context** follows the table as `WI | Worktree | Branch | Owner Session`, using the exact binding status values. Use `—` for an unbound read-only invocation; never infer an owner.
- **`docs/specs/work-items/DONE.md`** is regenerated only by table mode from a bound linked worktree. Read-only/default-checkout inspection has no refresh side effect.
- **`--detail WI-NNN`** prints the parsed metadata header followed by the raw file contents. Use this instead of opening the WI manually.

## User-Facing Output Contract

After running the script, the agent MUST reproduce the open-backlog table verbatim in its reply to the user. The Bash tool's stdout is consumed by the model — it is not automatically displayed. Copying the table into the assistant message is the only way the user sees it.

- Reproduce the full open-backlog markdown table (header + all rows).
- Include the closed-count footer line if the script printed one.
- Add the exact `WI | Worktree | Branch | Owner Session` context line after the verbatim table. Obtain it from worktree binding status; do not substitute the current directory or an unverified environment value.
- Do NOT replace the table with a prose summary. Prose summaries are additive only, after the table.
- For `--detail WI-NNN`, reproduce the metadata header + body verbatim.

See `rules/common/skill-output-visibility.md` for the global rule this instantiates.

## Tolerance

The parser accepts heading variants that the original version rejected:

| Heading form | Example | Parsed? |
|---|---|---|
| `# WI-NNN: title` | `# WI-001: J29 remaining 20 AC E2E coverage` | ✓ |
| `# WI-NNN — title` | `# WI-081 — sop_friendly field missing` | ✓ |
| `# WI-NNN - title` | `# WI-016a - subitem` | ✓ |
| `# Plain Title` (no WI prefix) | `# Voice-Driven Deal & Event Generation` | ✓ (uses filename as ID) |

Priority field accepts YAML frontmatter `priority:` / `severity:` and legacy `**Priority:** medium` / `**Severity:** medium`.

Canonical WI file format is defined in `references/work-item-schema.md`. Authoring skills should emit the canonical form; this parser tolerates legacy variants for backward compatibility.

## Why local-first

This skill never syncs to GitHub. It's the fast read for "what's open right now" without auth, network, or rate limits. For external tracking, run `sync-work-items` separately.

## Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | WI directory was read | `docs/specs/work-items/` exists and was globbed | |
| 2 | Status bucketing is correct | done items match DONE bucket keywords; open items are everything else | |
| 3 | Output is compact | default stdout ≤ 50 lines | |
| 4 | DONE.md mutation stayed isolated | Regeneration ran only from a bound linked worktree; read-only/default-checkout runs left it unchanged | |
| 5 | Reply contains table and binding identity | Verbatim backlog rows plus exact WI, Worktree, Branch, and Owner Session values appear in the assistant message | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-WorkItemGlobRead --evidence command_output:.svc/list-work-items-read.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-MetadataParseBucket --evidence command_output:.svc/list-work-items-parse.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PrioritySortRender --evidence command_output:.svc/list-work-items-render.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DoneIndexRegeneration --evidence file:docs/specs/work-items/DONE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-UserVisibleOutputReplay --evidence command_output:.svc/list-work-items-output-replay.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/list-work-items-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
