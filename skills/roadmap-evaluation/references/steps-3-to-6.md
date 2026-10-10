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
