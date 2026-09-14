# Feature: Roadmap Evaluation

**Status:** DRAFT
**Type:** Enabler
**Consumers:** route-workflow, stage-revenue, builder (via CLI invocation)
**Priority:** High
**Created:** 2026-04-09

---

## Problem Statement

The svc framework has skills that find opportunities (`find-opportunity`), profile
the builder (`mine-builder`), and stage revenue (`stage-revenue`), but none that
synthesize the full project state — work items, vision, builder constraints, and
agent costs — into a prioritized roadmap with cost estimates and timeline to first
revenue.

Without this, the builder must mentally integrate scattered artifacts (vision goals,
incomplete work items, financial constraints, tool costs) to decide what to build
next. This is the exact kind of synthesis that agents do well and humans do poorly
under cognitive load. The result: builders either build features in gut-feel order
(missing revenue-critical paths) or stall because the planning itself is
overwhelming.

Dependent features (`stage-revenue`, `route-workflow`) currently lack a
structured "what should I do in what order given my budget" input. They route
based on change type and builder profile, but not on a prioritized backlog
evaluated against cost and timeline constraints.

---

## User Stories

### US-1: Produce a Prioritized Milestone Plan

**As** route-workflow (and the builder reviewing its output),
**I need** a prioritized list of milestones derived from existing project artifacts,
**So that** the builder knows the highest-value sequence of work given their constraints.

#### Acceptance Criteria — US-1: Prioritized Milestones

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ROAD-01 | Skill reads `docs/specs/project-state.md` and extracts current pipeline position, completed features, and in-progress work | — | 🔲 | — |
| ROAD-02 | Skill reads all `docs/specs/work-items/WI-*.md` files and extracts titles, priorities, sizes, statuses, and dependencies | — | 🔲 | — |
| ROAD-03 | Skill reads `docs/specs/vision.md` and extracts stated product goals, target users, and revenue model | — | 🔲 | — |
| ROAD-04 | Skill reads `~/.svc/builder-profile.md` and extracts weekly hours, skill set, financial constraints, and distribution channels | — | 🔲 | — |
| ROAD-05 | Output contains 3-5 milestones, each with: title, goal statement, constituent work items (or new items if gaps exist), and a dependency order | — | 🔲 | — |
| ROAD-06 | Milestones are ordered by a composite score: revenue impact x feasibility x dependency satisfaction (later milestones cannot depend on unfinished prerequisites) | — | 🔲 | — |
| ROAD-07 | Each milestone includes a "revenue gate" — the specific revenue event it enables (first sale, first subscription, first paying customer, break-even on agent costs) | — | 🔲 | — |
| ROAD-ZERO | When no project-state, work-items, or vision exist, skill outputs a bootstrap checklist telling the builder which artifacts to create first, in priority order | — | 🔲 | — |

### US-2: Estimate Costs Per Milestone

**As** the builder,
**I need** a realistic cost estimate for each milestone that includes agent spend, infrastructure, and third-party services,
**So that** I can plan spending within my $150/mo (or stated) agent budget.

#### Acceptance Criteria — US-2: Cost Estimates

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ROAD-08 | Each milestone includes estimated agent cost based on: number of skills invoked x average token consumption per skill | — | 🔲 | — |
| ROAD-09 | Agent cost estimates use the builder profile's stated monthly budget (default: $150/mo) as the constraint ceiling | — | 🔲 | — |
| ROAD-10 | Each milestone includes estimated infrastructure cost (hosting, DB, auth, payments) based on tech stack in project-state or vision | — | 🔲 | — |
| ROAD-11 | Each milestone includes estimated third-party service costs (domain, email, analytics) where applicable | — | 🔲 | — |
| ROAD-12 | Total monthly burn across all categories is shown per milestone and cumulative | — | 🔲 | — |
| ROAD-13 | When cumulative cost exceeds the builder's budget, skill flags a "budget wall" — the milestone where spend outpaces available funds — and suggests staging or deferral | — | 🔲 | — |
| ROAD-14 | Cost estimates distinguish between one-time costs (domain registration, entity setup) and recurring costs (hosting, agent spend, SaaS subscriptions) | — | 🔲 | — |

### US-3: Project Timeline to First Paying Customer

