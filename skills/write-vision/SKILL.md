---
name: write-vision
version: "1.0"
description: >
  Create, refine, or convert product vision documents using an evidence-first,
  proposal-first workflow aligned with Serious Vibe Coding repository modes. Use when the
  user says "create vision", "refine vision", "convert vision", "update north star",
  "align vision with code", "vision drift", "vision rewrite", or "make this
  vision canonical". Supports `bootstrap` and `convert` repo modes and defaults
  to canonical target `docs/specs/vision.md`.
phases:
  - id: P1-ModeTargetResolution
    trigger: always
    reads: ["REPO_MODES.md", "docs/specs/project-state.md", "docs/specs/vision.md", "legacy vision paths"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-EvidenceCollection
    trigger: always
    reads: ["runtime evidence", "schema", "tests", "README.md", "docs/specs/"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-SectionProposal
    trigger: always
    reads: ["references/svc-vision-template.md", "references/output-schema.md", "collected evidence"]
    writes: ["proposal response or docs/specs/vision.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ApprovalApply
    trigger: always
    reads: ["approval gate", "apply flag", "section proposal"]
    writes: ["docs/specs/vision.md when apply=true"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/vision.md", artifact: existing-vision }
outputs:
  produces:
    - { path: "docs/specs/vision.md", artifact: vision, status: ACTIVE }
chain:
  lanes:
    greenfield: { position: 1, prev: null, next: analyze-domain }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Vision Sync

**Runtime v2 continuation:** Register the vision and its declared consumer via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve the authorized product direction and every vision-specific gate.

## Purpose

Produce a decision-ready product vision that stays aligned with implementation
reality and Serious Vibe Coding workflows, without mixing in PRD or implementation planning.

This skill is vision-only.

**Announce at start:** "I'm using the write-vision skill to sync the product vision."

---

## Repository Mode Gate

Detect repository mode from `REPO_MODES.md` before any recommendation:

- `bootstrap`: no stable product-spec workflow yet. Create the canonical
  `docs/specs/vision.md` baseline first.
- `convert`: existing docs/code conventions exist. Adapt and migrate with minimal
  disruption.

If mode is ambiguous, default to `convert`.

---

## Invocation Contract

Parse these flags when provided. If omitted, apply defaults and state them.

- `intent=create|refine|convert`
- `mode=grounded|scratch` (default `grounded`)
- `repo_mode=auto|bootstrap|convert` (default `auto`)
- `target=<path>` (default `docs/specs/vision.md`)
- `apply=true|false` (default `false`)

Default intent selection:

- **First: check `docs/specs/project-state.md`** for an existing vision at a
  non-canonical path (e.g., `VISION.md` instead of `vision.md`). If project-state
  lists the vision as existing at a different path, use THAT path as the target
  and set `intent=refine`. Do not create a duplicate at the canonical path —
  the compatibility note in project-state.md takes precedence.
- If project-state.md does not exist or does not mention a vision: check the
  canonical target path.
- If target exists: `intent=refine`
- If target does not exist: check for legacy locations (`VISION.md`,
  `docs/specs/CORE_VISION.md`, etc.) before defaulting to `intent=create`

---

## Scope Rules (Hard)

1. Vision-only output. Do not generate PRD sections or implementation plans.
2. In `mode=grounded`, propose changes first. Do not apply unless `apply=true`
   and the approval gate is explicitly cleared.
3. Convert over delete. If deletion is unavoidable, state meaning loss explicitly.
4. Keep unresolved conflicts visible. Do not silently reconcile contradictory
   evidence.

---

## Source Precedence (Grounded Mode)

Use this exact order when sources disagree:

1. Runtime + schema + tests (actual implementation reality)
2. Repo status documents (`IMPLEMENTATION_STATUS.md`, `README.md`, equivalent)
3. Specs and planning docs (`docs/specs/`, `docs/plans/`, legacy vision files)

For each major claim, label evidence type:
- `shipped`
- `documented`
- `inferred`

And confidence:
- `high`
- `medium`
- `low`

---

## Workflow

### Step 1: Resolve Target and Legacy Vision Files

- Canonical target is `docs/specs/vision.md`.
- In `convert`, detect legacy locations (`VISION.md`, `docs/specs/CORE_VISION.md`,
  other local variants) and map them to canonical sections.
- Never destroy legacy files by default. Prefer pointer-note migration.

### Step 2: Collect Evidence

Gather only claim-relevant evidence:

- North-star outcome and product category
- Who the product serves
- Core mechanics and differentiators
- Boundaries and explicit non-goals
- Current shipped reality vs planned areas
- Measurable success criteria

Use `scripts/collect_vision_evidence.sh` for a fast non-mutating inventory when
available.

### Step 3: Build Section-Level Proposal

Use `references/svc-vision-template.md` as canonical structure.

For each section, choose one action:
- `Add`
- `Convert`
- `Expand`
- `Delete` (requires meaning-loss note)

Keep one concept change per proposal item.

### Step 4: Emit Required Output Schema

Follow `references/output-schema.md` exactly:

1. `Proposed Changes`
2. `Evidence Table`
3. `Open Questions`
4. `Approval Gate`

### Step 5: Apply Behavior

- If `apply=false`: stop at proposal.
- If `apply=true`: apply only items explicitly approved in the approval gate.

## Phase Receipt Contract

When running under `.svc/lane-tasks-<WI>.json`, emit receipts for each required
phase before marking the task completed:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeTargetResolution --evidence command_output:.svc/write-vision-target.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-EvidenceCollection --evidence command_output:.svc/write-vision-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SectionProposal --evidence file:docs/specs/vision.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ApprovalApply --evidence file:docs/specs/vision.md
```

If `apply=false`, use the persisted proposal artifact path when one exists; otherwise
record the host transcript or lane-task evidence path that contains the proposal.

---

## Mode Behavior

### Mode: grounded (default)

- Evidence-backed proposal-first diffs.
- Claims must map to evidence rows.
- Conflicts and gaps stay explicit.

### Mode: scratch

- Draft from first principles when evidence is incomplete.
- Include assumptions list with confidence labels per major claim.
- Do not present synthetic citations as facts.

---

## Canonical Vision Structure

The canonical file should follow this structure:

1. North Star
2. Problem Statement
3. Who We Serve
4. Value Proposition
5. In-Scope Product Reality (Current)
6. Boundaries and Non-Goals
7. Product Principles
8. Success Definition
9. Evidence Anchors
10. Vision Editing Protocol
11. Decision Log
12. Forward-Looking Areas (Exploration, Not Commitment)

---

## Routing Rules

Use these handoffs when needed:

- Vision is missing or stale before persona/journey/spec work: run this skill first.
- Vision conflicts with persona assumptions: run `write-vision` before regenerating personas.
- Major code/spec drift discovered in `sync-spec-code`: run `write-vision mode=grounded`.
- Request for PRD or implementation details: finish vision work, then hand off to
  the relevant downstream skill.

---

## References

- `references/output-schema.md`
- `references/svc-vision-template.md`
- `scripts/collect_vision_evidence.sh`

## Audit Mode

When invoked with `--audit` or when vision.md already exists and the user asks to review it:

1. Read `docs/specs/vision.md`
2. Check completeness: all 12 canonical sections present?
3. Check staleness: does the vision's "Who We Serve" still match the current persona set?
4. Check code reality: does the vision's scope match what the codebase actually does? (grep for features mentioned in vision that don't exist in code)
5. Check consistency: do the Boundaries/Non-Goals still make sense given recent feature additions?
6. Report: section-by-section PASS/WARN/FAIL with specific findings

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
| 1 | `docs/specs/vision.md` exists | `test -f docs/specs/vision.md` | |
| 2 | Vision has North Star, Problem Statement, Who We Serve sections | grep for section headings in vision.md | |
| 3 | No unresolved TBD/TODO items in vision | grep for TBD, TODO, open questions in vision.md | |

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
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- Invoke next skill: `analyze-domain --progressive --lane greenfield`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `build-personas`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
