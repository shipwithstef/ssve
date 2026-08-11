---
name: stage-revenue
version: "1.0"
description: >
  Break a big idea into revenue stages — Stage 1 (fast money in 1-2 weeks),
  Stage 2 (reinvest), Stage 3 (the real thing). Ensures the builder doesn't
  burn out building a 3-month project with no income. Use when: builder has a
  big idea but no capital, or validate-feature shows the idea takes > 2 weeks
  with no proven revenue model. Also use when the user says "I have an idea but
  no money", "how do I fund this", "this will take months", "staging plan",
  "revenue first", or when route-workflow detects a big-idea + no-capital
  builder profile.
phases:
  - id: P1-StagingDecisionContext
    trigger: always
    reads: ["~/.svc/builder-profile.md", "docs/specs/vision.md", "feature brief", "opportunity context"]
    writes: [".svc/stage-revenue-decision.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-Stage1CandidateSelection
    trigger: staging-recommended
    reads: ["builder profile", "vision", "find-opportunity output", "first-project rules"]
    writes: ["docs/specs/staging-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-FirstProjectRulesGate
    trigger: staging-recommended
    reads: ["docs/specs/staging-plan.md", "builder profile", "first-project rules"]
    writes: ["docs/specs/staging-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-Stage2ReinvestmentPlan
    trigger: staging-recommended
    reads: ["builder profile", "Stage 1 revenue model", "Stage 3 gaps"]
    writes: ["docs/specs/staging-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-Stage3ReentryPlan
    trigger: always
    reads: ["vision or feature brief", "docs/specs/staging-plan.md", "chain rules"]
    writes: ["docs/specs/staging-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-EscapeHatchOrOverrideRouting
    trigger: always
    reads: ["user override text", "docs/specs/staging-plan.md", "Pipeline Continuation"]
    writes: ["docs/specs/staging-plan.md when staging proceeds", ".svc/stage-revenue-routing.log when skipped"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-StagingPlanArtifact
    trigger: staging-recommended
    reads: ["Staging Plan Output Format", "docs/specs/staging-plan.md"]
    writes: ["docs/specs/staging-plan.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/staging-plan.md", ".svc/lane-tasks-<WI>.json", "Self-Verify Checklist"]
    writes: [".svc/stage-revenue-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { artifact: vision-or-feature-brief, note: "The big idea — either docs/specs/vision.md or a feature brief describing what the builder ultimately wants to build" }
  optional:
    - { artifact: opportunities, note: "Output from find-opportunity — pre-scored opportunities that can serve as Stage 1 candidates" }
outputs:
  produces:
    - { path: "docs/specs/staging-plan.md", artifact: staging-plan }
chain:
  lanes: {}
  progressive: true
  self_verify: true
  human_checkpoint: true
---

# Revenue Staging

## Overview

Turn a big idea into a survivable journey. Most solo builders fail not because the
idea is bad, but because they run out of money, motivation, or momentum building
a 3-month project that earns nothing until launch day. This skill breaks the
journey into three stages where each stage funds and de-risks the next.

This skill does three things that "just build it" misses:
1. **Forces revenue-first thinking** — the builder earns money before investing
   months into the big idea
2. **Connects Stage 1 to the big idea** — the revenue project isn't random; it
   builds audience, domain knowledge, or tooling that feeds Stage 3
3. **Preserves builder autonomy** — "build my idea anyway" is always one
   sentence away, with zero guilt and zero friction

**Core principle:** Ship something that makes money this month. Then use that
money, audience, and confidence to build the thing you actually want.

**Announce at start:** "I'm using stage-revenue to break this into revenue stages
so you're earning money while building toward the big idea."

## When to Stage — Decision Matrix

Before doing any staging work, evaluate whether staging is even necessary.
Not every idea needs it.

| Situation | Decision | Rationale |
|-----------|----------|-----------|
| Big idea + no capital ($0 budget) | **Always stage** | Builder cannot sustain a multi-month build with no income. Stage 1 funds Stage 3. |
| Big idea + capital (can cover 3+ months of costs) | **Skip staging, build directly** | Builder has runway. Staging adds delay without survival benefit. Route to write-vision. |
| Big idea + takes > 2 weeks + no proven revenue model | **Stage** | Even with some capital, a long build with no revenue model is a burnout risk. Stage 1 validates the revenue model. |
| Fast idea (< 2 weeks build, proven revenue model) | **Skip staging, build directly** | The idea IS Stage 1. No need for a separate revenue project. Route to write-vision. |
| Builder has existing revenue ($1K+/mo from other source) | **Skip staging, build directly** | Revenue pressure is handled. The builder can focus on the big idea. |
| Builder profile shows 2+ abandoned projects at month 3 | **Always stage** | Pattern evidence: this builder loses momentum on long builds. Stage 1 gives early wins. |

**How to evaluate:**
1. Read the builder profile — check financial context, time, revenue pressure
2. Read the vision or feature brief — estimate build time and revenue model clarity
3. If find-opportunity output exists, check if any opportunity qualifies as Stage 1
4. Apply the matrix above

**If staging is not needed:** say so explicitly. "Your idea is a 1-week build with
a proven revenue model. No staging needed — routing to write-vision." Route to
write-vision or write-spec directly.

**If staging is needed:** proceed to the staging process below.

---

## Stage 1: Revenue Project (1-2 Weeks)

The Stage 1 project exists to generate income fast. It is NOT a prototype of the
big idea. It is a separate, shippable product that earns money within the first
month of launch.

### Selection Priority

Stage 1 projects are ranked by how well they connect to the big idea. Always
prefer related over unrelated.

#### Tier A: Related to the Big Idea (Best)

Same audience, earns money, teaches the domain. The Stage 1 project becomes a
feeder for Stage 3.

**What "related" means:**
- Targets the same users who will want the big idea
- Operates in the same domain (learns the builder about the problem space)
- Can share code, infra, or data with the big idea later
- Builds an audience that naturally converts to Stage 3 users

**Examples:**
- Big idea: full monitoring platform → Stage 1: uptime checker Chrome extension
  (same audience: DevOps engineers; builds install base; teaches the domain)
- Big idea: AI code review tool → Stage 1: VS Code extension that formats error
  messages (same audience: developers; builds VS Code install base)
- Big idea: freelancer invoicing platform → Stage 1: invoice template generator
  (same audience: freelancers; captures email list; learns billing pain points)

#### Tier B: Tangentially Related (Good)

Same audience, different product. Builds distribution for the big idea but
doesn't teach the domain.

**Examples:**
- Big idea: AI code review tool → Stage 1: GitHub README generator (same
  audience, different product, builds GitHub presence)
- Big idea: project management SaaS → Stage 1: meeting notes summarizer
  (same audience: team leads, different product)

#### Tier C: Unrelated (Last Resort)

Pure revenue play. Doesn't feed the big idea but funds it.

**When to use Tier C:**
- Builder's skills don't map to anything in the big idea's ecosystem
- The big idea's audience has no fast-money product gap
- Time pressure is extreme (need money this week, not this month)

**Examples:**
- Big idea: niche B2B SaaS → Stage 1: AI wrapper for real estate listings
  (unrelated but fast money with the builder's API skills)

### Selection Criteria

Every Stage 1 project MUST pass the first-project rules. These are non-negotiable
regardless of tier.

#### First-Project Rules

1. **Must ship in 1-2 weeks** at the builder's hours/week. Not 6 weeks. 1-2.
   Calculate: builder's weekly hours x 2 weeks = max build hours. If the
   project exceeds that, it is too big.
2. **Must not require skills the builder has failed at.** Check the builder
   profile's project history. If 2/3 past projects died because the builder
   couldn't do marketing, do not recommend a marketing-heavy Stage 1. Hard veto.
3. **Must have built-in distribution** through the builder's existing channels.
   Check the builder profile's social presence and distribution section. If
   the builder has a Reddit account with karma in r/selfhosted, the Stage 1
   project should target that community. No cold start.
4. **Must work without a business entity.** LemonSqueezy, Gumroad, or Dodo
   for payments. If the builder has no entity, the Stage 1 project cannot
   require Stripe or a registered company.
5. **Revenue model must be dead simple.** One price, one product. No tiered
   pricing, no enterprise plans, no complex billing.
6. **Must be boring.** Proven demand. Reverse-engineered from existing winners.
   Stage 1 is not the time for innovation.
7. **Must self-sustain on free tiers.** $0 infrastructure cost until revenue
   exceeds cost. Supabase free, Vercel free, LemonSqueezy (pays from revenue).
8. **Must have evidence of $1K+/mo** from similar products. Not "could make
   money" — "similar products DO make money." Cite the evidence.
9. **Must be something the builder would use themselves.** Dogfooding equals
   motivation. If the builder wouldn't use it, they won't finish it.

### Finding Stage 1

If the builder already has a Stage 1 candidate (from find-opportunity output
or their own idea), validate it against the first-project rules above.

If no Stage 1 candidate exists, invoke `find-opportunity` with the builder
profile and vision as context:

```
find-opportunity --builder-profile ~/.svc/builder-profile.md
```

Pass the vision document as context so find-opportunity can prefer opportunities
in the big idea's domain (Tier A) before falling back to tangential (Tier B)
or unrelated (Tier C). find-opportunity's self-verify check #10 scores
ecosystem value when a vision exists.

If find-opportunity returns results, score them against the tier system above
and pick the best fit. Present it to the builder with the tier and reasoning.

---

## Stage 2: Reinvest (Month 2-3)

Stage 2 is not a project. It is a reinvestment plan. Revenue from Stage 1
funds the infrastructure, tools, and capabilities needed for Stage 3.

### What to Reinvest In

Analyze the builder profile to identify specific gaps between where they are
and what Stage 3 requires. Recommendations must be specific, not generic.

#### Revenue Reinvestment

| Gap | Recommendation | When to buy | Typical cost |
|-----|---------------|-------------|-------------|
| No business entity | Register sole proprietorship or LLC | When revenue hits $500/mo and you need Stripe | $50-500 one-time |
| No payment processor | Set up Stripe (requires entity) | After entity registration | 2.9% + 30c per transaction |
| Free-tier infra hitting limits | Upgrade to paid tiers (Supabase Pro, Vercel Pro) | When free tier limits cause user-facing issues | $20-50/mo |
| No design skills | Hire a contractor for UI/UX | When Stage 3 has a significant frontend | $500-2000 one-time |
| No marketing skills | Hire a contractor for launch copy and distribution | 2 weeks before Stage 3 launch | $300-1000 one-time |
| Limited AI tooling | Upgrade to Claude Max or similar | When AI assistance is the bottleneck | $20-200/mo |
| No analytics | Set up Plausible or PostHog | Before Stage 3 launch | $9-25/mo |

#### Audience Reinvestment

If Stage 1 was Tier A or B (related to the big idea), the audience IS the
reinvestment:

- **Email list from Stage 1 users** → pre-launch list for Stage 3
- **App install base** → in-app announcement when Stage 3 launches
- **Community presence built during Stage 1** → organic distribution for Stage 3
- **Domain reputation** → credibility when pitching Stage 3

Document specifically how the Stage 1 audience transfers to Stage 3. If Stage 1
was Tier C (unrelated), note that audience reinvestment is minimal and the builder
will need a distribution plan for Stage 3.

#### Capability Reinvestment

Based on what the builder learned during Stage 1:

- **New skills acquired** → update builder profile, factor into Stage 3 scope
- **Tools mastered** → reuse in Stage 3 (same framework, same infra, same CI/CD)
- **Domain knowledge gained** → feeds directly into Stage 3 product decisions
- **Builder confidence** → the most underrated asset; shipping Stage 1 proves
  the builder can ship

### Gap Analysis

For each gap, provide:
1. What the gap is (specific, not "needs better tools")
2. What it costs to close
3. When to close it (which month, at what revenue level)
4. What happens if the builder skips it (risk of proceeding without)

Example:
```
Gap: No frontend skills — builder stalls on UI work (observed in 2 past projects)
Cost to close: $1,500 for a contractor to build Stage 3 UI components
When: Month 3, when Stage 1 revenue is $1K+/mo (covers contractor in 2 months)
Skip risk: HIGH — builder has abandoned 2 projects at the UI phase. Stage 3 will
likely stall at the same point without help.
```

---

## Stage 3: The Real Thing (Month 3+)

Stage 3 is the big idea. The builder now has what they lacked at the start:

- **Money** — Stage 1 revenue covers infrastructure costs and contractor help
- **Audience** — if Stage 1 was related, the users are already warm
- **Tools** — Stage 2 investments removed bottlenecks
- **Confidence** — shipping Stage 1 proved the builder can execute
- **Domain knowledge** — Stage 1 taught the problem space (if related)

### Re-entering the Pipeline

Stage 3 re-enters the main pipeline at `write-vision` with full resources.
The staging plan captures what changed:

```
Original situation:
  - $0 budget, no entity, no audience, no confidence
  - Big idea requires 3 months, no revenue until launch

After staging:
  - $1K+/mo from Stage 1
  - LLC registered, Stripe active
  - 500 users from Stage 1 (related audience)
  - Contractor budget for frontend
  - Shipped one product successfully
  - Learned the domain through Stage 1

Stage 3 build plan:
  - Enter write-vision with the original big idea
  - Builder profile is updated with Stage 1/2 learnings
  - Infrastructure is funded
  - Distribution exists
```

### What Changes at Stage 3

The pipeline runs normally from write-vision, but the builder profile now
reflects a different person than the one who started at Stage 1:

- validate-feature's kill signals are calibrated differently (builder has
  proven execution ability, has capital, has audience)
- find-opportunity's scoring weights shift (ecosystem value now matters more
  than speed-to-first-dollar)
- plan-changeset can scope larger tasks (contractor budget exists for weak areas)

---

## The "Build My Idea Anyway" Escape

**This escape hatch is ALWAYS available.** At any point during the staging
conversation — before, during, or after presenting the staging plan — the
builder can say "build my idea anyway" and the pipeline respects it immediately.

### Rules

1. **No guilt.** Do not say "are you sure?" or "I recommend staging first."
   The builder heard the recommendation. They decided. Move on.
2. **No gatekeeping.** The staging plan is a recommendation, not a gate. The
   pipeline serves the builder, not the other way around.
3. **No passive-aggressive warnings.** Do not attach "but you should know that..."
   caveats to the handoff. The staging plan already explained the tradeoffs.
4. **Best-effort execution.** Run the big idea through the normal pipeline
   (write-vision or write-spec) with best-effort recommendations given the
   builder's current situation.
5. **P0 taste decisions allowed.** The virtual founder persona (P0) may still
   suggest staging as a taste decision in downstream skills, but it respects
   the override. One mention, no repetition.

### What Happens on Override

```
Builder: "Build my idea anyway"

Pipeline response:
"Got it. Running the pipeline on [big idea] directly.
Routing to write-vision."

→ Invoke write-vision with the big idea as input
→ Builder profile is passed as-is (no capital, no entity, etc.)
→ Downstream skills adapt recommendations to the builder's actual situation
→ No staging plan is created
```

### When to Mention Staging Without Pushing

In the normal pipeline flow (not stage-revenue), P0 may notice a builder
with no capital working on a 3-month idea. P0 can mention staging ONCE:

"This is a 3-month build with no revenue until launch. stage-revenue can
break this into stages where you earn money from month 1. Want to stage it,
or build as-is?"

One question. One time. The builder answers and the pipeline moves.

---

## Staging Plan Output Format

The staging plan is written to `docs/specs/staging-plan.md`.

```markdown
# Staging Plan: <big idea name>

Created: <date>
Builder profile: <path>
Big idea: <one sentence summary>

## Decision

**Staging recommended:** Yes / No
**Reason:** <one sentence — which row of the decision matrix triggered>

## Stage 1: Revenue Project

**Project:** <name>
**Tier:** A (related) / B (tangential) / C (unrelated)
**Connection to big idea:** <how this feeds Stage 3, or "none — pure revenue play">
**What to build:** <one paragraph — the MVP>
**Revenue model:** <how money flows>
**Price:** <specific price>
**Payment method:** <LemonSqueezy / Gumroad / Dodo / Stripe>
**Infrastructure:** <free-tier stack>
**Build time:** <days at builder's hours/week>
**Distribution:** <specific channels from builder profile>
**Month 1 revenue target:** <conservative estimate with evidence>
**First-project rules:** PASS (all 9 rules checked)

### First-Project Rules Checklist

| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | Ships in 1-2 weeks | PASS / FAIL | <hours calculation> |
| 2 | No failed-skill dependency | PASS / FAIL | <checked against profile> |
| 3 | Built-in distribution | PASS / FAIL | <specific channel> |
| 4 | No entity required | PASS / FAIL | <payment method> |
| 5 | Dead simple revenue model | PASS / FAIL | <model description> |
| 6 | Boring / proven demand | PASS / FAIL | <evidence> |
| 7 | Self-sustaining free tiers | PASS / FAIL | <stack> |
| 8 | Evidence of $1K+/mo | PASS / FAIL | <specific evidence> |
| 9 | Builder would use it | PASS / FAIL | <dogfooding fit> |

## Stage 2: Reinvestment Plan

**Revenue milestone to trigger Stage 2:** $<amount>/mo
**Timeline:** Month <N> (estimated)

### Reinvestment Priorities

| Priority | Gap | Action | Cost | Revenue required |
|----------|-----|--------|------|-----------------|
| 1 | <specific gap> | <specific action> | <cost> | <$/mo to cover> |
| 2 | <specific gap> | <specific action> | <cost> | <$/mo to cover> |
| 3 | <specific gap> | <specific action> | <cost> | <$/mo to cover> |

### Audience Transfer Plan

<how Stage 1 audience feeds Stage 3 — or note if Stage 1 was Tier C>

## Stage 3: The Real Thing

**Project:** <big idea name>
**Re-entry point:** write-vision
**Builder situation at Stage 3:**
- Revenue: $<estimated>/mo from Stage 1
- Entity: <registered / not yet>
- Audience: <size and relevance>
- Tools: <what Stage 2 unlocked>
- Skills: <what Stage 1 taught>

**What's different from building now:**
<bullet list of concrete advantages the builder has after staging>

## Escape Hatch

If you want to skip staging and build the big idea now:
→ Say "build my idea anyway" at any time.
No staging plan will be created. The pipeline runs on your big idea directly
with best-effort recommendations for your current situation.
```

---

## Self-Verify Checklist

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Staging plan file exists | `test -f docs/specs/staging-plan.md` | |
| 2 | Decision matrix was applied | staging-plan.md contains "Decision" section with reason | |
| 3 | Stage 1 passes all first-project rules | All 9 rules show PASS in the checklist | |
| 4 | Stage 1 has specific revenue evidence | staging-plan.md cites real products making $1K+/mo | |
| 5 | Stage 2 reinvestment is specific to builder gaps | Reinvestment table references builder profile gaps, not generic advice | |
| 6 | Stage 3 re-entry point is specified | staging-plan.md names the pipeline skill to invoke | |
| 7 | Escape hatch is documented | staging-plan.md contains escape hatch section | |
| 8 | No TBD / TODO / placeholders | grep for TBD, TODO, placeholder, TBC in staging-plan.md | |
| 9 | Builder profile was read | staging-plan.md references specific builder profile data | |

If any check FAILs, fix before continuing. If a fix requires the builder's input
(e.g., missing builder profile data), stop and ask.

---

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `stage-revenue` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-StagingDecisionContext --evidence command_output:.svc/stage-revenue-decision.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-Stage1CandidateSelection --evidence file:docs/specs/staging-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-FirstProjectRulesGate --evidence file:docs/specs/staging-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-Stage2ReinvestmentPlan --evidence file:docs/specs/staging-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-Stage3ReentryPlan --evidence file:docs/specs/staging-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-EscapeHatchOrOverrideRouting --evidence command_output:.svc/stage-revenue-routing.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-StagingPlanArtifact --evidence file:docs/specs/staging-plan.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/stage-revenue-self-verify.log
```

If staging is skipped by decision matrix or user override, still record every
required phase id with command-output evidence explaining that the staging-only
work was intentionally skipped. Do not complete the task until all required
phase ids appear in `skill_receipt.phases_executed`.

---

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
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- If staging was recommended AND builder accepted:
  - If Stage 1 needs finding: invoke `find-opportunity --progressive`
  - If Stage 1 is defined: invoke `write-vision --progressive` with Stage 1 as the idea
- If staging was skipped (builder said "build my idea anyway" or decision matrix said skip):
  - Invoke `write-vision --progressive` with the big idea as-is

**If `--progressive` flag is absent:**
- Report the staging plan to the user
- Suggest next steps:
  - "Stage 1 is defined. Next: run `write-vision` with the Stage 1 project to start building."
  - Or: "Staging not needed. Next: run `write-vision` with your big idea."

### Human Checkpoint

The staging plan is a human checkpoint. Present the full plan and wait for:
- **"looks good"** → proceed to next skill
- **"build my idea anyway"** → skip staging, route to write-vision with big idea
- **edits** → revise the staging plan and re-verify
- **"find different Stage 1"** → re-run Stage 1 selection with adjusted criteria

---

## Baseline Failure This Skill Fixes

Without this skill, builders with big ideas and no capital enter the pipeline and
get a 3-month implementation plan that they cannot sustain. They build for 6 weeks,
run out of money or motivation, and abandon the project. The pipeline produced
technically correct output for a situation that was financially impossible.

stage-revenue inserts a survivability check between "I have an idea" and "let's
build it." The builder still gets to build the big idea — but they arrive at Stage 3
with money, audience, tools, and confidence instead of arriving at month 3 with
nothing.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
