---
name: reverse-engineer
version: "1.0"
description: >
  Deconstruct a company, product, tweet or technique into a buildable spec with a unique
  twist. Use when: reverse engineer X, how would I build X, clone X but better, tear this
  apart, what's their stack, how do they make money, or a product/tweet URL with build
  intent.
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

Beyond research, this skill reverse-engineers how something works across every
dimension, identifies what makes it successful, finds its weaknesses, and produces a
concrete plan to build a differentiated version matched to this builder's strengths.

**Announce at start:** "I'm using the reverse-engineer skill to deconstruct [target] and produce a build brief with a unique twist."

**Outcome:** a sourced teardown and an actionable build brief for a family-matched target.
**Check:** Self-Verify below. **Boundary:** no Phase 1 on a family-mismatched target without
user confirmation; estimates are labelled, never presented as facts.

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

Before spending cycles on Phase 1 intelligence gathering, validate that the named targets are from the right product family for the caller's product. Processing a dev-tool teardown for a local-business landing page is not a research failure — it is a *family mismatch* that the caller cannot detect without this check.

### Step 1 — Load caller's product context (cheap)

Read, in order, stopping when you have enough signal:
1. `docs/specs/vision.md` — one-line product description + domain
2. `docs/specs/personas/P1*.md` (or first persona alphabetically) — first 20 lines — to identify primary audience
3. If both are absent: prompt the user for one-line product + primary audience before proceeding

### Step 2 — Classify the caller's product family

Pick one primary family (two if genuinely hybrid):

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
| Target family ≠ caller family with no cross-family intent stated | **Stop** before Phase 1 and report (Step 5). |

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

Research every dimension that applies — a teardown with blind spots produces a twist built on guesses.

Cover product (1A: value prop, users, pricing, key features, UX patterns, content/SEO,
social proof), business (1B: revenue model and estimate, growth channels, team, funding,
moat, weakness), technical (1C: stack, architecture, API, integrations, data model,
performance) and — for a technique or workflow input — technique intelligence (1D: what it
is, origin, who uses it, why it works, limitations, supporting tools). Dimension tables with
where-to-look hints: `references/intelligence-dimensions.md`. Every claim carries its source;
estimates (revenue, stack) are labelled as estimates with confidence.

## Phase 2: Teardown

Synthesize intelligence into a structured teardown document.

### The Teardown Document

Write to `docs/specs/reverse-engineer/<name>-teardown.md`:

Sections: One-Liner, Target Users, Revenue Model, Core Loop, Feature Map (execution
quality and difficulty to replicate), Tech Stack (with confidence), Growth Engine, Moat
Analysis, Weaknesses (with evidence), What Makes It Work (the 3 things — market truths, not
features), and What's Overrated About It. Template: `references/output-templates.md`.

## Phase 3: Unique Twist Generation

This is the creative core: find the angle that makes your version worth building, rather
than a copy.

### 3A. Load Builder Context

From `~/.svc/builder-profile.md` (if it exists), take skills, distribution channels, time
constraints and financial situation. Without a profile, ask what they are best at (stack,
domain), who they can reach (audience, network, community), and how much time they have.

### 3B. Generate 5 Twist Angles

For each twist, explain why it's differentiated — not just what's different.

| Angle type | How to generate |
|---|---|
| **Niche down** | Same product but for a specific audience they ignore. "X but for Y" where Y has unique needs |
| **Simplify** | Strip to the core value, remove everything else. 10x simpler, 2x cheaper |
| **Integrate** | Combine two products into one. "It's X + Y in one tool" |
| **Open source** | Closed-source product → open-source alternative. Capture the self-host crowd |
| **Different business model** | They charge monthly → you do one-time. They're enterprise → you're indie. They're free + ads → you're paid + private |
| **Builder advantage** | Use something unique about this builder — their audience, domain expertise, geographic market, language, existing product |
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

Sections: header (based on, twist, builder), Vision Draft, Target User, Core Features
(MVP), Features to SKIP (deliberately), day-1 Revenue Model, Growth Plan (first 100 users),
Tech Stack Recommendation, Risk Register, and Next Step (→ `write-vision`; the teardown
feeds `analyze-competitors`). Template: `references/output-templates.md`.

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
