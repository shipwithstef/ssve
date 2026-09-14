---
name: evolve-framework
version: "1.0"
description: >
  Use when finding improvement opportunities in the svc framework itself.
  Triggers on "evolve the framework", "improve svc", "what should we fix next",
  "find gaps", "framework audit", "meta-improvement", or when wanting to make
  the pipeline better rather than using it on a project.
phases:
  - id: P1-FrameworkStatePreload
    trigger: always
    reads: ["FRAMEWORK-STATE.md"]
    writes: [".svc/evolve-framework-state.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-EvidenceSourceSurvey
    trigger: always
    reads: ["DOCTRINE.md", "skills-manifest.json", "SKILL.md files", "test-framework/results/", "proposals/"]
    writes: [".svc/evolve-framework-evidence.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-FindingClassification
    trigger: always
    reads: ["evidence survey", "references/skill-pack-comparison.md", "references/blend-registry.json"]
    writes: ["proposals/<date>-evolution.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-EvolutionProposalDraft
    trigger: always
    reads: ["classified findings", "existing proposals", "FRAMEWORK-STATE.md"]
    writes: ["proposals/<date>-evolution.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ProposalLifecycleDecision
    trigger: always
    reads: ["proposals/<date>-evolution.md", "proposals/done/", "FRAMEWORK-STATE.md"]
    writes: ["FRAMEWORK-STATE.md", ".svc/pipeline-decisions.jsonl"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["proposals/<date>-evolution.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
  optional:
    - { path: ".svc/framework-gaps.jsonl", artifact: framework-gaps }
    - test-framework/results/ (past test runs and comparisons)
    - proposals/ (existing improvement proposals)
    - references/skill-pack-comparison.md
outputs:
  produces:
    - { path: "proposals/<date>-evolution.md", artifact: evolution-proposal }
chain:
  lanes:
    framework: { position: 2 }
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Framework Evolution

You are improving the svc framework itself — not using it on a project.

**Announce at start:** "I'm using the evolve-framework skill to find improvement opportunities for the svc pipeline."

## Scope boundary vs `improve-framework` (WI-077)

These two skills produce DIFFERENT artifacts and should never be conflated:

| Skill | Artifact shape | What it carries |
|---|---|---|
| `evolve-framework` | `proposals/<date>-evolution.md` | **Survey** of N gaps with evidence + severity + category. No per-leaf fix briefs. |
| `improve-framework` | `proposals/<date>-framework-improvement-<name>.md` | **One** gap, diagnosed, with ACs + file-impact + rollback. Single fix brief. |

**Rule:** An evolution proposal MUST NOT embed per-leaf fix briefs. If a gap merits fix-brief-shape, author a separate `framework-improvement-<name>.md` file via `improve-framework`. Conflating these was the WI-073 lane-compliance failure (the cohesion proposal did both and the funnel got skipped).

Reciprocal note in `skills/improve-framework/SKILL.md` under "Scope boundary vs evolve-framework".

## Before You Start

**Read `FRAMEWORK-STATE.md` FIRST.** It contains:
- What was already analyzed and found
- What was already fixed (don't rediscover)
- Known gaps that are intentionally deferred (don't re-propose without new evidence)
- Locked decisions (don't re-litigate)

If you find something that's already in FRAMEWORK-STATE.md, skip it.
If you find something NEW, add it. If you fix something, move it from
"Known Gaps" to "Analysis History."

## What you're looking for

The goal is to find concrete, actionable improvements to the methodology,
skills, or pipeline that would make svc produce better results with less
friction. Every finding must be grounded in evidence, not vibes.

## Evidence sources (read in this order)

1. **DOCTRINE.md** — the methodology claims. Look for claims that aren't
   enforced by any skill, or enforcement gaps between what the doctrine says
   and what skills actually do.

2. **skills-manifest.json** — lane definitions, pipeline order, review gates.
   Look for ordering issues, missing skills in lanes, or gates that don't
   match the doctrine.

3. **Every included SKILL.md** — read the current first-party skill set from `skills-manifest.json`. Look for:
   - Skills that overlap significantly (should be merged or one should defer)
   - Skills that reference patterns not yet implemented
   - Skills with TODO/FIXME/placeholder sections
   - Input/output mismatches between chained skills
   - Missing self-verify or chain position metadata
   - Inconsistencies in how skills handle bootstrap vs convert mode

4. **test-framework/results/** — past autopilot runs and comparisons. Look for:
   - Metrics that show regression or stagnation
   - Comparison findings where svc lost to alternatives
   - Patterns in what the pipeline gets wrong repeatedly

5. **proposals/** — pending improvement proposals (not yet implemented).
   **proposals/done/** — implemented proposals (moved here after implementation).
   Check:
   - Whether any pending proposals are stale or no longer relevant
   - Whether done proposals actually landed in the skills they targeted

6. **references/skill-pack-comparison.md** — capability gaps vs gstack and
   superpowers. Look for capabilities others have that svc lacks.

7. **references/blend-registry.json** (if exists) — check if blended sources
   have shipped improvements since last blend.

## Analysis framework

For each finding, classify it:

| Category | What it means |
|----------|--------------|
| **Gap** | Something the doctrine or pipeline should do but doesn't |
| **Drift** | A skill contradicts the doctrine or another skill |
| **Inefficiency** | The pipeline wastes tokens, time, or user turns on something |
| **Fragility** | A pattern that works but breaks easily under edge cases |
| **Host capability drift** | Training data or existing docs misstate current host API capabilities |
| **Opportunity** | Something not in scope today but would meaningfully improve outcomes |

## Output

Produce `proposals/<date>-evolution.md` with this structure:

```markdown
# Framework Evolution — <date>

## Method
<What you read, how you assessed, what evidence you used>

## Findings (by priority)

### P0 — Fix now (blocks quality)
<Finding with evidence and specific fix>

### P1 — Fix soon (degrades quality)
<Finding with evidence and specific fix>

### P2 — Improve when possible (nice to have)
<Finding with evidence and specific fix>

### P3 — Track (not actionable yet)
<Finding with evidence and why it's not actionable yet>

## Comparison delta
<What competitors do that svc doesn't, with assessment of whether it matters>

## Stale proposal audit
<Which existing proposals are implemented, pending, or obsolete>
```

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Proposal file exists | `test -f proposals/<date>-evolution.md` | |
| 2 | Every finding cites file:line | grep for file paths in proposal | |
| 3 | FRAMEWORK-STATE.md was read first | no rediscovered items in findings | |
| 4 | Findings are ranked by impact | proposal has severity column | |

## Proposal Lifecycle

Evolution proposals live in `proposals/` while pending. When the proposal is
fully implemented by `improve-framework` or direct edits, move it:

```bash
mv proposals/<date>-evolution.md proposals/done/
```

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `evolve-framework` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-FrameworkStatePreload --evidence command_output:.svc/evolve-framework-state.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-EvidenceSourceSurvey --evidence command_output:.svc/evolve-framework-evidence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-FindingClassification --evidence file:proposals/<date>-evolution.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-EvolutionProposalDraft --evidence file:proposals/<date>-evolution.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProposalLifecycleDecision --evidence file:FRAMEWORK-STATE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/evolve-framework-self-verify.log
```

## Pipeline Continuation

Follow the canonical task-graph chaining contract: see `references/task-graph-chaining-protocol.md`.

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill produces a proposal; it does not chain progressively. After completion, route to `improve-framework` if the user wants to act on the proposal.

## Rules

- Every finding must cite the specific file and line where you found the issue.
  "The pipeline could be better" is not a finding. "skills/plan-changeset/SKILL.md:142
  references a simulation step but the simulation never checks import resolution"
  is a finding.

- Do not propose changes that would break existing lane definitions. If a lane
  needs restructuring, say so but frame it as a migration, not a rewrite.

- Do not propose adding skills just because another framework has them. Only
  propose additions where you can articulate what specific failure mode or
  inefficiency the addition would address.

- Do not implement any changes. This skill produces proposals. Implementation
  happens through the normal pipeline (write-spec → plan-changeset → etc).

- If any finding involves host-specific implementation (hooks, MCP, task graph,
  model routing, UI paradigms, Background Tasks), mark it as `host-capability-drift`
  and flag that it requires `research` verification before any proposal can be
  implemented.

- If any finding requires implementation touching > 2 files or > 50 lines,
  it MUST go through `write-spec` → `plan-changeset` → `execute-changeset`
  in a worktree. No reactive quick-fixes on framework skills. Framework
  changes are not exempt from planning discipline.

- If you find fewer than 3 findings, say so honestly. A clean audit is a
  valid result.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
