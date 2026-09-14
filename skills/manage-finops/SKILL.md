---
name: manage-finops
version: "1.0"
handles_concerns:
  - paid-external-api
description: >-
  FinOps for cloud selection, cost optimization, and solo-dev launch budgets. Use when: hosting recommendations, provider pricing comparisons (Hetzner/AWS/GCP/Vercel/Railway), "what will my monthly cost be", "free tier cliff", "is this API affordable at scale". Also: "how much should I budget for launch", "AWS vs Hetzner", "Vercel vs Netlify pricing". Long forms: "what will my monthly cost be at 10k users", "is Google Places API affordable at scale", "when do we hit the free tier cliff", "AWS vs Hetzner for a Node.js API", "Vercel vs Netlify pricing for my stack".
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/router-context.md", artifact: router-context }
    - { path: "docs/specs/features/*.md", artifact: feature-specs }
outputs:
  produces:
    - { path: "docs/specs/finops-audit.md", artifact: finops-audit }
phases:
  - { id: P1-ContextAndBuilderProfileLoad, required_for_completion: true, evidence: "vision, project state, router context, and builder profile availability checked" }
  - { id: P2-RequirementsAndScaleProjection, required_for_completion: true, evidence: "MVP requirements, traffic assumptions, budget constraints, and scale points identified" }
  - { id: P3-PlatformPricingComparison, required_for_completion: true, evidence: "platform/provider pricing and free-tier options compared" }
  - { id: P4-RevenueModelAndUnitEconomics, required_for_completion: true, evidence: "revenue model, CAC/LTV/payback, and ROI constraints evaluated" }
  - { id: P5-CostOptimizationAndDomainReview, required_for_completion: true, evidence: "cost optimization, API pricing, mobile build, and domain-cost applicability reviewed" }
  - { id: P6-FinOpsAuditArtifact, required_for_completion: true, evidence: "docs/specs/finops-audit.md written or updated" }
  - { id: P7-ProvenanceAndFreeTierGuardrails, required_for_completion: true, evidence: "claims tagged with provenance and free-tier cliffs/upgrade triggers documented" }
  - { id: P8-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify complete and task graph continuation handled" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# `manage-finops` Skill

## Purpose

To provide deep expertise in cloud financial operations (FinOps), enabling informed decisions about cloud infrastructure, hosting platforms, cost optimization, and solo developer launch strategies. This skill combines current pricing knowledge, cost optimization strategies, and practical guidance for managing cloud costs across all major platforms. It is the framework's primary mechanism for ensuring project economic viability and positive ROI.

**Announce at start:** "I'm using `manage-finops` to optimize costs, select platforms, and project ROI."

## Consequential cost decisions

Use `_shared/product-question-format.md` for unresolved platform, pricing or cost choices. Ground recommendations in verified current pricing, actual usage/code and owner constraints. Preserve meaningful alternatives, cost/risk, persona fit, reversibility and success signals without fixed competitor or question counts. Reuse accepted decisions; do not invent balances or conversion estimates to fill an analysis template.

## The FinOps Spec (MANDATORY for system-wide estimations)

When providing a comprehensive financial projection for a product or major integration (e.g., Square POS, Global Launch), use the **FinOps Spec** template:
- `references/finops-spec-template.md` — Components: Executive Summary, Infrastructure Breakdown (Small/Medium/Large), Unit Economics (CAC/LTV), Profitability Plan, and Free Tier Guardrails.

This ensures the user gets a "standardized document" that can serve as the project's financial source of truth.

## Output Schema

The `docs/specs/finops-audit.md` artifact MUST contain these sections (per `references/finops-spec-template.md`):
- **Executive Summary** — One-paragraph financial health verdict
- **Infrastructure Breakdown (Small/Medium/Large)** — Cost projections at three scale points
- **Unit Economics** — CAC, LTV, payback period, and margin at each scale
- **Funnel Impact (MANDATORY for comparisons)** — For any platform/vendor comparison, include: `Cost_per_attempt = infra_cost × P(attempt_fails_due_to_friction) × LTV_lost_per_failed_attempt`. Completion-rate deltas between options usually dominate infra-cost deltas at SaaS scale. Red Flag: "Cost comparison without quantifying conversion delta between options is incomplete — at any realistic funnel, infra cost is 10-100x smaller than LTV impact of a completion-rate difference."
- **Profitability Plan** — Timeline to breakeven and monthly run-rate targets
- **Free Tier Guardrails** — Exact free-tier limits, cliff thresholds, and upgrade triggers
- **Platform Recommendations** — Primary and fallback choices with rationale
- **Risk Register** — Cost risks, mitigations, and early-warning signals

## Provenance Tagging (MANDATORY)

Every factual claim in your reports must be tagged with its provenance:
- `[FROM-CODE]` — observed in the codebase or config via grep/read
- `[FROM-SPEC]` — derived from the feature spec, vision, or project state
- `[FROM-RESEARCH]` — from web search, `research` skill, or library documentation
- `[ASSUMED]` — not verified, inference or best guess

Untagged claims will be flagged as unverified in `review-gate`.

## When to Use This Skill

Activate this skill when:

1. **Selecting cloud infrastructure** — Choosing between Hetzner, AWS, Google Cloud, or other providers
2. **Comparing hosting platforms** — Evaluating Railway, Render, Vercel, Netlify, Fly.io, or similar
3. **Planning mobile app builds** — Understanding Expo EAS Build pricing and alternatives
4. **Designing launch strategy** — Planning phased launches with cost considerations
5. **Optimizing costs** — Reducing cloud spending while maintaining performance
6. **Budgeting and forecasting** — Planning cloud costs for solo developer projects
7. **Selecting revenue models** — Choosing freemium, SaaS, or other pricing strategies
8. **Comparing pricing** — Understanding current pricing across multiple platforms
9. **Optimizing MMR** — Identifying and proposing revenue improvement opportunities
10. **Optimizing domain costs** — Selecting registrars, managing TLD choices, reducing hidden costs

See `references/decision-index.md` for the full lookup table of decisions → reference files.

## Relationship with Other Skills

| Skill | Integration |
|---|---|
| `monetization-architecture` | `manage-finops` decides **how much to charge** and **what platform to use**; `monetization-architecture` decides **what to gate** and **where**. |
| `validate-feature` | **MANDATORY**: Answer Q7 (ROI/Cost) of the Feature Ship Brief using `manage-finops`. |
| `design-tech` | **MANDATORY**: Populates the `Cost Model` pillar. FinOps constraints drive architectural decisions. |
| `research` | Use `research` for deep dives into specific API pricing or domain trends not covered in references. |
| `find-opportunity` | `find-opportunity` identifies market winners; `manage-finops` analyzes their **cost structure** and **unit economics**. |
| `stage-revenue` | `stage-revenue` breaks the plan into stages; `manage-finops` provides the **budget and cost projections** for each stage. |

## Lane Integration

| Lane | Role of `manage-finops` |
|---|---|
| **Greenfield** | Runs after `analyze-competitors` to provide the cost baseline for `validate-feature`. |
| **Brownfield Feature** | Runs when a feature extension adds new API/storage/scaling costs. |
| **Bugfix** | Runs during `diagnose-bug` if the bug is a cost anomaly or quota exhaustion. |
| **Refactor** | Evaluates the cost impact of architectural changes (e.g., move to serverless). |

## Discipline Enforcement

### Rationalization Table

| Thought | Reality |
|---------|---------|
| "We're pre-revenue, costs don't matter yet." | Pre-revenue is when cash burn is most dangerous. Scale-traps built now will kill the project later. |
| "Let's just use AWS, it's the standard." | AWS is often 10x more expensive than Hetzner or Railway for solo devs. Defaulting to AWS is a failure of `manage-finops` discipline. |
| "I'll optimize the costs after we launch." | You won't. You'll be busy with features. Build for cost-efficiency from the start. |
| "The free tier is enough for now." | Know the EXACT limit. Is it 100 requests or 10,000? What's the cost of the first 1,000 paid requests? |

### Red Flags

- **Defaulting to expensive providers** without comparing with cheaper alternatives (Hetzner, Railway).
- **No mention of free tiers** in a greenfield project.
- **Cost projections assume infinite free usage** without identifying the "cliff" where paid tiers start.
- **Revenue models disconnected from infrastructure costs** (e.g., selling a $10/mo sub that costs $15/mo in API points).

## How to Use This Skill

### Core Workflow

**Step 0: Gather Context (MANDATORY)**
Read what exists. Don't ask for information the project already has.

1. `docs/specs/vision.md` — product purpose, target market
2. `docs/specs/project-state.md` — current focus and status
3. `~/.svc/builder-profile.md` — builder's budget, skills, and time constraints (GROUND TRUTH for recommendations)
4. `docs/specs/router-context.md` — deployment matrix and platform constraints

**Step 1: Understand Your Requirements**
- Load `references/solo-developer.md` to understand launch phases
- Compare requirements against the **builder profile**
- Determine: MVP requirements, expected traffic, growth projections
- Identify: Budget constraints, revenue model, scaling needs

**Step 2: Compare Platform Options**
- Load `references/platform-pricing.md` — covers both cloud providers (Hetzner, AWS, GCP, etc.) and PaaS/serverless (Railway, Render, Vercel, Netlify, Fly.io)
- Use `scripts/cost-calculator.py` to estimate costs
- Consider: Free tiers, pricing models, scaling costs

**Step 3: Plan Mobile App Builds**
- Load `references/expo-eas-pricing-guide.md` for Expo EAS Build pricing
- Consider: Build frequency, priority needs, alternatives
- Evaluate: Free tier limits, paid plan benefits

**Step 4: Design Revenue Model**
- Load `references/zero-investment.md` for pricing strategies
- Determine: Freemium tiers, subscription pricing, usage-based models
- Plan: Pricing tiers, feature gating, monetization approach

**Step 5: Optimize Costs**
- Load `references/cost-optimization.md` for optimization techniques
- Implement: Resource scheduling, right-sizing, reserved instances
- Monitor: Usage patterns, cost anomalies, optimization opportunities

**Step 6: Optimize Domain Costs**
- Load `references/domain-cost-optimization-comprehensive.md` for registrar comparison and optimization strategies
- Evaluate: Registrar pricing, privacy protection costs, DNS hosting costs
- Select: Cost-effective registrar
- Plan: Domain portfolio consolidation, transfer strategy

### Reference Materials

**For selection and comparison:**
- `references/decision-index.md` — Full decision → reference lookup table
- `references/platform-coverage.md` — Cloud providers, hosting platforms, databases, AI providers, startup programs
- `references/common-scenarios.md` — MVP launch, mobile app, high-traffic SaaS, ML/AI, domain/email setup

**For optimization and workflow:**
- `references/workflow-integration.md` — Best practices, development workflow integration, cross-skill MMR collaboration, multi-persona orchestration, AI service cost analysis
- `references/quick-reference-guide.md` — Quick comparison tables, decision trees, official pricing URLs

**CRITICAL**: Always check ALL free tier options extensively before recommending paid services. Only recommend paid services when free tier limits are reached AND revenue > 3x upgrade cost.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Recommendations prioritize free tiers | Verified through `references/free-tier-guides.md` before paid options | |
| 2 | Cost calculations are realistic | Verified via `cost-calculator.py` or actual pricing | |
| 3 | ROI is positive | Feature proposals have clear revenue justification | |
| 4 | API pricing models align | Confirmed shared vs per-user quota model alignment | |

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextAndBuilderProfileLoad --evidence file:docs/specs/vision.md --evidence file:docs/specs/project-state.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-RequirementsAndScaleProjection --evidence file:docs/specs/finops-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PlatformPricingComparison --evidence file:docs/specs/finops-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RevenueModelAndUnitEconomics --evidence file:docs/specs/finops-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-CostOptimizationAndDomainReview --evidence file:docs/specs/finops-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-FinOpsAuditArtifact --evidence file:docs/specs/finops-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-ProvenanceAndFreeTierGuardrails --evidence file:docs/specs/finops-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/manage-finops-self-verify-<WI>.log
```

For optional inputs or non-applicable cost surfaces, still record the relevant
phase with skip evidence, for example:
- `P1-ContextAndBuilderProfileLoad`: record
  `--evidence command_output:.svc/manage-finops-missing-builder-profile-<WI>.log`
  when `~/.svc/builder-profile.md` is unavailable.
- `P5-CostOptimizationAndDomainReview`: record
  `--evidence command_output:.svc/manage-finops-mobile-domain-skip-<WI>.log`
  when mobile build or domain-cost review is out of scope.

If no task graph exists, write the same phase/evidence list in the final
response so an orchestrator can backfill the receipt.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after

## Key Principles

- **Free Tier First**: Maximize free tier usage before paying
- **API Understanding Requirement**: Deep understanding of third-party APIs (pricing models, point costs per operation, rate limits) is critical before proposing improvements involving those APIs
- **Cross-Skill Collaboration**: Collaborate systematically with `write-spec` and `design-tech` to optimize Monthly Recurring Revenue (MMR)
- **Multi-Scale Cost Breakdowns + ROI Analysis**: Proactively provide Small/Medium/Large cost estimates and ROI analysis for every recommendation. Never settle for surface-level cost guesses.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
