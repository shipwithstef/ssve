---
name: manage-finops
version: "1.0"
handles_concerns:
  - paid-external-api
description: >
  Cloud cost and hosting decisions with sourced pricing: provider comparisons, monthly
  cost at scale, free-tier cliffs, launch budgets. Use when: what will my monthly cost be,
  AWS vs Hetzner, Vercel vs Netlify pricing, is this API affordable at scale, free tier
  cliff.
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

Cloud financial operations (FinOps) expertise for decisions about infrastructure, hosting platforms, cost optimization and solo-developer launch strategy, grounded in current pricing across the major platforms. This is the framework's primary mechanism for keeping a project economically viable with positive ROI.

**Announce at start:** "I'm using `manage-finops` to optimize costs, select platforms, and project ROI."

## Consequential cost decisions

Use `_shared/product-question-format.md` for unresolved platform, pricing or cost choices. Ground recommendations in verified current pricing, actual usage/code and owner constraints. Preserve meaningful alternatives, cost/risk, persona fit, reversibility and success signals without fixed competitor or question counts. Reuse accepted decisions; do not invent balances or conversion estimates to fill an analysis template.

## The FinOps Spec (for system-wide estimations)

For a comprehensive financial projection of a product or major integration (e.g., Square POS, Global Launch), use the **FinOps Spec** template, `references/finops-spec-template.md` — Executive Summary, Infrastructure Breakdown (Small/Medium/Large), Unit Economics (CAC/LTV), Profitability Plan and Free Tier Guardrails. A standard shape lets the document serve as the project's financial source of truth.

## Output Schema

`docs/specs/finops-audit.md` contains these sections (per `references/finops-spec-template.md`):
- **Executive Summary** — one-paragraph financial health verdict
- **Infrastructure Breakdown (Small/Medium/Large)** — cost projections at three scale points, each with its stated traffic/usage assumptions
- **Unit Economics** — CAC, LTV, payback period and margin at each scale
- **Funnel Impact (for every comparison)** — for any platform/vendor comparison, include `Cost_per_attempt = infra_cost × P(attempt_fails_due_to_friction) × LTV_lost_per_failed_attempt`. Completion-rate deltas between options usually dominate infra-cost deltas at SaaS scale. Red Flag: "Cost comparison without quantifying conversion delta between options is incomplete — at any realistic funnel, infra cost is 10-100x smaller than LTV impact of a completion-rate difference."
- **Profitability Plan** — timeline to breakeven and monthly run-rate targets
- **Free Tier Guardrails** — exact free-tier limits, cliff thresholds and upgrade triggers
- **Platform Recommendations** — primary and fallback choices with rationale
- **Risk Register** — cost risks, mitigations and early-warning signals

## Provenance Tagging

Tag every factual claim with its provenance, so readers can tell verified pricing from guesses:
- `[FROM-CODE]` — observed in the codebase or config via grep/read
- `[FROM-SPEC]` — derived from the feature spec, vision, or project state
- `[FROM-RESEARCH]` — from web search, `research` skill, or library documentation
- `[ASSUMED]` — not verified, inference or best guess

`review-gate` flags untagged claims as unverified.

## When to Use This Skill

1. **Selecting cloud infrastructure** — Hetzner, AWS, Google Cloud or other providers
2. **Comparing hosting platforms** — Railway, Render, Vercel, Netlify, Fly.io, or similar
3. **Planning mobile app builds** — Expo EAS Build pricing and alternatives
4. **Designing launch strategy** — phased launches with cost considerations
5. **Optimizing costs** — reducing cloud spend while maintaining performance
6. **Budgeting and forecasting** — cloud costs for solo developer projects
7. **Selecting revenue models** — freemium, SaaS, or other pricing strategies
8. **Comparing pricing** — current pricing across multiple platforms
9. **Optimizing MMR** — identifying and proposing revenue improvements
10. **Optimizing domain costs** — registrars, TLD choices, hidden costs

See `references/decision-index.md` for the full lookup table of decisions → reference files.

## Relationship with Other Skills

