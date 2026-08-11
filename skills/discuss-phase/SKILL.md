---
name: discuss-phase
version: "1.0"
description: >
  Resolve bounded gray areas between validation and implementation by producing
  a durable discussion artifact with decisions, blockers, deferrals, and next-step
  routing. Use when the user asks to discuss gray areas or unresolved choices, or
  when routing detects expensive ambiguity that is not primarily a bug/regression
  and not primarily feature-value validation.
phases:
  - id: P1-TopicScopeRerouteCheck
    trigger: always
    reads: ["user prompt", "feature spec", "work item", "FRAMEWORK-STATE.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ContextEvidenceLoad
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/router-context.md", "docs/specs/project-state.md", "docs/specs/decisions/*.md", "docs/logs/pipeline-decisions.jsonl"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-GrayAreaDecisionProtocol
    trigger: always
    reads: ["bounded gray areas", "repo artifacts", "code paths", "framework state", "research findings"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-DiscussionArtifactWrite
    trigger: always
    reads: ["decision protocol output", "required output contract"]
    writes: ["docs/specs/discussions/<topic>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-MaterialDecisionLog
    trigger: material-decisions-present
    reads: ["discussion decisions", "documented enum types"]
    writes: ["docs/logs/pipeline-decisions.jsonl"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify checklist", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json", "assistant response"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
    - { path: "docs/specs/router-context.md", artifact: router-context }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/features/*-brief.md", artifact: ship-brief }
    - { path: "docs/specs/decisions/*.md", artifact: decision-log-docs }
    - { path: "docs/logs/pipeline-decisions.jsonl", artifact: pipeline-decision-log }
outputs:
  produces:
    - { path: "docs/specs/discussions/<topic>.md", artifact: discussion-artifact }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Discussion Phase

Resolve gray areas that are too expensive to guess through, but not the same as
bug diagnosis or feature-value validation.

**Announce at start:** "I'm using the discuss-phase skill to resolve bounded gray areas."

## Purpose

This skill exists for cases where the framework already has a bounded topic but
still has several unresolved choices that would cause downstream churn if they
remain implicit.

The output is one durable topic-scoped artifact:

- `docs/specs/discussions/<topic>.md`

That artifact becomes the pre-flight input for downstream skills and the
comparison surface for later review enforcement.

## When To Run

Run when any of these are true:

- the user explicitly asks to discuss gray areas or unresolved choices
- `route-workflow` detects unresolved one-way-door ambiguity after validation
- a brownfield extension needs code-aware scouting before spec/design can safely continue
- a later phase reopens a topic that should have been settled earlier

Do **not** run when the real problem is:

- broken known behavior or regression -> `diagnose-bug`
- unvalidated demand, wedge, or feature worth -> `validate-feature`
- no actionable ambiguity at all -> continue current lane

## Scope Contract

The active discussion must stay bounded:

- target 3-7 gray areas in one run
- if more than 7 emerge, decide the highest-signal subset now and defer the rest
- do not reopen choices already settled in current project state, decision docs,
  feature specs, or the pipeline decision log unless there is explicit superseding evidence

Use exactly one category per gray area:

- `scope`
- `ux`
- `contract-data`
- `operations`
- `sequencing-ownership`

## Zero-State Rule

If no target spec exists, derive a bounded topic from:

- the user prompt
- a work item
- a framework gap in `FRAMEWORK-STATE.md`

If the topic cannot be stated in one sentence with one primary uncertainty
cluster, stop and ask for a narrower framing.

## Required Output Contract

Write `docs/specs/discussions/<topic>.md` with:

### Frontmatter

- `topic`
- `target`
- `repo_mode`
- `authoring_mode`
- `status`
- `ambiguity_before`
- `ambiguity_after`
- `open_count`
- `blocking_count`
- `recommended_next_skill`
- `source_refs`
- `updated`

### Structured sections

- `## Summary`
- `## Gray Area Register`
- `## Evidence Notes`
- `## Decisions`
- `## Deferred`
- `## Blockers`
- `## Next Step`

### Gray Area Register columns

- `id`
- `category`
- `reversibility`
- `magnitude`
- `signal_score`
- `status`
- `downstream_phase`
- `decision_summary`

Allowed row status values:

- `open`
- `decided`
- `deferred`
- `blocked`
- `rerouted`

Allowed artifact terminal states in frontmatter:

- `open`
- `proceed`
- `blocked`
- `rerouted`
- `not-needed`

## Decision Protocol

For each gray area:

1. classify reversibility: `two-way-door` or `one-way-door`
2. classify magnitude: `low`, `medium`, or `high`
3. gather evidence from repo artifacts, code paths, framework state, or research
4. choose output style:
   - irreversible or high-magnitude -> provide 3-5 ranked alternatives with trade-offs
   - reversible and low-magnitude -> provide a recommended default plus explicit override path

Interactive mode:

- ask one focused question per open gray area
- do not use a broad questionnaire

Auto mode:

- record the recommended default
- record confidence
- record the evidence that would reverse the recommendation

## Routing And Blocking Rules

Apply reroute precedence before ambiguity scoring:

1. broken known behavior or regression -> `diagnose-bug`
2. unvalidated value, wedge, or demand -> `validate-feature`
3. true design ambiguity -> continue in `discuss-phase`
4. no actionable ambiguity -> `status: not-needed`

Blocking rule:

- if any one-way-door item remains unresolved with confidence below `7/10`,
  set `status: blocked`, name the owner, and name the next required decision

Proceed rule:

- if the remaining ambiguity is non-blocking, set `status: proceed` and name
  the next skill explicitly

## Logging

Append material decisions to `docs/logs/pipeline-decisions.jsonl` using the
existing helper and documented enums. Discussion output may emit:

- `question`
- `answer`
- `taste`
- `user`
- `mechanical`

Do not invent new event types.

## Downstream Consumption Contract

When a discussion artifact exists for the same topic:

- `write-spec`, `design-ux`, and `design-tech` must read it before making new choices in the same area
- `review-gate` compares later artifacts/diffs against settled discussion decisions
- contradiction is allowed only when the feature spec's `Revision Log` explicitly supersedes the earlier discussion decision

## Self-Verify

Before declaring done:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Artifact exists | `test -f docs/specs/discussions/<topic>.md` | |
| 2 | Frontmatter has all required fields | grep for every required field key | |
| 3 | Gray Area Register uses allowed columns and status values | inspect register header and row values | |
| 4 | Output ends with a concise proceed/block/reroute summary | check `## Next Step` section | |
| 5 | Material decisions appended with existing enum types only | inspect `pipeline-decisions.jsonl` append command or resulting rows | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-TopicScopeRerouteCheck --evidence command_output:.svc/discuss-phase-scope-reroute.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ContextEvidenceLoad --evidence command_output:.svc/discuss-phase-context-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-GrayAreaDecisionProtocol --evidence command_output:.svc/discuss-phase-decision-protocol.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DiscussionArtifactWrite --evidence file:docs/specs/discussions/<topic>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-MaterialDecisionLog --evidence file:docs/logs/pipeline-decisions.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/discuss-phase-self-verify.log
```

## Pipeline Continuation

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Codex mirror: `update_plan`):**
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Codex and other hosts without Claude task APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `.svc/lane-tasks-<WI>.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `.svc/lane-tasks-<WI>.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `.svc/lane-tasks-<WI>.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

**If standalone:**
- Report the discussion result
- Suggest the next skill named in `recommended_next_skill`
