---
name: analyze-competitors
version: "1.0"
description: >
  Researches up to 30 competitors across direct, adjacent, emerging and macro tiers,
  scoring moats and whitespace into docs/specs/analyze-competitors.md. Use for
  "competitors", "who are we competing with", "differentiation", "market analysis".
  Product decisions, not marketing copy.
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
    greenfield: { position: 3, prev: analyze-domain, next: catalog-domain-capabilities }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Competitor Analysis

**Runtime v2 continuation:** Register every produced artifact with its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve this skill's unique competitor evidence and thin-landscape conditions.

Product intelligence — what exists in the market, what works, what's missing,
and where the whitespace is. This is not marketing positioning; it feeds product
decisions: feature scope, UX patterns, differentiation strategy.

**Announce at start:** "I'm using the analyze-competitors skill to map the competitive landscape."

**Outcome:** `docs/specs/analyze-competitors.md` + `.data.json` grounded in fresh web
research, with whitespace and moat scored, and competitor knowledge persisted. **Check:**
Self-Verify below and `validate-competitor-analysis-schema.sh`. **Boundary:** every
competitor fact comes from a source you actually read this run or a dated knowledge entry —
never from memory or invention.

**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## Knowledge-First

Start from `references/knowledge/INDEX.md`. If competitors in this space were already
analyzed (e.g., for a previous project in the same domain), read their Layer 2
CAPABILITIES.md and update with the delta only — new entrants, recent launches, pricing
changes. After analysis, write knowledge layers for each significant competitor so future
projects don't re-research them (Step 6).

## Process

### Step 1: Define the competitive space

**Staleness check:** If `docs/specs/analyze-competitors.md` exists, check its
`Generated:` date. If older than 30 days, warn: "Competitive landscape is 30+
days stale — pricing, features, and new entrants may have changed. Running
with `--refresh` to update current buzz, pricing, and new entrants without
full re-analysis." In `--refresh` mode, only update: pricing rows, current
buzz, new entrants (add to Emerging tier), and shutdowns/pivots. Skip full
9-dimension re-analysis for existing competitors.

Read `docs/specs/vision.md` and `docs/specs/domain-profile.md` (if exists), then name the
category precisely — not "productivity tool" but "AI-assisted learning recommendation
platform" or "real-time collaboration for distributed teams."

### Step 2: Find competitors (4-tier, up to 20)

**Web research is required** (per WI-140 / SDKG instance `competitor-analysis`), because a landscape built from memory misses new entrants and current mechanics. Output both `docs/specs/analyze-competitors.md` (human) and `docs/specs/analyze-competitors.data.json` (machine, conforming to `references/schemas/competitor-analysis.schema.json`). The header pattern "no new web research performed" / "consolidation only" / "read-only consolidation" is REJECTED by `validate-competitor-analysis-schema.sh` (COMP-07). Invoke WebSearch + WebFetch (or agy-cli per `rules/research-must-use-agy-cli.md`) per direct competitor before producing output. See `references/templates/analyze-competitors-output-template.md` for the output shape (markdown + companion JSON).

**Customer Mechanic Analysis section is required for each direct competitor** (per WI-140 COMP-03): how does the customer earn / enroll / verify; merchant cost; POS integrations; fraud prevention; customer complaints. This is what catches the "we're the only ones who do receipt scanning" class of failure on day 1.

**If `/last30days` is available** (recommended — [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill)), run
`/last30days "[category] tools products competitors"` first: cross-platform signals
(Reddit + HN + X) show which competitors have real momentum versus SEO-optimized landing
pages. Then supplement with WebSearch covering top companies and best tools for the current
year, alternatives comparisons, solutions to the specific problem in the vision, recently
funded startups, and open-source alternatives.

Map competitors across 4 tiers:

