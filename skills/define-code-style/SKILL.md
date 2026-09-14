---
name: define-code-style
version: "1.0"
description: >
  Define or audit a code style contract for the project. In create mode, analyzes
  existing codebase (brownfield) or design system + tech stack choice (greenfield) to
  produce a style contract. In audit mode, checks generated code against the contract.
  Produces docs/specs/style-contract.md. Use when: "code style", "naming conventions",
  "style contract", "style audit", "check code consistency", or automatically between
  design-tech and plan-changeset in the pipeline.
phases:
  - id: P1-ModeAndStalenessCheck
    trigger: always
    reads: ["docs/specs/style-contract.md", "package.json", "tsconfig.json", "git log"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SourceSignalSampling
    trigger: always
    reads: ["source code", "docs/specs/design-system.md", "docs/specs/features/*.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ConventionExtraction
    trigger: always
    reads: ["source code", "package.json", "tsconfig.json"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-StyleContractWrite
    trigger: create-mode-or-stale-contract
    reads: ["docs/specs/features/*.md", "docs/specs/design-system.md", "source code"]
    writes: ["docs/specs/style-contract.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-AuditDriftReport
    trigger: audit-mode
    reads: ["docs/specs/style-contract.md", "source code"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/style-contract.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
  optional:
    - { path: "docs/specs/design-system.md", artifact: design-system }
    - { path: "docs/specs/style-contract.md", artifact: existing-style-contract }
    - { path: "package.json", artifact: package-json }
    - { path: "tsconfig.json", artifact: tsconfig }
outputs:
  produces:
    - { path: "docs/specs/style-contract.md", artifact: style-contract }
chain:
  lanes:
    greenfield: { position: 17, prev: explore-solutions, next: plan-changeset }
    brownfield-feature: { position: 12, prev: explore-solutions, next: plan-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Spec Style Sync

Define the code style contract between technical design and implementation. The style contract is a project-level artifact — created once, evolved as the codebase grows.

**Announce at start:** "I'm using the define-code-style skill to define (or audit) the code style contract."

## Modes

### Create Mode (no existing style-contract.md)

Analyze the project to derive conventions:

**Brownfield (existing code):**
1. Read 5-10 representative source files across domains (services, routes, components, tests)
2. Extract patterns: naming, file structure, import style, test patterns, error handling
3. Produce `docs/specs/style-contract.md` that codifies what IS, not what should be

**Greenfield (no source files yet):**
1. Read `docs/specs/design-system.md` if it exists (visual language → component naming)
2. Read `package.json` and `tsconfig.json` for tech stack signals
3. Read the technical design section for architecture patterns
4. Produce a style contract based on community conventions for the detected stack

### Audit Mode (existing style-contract.md)

1. Read the current style contract
2. Scan source files for violations
3. Report violations as a table: file, line, convention violated, actual vs expected
4. Do NOT auto-fix — report only. The developer decides what to change.

### Staleness Check

The style contract is stale if:
- It predates the most recent `design-tech` checkpoint commit
- `package.json` dependencies have changed since the contract's `Generated:` date

If stale, re-run Create Mode to refresh.

## Style Contract Structure

```markdown
# Code Style Contract

**Generated:** YYYY-MM-DD
**Source:** [codebase analysis | design system + tech stack]
**Tech Stack:** [detected from package.json / tsconfig]

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | [detected] | user-service.ts |
| Functions | [detected] | getUserById |
| Types/Interfaces | [detected] | UserProfile |
| Constants | [detected] | MAX_RETRY_COUNT |
| Test files | [detected] | user-service.test.ts |

## File Structure Patterns

- Services: [detected path pattern]
- Components: [detected path pattern]
- Types: [detected path pattern]
- Tests: [co-located | separate directory]

## Import Style

- [absolute | relative | aliased]
- [named exports | default exports]
- [type imports separated | inline]

## Test Patterns

- Framework: [vitest | jest | mocha | detected]
- Structure: [describe/it | test() | detected]
- Assertion style: [expect | assert | detected]
- Mock strategy: [boundary mocks | no mocks | detected]

## Error Handling

- [custom classes | plain Error | error codes | detected]
- [try/catch | Result type | detected]

## Component Patterns (if UI exists)

- Props naming: [detected]
- Hook extraction: [detected]
- State management: [detected]
```

## Self-Verify

Before declaring done:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | `docs/specs/style-contract.md` exists | `test -f docs/specs/style-contract.md` | |
| 2 | Contract has all required sections | grep for Naming, File Structure, Import, Test, Error | |
| 3 | Conventions are specific (not "TBD" or generic) | No placeholder text | |
| 4 | Tech stack matches `package.json` | Compare detected stack with actual deps | |

## Audit Mode

When invoked in audit mode (existing code style contract at `docs/specs/style-contract.md`):
1. Read the existing contract
2. Run staleness check against current codebase
3. Report drift: conventions that no longer match the code
4. Suggest updates — do not auto-apply without confirmation

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeAndStalenessCheck --evidence command_output:.svc/define-code-style-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SourceSignalSampling --evidence command_output:.svc/define-code-style-sampling.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ConventionExtraction --evidence command_output:.svc/define-code-style-conventions.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-StyleContractWrite --evidence file:docs/specs/style-contract.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-AuditDriftReport --evidence command_output:.svc/define-code-style-audit.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/define-code-style-self-verify.log
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

**If `--progressive` and self-verify passed:**
- Check `--skip` list. If `style` is in skip list, pass through to next skill.
- Determine lane from `--lane` flag.
- Invoke next skill: `plan-changeset --progressive --lane <lane>`

**If standalone:**
- Report the style contract summary
- Suggest: "Next: run `plan-changeset` to produce the implementation manifest"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
