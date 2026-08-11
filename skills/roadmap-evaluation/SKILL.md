---
name: roadmap-evaluation
version: "1.0"
description: >-
  Synthesize project-state, work items, vision, and builder profile into a prioritized milestone roadmap with cost estimates and timeline-to-first-paying-customer. Use when: "what should I build next", "show me the roadmap", "prioritize my backlog", "how long until revenue". Also: "what's next", "where am I", "can I afford this", "timeline to first customer", "evaluate my roadmap". Also: "what's the plan", "budget check".
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

### Step 0b: Bootstrap Mode

When the builder has no project artifacts, don't guess — tell them what to
create and in what order. This is the only path that produces a checklist
instead of a roadmap.

**Output a bootstrap checklist to `docs/specs/roadmap.md`:**

```markdown
---
mode: bootstrap
created: <date>
status: incomplete
missing_inputs:
  - builder-profile
  - vision
  - project-state
  - work-items
---

# Roadmap: Bootstrap Required

The roadmap needs project artifacts to work with. Create these in order:

## Priority 1: Builder Profile
Run `/mine-builder` to capture your situation — budget, hours, skills,
distribution. This takes ~5 minutes and everything else depends on it.

## Priority 2: Vision
Run `/write-vision` to define what you're building, for whom, and how it
makes money. Without this, milestones have no direction.

## Priority 3: Work Items
After the vision exists, break it into work items. The pipeline does this
naturally as you run through specs.

## Priority 4: Project State
Created automatically as you progress through the pipeline. No manual
action needed.

---

When at least builder-profile and vision exist, re-run `/roadmap-evaluation`
for a full milestone plan.
```

**After writing the bootstrap output, stop.** Do not proceed to Steps 1-5.

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

### Step 3: Estimate Costs

For each milestone, estimate three cost categories.

**Category 1: Agent costs**

Agent cost is driven by the number of svc skill invocations. Each skill has a
rough token profile based on the complexity of work it does.

| Skill complexity | Avg tokens (input+output) | Approx cost (Opus) | Approx cost (Sonnet) |
|-----------------|--------------------------|--------------------|--------------------|
| Light (quick-fix, audit-ac) | 20-40K | $0.30-0.60 | $0.10-0.20 |
| Medium (write-spec, design-ux) | 50-100K | $0.75-1.50 | $0.25-0.50 |
| Heavy (execute-changeset, plan-changeset) | 100-200K | $1.50-3.00 | $0.50-1.00 |
| Orchestration (route-workflow full pipeline) | 200-400K | $3.00-6.00 | $1.00-2.00 |

**Estimate per milestone:** count the skills a milestone requires (write-spec +
design-ux + design-tech + plan-changeset + execute-changeset + review = 6
invocations minimum for a feature), multiply by the appropriate cost tier.

A typical feature milestone costs $5-15 in agent tokens on Opus, $2-5 on Sonnet.

**Category 2: Infrastructure costs**

Based on the tech stack (from vision or project-state), estimate monthly
hosting and service costs. Use free-tier-first defaults.

| Service | Free tier | Paid tier | When to upgrade |
|---------|-----------|-----------|----------------|
| Vercel | $0 (hobby) | $20/mo (pro) | Custom domain, team features |
| Supabase | $0 (free) | $25/mo (pro) | >500MB DB, >50K MAU |
| Cloudflare | $0 (free) | $5/mo (pro) | Advanced features |
| Domain | — | $10-15/yr | Always needed for launch |
| Email (Resend) | $0 (100/day) | $20/mo | >100 emails/day |
| Analytics (PostHog) | $0 (1M events) | $0+ (usage) | >1M events/mo |

**Category 3: Third-party and one-time costs**

