---
name: reverse-engineer
version: "1.0"
description: >
  Deconstruct any company, product, tweet, or technique into a buildable spec
  with a unique twist. Use when: "reverse engineer X", "how does X work",
  "clone X but better", "deconstruct this", "I saw this tweet, build it",
  "copy this with a twist", "how would I build X", "X is making money, I want
  in", "analyze this product", any company/product URL, any tweet URL with a
  build intent, or when the user points at something and says "I want that".
  Also triggers on: "tear this apart", "what's their stack", "how do they
  make money", "reverse this business model".
phases:
  - id: P1-InputDetectionFamilyFit
    trigger: always
    reads: ["user target", "docs/specs/vision.md", "personas", "target URL or description"]
    writes: [".svc/reverse-engineer-family-fit.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-IntelligenceGathering
    trigger: family-fit-cleared
    reads: ["target product/company/tweet/repo", "research sources", "web evidence"]
    writes: [".svc/reverse-engineer-intelligence.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-TeardownDocument
    trigger: family-fit-cleared
    reads: ["intelligence log", "Phase 2 teardown template"]
    writes: ["docs/specs/reverse-engineer/<name>-teardown.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-TwistGeneration
    trigger: family-fit-cleared
    reads: ["teardown", "~/.svc/builder-profile.md", "twist angle table"]
    writes: [".svc/reverse-engineer-twists.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-BuildBrief
    trigger: family-fit-cleared
    reads: ["chosen twist", "build brief template", "builder context"]
    writes: ["docs/specs/reverse-engineer/<name>-build-brief.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-KnowledgePersistence
    trigger: trackable-target
    reads: ["teardown", "references/knowledge/INDEX.md", "knowledge protocol"]
    writes: ["references/knowledge/competitors/<name>/CAPABILITIES.md when applicable", "references/knowledge/INDEX.md when applicable"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-RoutingNextStep
    trigger: always
    reads: ["build brief", "teardown", "user goal"]
    writes: [".svc/reverse-engineer-routing.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "teardown/build brief"]
    writes: [".svc/reverse-engineer-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
    - { path: "docs/specs/vision.md", artifact: vision }
outputs:
  produces:
    - { path: "docs/specs/reverse-engineer/<name>-teardown.md", artifact: teardown }
    - { path: "docs/specs/reverse-engineer/<name>-build-brief.md", artifact: build-brief }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Reverse Engineer

Deconstruct anything into a buildable plan with a unique twist.

Input: a company, product, tweet, technique, workflow, or URL.
Output: a complete teardown + a build brief ready for `write-vision`.

This skill does NOT just research. It reverse-engineers HOW something works
across every dimension, identifies what makes it successful, finds its
weaknesses, and produces a concrete plan to build a differentiated version
matched to this builder's strengths.

**Announce at start:** "I'm using the reverse-engineer skill to deconstruct [target] and produce a build brief with a unique twist."

## Input Detection

Parse the user's input to determine what they're pointing at:

| Input type | Detection | Research approach |
|---|---|---|
| Company name | No URL, recognizable brand | WebSearch for product, pricing, tech stack, team, funding |
| Product URL | `https://...` pointing at a product | Browse the product directly + research around it |
| Tweet URL | `https://twitter.com/...` or `https://x.com/...` | Extract the idea/technique from the tweet, then research the space |
| App store link | Apple/Google Play URL | Read the listing, reviews, screenshots, then research |
| GitHub repo | `https://github.com/...` | Clone and analyze (use research skill's analysis mode) |
| Technique description | "the way X does Y" | Research the technique, who uses it, how it works |
| Screenshot/image | User provides image | Read the image, identify the product/pattern, then research |

## Phase 0.5: Reference-Family Fit Check

Before spending cycles on Phase 1 intelligence gathering, validate the named targets are from the right PRODUCT FAMILY for the caller's product. Processing a dev-tool teardown for a local-business landing page is not a research failure — it is a *family mismatch* that the caller cannot detect without this check.

### Step 1 — Load caller's product context (cheap)

Read, in order, stopping when you have enough signal:
1. `docs/specs/vision.md` — one-line product description + domain
2. `docs/specs/personas/P1*.md` (or first persona alphabetically) — first 20 lines — to identify primary audience
3. If both are absent: prompt the user for one-line product + primary audience before proceeding

### Step 2 — Classify the caller's product family

Pick ONE as the primary family (two if genuinely hybrid):

| Family | Signals | Emotional register |
|---|---|---|
| **Dev tools** | developer audience, code/API/infra/CLI, technical buyer | engineer-cool, dark-mode, austere |
| **Enterprise B2B / workflow** | ops/finance/HR/CS teams, admin buyer | trust, density, structured |
| **Consumer social** | mass-market, expressive, UGC, feed-driven | bold, playful, expressive |
| **Local-marketplace / discovery** | location-based, SMB + consumer, discovery flows | alive, warm, populated |
| **Hospitality / physical-world ops** | restaurants, salons, retail, local services | neighborhood, tangible, human |
| **Creator / media** | individual creators, audience monetization | personality, premium, content-first |
| **Prosumer / productivity** | knowledge workers, individual power users | clean, fast, design-forward |
| **Fintech / money** | banking, payments, trading | trust, precision, conservative |
| **Health / life / regulated** | healthcare, legal, compliance-heavy | calm, authoritative, conservative |

### Step 3 — Classify each named target's family

For each target the user named, pick the same-taxonomy family. If uncertain, WebSearch the target for 30 seconds of audience/positioning signal.

### Step 4 — Compare

| Scenario | Action |
|---|---|
| Target family == caller family | PROCEED to Phase 1 |
| Target family ≠ caller family, but user is explicitly seeking cross-family patterns (e.g., "I know it's not the same family, I want to steal the interaction pattern") | PROCEED to Phase 1 with a register-warning in the Twist section |
| Target family ≠ caller family with no cross-family intent stated | **STOP.** Do not proceed to Phase 1. |

### Step 5 — On mismatch, report and offer alternatives

Report to the user:
- Named targets' family: `<X>`
- Caller's product family: `<Y>`
- Why the mismatch matters: one sentence on register/audience incompatibility
- **3–5 family-matched alternatives** from family `<Y>` with one-line reasoning per alternative
- Ask: **(A)** switch to suggested alternatives, **(B)** proceed with original targets explicitly aware of the register mismatch (will be annotated in the build brief), or **(C)** provide different targets

Only proceed to Phase 1 after the user confirms. In auto mode with no user present: default to (A) if alternatives are high-confidence, otherwise (B) with a strongly-worded register-mismatch warning in the build brief's Twist section.

### Anti-patterns

- "The user named these targets, so they must be right." No. Targets are user input; family-fit is skill responsibility.
- "Cross-family pattern extraction is always valid." No. Pattern is cheap; register is expensive. A hero shape can transfer across families; a hero *feel* usually cannot.
- "Skipping Phase 0.5 saves time." No. A full Phase 1-4 run on wrong-family targets costs 10x more than a 30-second family check.

## Phase 1: Intelligence Gathering

Gather everything. Leave no dimension unresearched.

### 1A. Product Intelligence

| Dimension | What to find | How |
|---|---|---|
| **What it does** | Core value prop in one sentence | Landing page, About page, app store description |
| **Who it's for** | Target users, personas, use cases | Marketing copy, testimonials, case studies, subreddit |
| **Pricing** | Plans, pricing model, free tier, enterprise | Pricing page, comparison sites |
| **Key features** | Top 5-10 features that differentiate | Feature page, changelog, product hunt launch |
| **UX patterns** | Onboarding flow, core loop, retention hooks | Browse the product if possible, screenshots, demo videos |
| **Content/SEO** | Blog, docs, guides — what drives organic traffic | Site structure, blog topics, keyword targets |
| **Social proof** | Stars, users, testimonials, press, awards | Landing page, GitHub, social media, review sites |

### 1B. Business Intelligence

| Dimension | What to find | How |
|---|---|---|
| **Revenue model** | How they make money (SaaS, marketplace, ads, API) | Pricing page, job posts (reveals scale), press interviews |
| **Revenue estimate** | ARR/MRR if available, or proxy signals | Crunchbase, BuiltWith, job count, pricing x estimated users |
| **Growth channels** | How they acquire users (organic, paid, viral, API) | Similarweb, social media presence, backlink analysis |
| **Team size** | Headcount, key roles, hiring signals | LinkedIn, About page, job board |
| **Funding** | Raised? From whom? Bootstrapped? | Crunchbase, press, founder interviews |
| **Moat** | What makes them hard to compete with | Network effects, data, brand, regulatory, tech |
| **Weakness** | Where they're vulnerable | Bad reviews, missing features, pricing complaints, slow iteration |

### 1C. Technical Intelligence

| Dimension | What to find | How |
|---|---|---|
| **Tech stack** | Frontend, backend, database, infra | BuiltWith, Wappalyzer, job posts, GitHub, blog posts |
| **Architecture** | Monolith, microservices, serverless, edge | Engineering blog, conference talks, job descriptions |
| **API** | Public API? Docs? Rate limits? Pricing? | /api, /docs, developer portal |
| **Integrations** | What does it connect to? | Integrations page, marketplace, Zapier/Make |
| **Data model** | What entities exist? Relationships? | API docs, UI structure, database mentions in blog |
| **Performance** | Fast? Slow? Real-time? | Browse it, check Lighthouse scores, check latency |

### 1D. Technique Intelligence (if input is a technique/workflow)

| Dimension | What to find | How |
|---|---|---|
| **What it is** | The technique in concrete steps | Source tweet/article, related discussions |
| **Who invented it** | Origin, evolution, variations | Search for earliest mention, related techniques |
| **Who uses it** | Companies, teams, individuals applying it | Case studies, blog posts, conference talks |
| **Why it works** | The mechanism — not just "it's good" | First principles analysis, empirical evidence |
| **Limitations** | When it fails, edge cases, prerequisites | Criticisms, failure stories, context dependencies |
| **Tools that support it** | Software, frameworks, templates | Product Hunt, GitHub, tool comparisons |

## Phase 2: Teardown

Synthesize intelligence into a structured teardown document.

### The Teardown Document

Write to `docs/specs/reverse-engineer/<name>-teardown.md`:

```markdown
# Teardown: <name>

## One-Liner
<What it does in one sentence>

## Target Users
<Who uses it and why, with specific personas>

## Revenue Model
<How it makes money, estimated revenue, pricing tiers>

## Core Loop
<The user behavior loop that drives retention>
1. User does X
2. Product provides Y
3. User gets value Z
4. User returns because W

## Feature Map
| Feature | Purpose | Execution quality (1-10) | Difficulty to replicate |
|---|---|---|---|
| ... | ... | ... | easy / medium / hard / moat |

## Tech Stack (best estimate)
| Layer | Technology | Confidence |
|---|---|---|
| Frontend | ... | high/medium/low |
| Backend | ... | ... |
| Database | ... | ... |
| Infra | ... | ... |

## Growth Engine
| Channel | Estimated % of traffic | Replicable? |
|---|---|---|
| ... | ... | yes/no/partially |

## Moat Analysis
| Moat type | Strength (1-10) | How to overcome |
|---|---|---|
| ... | ... | ... |

## Weaknesses
| Weakness | Evidence | Opportunity |
|---|---|---|
| ... | (bad reviews, missing feature, complaint) | (what you'd do differently) |

## What Makes It Work (the 3 things)
1. <The #1 reason this succeeds — not a feature, a truth about the market>
2. <The #2 reason>
3. <The #3 reason>

## What's Overrated About It
<Things that look important but aren't actually why it works>
```

## Phase 3: Unique Twist Generation

This is the creative core. Do NOT just copy — find the angle that makes
your version worth building.

### 3A. Load Builder Context

Read builder profile (`~/.svc/builder-profile.md`) if it exists.
Extract: skills, distribution channels, time constraints, financial situation.

If no builder profile exists, ask:
- What are you best at? (tech stack, domain expertise)
- Who can you reach? (existing audience, network, community)
- How much time do you have? (full-time, evenings, weekends)

### 3B. Generate 5 Twist Angles

For each twist, explain WHY it's differentiated — not just what's different.

| Angle type | How to generate |
|---|---|
| **Niche down** | Same product but for a specific audience they ignore. "X but for Y" where Y has unique needs |
| **Simplify** | Strip to the core value, remove everything else. 10x simpler, 2x cheaper |
| **Integrate** | Combine two products into one. "It's X + Y in one tool" |
| **Open source** | Closed-source product → open-source alternative. Capture the self-host crowd |
| **Different business model** | They charge monthly → you do one-time. They're enterprise → you're indie. They're free + ads → you're paid + private |
| **Builder advantage** | Use something unique about THIS builder — their audience, domain expertise, geographic market, language, existing product |
| **Technique flip** | They do it X way → you do it Y way because of a first-principles insight about why X is suboptimal |
| **Speed/UX flip** | They're complex → you're instant. They require setup → you work out of the box |
| **AI-native** | They built pre-AI → you build AI-first. Core experience changes when AI is the default |
| **Vertical integration** | They're a tool → you're a solution. Bundle the tool with the service/content |

Present all 5 with:
- **The twist** — one sentence
- **Why it works** — what market truth supports this
- **Builder fit** — how well this matches the builder's skills/distribution
- **Effort estimate** — MVP in days/weeks
- **Risk** — what could kill this

### 3C. User Picks (or auto-recommend)

In interactive mode: present 5 twists, user picks.
In auto mode: recommend the one with best (builder fit x market size x speed).

## Phase 4: Build Brief

Produce a concrete build brief that feeds directly into `write-vision`.

Write to `docs/specs/reverse-engineer/<name>-build-brief.md`:

```markdown
# Build Brief: <chosen-twist-name>

**Based on:** <original product/company/technique>
**Twist:** <the differentiation in one sentence>
**Builder:** <name from profile or "not profiled">

## Vision Draft
<2-3 paragraphs: what you're building, for whom, why now, how it's different>

## Target User
<Primary persona with specific needs the original doesn't serve>

## Core Features (MVP — ship in <timeframe>)
| # | Feature | Why included | Inspired by original? | Twist applied? |
|---|---------|-------------|----------------------|---------------|
| 1 | ... | ... | yes/no | yes — <how it's different> |

## Features to SKIP (deliberately)
| Feature in original | Why skip |
|---|---|
| ... | <not core to twist / too expensive / moat-dependent> |

## Revenue Model
<How this version makes money, day 1>

## Growth Plan (first 100 users)
| Week | Action | Channel | Expected result |
|---|---|---|---|
| 1 | ... | ... | ... |

## Tech Stack Recommendation
<Based on builder's skills + speed requirement>

## Risk Register
| Risk | Likelihood | Mitigation |
|---|---|---|
| Original company copies your twist | ... | Ship fast, build community |
| ... | ... | ... |

## Next Step
→ Feed this brief into `write-vision` to start the svc pipeline.
  The teardown at `docs/specs/reverse-engineer/<name>-teardown.md`
  becomes input for `analyze-competitors`.
```

## Phase 5: Knowledge Persistence

If the target is a company or product worth tracking:

1. Write to `references/knowledge/competitors/<name>/CAPABILITIES.md`
   using the knowledge protocol
2. Update `references/knowledge/INDEX.md`
3. The teardown becomes a reusable asset for future `analyze-competitors` runs

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `reverse-engineer` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InputDetectionFamilyFit --evidence command_output:.svc/reverse-engineer-family-fit.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-IntelligenceGathering --evidence command_output:.svc/reverse-engineer-intelligence.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-TeardownDocument --evidence file:docs/specs/reverse-engineer/<name>-teardown.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-TwistGeneration --evidence command_output:.svc/reverse-engineer-twists.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-BuildBrief --evidence file:docs/specs/reverse-engineer/<name>-build-brief.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-KnowledgePersistence --evidence file:references/knowledge/competitors/<name>/CAPABILITIES.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-RoutingNextStep --evidence command_output:.svc/reverse-engineer-routing.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/reverse-engineer-self-verify.log
```

If family fit blocks the teardown or the target is not worth tracking, still
record downstream phase ids with command-output evidence explaining the stop or
skip. Do not complete the task until all required phase ids appear in
`skill_receipt.phases_executed`.

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

After this skill completes:

- **If the user wants to build:** route to `write-vision` with the build brief
  as primary input. The teardown feeds `analyze-competitors`.
- **If the user wants to validate first:** route to `validate-feature` with the
  twist as the feature idea.
- **If the user just wanted intel:** done. Teardown is the deliverable.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 0 | Phase 0.5 family-fit check ran | Caller product family named, target family named, match or explicit user confirmation logged | |
| 1 | Teardown covers all dimensions | All tables in Phase 2 template are populated, no "unknown" without explanation | |
| 2 | "What Makes It Work" is non-obvious | The 3 things are market truths, not feature descriptions | |
| 3 | 5 twist angles generated | Each has twist + why + builder fit + effort + risk | |
| 4 | Build brief is actionable | Someone could start building from the brief without further research | |
| 5 | Features to SKIP are listed | Deliberate exclusions, not just omissions | |
| 6 | Revenue model is day-1 specific | Not "eventually we'll monetize" — how it makes money at launch | |
| 7 | Builder profile was consulted | Twists are matched to builder skills/distribution, not generic | |
| 8 | Knowledge persisted | Teardown saved, competitor knowledge written if applicable | |

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
