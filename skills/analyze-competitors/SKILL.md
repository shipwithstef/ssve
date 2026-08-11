---
name: analyze-competitors
version: "1.0"
description: >
  Systematic product intelligence on top competitors in the project's domain.
  Finds up to 30 competitors across 4 tiers (direct/adjacent/emerging/macro),
  analyzes what they do well and poorly, scores moat durability, identifies
  whitespace and differentiation opportunities. NOT marketing copy — product
  decisions. Produces docs/specs/analyze-competitors.md. Use when: "competitors",
  "what else exists", "market analysis", "who are we competing with", "differentiation",
  or automatically after analyze-domain in progressive greenfield mode.
phases:
  - id: P1-KnowledgeFirstLandscape
    trigger: always
    reads: ["references/knowledge/INDEX.md", "references/knowledge/competitors/"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CompetitiveSpaceDefinition
    trigger: always
    reads: ["docs/specs/vision.md", "docs/specs/domain-profile.md", "docs/specs/analyze-competitors.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-CompetitorResearch
    trigger: always
    reads: ["web research", "public reviews", "competitor sites", "last30days signals"]
    writes: ["docs/specs/analyze-competitors.data.json"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-DimensionAnalysis
    trigger: always
    reads: ["competitor research notes", "pricing pages", "reviews", "docs"]
    writes: ["docs/specs/analyze-competitors.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-WhitespaceMoatSynthesis
    trigger: always
    reads: ["docs/specs/analyze-competitors.md", "docs/specs/vision.md"]
    writes: ["docs/specs/analyze-competitors.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-KnowledgePersistence
    trigger: always
    reads: ["docs/specs/analyze-competitors.md", "docs/specs/analyze-competitors.data.json"]
    writes: ["references/knowledge/competitors/<competitor-slug>/CAPABILITIES.md", "references/knowledge/INDEX.md"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: existing-analysis }
outputs:
  produces:
    - { path: "docs/specs/analyze-competitors.md", artifact: analyze-competitors }
chain:
  lanes:
    greenfield: { position: 3, prev: analyze-domain, next: build-personas }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Competitor Analysis

**Runtime v2 continuation:** Register every produced artifact with its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve this skill's unique competitor evidence and thin-landscape conditions.

Product intelligence — what exists in the market, what works, what's missing,
and where the whitespace is. This is NOT marketing positioning. This feeds product
decisions: feature scope, UX patterns, differentiation strategy.

**Announce at start:** "I'm using the analyze-competitors skill to map the competitive landscape."


**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## Knowledge-First

Before researching competitors, check the knowledge base:

```bash
cat references/knowledge/INDEX.md 2>/dev/null
```

If competitors in this space were already analyzed (e.g., for a previous
project in the same domain), read their Layer 2 CAPABILITIES.md. Update
with delta only — new entrants, recent launches, pricing changes. Don't
re-analyze what's already known.

After analysis, write knowledge layers for each significant competitor
so future projects don't re-research them. See Step 6 below.

## Process

### Step 1: Define the competitive space

**Staleness check:** If `docs/specs/analyze-competitors.md` exists, check its
`Generated:` date. If older than 30 days, warn: "Competitive landscape is 30+
days stale — pricing, features, and new entrants may have changed. Running
with `--refresh` to update current buzz, pricing, and new entrants without
full re-analysis." In `--refresh` mode, only update: pricing rows, current
buzz, new entrants (add to Emerging tier), and shutdowns/pivots. Skip full
9-dimension re-analysis for existing competitors.

Read `docs/specs/vision.md` and `docs/specs/domain-profile.md` (if exists).

Determine: what category does this product compete in? Be specific — not "productivity tool"
but "AI-assisted learning recommendation platform" or "real-time collaboration for distributed teams."

### Step 2: Find competitors (4-tier, up to 20)

**Web research is MANDATORY** (per WI-140 / SDKG instance `competitor-analysis`). Output MUST include both `docs/specs/analyze-competitors.md` (human) AND `docs/specs/analyze-competitors.data.json` (machine, conforming to `references/schemas/competitor-analysis.schema.json`). The header pattern "no new web research performed" / "consolidation only" / "read-only consolidation" is REJECTED by `validate-competitor-analysis-schema.sh` (COMP-07). You MUST invoke WebSearch + WebFetch (or agy-cli per `rules/research-must-use-agy-cli.md`) per direct competitor before producing output. See `references/templates/analyze-competitors-output-template.md` for the required output shape (markdown + companion JSON).

**Customer Mechanic Analysis section is REQUIRED for each direct competitor** (per WI-140 COMP-03): how does the customer earn / enroll / verify; merchant cost; POS integrations; fraud prevention; customer complaints. This is what catches the "we're the only ones who do receipt scanning" class of failure on day 1.

**If `/last30days` is available** (recommended — [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill)):
Run `/last30days "[category] tools products competitors"` first. This gives
you what people are ACTUALLY talking about right now — not just what ranks on
Google. Cross-platform signals (Reddit + HN + X) reveal which competitors have
real momentum vs which are just SEO-optimized landing pages.

**Then supplement with WebSearch** for:
- "[category] top companies {current year}"
- "[category] best tools {current year}"
- "[category] alternatives comparison"
- "[specific problem from vision] solutions"
- "[category] startups funded {current year}"
- "[category] open source alternatives"

Map competitors across 4 tiers:

| Tier | Target count | Criteria | Analysis depth |
|---|---|---|---|
| **Direct** | up to 6 | Same problem, same user, same category | Full (all 9 dimensions in Step 3) |
| **Adjacent** | up to 5 | Same user different solution, OR same solution different user | Core only (product, pricing, differentiator, user pain) |
| **Emerging/Insurgent** | up to 5 | New entrants (<2 years), recently funded, open-source disruptors | Core + funding/traction signals |
| **Macro disruptors** | up to 4 | AI models, platform incumbents, or regulation shifts that could absorb/eliminate the space | Threat assessment only (what trigger, what timeline, how to survive) |

**Minimum:** 3 direct + 1 from any other tier. **Maximum:** 20 total.

For mature domains with many competitors, populate all tiers. For niche
markets, it's acceptable to have fewer — log "Tier X: <N> found (market
is narrow)" rather than padding with irrelevant entries.

### Step 3: Analyze each competitor

For each **Direct** competitor, gather the full 9 dimensions. For other tiers,
gather only the dimensions marked in the tier table above.

| Dimension | How to find | What matters |
|-----------|------------|-------------|
| **Core product** | Landing page, product tours, docs | What do they actually do? |
| **Key features** | Feature pages, pricing tiers | What's included/excluded at each tier? |
| **Tech approach** | Blog posts, docs, GitHub (if open source) | How do they build it? |
| **UX patterns** | Screenshots, demos, reviews mentioning UX | What feels good/bad to use? |
| **Business model** | Pricing page | Free tier? Subscription? Usage-based? |
| **User love** | G2/Product Hunt/Reddit/last30days — positive | What do users praise? |
| **User pain** | G2/Product Hunt/Reddit/last30days — negative | What do users complain about? |
| **Current buzz** | last30days (if available) | What are people saying RIGHT NOW? Trending or stale? |
| **Differentiator** | Positioning, "why us" page | What do they claim is unique? |
| **Customer Mechanic** (NEW WI-140) | Direct testing of signup + earn flow + reading their docs | How does the customer EARN points (auto-POS / scan / check-in / card-link)? How do they ENROLL (app / POS / SMS / wallet)? Merchant cost? POS integrations? Fraud controls? G2/Reddit complaints? |

### Step 4: Synthesize whitespace

After analyzing all competitors across tiers:

1. **What do they ALL do?** (table stakes — we must have these)
2. **What do SOME do well?** (competitive features — consider adopting)
3. **What do NONE do well?** (whitespace — potential differentiation)
4. **What do users consistently complain about?** (pain points — opportunity)
5. **What approach is nobody taking?** (the non-obvious angle)

### Step 4b: Moat assessment

Whitespace tells you where to enter. Moat tells you whether you can stay.
For each whitespace opportunity and each existing strength, score moat
durability on a 1–5 scale:

| Score | Type | Meaning | Example |
|---|---|---|---|
| 1 | Feature parity | Competitor can ship the same thing in a sprint | UI polish, basic CRUD features |
| 2 | Execution gap | Competitor CAN do it but is slower/worse at it | Better onboarding, faster support |
| 3 | Data/network moat | Requires accumulated data or users to replicate | Loyalty history, community effects, review corpus |
| 4 | Integration lock-in | Switching cost after setup is real | POS integration, employee scheduling dependencies |
| 5 | Structural moat | Regulatory, geographic, certification, or proprietary pipeline | MoR status, local business licensing, exclusive partnerships |

Products with no moat (all 1s) are revenue plays, not defensible businesses —
that's fine for a first revenue project but important to know explicitly.
Products with mixed moats (some 3+) can be defensible if the high-moat
dimensions reinforce each other.

**Output a moat table** with each opportunity/strength scored:

```markdown
## Moat Assessment

| Opportunity/Strength | Moat score | Type | Why |
|---|---|---|---|
| [opportunity 1] | 3 | Data/network | Loyalty visit history accumulates over months |
| [opportunity 2] | 1 | Feature parity | Any competitor could add this in a week |
```

**Overall moat rating:** average of top 3 scores. Below 2.0 = no moat (flag
it). 2.0–3.0 = weak moat. 3.0+ = defensible position.

### Step 5: Write analysis

Produce `docs/specs/analyze-competitors.md`:

```markdown
# Competitor Analysis

**Generated:** YYYY-MM-DD
**Category:** [specific competitive category]
**Source:** WebSearch + public reviews

## Direct Competitors (target 8-10, was up to 6)

### 1. [Company Name]
- **What they do:** [1-2 sentences]
- **Key features:** [bulleted list]
- **Business model:** [pricing approach]
- **Users love:** [from reviews]
- **Users hate:** [from reviews]
- **Differentiator:** [what they claim]

### 2-6. [Same structure]

## Adjacent Competitors (target 8-10, was up to 5)
[Core dimensions only: product, pricing, differentiator, user pain]

## Emerging / Insurgent (target 6-8, was up to 5)
[Core + funding/traction signals]

## Macro Disruptors (target 4-6, was up to 4)
[Threat assessment: what trigger, what timeline, how to survive]

## Landscape Summary

### Table Stakes (everyone has, we must too)
- [feature 1]
- [feature 2]

### Competitive Features (some have, worth considering)
- [feature] — [who has it, why it matters]

### Whitespace (nobody does well)
- [gap 1] — [why it's an opportunity]
- [gap 2] — [why it's an opportunity]

### Common User Complaints (across all competitors)
- [complaint] — [N mentions across reviews]

## Moat Assessment

| Opportunity/Strength | Moat score (1-5) | Type | Why |
|---|---|---|---|
| [opportunity 1] | [score] | [type] | [reasoning] |

**Overall moat rating:** [average of top 3] — [no moat / weak / defensible]

## Differentiation Opportunity

Based on the whitespace, user pain, and moat assessment:
- **Our angle:** [how vision.md's approach differs]
- **What we can do that they can't/won't:** [specific capabilities]
- **What we should steal:** [best practices from competitors]
- **What we should avoid:** [mistakes competitors make]

## Impact on Feature Decisions

- **Feature discovery Q4 (the bet):** [informed by whitespace]
- **Spec ACs:** [informed by table stakes + competitive features]
- **UX design:** [informed by what users love/hate about competitors]
- **Marketing positioning:** [informed by differentiation opportunity]
```

### Step 6: Write knowledge layers

For each competitor analyzed, write to the knowledge base:

```bash
mkdir -p references/knowledge/competitors/<competitor-slug>
```

Write CAPABILITIES.md:
```markdown
# <Competitor Name> — Capabilities
Analyzed: <date>
URL: <url>
## What: <one sentence>
## Pricing: <model and price points>
## Strengths: <bullet list>
## Weaknesses: <bullet list>  
## Users: <who uses it>
```

Write `.version` with analysis date (stale after 7 days — competitors move fast).
Update `references/knowledge/INDEX.md` with a row.

## Phase Receipt Contract

When running under `.svc/lane-tasks-<WI>.json`, emit receipts for each required
phase before marking the task completed:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-KnowledgeFirstLandscape --evidence command_output:.svc/analyze-competitors-knowledge.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CompetitiveSpaceDefinition --evidence command_output:.svc/analyze-competitors-space.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-CompetitorResearch --evidence file:docs/specs/analyze-competitors.data.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DimensionAnalysis --evidence file:docs/specs/analyze-competitors.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-WhitespaceMoatSynthesis --evidence file:docs/specs/analyze-competitors.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-KnowledgePersistence --evidence file:references/knowledge/INDEX.md
```

## Auto Mode vs Guided Mode

**Auto mode:** Research silently, produce analysis, chain forward.

**Guided mode:** Present each competitor with key findings. Ask:
"Here's what I found across the 4 tiers. Any I'm missing, or any you know about that aren't showing up in search?"

For the whitespace synthesis: "Here's where I see the opportunity. Does this match your intuition?"

## Brownfield Behavior

For existing products: read the codebase to understand what features already exist, then compare against competitors. The analysis focuses on gaps: "Competitors A and B have [X] and you don't. Competitors C and D have [Y] which you do better."

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | `docs/specs/analyze-competitors.md` exists | `test -f` | |
| 2 | At least 3 direct + 1 other tier analyzed | count ### headers per tier section | |
| 3 | Whitespace section identifies ≥1 opportunity | grep for Whitespace | |
| 4 | Moat assessment table exists with scored opportunities | grep for "Moat Assessment" and score column | |
| 5 | Differentiation section connects to vision | references vision.md concepts | |
| 5 | Knowledge protocol conformance | Library checked first, project artifact written, knowledge persisted, .version updated | |

## Audit Mode

When invoked with `--audit` to refresh competitive intelligence:

1. Read `docs/specs/analyze-competitors.md`
2. Check age: more than 7 days old? Market moves fast.
3. WebSearch for recent changes: new competitors? Pivots? Shutdowns?
4. Check our product against the table stakes list: any we still don't have?
5. Check whitespace: has any competitor filled a gap we identified?
6. Report: competitor-by-competitor CURRENT/CHANGED/NEW with specific findings

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

**If `--progressive` and self-verify passed:**
- Chain to build-personas: `build-personas --progressive --lane greenfield`

**If standalone:**
- Report competitive landscape summary
- Suggest: "Next: run `build-personas` or `validate-feature`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