| Item | Cost | Type | When needed |
|------|------|------|------------|
| Domain registration | $10-15 | One-time (yearly) | Before launch |
| LLC/sole proprietorship | $50-500 | One-time | Before Stripe |
| Stripe setup | $0 (2.9%+30c/tx) | Per-transaction | At first-sale milestone |
| Payment platform (Dodo/Lemon) | 5-8% per tx | Per-transaction | At first-sale milestone |

**Budget wall detection:**

After estimating all costs, calculate cumulative monthly burn at each milestone.
When cumulative burn exceeds the builder's budget_monthly:

```
⚠️ BUDGET WALL at Milestone N: "<milestone title>"
  Cumulative monthly cost: $X/mo
  Builder budget: $Y/mo
  Overage: $Z/mo

  Options:
  1. Defer Milestone N until revenue from earlier milestones covers the gap
  2. Run /stage-revenue to find a fast revenue project that funds the plan
  3. Reduce scope — identify which work items in Milestone N are optional
  4. Switch to Sonnet for implementation (reduces agent cost ~3x)
```

### Step 4: Project Timeline

Convert milestone sizes into calendar time using the builder's weekly hours.

**Time estimation formula:**

```
milestone_weeks = total_work_item_size_hours / hours_weekly

Size-to-hours mapping (from GitHub Projects convention):
  XS = 2 hours
  S  = 4 hours
  M  = 8 hours (1 day)
  L  = 20 hours (2-3 days)
  XL = 40 hours (1 week)
```

**Calendar projection:**

Starting from today's date, lay out milestones sequentially (respecting
dependencies) and calculate three timelines:

| Band | Multiplier | Basis |
|------|-----------|-------|
| Optimistic | 0.8x | Builder is experienced, no blockers |
| Realistic | 1.0x | Normal pace with normal interruptions |
| Pessimistic | 2.0x | Unknowns, learning curves, life happens |

If the builder profile includes project history with actual completion times,
calibrate the realistic estimate to their historical pace instead of using 1.0x.

**Parallel work:** If two milestones have no dependency relationship, they CAN
overlap. But solo builders rarely parallelize effectively — only mark milestones
as parallel if they involve genuinely different work streams (e.g., content
creation alongside development).

**First-revenue warning:**

When the "first-paying-customer" milestone's realistic completion date is more
than 8 weeks from today:

```
⚠️ TIMELINE WARNING: First revenue projected at week N (>8 weeks)

  The svc framework recommends /stage-revenue for timelines beyond 8 weeks.
  Revenue staging finds a fast Stage 1 project that earns money within 2-4
  weeks while the main project continues in the background.

  Current projected first-revenue: <date> (week N)
  With staging: ~2-4 weeks for Stage 1 revenue, then main project continues
```

### Step 5: Identify Risks and Gaps

Scan the milestone plan for four categories of risk.

**Category 1: Skill gaps**

Compare each work item's required skills/technologies against the builder
profile's skill set. Flag mismatches:

```
🔸 SKILL GAP: Milestone 2 "Payment Integration" requires Stripe API
   Builder profile shows no Stripe experience.
   Severity: blocks revenue (payment is required to earn)
   Mitigation: Use Dodo Payments (simpler API), or budget 4 extra hours for learning
```

**Category 2: External blockers**

Identify milestones that depend on factors outside the builder's control:

```
🔸 EXTERNAL BLOCKER: Milestone 3 requires a registered business entity
   Lead time: 1-4 weeks depending on jurisdiction
   Severity: blocks revenue (can't use Stripe without entity)
   Mitigation: Start entity registration now; use LemonSqueezy until entity is ready
```

**Category 3: Vision-backlog gaps**

Cross-reference vision goals against work items:

- **Unplanned vision gaps:** Vision goals with no corresponding work items.
  These are promises the builder made to themselves that have no execution path.
- **Orphan work:** Work items that don't connect to any vision goal. These
  might be scope creep, or the vision needs updating.