**As** the builder,
**I need** a calendar-grounded timeline showing when each milestone completes and when first revenue arrives,
**So that** I can set realistic expectations and identify if the plan is survivable.

#### Acceptance Criteria — US-3: Timeline Projection

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ROAD-15 | Timeline uses the builder profile's weekly hours to calculate elapsed calendar time per milestone | — | 🔲 | — |
| ROAD-16 | Each milestone shows: estimated start date, estimated completion date, and elapsed weeks | — | 🔲 | — |
| ROAD-17 | The "first paying customer" milestone is explicitly identified and its projected date highlighted | — | 🔲 | — |
| ROAD-18 | Timeline accounts for milestone dependencies — parallel work where possible, sequential where dependencies require it | — | 🔲 | — |
| ROAD-19 | When the projected timeline to first revenue exceeds 8 weeks, skill emits a warning and suggests invoking `stage-revenue` to find a faster Stage 1 path | — | 🔲 | — |
| ROAD-20 | Timeline includes a "confidence band" — optimistic (builder is fast, no blockers), realistic (historical pace from builder profile), pessimistic (2x realistic for unknowns) | — | 🔲 | — |

### US-4: Identify Roadmap Risks and Gaps

**As** the builder,
**I need** the roadmap to surface risks, missing prerequisites, and skill/knowledge gaps,
**So that** I can address blockers before they stall the plan.

#### Acceptance Criteria — US-4: Risk and Gap Analysis

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ROAD-21 | Skill identifies work items that reference skills or technologies not in the builder profile's skill set and flags them as "skill gap risks" | — | 🔲 | — |
| ROAD-22 | Skill identifies milestones that depend on external factors (business entity, payment processor approval, domain purchase) and flags lead times | — | 🔲 | — |
| ROAD-23 | Skill identifies vision goals that have no corresponding work items and flags them as "unplanned vision gaps" | — | 🔲 | — |
| ROAD-24 | Skill identifies work items that have no connection to any vision goal and flags them as "orphan work" — potentially deprioritize | — | 🔲 | — |
| ROAD-25 | Risk items include a severity (blocks revenue / delays revenue / cosmetic) and a suggested mitigation | — | 🔲 | — |
| ROAD-26 | When the builder profile shows a pattern of abandoned projects at a specific phase (from project history), skill flags milestones at that phase as "abandonment risk" and suggests countermeasures | — | 🔲 | — |

### US-5: Produce Machine-Readable Output

**As** route-workflow and stage-revenue,
**I need** the roadmap in a structured format that downstream skills can parse,
**So that** routing and staging decisions can incorporate roadmap priorities automatically.

#### Acceptance Criteria — US-5: Structured Output

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| ROAD-27 | Skill outputs `docs/specs/roadmap.md` in a defined format: YAML frontmatter (metadata) + markdown body (human-readable milestones) | — | 🔲 | — |
| ROAD-28 | YAML frontmatter includes: `budget_monthly`, `hours_weekly`, `first_revenue_date`, `total_milestones`, `total_estimated_cost`, `confidence` | — | 🔲 | — |
| ROAD-29 | Each milestone section includes a parseable metadata block: `id`, `title`, `priority_score`, `estimated_weeks`, `estimated_cost`, `revenue_gate`, `status` | — | 🔲 | — |
| ROAD-30 | Output includes a `## Summary` section with: time to first paying customer, total cost to first paying customer, budget utilization percentage, top 3 risks | — | 🔲 | — |

---

## System Dependencies

### This feature depends on:

| Dependency | Type | Spec exists? | What it provides | Mock strategy |
|-----------|------|-------------|-----------------|---------------|
| mine-builder | Enabler | N/A (skill, not spec) | `~/.svc/builder-profile.md` — builder constraints | Use sample builder profile with $150/mo budget, 15 hrs/week |
| project-state | Framework artifact | N/A (convention) | `docs/specs/project-state.md` — pipeline position | Use sample project-state at "post-vision" stage |
| work-items | Framework artifact | N/A (convention) | `docs/specs/work-items/WI-*.md` — backlog | Use 3-5 sample work items with varied priorities/sizes |
| vision | Framework artifact | N/A (convention) | `docs/specs/vision.md` — product goals | Use sample vision with revenue model section |

### Other features depend on this:

