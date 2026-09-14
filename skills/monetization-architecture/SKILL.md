---
name: monetization-architecture
version: "1.0"
description: >-
  Decide which features to hard-paywall, usage-limit, or keep free — produces a Feature-Tier Gating Matrix plus an Enforcement Audit comparing stated pricing policy against actual code guards. Use when: "free vs paid", "paywall strategy", "feature gating", "tier enforcement", "monetization architecture". Also: "premium gating", "pricing enforcement audit", "what goes in which tier". Also: "which features to gate", "what should be free vs paid", "free vs paid features", "feature gating decisions".
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
    - { path: "docs/specs/features/*.md", artifact: feature-specs }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { artifact: pricing-page, note: "The product's current pricing page or tier definition" }
outputs:
  produces:
    - { path: "docs/specs/monetization-architecture.md", artifact: gating-matrix }
phases:
  - id: P1-ContextGathering
    trigger: always
    reads: ["docs/specs/vision.md", "pricing-page or tier definition", "docs/specs/analyze-competitors.md", "docs/specs/personas/P*.md", "docs/specs/domain-profile.md", "~/.svc/builder-profile.md"]
    writes: ["monetization context and missing-evidence notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-FeatureInventory
    trigger: after:P1-ContextGathering
    reads: ["vision", "pricing page", "feature specs", "codebase feature/page inventory"]
    writes: ["feature inventory with current tier and adoption role"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-TierClassification
    trigger: after:P2-FeatureInventory
    reads: ["feature inventory", "competitor benchmarks", "domain norms", "personas"]
    writes: ["evidence-graded tier assignments"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-GatingMechanismAndWedgeProtection
    trigger: after:P3-TierClassification
    reads: ["tier assignments", "wedge feature analysis", "gating mechanism matrix"]
    writes: ["gating mechanism decisions and wedge-protection notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-RevenueImpactEstimation
    trigger: after:P4-GatingMechanismAndWedgeProtection
    reads: ["gating decisions", "usage data or assumptions", "pricing tiers"]
    writes: ["revenue impact estimates and assumptions"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-EnforcementAudit
    trigger: after:P5-RevenueImpactEstimation
    reads: ["pricing policy", "code guards", "routes/pages/features", "API endpoints"]
    writes: ["enforcement audit findings"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P7-GatingMatrixArtifact
    trigger: after:P6-EnforcementAudit
    reads: ["tier assignments", "gating decisions", "revenue estimates", "enforcement findings"]
    writes: ["docs/specs/monetization-architecture.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P8-SelfVerifyNextTrailer
    trigger: after:P7-GatingMatrixArtifact
    reads: ["Self-Verify table", "docs/specs/monetization-architecture.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json", "Next action trailer"]
    evidence_kind: command_output
    required_for_completion: true
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
  notes: >
    Standalone/on-demand skill invocable from multiple lanes. In greenfield:
    after analyze-competitors, before validate-feature. In brownfield-feature:
    standalone or before plan-changeset for enforcement remediation.
---

# Monetization Architecture

## Overview

Map every product feature to a pricing tier with evidence-graded justification,
then audit whether the code actually enforces the stated policy.

This skill does three things that adjacent skills miss:
1. **Classifies features** — table-stakes (free) vs differentiation (mid-tier)
   vs premium (top-tier), grounded in competitor benchmarks and domain norms
2. **Selects the gating mechanism** — hard paywall vs usage limit vs time trial
   vs feature preview, based on a decision matrix that accounts for adoption
   risk and conversion potential
3. **Audits enforcement** — compares the pricing page promise against actual
   code guards, catching the exact class of bug where "free users get
   everything because the wall doesn't exist"

The output is a **Feature-Tier Gating Matrix** that downstream skills consume:
`write-spec` uses it to define feature boundaries, `plan-changeset` uses it to
scope enforcement work, and `design-ux` uses it to design the gate UI.

**Announce at start:** "I'm using monetization-architecture to map features to
pricing tiers and audit enforcement."

## When to Use This vs Adjacent Skills

| You need to... | Use this skill | Use instead |
|---|---|---|
| Decide WHAT to gate and WHERE | Yes | — |
| Decide HOW MUCH to charge | No | Handle outside svc (pricing research / spreadsheet) |
| Design the paywall UI/UX | No | `design-ux` |
| Reduce churn after gating | No | Handle outside svc (product strategy / analytics) |
| Pick a payment processor | No | Handle outside svc (MoR vs Stripe research) |
| Implement the payment flow | No | Dodo stack skills |

## Process

### Step 0: Gather Context

Read what exists. Don't ask for information the project already has.

**Required reads:**
1. `docs/specs/vision.md` — product purpose, target market
2. Pricing page or tier definition — stated tier names, prices, and claimed feature boundaries

**Optional reads (use if they exist):**
3. `docs/specs/analyze-competitors.md` — what competitors gate
4. `docs/specs/personas/P*.md` — who the users are and what they value
5. `docs/specs/domain-profile.md` — industry norms for monetization
6. `~/.svc/builder-profile.md` — builder constraints (no entity? pre-revenue? budget?)

**If competitor analysis doesn't exist** and you're making tier decisions, invoke
`/research` to find what 3-5 direct competitors gate at each tier. The gating
matrix without competitor benchmarks is guesswork.

### Step 1: Inventory All Features

List every distinct feature/page/capability in the product. For each:

| Feature | Current tier | Current mechanism | User-facing? | Adoption role |
|---|---|---|---|---|
| Dashboard | Free | None | Yes | Table-stakes |
| Flash Offers | Growth ($14.99) | UsageLimitGuard (soft) | Yes | Wedge |
| Standby Queue | Professional ($39.99) | UsageLimitGuard (soft) | Yes | Differentiation |
| Reports | Free | None | Yes | Table-stakes |

**Adoption role** is one of:
- **Table-stakes** — users expect this for free; gating it kills sign-ups
- **Wedge** — the feature that hooks users and drives adoption; gating it
  early kills growth, but it's the thing they'd eventually pay for
- **Differentiation** — adds value beyond the core; natural mid-tier gate
- **Premium** — power-user or enterprise feature; natural top-tier gate
- **Retention** — keeps users engaged but doesn't drive conversion

This classification is the foundation. Get it wrong and the whole matrix is wrong.

### Step 2: Classify Features into Tiers

For each feature, assign a tier using this evidence-graded decision framework:

#### Classification Decision Tree

```
Is this feature expected for free by >80% of your market?
  YES → Table-stakes (Free tier)
  NO ↓

Does this feature drive initial adoption / is it the "wedge"?
  YES → Freemium candidate (Free with limits, or Free trial)
  NO ↓

Do >50% of competitors gate this at mid-tier?
  YES → Differentiation (Mid-tier)
  NO ↓

Is this a power-user, team, or enterprise feature?
  YES → Premium (Top tier)
  NO → Re-evaluate — may be table-stakes you're overvaluing
```

#### Evidence Grading

Every tier assignment gets an evidence grade:

| Grade | Meaning | Acceptable? |
|---|---|---|
| **A — Competitor-validated** | 3+ competitors gate this identically | Yes |
| **B — Domain-norm** | Industry standard practice (e.g., SSO = enterprise) | Yes |
| **C — Usage-data-backed** | Your analytics show this feature drives conversion | Yes |
| **D — Founder-intuition** | "I think this should be paid" | Only for MVP |
| **F — Contradicted** | Evidence says this should be in a different tier | No — reclassify |

**The bar:** Every feature in the gating matrix needs at least a D-grade
justification. F-grades force reclassification. A and B grades are preferred
for all non-MVP decisions.

### Step 3: Select Gating Mechanisms

For each gated feature, choose a mechanism:

| Mechanism | How it works | Best for | Conversion rate | Risk |
|---|---|---|---|---|
| **Hard paywall** | Feature completely locked; upgrade to access | Clear premium features (SSO, API, advanced reports) | 8-15% (highest) | Kills adoption if applied to wedge |
| **Usage limit** | Feature accessible but capped (N uses/mo) | Wedge features, consumption-based value | 5-8% | Users may game limits or leave |
| **Time trial** | Full access for N days, then gate | Complex features that need time to prove value | 5-10% | Conversion drops sharply after trial ends |
| **Feature preview** | Can see output but not act on it (blurred, truncated) | Content, reports, analytics | 3-8% | Feels teasing; can frustrate |
| **Soft banner** | Feature works but banner suggests upgrading | Upsell nudge, not real gating | 1-3% (lowest) | Effectively free — not real enforcement |

#### Mechanism Decision Matrix

```
Is this feature the adoption wedge?
  YES → Usage limit or Time trial (NEVER hard paywall)
  NO ↓

Does the feature have natural consumption units?
  YES → Usage limit (cap units, not access)
  NO ↓

Is the value obvious without experiencing it?
  YES → Hard paywall (user knows what they're buying)
  NO → Time trial or Feature preview (user needs to experience value first)
```

**Critical rule:** Never hard-paywall the wedge feature of a pre-revenue product.
If no one is paying yet, your job is to get them hooked, not to lock the door.
Usage limits or time trials let users experience value and convert naturally.

### Step 4: Wedge Protection Analysis

The wedge is the feature that makes users come back. Identify it, protect it.

**How to identify the wedge:**
1. Which feature do users engage with first after sign-up?
2. Which feature do power users use most frequently?
3. Which feature do competitors highlight in their marketing?
4. Which feature would make your product indistinguishable from competitors if removed?

**Wedge protection rules:**
- The wedge MUST be accessible in the free tier (with limits if needed)
- Gating the wedge kills adoption at the top of the funnel
- If you must gate the wedge, use usage limits, not hard paywalls
- Monitor: if free→paid conversion drops after gating the wedge, the limit is too aggressive

**Example (WI-008 context):** If Flash Offers is the wedge feature for a
scheduling app, hard-paywalling it to Growth tier means free users never
experience the core differentiator. Better: free tier gets 2 Flash Offers/month,
Growth gets unlimited.

### Step 5: Revenue Impact Estimation

For each gating decision, estimate the revenue impact:

```
Feature: Flash Offers
Current: Free (soft banner only — UsageLimitGuard)
Proposed: Free tier gets 3/month, Growth ($14.99) gets unlimited

Estimated impact:
  - Free users affected: ~X% of active users use Flash Offers
  - Conversion catalyst: Usage limit creates natural upgrade trigger
  - Revenue estimate: If 5% of free users who hit the limit convert →
    [active users] × [% hitting limit] × 5% × $14.99/mo = $/mo
  - Risk: If limit is too low, users churn instead of converting
  - Mitigation: Start with generous limit, tighten based on data
```

When you don't have usage data (common for pre-revenue products), state
assumptions explicitly and mark the estimate as **D-grade (founder intuition)**.

### Step 6: Enforcement Audit

This is the code-level check. Compare stated pricing policy against actual
enforcement in the codebase.

**Audit checklist:**

1. **Find the pricing page** — what does it promise for each tier?
2. **Find the guard components** — grep for paywall, guard, gate, subscription,
   premium, tier in the codebase
3. **For each gated feature in the pricing page:**
   - Is there a guard component on the route/page/feature?
   - Is it a hard guard (blocks access) or soft guard (shows banner)?
   - Does the guard check the correct tier level?
   - Is the guard bypassable (e.g., direct URL access, API call)?

**Common enforcement anti-patterns:**

| Anti-pattern | What it looks like | Impact |
|---|---|---|
| **Soft guard masquerading as hard** | `UsageLimitGuard` instead of `SubscriptionGuard` | Free users get "premium" features |
| **Guard on UI only, not API** | Button hidden but API endpoint open | Technical users bypass the gate |
| **Wrong tier check** | Guards check `isPaid` instead of `tier >= Growth` | Any paid tier gets everything |
| **No guard at all** | Feature page has no gate component | Pricing page is a lie |
| **Feature flag instead of tier** | `isFeatureEnabled` not tied to subscription | Gating is manual, not billing-integrated |

**Output format for each enforcement finding:**

```
FINDING: [Feature] — [Severity]
  Pricing says: [tier required]
  Code does: [actual guard / no guard]
  File: [path:line]
  Impact: [what free users can access that they shouldn't]
  Fix: [specific code change needed]
```

### Step 7: Produce the Gating Matrix

Write `docs/specs/monetization-architecture.md` with:

```markdown
# Monetization Architecture

Last updated: <date> by monetization-architecture

## Tier Structure
| Tier | Price | Target persona | Value proposition |
|---|---|---|---|
| Free | $0 | Casual users, evaluation | Core functionality with limits |
| Growth | $14.99/mo | Active businesses | Full feature access |
| Professional | $39.99/mo | Multi-location / high-volume | Advanced features + priority |

## Feature-Tier Gating Matrix

| Feature | Tier | Mechanism | Evidence | Grade | Justification |
|---|---|---|---|---|---|
| Dashboard | Free | None | Table-stakes; all competitors free | A | Users expect this free |
| Flash Offers | Free (3/mo) → Growth (unlimited) | Usage limit | Wedge feature; Homebase/7shifts free with limits | B | Wedge protection: must be accessible to free users |
| Standby Queue | Growth | Hard paywall | 3/5 competitors gate to mid-tier | A | Differentiation feature |
| Advanced Reports | Professional | Hard paywall | Enterprise feature; all competitors gate | A | Power-user feature |

## Wedge Analysis
- **Identified wedge:** [feature name]
- **Protection strategy:** [usage limit / time trial / free with limits]
- **Risk if paywalled:** [specific adoption impact]

## Enforcement Audit Findings
[enforcement findings from Step 6]

## Revenue Impact Estimates
[estimates from Step 5]

## Decisions Log
| Decision | Grade | Alternative considered | Why this choice |
|---|---|---|---|
| Flash Offers: usage limit not hard paywall | B | Hard paywall to Growth | Wedge protection — hard paywall kills free→paid funnel |
```

## Rationalization Table

| Thought | Reality |
|---------|---------|
| "Let's just paywall everything and see who pays" | Paywalling the wedge kills adoption. You need free users to convert. Classify first, gate second. |
| "We don't have competitor data, I'll just guess" | Invoke `/research` and get 3-5 competitor gating benchmarks. Guessing produces F-grade decisions. |
| "Usage limits are too complex, just use hard paywalls" | Usage limits convert 5-8% of free users who hit them. Hard paywalls on wedge features convert 0% — users never experience the value. |
| "The enforcement audit is optional" | If your pricing page says "Growth+" but code says "soft banner", you're lying to customers. The audit is the whole point. |
| "This feature is obviously premium" | "Obviously" is D-grade evidence. Check what competitors do. If 3/5 give it free, your "obvious" is wrong. |
| "We're pre-revenue, gating doesn't matter yet" | Pre-revenue is exactly when gating architecture matters most. Get it wrong now and you train users to expect everything for free. |

## Red Flags

- You assigned tiers without checking a single competitor → Stop, invoke `/research`
- Every feature is assigned to the same tier → Your classification is broken
- The wedge feature is behind a hard paywall → Reclassify immediately
- No enforcement findings in the audit → You didn't grep the codebase
- All evidence grades are D (intuition) → Acceptable for MVP only; flag for re-evaluation when data exists

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Feature inventory complete | Every user-facing feature/page listed | |
| 2 | Tier classification has evidence | Every feature has grade A-D justification | |
| 3 | No F-grade decisions shipped | F-grades force reclassification | |
| 4 | Wedge identified and protected | Wedge feature accessible in free tier | |
| 5 | Gating mechanisms assigned | Every gated feature has a specific mechanism | |
| 6 | Enforcement audit completed | Code grep for guards on every gated feature | |
| 7 | At least 3 competitors benchmarked | Competitor gating data present (or research invoked) | |
| 8 | Revenue estimates stated (even if D-grade) | Each gating decision has impact estimate | |
| 9 | Output file written | `docs/specs/monetization-architecture.md` exists | |
| 10 | No hard paywall on wedge (unless explicitly justified) | Wedge uses usage limit, time trial, or free-with-limits | |

## Phase Receipt Contract

When this skill runs inside a task graph, emit one receipt per completed phase
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextGathering --evidence command_output:.svc/monetization-architecture-context-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-FeatureInventory --evidence command_output:.svc/monetization-architecture-features-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-TierClassification --evidence command_output:.svc/monetization-architecture-tiers-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-GatingMechanismAndWedgeProtection --evidence command_output:.svc/monetization-architecture-gating-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-RevenueImpactEstimation --evidence command_output:.svc/monetization-architecture-revenue-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-EnforcementAudit --evidence command_output:.svc/monetization-architecture-enforcement-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-GatingMatrixArtifact --evidence file:docs/specs/monetization-architecture.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyNextTrailer --evidence command_output:.svc/monetization-architecture-self-verify-<WI>.log
```

If competitor evidence is missing and the correct next step is `research`,
record the phase reached and explicit research-gap evidence before routing away.
If no task graph exists, report the same phase evidence in the assistant
response.

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

**Standalone mode:**
- After producing the gating matrix, the natural next step depends on context:
  - If features need spec updates → `write-spec` (delta mode, incorporating gating decisions)
  - If enforcement bugs found → `plan-changeset` (to fix guard components)
  - If competitor data was missing → `analyze-competitors` (then re-run this skill)

**`**Next:**` trailer is mandatory.** Every response ends with a concrete next action.

### Key Principles

- **Evidence over intuition.** Every tier decision needs a grade. D is acceptable for MVP; F forces reclassification.
- **Wedge protection is non-negotiable.** The feature that drives adoption must be accessible to free users.
- **Enforcement is the whole point.** A gating matrix without a code audit is a wish list, not architecture.
- **Competitor benchmarks are cheap insurance.** 30 minutes of research prevents months of wrong pricing.
- **Soft gates are not gates.** A usage-limit banner that doesn't block access is a suggestion, not enforcement.
- **Start generous, tighten with data.** Set limits higher than you think, then adjust based on actual conversion data.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