```
🔸 UNPLANNED: Vision states "multi-language support" but no WI covers i18n
   Severity: delays revenue (if target market needs it) / cosmetic (if not)
   Mitigation: Add WI or explicitly defer in vision with reasoning

🔸 ORPHAN: WI-007 "Dark mode" doesn't map to any vision goal
   Severity: cosmetic
   Mitigation: Deprioritize unless builder insists — move to last milestone or backlog
```

**Category 4: Abandonment patterns**

If the builder profile shows a history of abandoned projects, check which
phase they typically stall at. Flag milestones that hit that phase:

```
🔸 ABANDONMENT RISK: Builder profile shows 2/3 past projects abandoned at
   the "UI polish" phase. Milestone 3 "Launch-ready UI" lands directly in
   this pattern.

   Countermeasures:
   1. Hire a UI contractor ($500-1500) — removes the builder's weak point
   2. Ship with minimal UI first — ugly but functional beats beautiful but abandoned
   3. Use a component library (shadcn/ui) to reduce UI decisions
   4. Set a hard deadline: if Milestone 3 isn't done in 2 weeks, launch anyway
```

### Step 6: Assemble Output

Write `docs/specs/roadmap.md` in the following format:

```markdown
---
budget_monthly: <number from builder profile, default 150>
hours_weekly: <number from builder profile, default 15>
first_revenue_date: "<YYYY-MM-DD — realistic estimate>"
total_milestones: <N>
total_estimated_cost: <sum of all milestone costs>
confidence: <low | medium | high — based on input completeness>
created: "<YYYY-MM-DD>"
inputs_found:
  builder_profile: <true | false>
  vision: <true | false>
  project_state: <true | false>
  work_items: <count | 0>
  staging_plan: <true | false>
---

# Roadmap: <Product Name>

## Summary

- **Time to first paying customer:** <N weeks> (optimistic: <N>, pessimistic: <N>)
- **Total cost to first paying customer:** $<amount> (agent: $<X>, infra: $<Y>, other: $<Z>)
- **Budget utilization:** <X>% of $<budget>/mo
- **Top 3 risks:**
  1. <risk summary + severity>
  2. <risk summary + severity>
  3. <risk summary + severity>

---

## Milestone 1: <Title>

<!-- metadata
id: M1
priority_score: <composite score 1-10>
estimated_weeks: <N>
estimated_cost: <$amount>
revenue_gate: <gate name>
status: PLANNED
-->

**Goal:** <one sentence — what this milestone achieves>
**Revenue gate:** <gate name> — <what revenue event this enables>
**Timeline:** <start date> → <end date> (<N weeks> realistic)
**Cost:** Agent $<X> + Infra $<Y> + Other $<Z> = **$<total>**

### Work Items

| WI | Title | Size | Status | Skills needed |
|----|-------|------|--------|--------------|
| WI-001 | ... | M | pending | React, Supabase |
| WI-002 | ... | S | pending | TypeScript |

### Risks

- <any risks specific to this milestone>

---

## Milestone 2: <Title>

<!-- ... same format ... -->

---

## Risks and Gaps

### Skill Gaps
<list or "None identified">

### External Blockers
<list or "None identified">

### Vision-Backlog Gaps
<list or "None identified">

### Abandonment Patterns
<list or "No abandonment history in builder profile">

---

## Cost Breakdown

| Milestone | Agent | Infra | Other | Total | Cumulative monthly |
|-----------|-------|-------|-------|-------|-------------------|
| M1: ... | $X | $Y | $Z | $T | $C/mo |
| M2: ... | $X | $Y | $Z | $T | $C/mo |
| **Total** | | | | **$T** | **$C/mo** |

<budget wall warning if applicable>

---

## Timeline

| Milestone | Start | End (optimistic) | End (realistic) | End (pessimistic) |
|-----------|-------|-------------------|-----------------|-------------------|
| M1: ... | <date> | <date> | <date> | <date> |
| M2: ... | <date> | <date> | <date> | <date> |

**First paying customer:** <date> (realistic)

<8-week warning if applicable>
```

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