| Consumer | Type | What it needs from us |
|----------|------|----------------------|
| route-workflow | Enabler | Milestone priorities to influence routing decisions |
| stage-revenue | Enabler | Timeline-to-revenue to decide if staging is needed |
| teach-project | Enabler | Roadmap summary for builder education |

---

## Data Flow

```
┌─────────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ ~/.svc/              │   │ docs/specs/       │   │ docs/specs/      │
│ builder-profile.md   │   │ vision.md         │   │ project-state.md │
│                      │   │                   │   │                  │
│ - budget: $150/mo    │   │ - product goals   │   │ - pipeline phase │
│ - hours: 15/wk       │   │ - revenue model   │   │ - completed work │
│ - skills: [...]      │   │ - target users    │   │ - current lane   │
│ - history: [...]     │   │                   │   │                  │
└────────┬────────────┘   └────────┬──────────┘   └────────┬─────────┘
         │                         │                        │
         └─────────────┬───────────┘────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   roadmap-evaluation    │
         │                         │
         │  1. Read all inputs     │◄─── docs/specs/work-items/WI-*.md
         │  2. Score & prioritize  │
         │  3. Estimate costs      │
         │  4. Project timeline    │
         │  5. Identify risks      │
         │  6. Format output       │
         └────────┬────────────────┘
                  │
                  ▼
         ┌─────────────────────────┐
         │ docs/specs/roadmap.md   │
         │                         │
         │ - YAML frontmatter      │
         │ - Milestone 1..N        │
         │   - priority score      │
         │   - cost estimate       │
         │   - timeline            │
         │   - revenue gate        │
         │   - risks               │
         │ - Summary               │
         │   - first revenue date  │
         │   - total cost          │
         │   - top risks           │
         └─────────────────────────┘
```

---

## State Machine: Milestone Lifecycle

```
                ┌──────────┐
                │ PLANNED  │ ← initial state from roadmap-evaluation
                └────┬─────┘
                     │ builder starts work
                     ▼
                ┌──────────┐
                │ ACTIVE   │ ← work items in progress
                └────┬─────┘
                     │ all constituent WIs completed
                     ▼
                ┌──────────┐
                │ COMPLETE │ ← revenue gate tested
                └────┬─────┘
                     │ revenue gate confirmed
                     ▼
                ┌──────────┐
                │ VALIDATED│ ← revenue is flowing
                └──────────┘

  Side transitions:
  ACTIVE → BLOCKED (external dependency not met)
  ACTIVE → DEFERRED (budget wall hit, staging needed)
  PLANNED → DROPPED (scope review removes it)
```

---

## API Contracts

_N/A — this is a skill (prompt-based), not an HTTP service._

---

## Data Model

_N/A — output is a markdown file with YAML frontmatter, not a database._

---

## Component Tree

_N/A — no UI surface. Output is a document consumed by other skills and the builder._

---

## Event Contracts

_N/A — no async events. Skill is invoked synchronously and produces a file._

---

## Feature Toggles

_N/A — no external service dependencies. All inputs are local files._

---

## Technical Design

_To be added by design-tech._

---

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | `[NEW]` | Fills the "what to build next" gap between find-opportunity/stage-revenue and pipeline execution |
| 2 | Journey | `[NEW]` | System journey: builder invokes skill, receives roadmap, uses it to guide work |
| 3 | Acceptance criteria | `[NEW]` | 30 ACs across 5 user stories in this spec |
| 4 | UX | `[N/A — justified: no user surface; output is a markdown document read by builder and consumed by other skills]` | — |
| 5 | UI | `[N/A — justified: no visual interface; skill produces structured markdown]` | — |
| 6 | Tech architecture | `[NEW]` | To be defined by design-tech — skill is a SKILL.md prompt file |
| 7 | Cost model | `[NEW]` | Skill itself costs ~1 agent invocation (~$0.10-0.50 in tokens); outputs cost estimates for the project |
| 8 | Operations & ownership | `[NEW]` | Framework-owned skill; no production monitoring needed; versioned with svc repo |

---

## Implementation Notes

_To be added by plan-changeset and execute-changeset._

---

## Journey References

_To be added after write-journeys._

---

## Revision Log

| Date | AC | Was | Now | Why | By skill |
|------|----|-----|-----|-----|----------|
| 2026-04-09 | — | — | Initial DRAFT | Feature spec created | write-spec |