| Tier | Target count | Criteria | Analysis depth |
|---|---|---|---|
| **Direct** | up to 6 | Same problem, same user, same category | Full (all 9 dimensions in Step 3) |
| **Adjacent** | up to 5 | Same user different solution, OR same solution different user | Core only (product, pricing, differentiator, user pain) |
| **Emerging/Insurgent** | up to 5 | New entrants (<2 years), recently funded, open-source disruptors | Core + funding/traction signals |
| **Macro disruptors** | up to 4 | AI models, platform incumbents, or regulation shifts that could absorb/eliminate the space | Threat assessment only (what trigger, what timeline, how to survive) |

**Minimum:** 3 direct + 1 from any other tier. **Maximum:** 20 total.

For mature domains, populate all tiers. For niche markets, fewer is acceptable — log
"Tier X: <N> found (market is narrow)" rather than padding with irrelevant entries.

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
fine for a first revenue project but important to know explicitly. Mixed moats
(some 3+) can be defensible if the high-moat dimensions reinforce each other.

Output a `## Moat Assessment` table (opportunity/strength, moat score, type, why).
**Overall moat rating:** average of top 3 scores. Below 2.0 = no moat (flag
it). 2.0–3.0 = weak moat. 3.0+ = defensible position.

### Step 5: Write analysis

Produce `docs/specs/analyze-competitors.md` with: header (Generated date, category,
sources), one section per tier, Landscape Summary (table stakes, competitive features,
whitespace, common complaints), Moat Assessment, Differentiation Opportunity (our angle,
what we can do that they can't/won't, what to steal, what to avoid), and Impact on Feature
Decisions. Template: `references/output-templates.md`.

### Step 6: Write knowledge layers

For each competitor analyzed, write `references/knowledge/competitors/<competitor-slug>/CAPABILITIES.md`
(template in `references/output-templates.md`) and `.version` with the analysis date (stale
after 7 days — competitors move fast). Update `references/knowledge/INDEX.md` with a row.

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

When invoked with `--audit` to refresh competitive intelligence: if
`docs/specs/analyze-competitors.md` is more than 7 days old, WebSearch for new competitors,
pivots and shutdowns; check our product against the table-stakes list and whether any
competitor filled an identified whitespace gap; report competitor-by-competitor
CURRENT/CHANGED/NEW with specific findings.

## Pipeline Continuation

**Lane graph driven by `svc-next`.** When `.svc/lane-tasks-<WI>.json` was compiled for this work, `svc-next` alone completes this stage and picks the successor: do not mark the task completed, start or load the next task or skill, or follow a next-skill default from this section; finish through `## Handback` at the end of this file. The rules below apply only without a compiled lane graph.

### Task-graph mode (source of truth: `.svc/lane-tasks-<WI>.json`; mirrors: Claude `TaskList`, Kimi `/task`+`TaskList`/`TaskOutput` observe-only, Codex `update_plan`)
- Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions, not prose.
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume.
- Host-UI mirroring only in the parent session (host exposes TaskList and no `SVC_SUBAGENT=1`);
  otherwise skip it — the file is the durable record and the parent re-mirrors after the subagent returns.
  Subagents do not call TaskUpdate: a failed call is silent drift between the subagent's intent and the host UI.
- In Codex and other hosts without native task-mutation APIs, mirror only the active step in `update_plan`.
- Mark this task `completed` before leaving; then mirror. Evaluate the next task's conditions:
  runnable → mark `in_progress`, persist, load that skill; skippable → mark `completed` + skip reason.
- Per `route-workflow` Task-Graph Execution Protocol.

### Chaining

**Under a compiled lane graph (`.svc/lane-tasks-*.json`) `svc-next` chooses the next stage: do not invoke or suggest the next skill from this section; follow `## Handback` at the end of this file. The standalone guidance below applies only when no lane graph exists.**

**If `--progressive` and self-verify passed:** chain to build-personas: `build-personas --progressive --lane greenfield`

**If standalone:** report the competitive landscape summary and suggest: "Next: run `build-personas` or `validate-feature`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Handback

Run `node "$SVC_ROOT"/scripts/svc-next.mjs --root . --done analyze-competitors --receipt load-skill` and follow the printed card: do only what its `SKILL` says. `progressive: true` means do not ask a person; it never names the next skill.
