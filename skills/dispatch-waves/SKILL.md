---
name: dispatch-waves
version: "1.0"
description: >
  Plan and coordinate parallel execution waves for multiple svc work items.
  Use when the user says "handle these WIs in parallel", "run these work items
  concurrently", "dispatch these WIs", "parallel WI wave", or when route-workflow
  receives a list of multiple WI IDs that can be worked independently. Produces
  a conflict-aware wave plan, selects transport, assigns file ownership, and
  validates worker merge-back evidence before the parent graph advances.
phases:
  - id: P1-WIListAndScope
    trigger: always
    reads: ["user request", "docs/specs/work-items/WI-*.md"]
    writes: [".svc/parallel-dispatch-<run>.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P2-AffectedFileDependencyExtraction
    trigger: always
    reads: ["docs/specs/work-items/WI-*.md", "source files named by WIs"]
    writes: [".svc/parallel-dispatch-<run>.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-WavePlanAndTransport
    trigger: always
    reads: ["references/parallel-dispatch-transport.md", ".svc/parallel-dispatch-<run>.json"]
    writes: [".svc/parallel-dispatch-<run>.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-WorkerDispatchOrInlineExecution
    trigger: dispatchable-wave
    reads: [".svc/parallel-dispatch-<run>.json", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/dispatch/*.result.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-MergeBackValidation
    trigger: always
    reads: [".svc/parallel-dispatch-<run>.json", ".svc/dispatch/*.result.json"]
    writes: [".svc/lane-tasks-<WI>.json", ".svc/parallel-merge-back-<run>.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: [".svc/parallel-dispatch-<run>.json", ".svc/parallel-merge-back-<run>.json"]
    writes: [".svc/pipeline-decisions.jsonl"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/work-items/WI-*.md", artifact: work-items }
  optional:
    - { path: ".svc/lane-tasks-<WI>.json", artifact: parent-task-graph }
outputs:
  produces:
    - { path: ".svc/parallel-dispatch-<run>.json", artifact: parallel-wave-plan }
    - { path: ".svc/parallel-merge-back-<run>.json", artifact: merge-back-report }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Parallel WI Dispatch

**Announce at start:** "I'm using the dispatch-waves skill to plan conflict-aware parallel WI execution."

## Purpose

Turn "handle these WIs in parallel" into a deterministic wave plan. The plan is
only executable when affected files, dependency expansion, transport choice,
ownership boundaries, and merge-back evidence are explicit.

Runtime details live in `skills/dispatch-waves/references/dispatch-runtime.md` and
`references/parallel-dispatch-transport.md`; keep this skill focused on routing,
commands, and self-verify decisions.

## Before Starting

Build a bounded context plan:
- Start from `.svc/session-contract.jsonl`, the active WI list, and the explicit user request.
- Use `.svc/spec-index.json`, `docs/specs/work-items/INDEX.md`, and the requested WI files to find dependent WIs, affected files, validators, and ownership constraints.
- Read every WI, script, validator, or reference that can change conflict detection, transport choice, merge-back validation, or parent graph mutation.

Skip if: the request names fewer than two WIs or does not ask for parallel/concurrent/dispatch execution.

## Task Graph

source of truth: `.svc/lane-tasks-<WI>.json`

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; do not treat the host mirror as durable state.

## Required Commands

Create the wave plan:

```bash
node scripts/plan-parallel-wi-dispatch.mjs --wis WI-001,WI-002 --out .svc/parallel-dispatch-<run>.json
```

Validate worker merge-back evidence before mutating the parent graph:

```bash
node scripts/validate-parallel-merge-back.mjs --plan .svc/parallel-dispatch-<run>.json --results .svc/dispatch
```

## Dispatch Rules

1. Extract canonical `Affected Files` / `Affected Specs` metadata first, then
   frontmatter `affected_files`, suspected paths, and dependency files before
   dispatch. A WI with unknown scope is `blocked:scope-unknown` and must not be
   sent to a worker.
2. Compute waves from the conflict graph. WIs with overlapping affected files,
   overlapping dependency files, unknown scope, or shared config paths are not
   in the same parallel wave.
3. Choose transport from `references/parallel-dispatch-transport.md`:
   `local-inline`, `subagent`, `detached-kimi`, or `headless-worker`.
4. Assign each worker an ownership boundary. The worker may edit only its
   `write_scope` unless the parent revises the plan.
5. For intra-WI mutating children, persist and accept a v2 delegation and use a
   separate contained inner worktree. Cross-WI dispatch retains one controller
   lease per WI; authority is never inherited from the dispatching session.
6. Workers write one atomic `.svc/dispatch/<WI>.result.json` result. The parent
   session performs merge-back sequentially and updates lane-task state.
7. Subagents and detached workers use `.svc/lane-tasks-<WI>.json` as the only
   durable task state. Host mirrors such as TaskUpdate or `update_plan` are
   parent-session mirrors only.

## Merge-Back Contract

Each worker result must include:

| Field | Required | Meaning |
|---|---|---|
| `wi` | yes | Work item ID matching the plan |
| `status` | yes | `success` or `failed:<reason>` |
| `worker_summary` | yes | What changed and why |
| `changed_files` | yes | Files changed by the worker |
| `validation_evidence` | yes | Commands or checks with passing result |
| `clean_worktree` | yes | `true` for successful workers |
| `parent_graph_mutation` | yes | Parent graph update intent |
| `conflict_handling` | conditional | Required when conflicts were detected or serialized |

## Wave Closeout Gate

Before a parent session claims that every WI in a dispatched wave is closed,
run the shared wave closeout validator:

```bash
node scripts/validate-wave-closeout.mjs --ids WI-001,WI-002 --expect-count 2
```

Use `references/wave-closeout-validation.md` when the wave uses a custom
evidence root or project-specific worktree scope tokens.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | WI list resolved | Every requested WI maps to a repo work-item file | |
| 2 | Affected files extracted | Plan has non-empty `affected_files` or blocks dispatch as `scope-unknown` | |
| 3 | Conflict graph computed | Plan records conflicts and no conflicting WIs share a parallel wave | |
| 4 | Transport selected | Every plan task has `transport` from the reference table | |
| 5 | Ownership assigned | Every dispatchable task has `ownership.write_scope` | |
| 6 | Merge-back evidence validated | `validate-parallel-merge-back.mjs` passes before parent graph mutation | |
| 7 | Parent mirror protected | Subagent/detached worker instructions skip host UI mirroring and rely on file state | |
| 8 | Wave closeout validated | If the closeout claims all WIs in the wave are closed, `validate-wave-closeout.mjs` passes for the exact WI list and expected count | |

## Pipeline Continuation

After merge-back validation passes, update the parent `.svc/lane-tasks-<WI>.json`
sequentially, then refresh the host mirror from file state. If any worker fails,
leave that WI failed or blocked with the result path and continue only with
independent successful WIs.