| Skill | Integration |
|---|---|
| `monetization-architecture` | `manage-finops` decides **how much to charge** and **what platform to use**; `monetization-architecture` decides **what to gate** and **where**. |
| `validate-feature` | Required: answers Q7 (ROI/Cost) of the Feature Ship Brief. |
| `design-tech` | Required: populates the `Cost Model` pillar. FinOps constraints drive architectural decisions. |
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
| "I'll optimize the costs after we launch." | You won't — you'll be busy with features. Build for cost-efficiency from the start. |
| "The free tier is enough for now." | Know the exact limit. Is it 100 requests or 10,000? What does the first 1,000 paid requests cost? |

### Red Flags

- **Defaulting to expensive providers** without comparing cheaper alternatives (Hetzner, Railway).
- **No mention of free tiers** in a greenfield project.
- **Cost projections assume infinite free usage** without identifying the "cliff" where paid tiers start.
- **Revenue models disconnected from infrastructure costs** (e.g., selling a $10/mo sub that costs $15/mo in API points).

## How to Use This Skill

### Core Workflow

**Step 0: Gather Context (first)**
Read what exists rather than asking for information the project already has: `docs/specs/vision.md` (purpose, target market), `docs/specs/project-state.md` (current focus), `~/.svc/builder-profile.md` (budget, skills, time — the ground truth for recommendations), `docs/specs/router-context.md` (deployment matrix, platform constraints).

**Step 1: Understand Your Requirements** — with `references/solo-developer.md` (launch phases), compare needs against the builder profile: MVP requirements, expected traffic, growth projections, budget constraints, revenue model, scaling needs. Write the traffic and usage assumptions behind each scale point down; every estimate inherits them.

**Step 2: Compare Platform Options** — `references/platform-pricing.md` covers cloud providers (Hetzner, AWS, GCP, etc.) and PaaS/serverless (Railway, Render, Vercel, Netlify, Fly.io). Estimate with `scripts/cost-calculator.py`, weighing free tiers, pricing models and scaling costs.

**Step 3: Plan Mobile App Builds** — `references/expo-eas-pricing-guide.md`: build frequency, priority needs, alternatives, free-tier limits vs paid benefits.

**Step 4: Design Revenue Model** — `references/zero-investment.md`: freemium tiers, subscription or usage-based pricing, feature gating.

**Step 5: Optimize Costs** — `references/cost-optimization.md`: resource scheduling, right-sizing, reserved instances; monitor usage patterns and cost anomalies.

**Step 6: Optimize Domain Costs** — `references/domain-cost-optimization-comprehensive.md`: registrar pricing, privacy protection and DNS hosting costs, portfolio consolidation and transfer strategy.

### Reference Materials

**For selection and comparison:**
- `references/decision-index.md` — Full decision → reference lookup table
- `references/platform-coverage.md` — Cloud providers, hosting platforms, databases, AI providers, startup programs
- `references/common-scenarios.md` — MVP launch, mobile app, high-traffic SaaS, ML/AI, domain/email setup

**For optimization and workflow:**
- `references/workflow-integration.md` — Best practices, development workflow integration, cross-skill MMR collaboration, multi-persona orchestration, AI service cost analysis
- `references/quick-reference-guide.md` — Quick comparison tables, decision trees, official pricing URLs

**Free-tier rule:** check every free-tier option thoroughly before recommending a paid service. Recommend paid services only when free-tier limits are reached and revenue > 3x the upgrade cost — a solo builder's runway is the scarcest resource.

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

- **Free Tier First**: maximize free-tier usage before paying.
- **API Understanding Requirement**: understand third-party APIs in depth (pricing models, point costs per operation, rate limits) before proposing improvements that involve them.
- **Cross-Skill Collaboration**: work with `write-spec` and `design-tech` to optimize Monthly Recurring Revenue (MMR).
- **Multi-Scale Cost Breakdowns + ROI Analysis**: give Small/Medium/Large cost estimates and ROI analysis for every recommendation, each with its assumptions stated — a single surface-level guess hides the cliffs.

## Post-Compaction Recovery

If context was compacted and you lost track of framework state: `.svc/lane-tasks-<WI>.json` is the sole source of truth. Resume the first `in_progress` task (else the first `pending` with blockers satisfied), re-load it with `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`, re-read this SKILL.md, and continue. Verify a `skill_receipt` exists before marking any task complete — no ghost-completes.

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
