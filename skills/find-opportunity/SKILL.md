---
name: find-opportunity
version: "1.0"
description: >-
  Find the fastest path to online revenue for this builder — reverse-engineers what makes money now (SaaS, extensions, APIs, templates, AI wrappers), matches builder skills/distribution, scores and ranks opportunities. Use when: "what should I build", "fastest path to revenue", "find me a project", "I need money", or validate-feature returns NO-SHIP. Also: "first project", "help me pick".
phases:
  - id: P1-BuilderProfileVisionContext
    trigger: always
    reads: ["~/.svc/builder-profile.md", "docs/specs/vision.md", "docs/specs/opportunities/top-3-opportunities.md", "references/platform-compatibility.md"]
    writes: [".svc/find-opportunity-context.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-BuilderAdvantagesExtraction
    trigger: always
    reads: ["~/.svc/builder-profile.md", "references/target-profiles.md"]
    writes: ["docs/specs/opportunities/top-3-opportunities.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-CategoryMatrixMarketScan
    trigger: always
    reads: ["references/category-matrix.md", "references/market-scan-protocol.md", "references/platform-compatibility.md"]
    writes: ["docs/specs/opportunities/top-3-opportunities.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-RevenueInfrastructureVetoes
    trigger: always
    reads: ["references/disqualifiers.md", "references/scoring-guide.md"]
    writes: ["docs/specs/opportunities/top-3-opportunities.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ScoringEvidenceStrength
    trigger: always
    reads: ["references/scoring-guide.md", "references/quality-gates.md"]
    writes: ["docs/specs/opportunities/top-3-opportunities.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-QualityGatesWinnerSelection
    trigger: always
    reads: ["references/quality-gates.md", "references/anti-patterns.md"]
    writes: ["docs/specs/opportunities/top-3-opportunities.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-Top3OpportunityArtifact
    trigger: always
    reads: ["references/opportunity-card-template.md", "references/self-verify-checklist.md"]
    writes: ["docs/specs/opportunities/top-3-opportunities.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/opportunities/top-3-opportunities.md", "references/self-verify-checklist.md"]
    writes: [".svc/find-opportunity-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
  optional:
    - { path: "docs/specs/vision.md", artifact: vision }
outputs:
  produces:
    - { path: "docs/specs/opportunities/top-3-opportunities.md", artifact: top-3-opportunities }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Find Opportunity

Find what to build. Not what COULD work — what IS working, and whether this
specific builder can ship a competitive version in 1-2 weeks.

**Announce at start:** "I'm using the find-opportunity skill to scan the market
and find online/digital product opportunities matched to your builder profile."

## Online Product Mandate

This skill finds **software products that generate revenue online**. Every
opportunity must be:
- **Shippable from a laptop** — no physical presence, no local geography
- **Global market** — customers can be anywhere
- **Digital delivery** — code, API, template, or subscription

**Hard exclusions (never recommend):**
- Local service businesses (cleaning, landscaping, tutoring in-person)
- Brick-and-mortar tools (POS for restaurants, salon booking for local shops)
- Consulting or agency models that trade time for money
- Physical products, dropshipping, or anything with inventory/shipping
- Real estate, local delivery, or location-dependent marketplaces

**Soft exclusions (only if builder explicitly requests):**
- Marketplace apps targeting local buyers/sellers
- Tools whose ONLY customer base is small local businesses

If the builder's current project or profile signals local business (e.g.,
Example Marketplace, salon software, restaurant tools), **explicitly note the tension**:
> "Your current project is in the local business space. I'm looking for online
> opportunities that leverage your skills but reach a global market. If you
> specifically want local business ideas, let me know and I'll adjust."

Then proceed with online-only opportunities.

**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction,
storage, and staleness rules.

---

## Process

```
Builder Profile → Extract Advantages → Market Scan → Reverse-Engineer Winners →
Match to Builder → Score & Rank → Quality Gates → Winner Selection →
Present Top 3 → User Picks / Auto-Select → Hand Off
```

Read `references/target-profiles.md` for the revenue bar, target profiles,
bootstrapping mode, and break-even math.

---

## Prerequisites

### Builder Profile (Required)

Read `~/.svc/builder-profile.md`. If it does not exist, stop and tell the
user: "I need your builder profile to find opportunities matched to you.
Run /route-workflow to create one, or describe your situation: skills, time,
budget, distribution channels."

The builder profile IS the input. Without knowing who the builder is, every
recommendation is generic and useless. The profile tells you:
- What they can build (skills)
- Who they can reach (distribution)
- How fast they can ship (hours/week)
- What they can spend ($0 or otherwise)
- What has worked/failed before (project history)
- Whether they have a business entity (payment constraints)

### Existing Opportunity Research (Continuation Mode)

Check for existing research before starting from scratch:

```bash
ls docs/specs/opportunities/top-3-opportunities.md 2>/dev/null
```

If the file exists, **read it and operate in continuation mode:**

1. **Preserve existing WebSearch-based research** — funding data, pricing,
   market size, competitor landscapes. This is expensive to re-gather.
2. **Identify what's MISSING** — typically: social proof (engagement-scored
   community signals), diversity (too narrow on one domain), niche specificity
   (too broad, competing with everyone).
3. **Layer last30days social proof ON TOP** of existing research. The 4-dimension
   discovery (Step 3a) runs fresh, but the WebSearch supplemental (Step 3b) can
   reference existing data instead of re-searching.
4. **Expand the funnel** — if existing research is domain-heavy (e.g., all DevOps),
   run last30days discovery queries OUTSIDE the builder's primary domain to find
   cross-domain opportunities the builder's skills could serve.
5. **Re-score all candidates** with the new social proof data. Candidates that
   had strong WebSearch evidence but zero social proof should be downgraded.
   Candidates with weak WebSearch evidence but strong social proof should be
   upgraded.

**Continuation mode is NOT "validate my existing picks."** It is "here's what
I found with WebSearch — now find what REAL PEOPLE are saying and see if the
picture changes."

If no existing research exists, run the full process from Step 1.

### Vision (Optional)

If `docs/specs/vision.md` exists, read it. The builder has a big idea. In this
case, the skill looks for Stage 1 revenue projects that FEED the big idea:
same audience, same domain, smaller scope, immediate revenue. The best Stage 1
project earns money AND builds an audience for the real thing.

If no vision exists, the skill runs in pure discovery mode — find the best
opportunity for this builder regardless of any larger direction.

### Platform Context (Auto-Detected)

Read `references/platform-compatibility.md` to detect the builder's platform
from their profile or project files, and score categories for stack
compatibility.

---

## Step 1: Extract Builder Advantages

From the builder profile, extract what this specific person can do BETTER or
CHEAPER than the average builder.

```markdown
## Builder Advantages

### Can Build (Technical Edge)
- <languages, frameworks, infra>

### Can Reach (Distribution Edge)
- <social platforms, communities, email list, marketplace presence>

### Has (Infrastructure Edge)
- <subscriptions, free tiers, domains, codebases, entity status>

### Time Budget
- <hours/week available, realistic ship timeline>

### Unique Angle
- <domain expertise from job, hobby, past projects>

### Hard Constraints
- <skills failed before, budget ceiling, entity status, employment limits>

### History Signal
- <patterns from past projects: what worked, what killed them>
```

**Critical:** If the builder profile shows a repeated failure mode (2+ projects
died the same way), that failure mode becomes a hard veto.

---

## Step 2: Product Category Matrix

Read `references/category-matrix.md` for:
- Domain matching rules (including local-business domain override)
- Distribution models and scoring boosts
- Full product category table (11 categories)
- Category fit quick-score dimensions

**Key rules (read the full reference for details):**
- The pipeline builds the code — limit opportunities to what the builder can
  distribute, deploy, maintain, and evaluate
- Domain is a strong signal, not a hard filter
- If builder's domain is local business: reduce domain bonus by half, actively
  seek online product angles
- Prefer solutions with built-in distribution
- Scan 8+ categories. Rate each for fit BEFORE deep research.

Also read `references/platform-compatibility.md` to detect the builder's platform
and score categories for stack compatibility (NOT eliminate them).

---

## Step 3: Market Scan Protocol

Read `references/market-scan-protocol.md` for the full protocol including:
- last30days social proof discovery (4 dimensions, 8 queries)
- WebSearch supplemental research
- analyze-competitors deep dives
- Reverse-engineering process
- Candidate funnel requirements (10+ candidates, 8+ categories)
- Proof chain format (5+ evidence points per top-3 candidate)
- Parallel research mandate

**Key rule:** last30days is PRIMARY. WebSearch is supplemental. Blog posts are
NOT social proof. Reddit/HN/X engagement with metrics IS social proof.

---

## Step 4: Self-Sustaining Infrastructure

**Mandatory:** every recommendation uses infrastructure that costs $0 until
revenue exceeds the cost.

| Layer | Free Tier Pick | Scales To |
|---|---|---|
| Database | Supabase (500MB, 50K rows) | Supabase Pro ($25/mo) |
| Hosting | Vercel (100GB bandwidth) | Vercel Pro ($20/mo) |
| Auth | Supabase Auth (50K MAU) or Clerk (10K MAU) | Pro tier |
| Storage | Supabase Storage (1GB) or Cloudflare R2 (10GB) | Pay as you grow |
| Email | Resend (3K/mo) or Loops (1K contacts) | Resend $20/mo |
| Payments | Dodo / LemonSqueezy / Gumroad — no entity needed | Stripe when entity exists |
| Analytics | Plausible (free trial) or Umami (self-hosted free) | Plausible $9/mo |
| AI (wrapper) | OpenAI / Anthropic API (user-funded) | Scales with users |
| Mobile | Expo + EAS (30 builds/mo free) | EAS $99/mo |

**Rule:** $0 out of pocket until revenue exceeds infra cost. If an opportunity
requires paid infra from day 1 and the builder has $0 budget, disqualify it.

---

## Step 5: AI Wrapper Special Path

Read `references/scoring-guide.md` for the AI wrapper special path including
wrapper economics, multi-wrapper strategy, and when to recommend wrappers.

---

## Step 6: Scoring

Read `references/scoring-guide.md` for:
- Six scoring dimensions with weights and guides
- Evidence Strength (0-10) — separate from score, gates auto-select
- Score anti-inflation cap: `max_score = min(calculated_score, 60 + evidence_strength * 2)`

**Dimensions (weights):** Guaranteed revenue (30%), Builder fit (25%),
Distribution fit (20%), Speed to first $ (15%), Self-sustaining (5%),
Ecosystem value (5%).

Show the math. Each dimension gets a number and a one-sentence justification.

---

## Step 7: Disqualifiers

Read `references/disqualifiers.md` for the full table of 9 hard vetoes.

**Critical disqualifiers (always inline):**
- Requires physical presence or local market only → hard veto
- Evidence strength < 4 → reject, research more
- Takes > 2 weeks to build at builder's pace → too big
- No evidence of anyone paying for similar products → no speculation

When a disqualifier fires, log it and move on. Mention rejected candidates in
"Considered and Rejected" so the user sees the work.

---

## Step 8: Present Top 3 + Winner Selection

Save to `docs/specs/opportunities/top-3-opportunities.md`.

Read `references/opportunity-card-template.md` for the full card format.
Each card includes: Category, What, Reverse-engineered from, Evidence, Why you,
MVP, Revenue Model, Infrastructure, Distribution Plan, Build Time, Revenue
Projections, Risk, Score (with Evidence Strength and cap note).

### Winner Auto-Selection

Read `references/quality-gates.md` for the full auto-select protocol including:
- Pre-validation sanity check (task-level hours vs available)
- Adversarial review (moat risk, demand risk, builder risk, platform risk)
- Anti-pattern cross-check (AP-5, AP-12, AP-18)
- Pessimistic sensitivity analysis (25% customers, 2× build time)
- Auto-select decision matrix

**Auto-select triggers ONLY when ALL conditions met:**
- Confidence > 20 points (top_score - second_score)
- Top score > 80
- Evidence Strength >= 7
- ALL quality gates pass

**Overrides that BLOCK auto-select:**
- Evidence strength < 7
- Any quality gate fails
- Platform stack mismatch on top opportunity

If auto-select triggers: "This is the clear winner. Shall I start building it?"
If user says "not that one": respect immediately, present full 3-choice menu.

---

## Step 9: User Picks and Pipeline Handoff

### User picks an opportunity (or auto-selected)

1. Use the opportunity as input to `write-vision`
2. Vision incorporates: product definition, builder constraints, infra choices,
   distribution plan, revenue model, pricing, **platform constraints**
3. `validate-feature` runs with opportunity evidence pre-loaded
4. Full pipeline runs from there

### Full Delivery Mode

Read `references/full-delivery-mode.md` for the chained pipeline:
```
write-vision → analyze-domain → analyze-competitors → build-personas →
validate-feature → write-spec → design-ux → design-ui → design-tech →
plan-changeset → execute-changeset
```

**Rules:** Opportunity card IS the vision seed. Platform constraints respected.
`human_checkpoint` still honored. Blockers surfaced to user.

### User says "none of these"

Ask what's wrong. Rescan with adjusted criteria:
- Wrong category → rescan focused there
- Right category, wrong angle → dig deeper in same space
- User has their own idea → respect it, run pipeline on their idea

### User says "just pick the best one"

P0 picks Opportunity #1 (highest score), logs it as a taste decision in the
research log, and runs the pipeline. The user can always change direction
later.

### User says "build my idea anyway"

Respect it. Always. No gatekeeping. Run the pipeline on their idea.

But if their idea is a 2-month build with no revenue until launch and their
builder profile shows no capital, present the staging strategy:

> "Your idea is solid but it's a [N]-week build with no revenue until launch.
> Here's a staging plan:"
>
> **Stage 1 (weeks 1-2):** Build [Opportunity N] — earns money AND [builds
> audience for / teaches domain of / is related to] your big idea.
>
> **Stage 2 (month 2-3):** Revenue from Stage 1 funds entity registration,
> Stripe, better tools, maybe a contractor for your weak skills.
>
> **Stage 3 (month 3+):** Build your big idea with revenue, audience, and
> tools from Stages 1-2.
>
> Or: "build my idea anyway" — always available.

If the vision exists and the staging strategy applies, prefer Stage 1 projects
that are RELATED to the big idea: same audience, same domain, smaller scope.
The best Stage 1 project earns money AND builds an audience for Stage 3.

---

## First Project Rules

Read `references/first-project-rules.md` for the full 9 rules and builder journey.

Summary: Must ship in 1-2 weeks, built-in distribution, no entity needed, dead
simple revenue model, proven demand, free-tier infra, $1K+/mo evidence,
builder would use it themselves.

---

## Self-Verify

Before declaring done, verify every check passes. Read
`references/self-verify-checklist.md` for the full 30-item checklist.

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | 3+ opportunities with revenue evidence | Count cards, verify evidence section | |
| 2 | Buildable in 1-2 weeks | Hours estimated from builder's pace | |
| 3 | Free-tier infra only | $0 cost in infrastructure section | |
| 4 | 10+ candidates investigated | Count top 3 + rejected | |
| 5 | 5+ proof points per top-3 | Numbered proof chain per card | |
| 6 | Platform compatibility noted | Native/neutral/mismatch on each card | |
| 7 | Evidence strength >= 4 | Score 0-10 per opportunity | |
| 8 | Winner confidence calculated | Gap > 20, top > 80, evidence >= 7 | |
| 9 | Auto-select gates passed | Sanity check, adversarial, anti-patterns, sensitivity | |
| 10 | Output file exists | `docs/specs/opportunities/top-3-opportunities.md` | |

If any check FAILs, fix before presenting. Do not present incomplete opportunities.

---

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `find-opportunity` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-BuilderProfileVisionContext --evidence command_output:.svc/find-opportunity-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-BuilderAdvantagesExtraction --evidence file:docs/specs/opportunities/top-3-opportunities.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-CategoryMatrixMarketScan --evidence file:docs/specs/opportunities/top-3-opportunities.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-RevenueInfrastructureVetoes --evidence file:docs/specs/opportunities/top-3-opportunities.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ScoringEvidenceStrength --evidence file:docs/specs/opportunities/top-3-opportunities.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-QualityGatesWinnerSelection --evidence file:docs/specs/opportunities/top-3-opportunities.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-Top3OpportunityArtifact --evidence file:docs/specs/opportunities/top-3-opportunities.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/find-opportunity-self-verify.log
```

Do not complete the task until all required phase ids appear in
`skill_receipt.phases_executed`.

---

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

This skill does not participate in progressive chains. Invoked by
`route-workflow` before `write-vision`, or after `validate-feature` returns
NO-SHIP.

**After user picks:**
- Invoke `write-vision` with opportunity context
- Full greenfield pipeline: `write-vision → analyze-competitors + analyze-domain → build-personas → validate-feature → write-spec → ...`

---

## What This Produces

`docs/specs/opportunities/top-3-opportunities.md` containing:
- 3 scored, evidence-backed opportunity cards
- Builder advantages extraction
- Considered-and-rejected section
- Recommendation with reasoning

This is a decision document. It does NOT contain:
- Architecture or technical design (comes from write-spec)
- Implementation plan (comes from plan-changeset)
- Full competitive analysis (comes from analyze-competitors)
- Product vision (comes from write-vision)

---

## Baseline Failure This Skill Fixes

Without this skill, builders either (a) build the first idea that comes to
mind without market validation, or (b) spend weeks "researching" without
a structured framework and never start building. Both fail.

This skill forces evidence-based opportunity selection: real products, real
revenue, real builder-specific advantages.

The key insight: most builders don't fail at building. They fail at picking
what to build. This skill fixes the picking.

---

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-read this SKILL.md** — Refresh context for the current step
4. **Read relevant reference files** — `references/*.md` for detailed tables/templates
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete
