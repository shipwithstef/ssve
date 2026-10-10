---
name: roadmap-evaluation
version: "1.0"
description: >
  Turn project state, work items, vision and builder profile into a prioritized, costed
  milestone roadmap with time to first paying customer. Use for 'show me the roadmap',
  'prioritize my backlog', 'how long until revenue', 'can I afford this'.
inputs:
  required: []
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/work-items/WI-*.md", artifact: work-items }
    - { path: "docs/specs/staging-plan.md", artifact: staging-plan }
outputs:
  produces:
    - { path: "docs/specs/roadmap.md", artifact: roadmap }
phases:
  - id: P1-InputInventory
    trigger: always
    reads: ["~/.svc/builder-profile.md", "docs/specs/vision.md", "docs/specs/project-state.md", "docs/specs/work-items/WI-*.md", "docs/specs/staging-plan.md"]
    writes: ["input inventory and missing-input notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-BootstrapDecisionOrNormalizeInputs
    trigger: after:P1-InputInventory
    reads: ["input inventory and missing-input notes"]
    writes: ["bootstrap decision or normalized roadmap inputs"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-MilestoneScoringPrioritization
    trigger: after:P2-BootstrapDecisionOrNormalizeInputs
    reads: ["normalized roadmap inputs", "work item dependency data", "vision goals"]
    writes: ["milestone grouping and priority scores"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-CostEstimationBudgetWall
    trigger: after:P3-MilestoneScoringPrioritization
    reads: ["milestone grouping and priority scores", "builder budget", "infrastructure cost assumptions"]
    writes: ["cost estimates and budget-wall notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-TimelineRiskGapAnalysis
    trigger: after:P4-CostEstimationBudgetWall
    reads: ["milestone estimates", "builder hours", "vision goals", "work items", "builder project history"]
    writes: ["timeline bands, first-revenue warning, risks and gaps"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-RoadmapArtifactWrite
    trigger: after:P5-TimelineRiskGapAnalysis
    reads: ["milestone plan", "cost estimates", "timeline bands", "risks and gaps"]
    writes: ["docs/specs/roadmap.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-BuilderSummaryCheckpoint
    trigger: after:P6-RoadmapArtifactWrite
    reads: ["docs/specs/roadmap.md"]
    writes: ["builder-facing roadmap summary and checkpoint ask"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: after:P7-BuilderSummaryCheckpoint
    reads: ["Self-Verify Checklist", "docs/specs/roadmap.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
chain:
  lanes: {}
  progressive: true
  self_verify: true
  human_checkpoint: true
---

# Roadmap Evaluation

## Overview

Turn scattered project artifacts into a single prioritized plan. This skill
reads everything the builder has — vision, work items, project state, builder
profile — and produces a roadmap that answers three questions:

1. **What to build, in what order?** — milestones ranked by revenue impact x
   feasibility x dependency satisfaction
2. **What will it cost?** — agent spend, infrastructure, and third-party
   services per milestone, checked against the builder's monthly budget
3. **When does money come in?** — calendar-grounded timeline to first paying
   customer, with confidence bands

The output is `docs/specs/roadmap.md` — human-readable markdown with
machine-parseable YAML frontmatter so downstream skills (route-workflow,
stage-revenue) can consume it programmatically.

**Announce at start:** "I'm using roadmap-evaluation to synthesize your project
artifacts into a prioritized milestone plan with cost estimates and timeline."

**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction,
storage, and staleness rules when researching infrastructure costs or market rates.

---

## When This Skill Adds Value

This skill is useful whenever the builder has at least a vision OR work items.
It becomes essential when the builder has both and needs to decide sequencing.

| Situation | Value |
|-----------|-------|
| Builder has vision + work items + builder profile | **Maximum** — full roadmap with personalized timeline and costs |
| Builder has vision + builder profile, no work items | **High** — derives milestones from vision goals, surfaces gaps |
| Builder has work items only, no vision | **Medium** — prioritizes existing backlog, flags missing direction |
| Builder has nothing yet | **Bootstrap** — outputs a checklist of what to create first |

The skill degrades gracefully. Every missing input narrows the output but never
blocks it entirely. The bootstrap path ensures even a brand-new project gets
value.

---

## Process

### Step 0: Read All Inputs

Read every available artifact. Missing inputs are noted but never block execution.

```
# Check each input — read if it exists, note if missing
cat ~/.svc/builder-profile.md 2>/dev/null
cat docs/specs/vision.md 2>/dev/null
cat docs/specs/project-state.md 2>/dev/null
ls docs/specs/work-items/WI-*.md 2>/dev/null
cat docs/specs/staging-plan.md 2>/dev/null
```

**If none of the four core inputs exist** (no builder profile, no vision, no
project-state, no work items), switch to Bootstrap Mode (Step 0b). Do not
attempt to generate a roadmap from nothing.

**Record what was found:**

```
Inputs found:
  ☑/☐ builder-profile.md — budget: $___/mo, hours: ___/wk, skills: [...]
  ☑/☐ vision.md — product: ___, revenue model: ___, target users: ___
  ☑/☐ project-state.md — pipeline phase: ___, lane: ___
  ☑/☐ work-items — count: ___, by status: ___ pending, ___ in-progress, ___ completed
  ☑/☐ staging-plan.md — staging recommended: yes/no
```

**Step 0b: Bootstrap Mode** — When the builder has no project artifacts, do not guess a roadmap. Write a bootstrap checklist to `docs/specs/roadmap.md` (frontmatter `mode: bootstrap`, `status: incomplete`, `missing_inputs` list) that names what to create in order: builder profile via `/mine-builder`, vision via `/write-vision`, work items, and project state (auto-created). Then STOP and do not proceed to Steps 1-5; re-run `/roadmap-evaluation` once at least the builder profile and vision exist. Details: `references/bootstrap-mode.md`.

### Step 1: Extract and Normalize

From each input, extract the data needed for scoring.

**From builder-profile:**
- `budget_monthly` — the builder's stated monthly agent/tool budget (default: $150)
- `hours_weekly` — hours available per week for building
- `skills` — technologies and domains the builder knows
- `distribution` — channels the builder can use for launch
- `project_history` — past projects, especially abandonment patterns
- `failure_patterns` — phases where the builder tends to stall

**From vision:**
- `product_goals` — what the product does and who it serves
- `revenue_model` — how money flows (subscription, one-time, usage-based)
- `target_users` — who pays
- `differentiators` — what makes this product worth building

**From project-state:**
- `pipeline_phase` — where the project is in the svc pipeline
- `completed_features` — what's already built
- `current_lane` — greenfield, brownfield, etc.

**From work-items:**
For each WI-*.md, extract:
- `id`, `title`, `priority`, `size`, `status`
- `dependencies` — other WIs this one depends on
- `skills_required` — technologies needed (for skill-gap detection)
- `revenue_connection` — does this WI directly enable revenue?

**From staging-plan (if exists):**
- `staging_recommended` — was staging recommended?
- `stage_1_project` — what's the fast-revenue project?
- `current_stage` — which stage is the builder in?

### Step 2: Score and Prioritize

Group work items into 3-5 milestones. Each milestone is a coherent chunk of
work that reaches a testable state — ideally a revenue gate.

**Grouping principles:**
- Group by dependency chain — items that must ship together go in the same milestone
- Group by revenue gate — items that collectively enable a revenue event belong together
- Keep milestones roughly similar in size (2-4 weeks each at the builder's pace)
- Never put more than 7 work items in one milestone — split if larger

**Score each milestone on three dimensions:**

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Revenue impact | 40% | How directly does this milestone enable revenue? First sale > improved conversion > nice-to-have feature |
| Feasibility | 35% | Does the builder have the skills? Does it fit the budget? Are dependencies satisfied? |
| Dependency satisfaction | 25% | Does this milestone unblock other milestones? Bottleneck-breakers score higher |

**Composite score:** `(revenue_impact × 0.4) + (feasibility × 0.35) + (dependency_satisfaction × 0.25)`

Each dimension is scored 1-10. The composite determines milestone order.

**Revenue gate assignment:**

Every milestone gets exactly one revenue gate — the revenue event it enables.
If a milestone doesn't enable any revenue event, it must be justified as a
prerequisite for one that does.

| Revenue Gate | Description | Examples |
|-------------|-------------|---------|
| `first-sale` | Product can accept payment for the first time | Payment integration, pricing page, checkout flow |
| `first-subscription` | Recurring revenue begins | Subscription billing, account management |
| `first-paying-customer` | A real human pays real money | Launch, distribution, onboarding |
| `break-even-agent` | Revenue covers agent/tool costs | Enough customers to cover $150/mo |
| `break-even-infra` | Revenue covers all operating costs | Enough customers to cover hosting + tools |
| `growth-ready` | Core product stable enough to invest in growth | Analytics, referral, content |
| `prerequisite` | No direct revenue — enables a revenue milestone | Auth, data model, API layer |

**Steps 3-6: Costs, Timeline, Risks, Output** — Step 3: estimate per milestone agent cost (skill invocations times a token-cost tier), infrastructure cost (free-tier-first) and one-time/third-party cost; when cumulative monthly burn exceeds `budget_monthly`, emit a BUDGET WALL warning with options (defer, `/stage-revenue`, cut scope, switch to Sonnet). Step 4: convert sizes (XS=2h, S=4h, M=8h, L=20h, XL=40h) into weeks using `hours_weekly`, give optimistic 0.8x, realistic 1.0x and pessimistic 2.0x dates (calibrate to builder history if present), and if first revenue is over 8 weeks out emit a TIMELINE WARNING recommending `/stage-revenue`. Step 5: flag skill gaps, external blockers, vision-backlog gaps (unplanned vision goals and orphan work items) and abandonment patterns from the builder profile. Step 6: write `docs/specs/roadmap.md` with the frontmatter (budget, hours, first_revenue_date, milestones, cost, confidence, inputs_found), Summary, per-milestone sections with metadata, work items table and risks, Risks and Gaps, Cost Breakdown and Timeline tables. Details and templates: `references/steps-3-to-6.md`.

### Step 7: Present to Builder

After writing the roadmap, present a concise summary to the builder. Don't
dump the entire document — highlight the decisions that matter:

1. **The sequence** — "Here's the order I'm recommending and why M1 comes first"
2. **The money question** — "You can reach first revenue by <date> at $<cost>"
3. **The scary parts** — "These N risks could stall you, here's what to do about them"
4. **The ask** — "Does this sequence make sense? Want to adjust priorities?"

Wait for the builder's response before proceeding.

---

## Re-evaluation Mode

When `docs/specs/roadmap.md` already exists, run in re-evaluation mode:

1. Read the existing roadmap
2. Read current project-state and work-items (some may have changed status)
3. Update milestone statuses: move completed WIs, recalculate timelines
4. Recalculate costs based on what's been spent vs remaining
5. Flag any new risks that emerged since the last evaluation
6. Write the updated roadmap (preserve the same file, update content)

Re-evaluation is lighter than initial creation — it preserves the milestone
structure and only updates what changed. If the project has drifted
significantly from the roadmap, note the drift and ask the builder whether
to restructure or continue.

---

## Self-Verify Checklist

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Roadmap file exists | `test -f docs/specs/roadmap.md` | |
| 2 | YAML frontmatter complete | All 6 required fields present: budget_monthly, hours_weekly, first_revenue_date, total_milestones, total_estimated_cost, confidence | |
| 3 | 3-5 milestones defined | Count `## Milestone` headings (or 1 bootstrap checklist) | |
| 4 | Every milestone has a revenue gate | Each milestone metadata block has `revenue_gate` | |
| 5 | Cost breakdown table present | `## Cost Breakdown` section exists with per-milestone costs | |
| 6 | Timeline table present | `## Timeline` section exists with three confidence bands | |
| 7 | Budget wall flagged if applicable | If cumulative cost > budget_monthly, warning is present | |
| 8 | First-revenue warning if applicable | If realistic first-revenue > 8 weeks, stage-revenue mention is present | |
| 9 | Risks section populated | `## Risks and Gaps` section exists with at least one category populated (or explicit "None") | |
| 10 | No TBD/TODO placeholders | grep for TBD, TODO, placeholder in roadmap.md returns nothing | |
| 11 | Builder profile was used (if available) | Budget and hours in frontmatter match builder profile, or defaults noted | |
| 12 | Vision goals traced (if available) | Every vision goal maps to at least one WI in a milestone, or is flagged as unplanned | |

If any check FAILs, fix before continuing.

---

## Phase Receipt Contract

When this skill runs inside a task graph, emit one receipt per completed phase
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InputInventory --evidence command_output:.svc/roadmap-evaluation-inputs-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-BootstrapDecisionOrNormalizeInputs --evidence command_output:.svc/roadmap-evaluation-normalize-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-MilestoneScoringPrioritization --evidence command_output:.svc/roadmap-evaluation-scoring-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CostEstimationBudgetWall --evidence command_output:.svc/roadmap-evaluation-costs-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-TimelineRiskGapAnalysis --evidence command_output:.svc/roadmap-evaluation-risks-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-RoadmapArtifactWrite --evidence file:docs/specs/roadmap.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-BuilderSummaryCheckpoint --evidence command_output:.svc/roadmap-evaluation-summary-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/roadmap-evaluation-self-verify-<WI>.log
```

In Bootstrap Mode, still record `P3-MilestoneScoringPrioritization`,
`P4-CostEstimationBudgetWall`, and `P5-TimelineRiskGapAnalysis` with explicit
skip evidence that roadmap synthesis was intentionally bypassed because core
inputs were absent. If no task graph exists, report the same phase evidence in
the assistant response.

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

**If `--progressive` flag is present AND self-verify passed:**
- If the roadmap flagged first-revenue > 8 weeks AND no staging plan exists:
  invoke `stage-revenue --progressive`
- Otherwise: present roadmap to builder and suggest next action based on
  Milestone 1's needs (usually `write-spec` or `write-vision` for the
  highest-priority work item)

**If `--progressive` flag is absent:**
- Report the roadmap summary to the builder
- Suggest: "Milestone 1 is <title>. Next step: run `<appropriate skill>` to
  start executing it."

### Human Checkpoint

The roadmap is a human checkpoint. Present the summary and wait for:
- **"looks good"** → proceed to Milestone 1 execution
- **priority changes** → rescore and reorder milestones
- **scope changes** → add/remove work items, regenerate
- **"too expensive"** → find cost reductions (Sonnet, free tiers, scope cuts)
- **"too slow"** → find timeline reductions (scope cuts, parallel work, contractors)

---

## Key Principles

- **Revenue gates are non-negotiable.** Every milestone must either enable
  revenue or provably unblock one that does. Milestones without revenue
  connection get deprioritized ruthlessly.
- **The builder's budget is a hard constraint, not a suggestion.** If the plan
  costs more than they can spend, the plan is wrong — not the builder.
- **Calendar time beats ideal time.** A builder with 10 hrs/week takes 4
  calendar weeks to do 40 hours of work. Always show calendar time.
- **Degrade gracefully.** Missing inputs narrow the output but never block it.
  Something useful comes out even with just a vision doc.
- **The roadmap is a living document.** Re-evaluation mode updates it as the
  project progresses. Stale roadmaps are worse than no roadmap.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
