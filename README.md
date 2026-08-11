# Serious Serious Vibe Engineering (SSVE)

> **Serious Serious Vibe Engineering**
>
> Progressive Deterministic Development — a methodology for reliable agentic software engineering

SSVE turns an initial prompt into reliable software through progressive
narrowing, adversarial reviews, deterministic execution, and verified
promotion. The goal is fast delivery without trading away engineering rigor.

Vibe coding, but the vibe is engineering rigor.

## Why This Exists

Three pain points from years of vibe coding:

1. **Unpredictability.** Same prompt, different output every run. No
   deterministic path from intent to working code.
2. **No end-to-end automation.** Most frameworks stop at code generation.
   Nobody closes the loop from high-level intent through spec, design,
   implementation, testing, and verified delivery.
3. **No rejection path.** Agents always say yes and produce *something*.
   There is no honest "this won't work, here's what might" path.

The idea: you give a high-level intent — a product idea or a feature within
an existing product — and the system either **delivers it** through
progressive narrowing, or **rejects it with evidence and proposes
alternatives** that you can accept or reject.

**It starts with you, not the product.** Before building anything, the
pipeline mines your builder profile — financial situation, time budget,
skills, team, social presence, existing subscriptions, business entity
status, and strategic goal. A broke developer working evenings gets
different recommendations than a funded founder with a marketer co-founder.
The profile persists across projects and gets smarter after each one.

**Don't know what to build? The pipeline finds it.** If your goal is
"I need money" but you don't have an idea, say so. The system reverse-
engineers what's making money RIGHT NOW, matches it to your skills and
distribution channels, and presents the top 3 opportunities — each with
evidence of existing revenue, a 1-2 week build plan, and a self-sustaining
free-tier stack. Target: $1K/mo within 1 month of launch. If you have a
big idea but need money first, the system proposes a staging plan — a
fast-money project (ideally feeding your big idea) before the main build.
"Build my idea anyway" always works.

**One prompt to product.** In `--autorun` mode, a single high-level intent
(or a selected opportunity) runs the full pipeline end-to-end. The virtual
founder (P0) makes taste decisions informed by your builder profile and
logs them for review. The only hard stops are: feature rejection (NO-SHIP),
unresolvable test failures, critical security findings, and merge
conflicts. Everything else flows.

**Designed to fit Claude Max plan economics** — supports many isolated
worktree/subagent sessions and a four-layer token cache that maximizes prompt
cache hits across subagents. This is architecture support, not a runtime
scheduler: svc does not yet provide automatic multi-instance scheduling or a
global lock layer.

### What's Built vs. What's Next

| Capability | Status |
|---|---|
| Builder profile mining | Built — financial, time, skills, team, social/distribution, tools, entity, goals, project history, failure patterns; updates after every project; persists globally |
| Find what to build | Built — reverse-engineers current market winners, matches to builder skills/distribution, 1-2 week builds on free-tier infra, staging strategy for big ideas, $1K/mo target within month 1 |
| Progressive narrowing (vision → verified merge) | Built — 18 phases, 7 review gates |
| One prompt to product (`--autorun`) | Built — P0 decides at human checkpoints; only hard stops are NO-SHIP, test failure, security, merge conflict |
| Reject/pivot on infeasible intent | Built — 7 kill signals with evidence scoring; NO-SHIP produces structured rejection + alternative directions |
| Pipeline decision log | Built — structured audit trail at `.svc/pipeline-decisions.jsonl`, with bootstrap files under `.svc/` and safe append helper `scripts/pipeline-log.mjs` |
| Worktree isolation per feature | Built — `worktree.sh` with guard, create, promote, cleanup |
| Subagent dispatch for parallel tasks | Specified — prompt protocol in execute-changeset; relies on LLM following instructions, no runtime orchestrator |
| Multi-agent coordination | Architecture support, not scheduler — worktree isolation + token cache layers; no automatic multi-instance scheduling or global lock layer yet |

## Origin Story

I had my own methodology — fully testable specs, every acceptance criterion
covered by E2E tests, progressive narrowing from vision to verified code. The
soul of the approach was already there.

Then I started using other people's incredible work:
[gstack](https://github.com/garrytan/gstack) (Garry Tan),
[superpowers](https://github.com/obra/superpowers) (Jesse Vincent),
[Oh My Claude Code](https://github.com/yeachan-heo/oh-my-claudecode) (Yeachan Heo),
and [claude-code-setup](https://github.com/petekp/claude-code-setup) (Pete Petrash).
Each one solved problems the others didn't. None of them combined into a single
streamlined flow.

So I built this — an opinionated blend of how I actually work. The best patterns
from each project, wired into one pipeline. The goal is that one day these
patterns can be ported back to help each project solve specific weaknesses,
while giving me (and anyone else who wants it) a single coherent experience
right now.

This framework is source-available. You can use it freely to build your own
products. PRs are open but all changes require approval. See [`LICENSE`](LICENSE)
for full terms and contact `angelovsan@gmail.com` for commercial or redistribution
rights.

## The Problem

Large language models generate code through pattern matching. Given a spec,
an LLM produces different implementations on different runs — different
abstractions, different edge cases, different integration patterns. Each one
is confidently presented as correct. This is not a bug. It is how these
systems work.

Every methodology that goes from ticket to code, from spec to implementation,
from design to "let the agent figure it out" is accepting non-determinism as
a feature. Most of the time it works. Sometimes it doesn't. You find out in
QA, or in production, or when two agents implemented the same feature
differently in parallel branches.

SSVE rejects that.

## The Solution: Progressive Narrowing

Each phase constrains the space of possible outputs for the next phase. By the
time code is written, the implementation surface is tightly constrained — not by
pattern matching alone, but by the accumulated constraints from every prior phase.

```
Phase 1:  Vision              → infinite possibilities
Phase 2:  Personas            → narrows WHO
Phase 3:  Feature Spec        → narrows WHAT (stories, acceptance criteria)
Phase 4:  UX Design           → narrows HOW users experience it
Phase 5:  UI Design           → narrows HOW it looks
Phase 6:  Technical Design    → narrows HOW to build it
Phase 7:  Implementation      → narrows to ONE reviewed branch outcome
Phase 8:  Promotion           → squash-merges the worktree to main
Phase 9:  Verification        → proves the merge matches the manifest
```

At Phase 1, the agent is generating. By Phase 7, the agent is executing against
a constrained implementation plan inside a worktree branched from main. The
creative work happens in Phases 1-6 and in any explicit loop-backs. Phase 7 is
controlled execution with task reviews and checkpoints. Phase 8 is a squash
merge. Phase 9 is checking.

## Why This Works (Technical Argument)

An LLM's output variance is inversely proportional to the constraints in its
context window. More context = less variance. The progressive narrowing model
exploits this:

1. **Context loading.** Each phase reads ALL prior artifacts. The agent writing
   the change set has read the vision, personas, spec, UX design, UI design,
   technical design, journeys, and existing code. Every constraint is in context.

2. **Variance reduction.** A one-line ticket produces 50 implementations.
   A spec with 12 acceptance criteria produces 5. A detailed implementation
   manifest with explicit tasks, files, validations, and checkpoints reduces
   the remaining variance to a small, reviewable branch diff.

3. **Review before generation.** Traditional: agent generates code, human
   reviews code. SSVE: human reviews intent (spec, design, plan),
   then the agent executes that intent task by task on a branch. Reviewing
   intent early is cheaper than reviewing a fully improvised implementation late.

4. **Deterministic promotion.** The worktree IS the code. Promotion is
   `git merge --squash` to main. Deviations are detected by diffing the
   merged result against the manifest. Nothing is left to interpretation.

5. **Attention decay mitigation.** LLMs suffer from positional attention
   decay — tokens loaded early in context receive less attention during
   generation. Checkpoints (commits at each phase boundary) reset this by
   forcing the agent to re-read artifacts fresh. The worktree keeps all
   artifacts consistent and accessible as the agent's external memory.

## The Review Protocol

Every phase transition is gated by a structured review designed around LLM
failure modes:

```
Step 1: SELF-REVIEW      → agent reviews own work, produces findings
Step 2: SELF-JUDGMENT     → agent accepts/rejects own findings with reasoning
Step 3: CROSS-REVIEW      → second agent independently evaluates
Step 4: CONVERGENCE       → medium/low only = PASS; critical/high = fix; 3 iterations = escalate
```

This catches: agents missing own errors (Step 3), agents agreeing too easily
(Step 2 forces adversarial self-reasoning), review theater (severity classification
+ convergence criteria), infinite loops (3-iteration cap).

## Local-First, Mock-by-Default, Feature-Toggleable

The first iteration of anything you build with svc is demoable, stunning, and
runs locally with zero credentials. Every external dependency (payments, email,
storage, auth) ships with two implementations:

- **Mock** — ON by default. Works locally, returns realistic data, exercises
  the full acceptance criteria. This is what demos and E2E tests run against.
- **Real** — OFF by default. Behind a feature toggle. Enabled per-environment
  when ready (staging → production).

This is enforced at every phase: specs require mock strategies for all
integrations (G1), tech design defines the toggle architecture (G4), and
execution must pass a first-demo test locally with zero network access (G5).

Full convention: [`references/feature-toggles.md`](references/feature-toggles.md)

## The Pipeline

### Foundational Artifacts (created once, evolved)

| Artifact | Skill | Purpose |
|----------|-------|---------|
| Vision | `write-vision` | Product direction, boundaries, principles |
| Domain Profile | `analyze-domain` | Industry, tech stack, domain reference packs |
| Competitor Analysis | `analyze-competitors` | Comprehensive one-shot competitive deep-dive (new entrants) |
| Competitor Refresh | `refresh-competitors` | Weekly diff-based refresh of tracked competitor state |
| Capability Matrix | `catalog-domain-capabilities` | Classified industry capability catalog with gap analysis and build-priority scoring |
| Industry Grounding | `validate-feature` + `write-spec` | Default competitive grounding for every feature spec |
| Personas | `build-personas` | Who uses this (human and system consumers) |
| Design System | `design-ui` | Visual language: tokens, typography, colors, spacing |

### Builder Profile (created once, evolves)

| Artifact | Location | Purpose |
|----------|----------|---------|
| Builder Profile | `~/.svc/builder-profile.md` | Who is building: finances, time, skills, team, social presence, tools, entity, goals, project history, learned patterns. Persists across all projects and gets smarter after each one. |

### Per-Feature Pipeline

| Phase | Skill | Produces | Gate |
|-------|-------|----------|------|
| 3. Discovery | `validate-feature` | Feature Ship Brief or NO-SHIP rejection with evidence | Kill signal gate |
| 3. Spec | `write-spec` | User stories, ACs, system dependencies | G1 |
| 3b. AC Audit | `audit-ac` | Rewritten/added acceptance criteria | — |
| 3c. Journeys | `write-journeys` | BDD journey docs (.feature.md) with AC traceability | — |
| 4. UX Design | `design-ux` | Screen flows, states, interactions | G2 |
| 5. UI Design | `design-ui` | Component specs, design tokens, visual hierarchy | G3 |
| 5b. Visual Baseline | `track-visuals` | Breakpoint screenshots after UI design | — |
| 6. Technical Design | `design-tech` | Architecture, data model, feasibility | G4 |
| 6b. Alternatives | `explore-solutions` | Challenge baseline with alternative paradigms | — |
| 6c. Code Style | `define-code-style` | Code style contract for the project | — |
| 7. Plan | `plan-changeset` | Implementation manifest, task graph, AC/test mapping | — |
| 7b. Execute | `execute-changeset` | Code in worktree, staged diffs, checkpoint commits | G5 |
| 7c. Visual Diff | `track-visuals` | Screenshot diffs after UI-affecting code changes | — |
| 7d. Correctness | `audit-implementation` | Deep correctness audit before landing | — |
| 8. Promote | `land-changeset` | Squash merge to main, version bump, PR | G6 |
| 9. Verify | `verify-promotion` | VERIFIED status (spec-sync + QA + E2E proof) | G7 |

### Feature Spec Lifecycle

```
DRAFT → UX-REVIEWED → DESIGNED → BASELINED → CHANGE-SET-APPROVED → PROMOTED → VERIFIED
  ↓
REJECTED (NO-SHIP with evidence) → PIVOTED (alternative accepted) → DRAFT (re-enter pipeline)
```

## Feature Types

Every feature spec carries a type that identifies its consumer:

| Type | Consumer | Example |
|------|----------|---------|
| Feature | Human user | Match discovery, chat, payments |
| Enabler | Other service | Score recalculation cron, email service |
| Integration | External system | Stripe webhooks, OAuth provider |

All types go through the same pipeline. The type changes the consumer, not the
rigor. Specifying a Feature automatically reveals every Enabler and Integration
it depends on (the cascade effect).

## Workflow Lanes

SSVE routes work into lanes based on repo state and change type.
Use `route-workflow` to detect the right lane automatically, or pick one manually.

### Greenfield

Full progressive narrowing pipeline for new products or features in clean repos.

```
mine-builder → [find-opportunity] → [stage-revenue] →
write-vision → analyze-domain → analyze-competitors → catalog-domain-capabilities →
build-personas → validate-feature → write-spec → audit-ac → write-journeys →
design-ux → design-ui → track-visuals → design-tech →
explore-solutions → define-code-style → plan-changeset →
execute-changeset → track-visuals → review-gate → audit-implementation →
land-changeset → verify-promotion
```

`mine-builder` runs once (or quick-checks on return visits). `find-opportunity`
runs when the user doesn't have an idea. `stage-revenue` runs when the idea
is big but the builder needs money first. All three are skippable — "build
my idea anyway" jumps straight to `write-vision`.

Use when: starting a new project, adding a major feature to an empty or
near-empty repo, or the user says "build me an app" or "help me find what
to build."

### Brownfield Conversion

Onboard an existing repo into svc before applying other lanes.

```
onboard-repo → sync-work-items
```

Use when: the repo has shipped code, docs, tests, or conventions that must be
inventoried and mapped before svc can govern it. Does not rewrite anything
— logs findings as work items and routes each to the right lane.

### Brownfield Feature

Extend an existing system with delta specs instead of regenerating the full world.
User-facing and admin-facing changes must carry UX/UI design and breakpoint
evidence. Only pure background enablers/integrations can skip them with an
explicit rationale.

```
sync-spec-code → validate-feature → write-spec → write-journeys →
design-ux → design-ui → track-visuals → design-tech →
explore-solutions → define-code-style → plan-changeset →
execute-changeset → track-visuals → review-gate →
audit-implementation → land-changeset → verify-promotion
```

Use when: adding a feature to a repo that already has specs, journeys, and
working code. Starts with drift check to ensure the spec baseline is accurate.

### Bugfix

Root-cause-first correction. Skips code style by default.

```
diagnose-bug → plan-changeset → execute-changeset →
review-gate → audit-implementation → land-changeset → verify-promotion
```

Use when: a work item describes broken behavior, a regression, or a production
issue. The diagnosis produces a brief with root cause, fix surface, and proof
plan before any code is touched.

### Drift / Maintenance

Reconcile specs, journeys, and code without shipping new behavior.

```
sync-spec-code → write-journeys → sync-work-items
```

Use when: specs have drifted from code (PLANNED items are now implemented,
code contradicts spec, journeys reference stale behavior). Produces updated
annotations and work items.

### Refactor

Preserve behavior while making bounded structural changes.

```
sync-spec-code → plan-changeset → execute-changeset →
review-gate → audit-implementation → land-changeset → verify-promotion
```

Use when: renaming, restructuring, extracting, or cleaning up code without
changing user-facing behavior.

## The Worktree Model

All implementation phases happen in a single worktree branched from main.
Code lives in actual files, not markdown documents.

```
feature/match-discovery (worktree branch)
  src/...                  ← real code, real tests, real files
  docs/plans/manifest.md   ← what changed, why, task graph, validations
  checkpoint commits:
    phase-3-spec
    phase-4-ux-design
    phase-5-ui-design
    phase-6-technical-design
    task-1-types
    task-2-data-model
    task-3-tests
    ...
```

Each phase creates a checkpoint commit on the feature branch. The manifest
describes what changed, how tasks are grouped, and what validation should
happen, preserving reviewability. Promotion is `git merge --squash` to main —
one clean commit with the full context.

Full worktree model: [`WORKTREES.md`](WORKTREES.md)

## Token Efficiency

SSVE uses a four-layer cache architecture that reduces token costs by
50-60% compared to naive approaches:

| Layer | Scope | Cached across | Tokens |
|-------|-------|---------------|--------|
| 1. Project | Vision, personas, design system | All features, all tasks | ~15K |
| 2. Feature | Spec, UX, UI, tech design | All tasks of one feature | ~20K |
| 3. Code | Only files referenced by spec annotations | Parallel sub-agents | ~30K |
| 4. Task | Task instructions (unique) | Never cached | ~10K |

Key optimizations:
- **Phases 3-6 don't load source code.** The spec IS the codebase index
  (RESOLVED annotations with file:line). Code is loaded only in Phase 7.
- **Stable loading order** maximizes cache prefix matches across tasks.
- **Parallel sub-agents** share Layer 1-3 cache when dispatched together.
- **Phase-skipping** for non-UI features (Enablers skip Phases 4-5).

## Setup

### Platform

svc runs inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code),
which executes bash commands, git operations, and file I/O through a Unix shell.
This means:

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux** | Best | Native shell, fastest file I/O, no abstraction layers |
| **macOS** | Best | Native shell, fully supported |
| **Windows + WSL2** | Supported | Run inside WSL2 — not native Windows. Work in the Linux filesystem (`~/`), not `/mnt/c/` |
| **Windows native** | Not supported | Claude Code requires bash. cmd.exe and PowerShell don't work |

**If you're on Windows, use WSL2.** The entire svc pipeline — worktree
management, eval scripts, lint checks, skill execution — uses bash and assumes
a POSIX environment. WSL2 gives you a real Linux kernel with native ext4
performance. Working inside `/mnt/c/` (the Windows filesystem) is 3-5x slower
for git operations due to the 9P filesystem bridge — always keep your repo in
the Linux home directory.

### Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Node.js** | 18+ | 20+ (LTS) |
| **Git** | 2.25+ | Latest |
| **Claude Code** | Latest | Latest |
| **GitHub CLI** (`gh`) | Optional | Install for `land-changeset` PR creation |
| **Anthropic account** | Required | Claude Pro ($20/mo) or Max ($200/mo for 100 instances) |

### Before Your First Product

The pipeline builds and deploys. You handle payments and posting.
Set these up once (15 min total) before running:

| What | Why | How |
|---|---|---|
| **Dodo Payments** | Accept payments with no company, handles VAT | [dodopayments.com](https://dodopayments.com) — sign up, verify identity |
| **GitHub account** | Code hosting + deployment triggers | You probably have this |
| **Vercel or similar** | Free hosting that scales | Connect GitHub repo, auto-deploys |

**MCP integrations** — the pipeline discovers and uses these automatically
if available. They replace manual steps:

| MCP | What it automates |
|---|---|
| Supabase MCP | Database creation, auth setup, storage |
| Stripe/Dodo MCP | Payment link creation, product setup |
| Vercel MCP | Deployment, environment variables, domains |
| Playwright MCP | Browser testing, QA, visual verification |
| GitHub MCP | PR creation, issue tracking |

The pipeline's `discover-skills` and `research` skills find available MCPs
at runtime. You don't need to install them all upfront — the pipeline will
tell you what it needs when it needs it.

### Install

```bash
# 1. Install Claude Code (if not already installed)
npm install -g @anthropic-ai/claude-code

# 2. Clone and install svc
git clone https://github.com/s7an-it/seriousvibecoding.git ~/.claude/skills/svc
cd ~/.claude/skills/svc && ./setup

# 3. Verify — start Claude Code in any project
cd your-project && claude
```

The `setup` script symlinks all 50 skills + framework infrastructure
(DOCTRINE.md, REPO_MODES.md, scripts/, etc.) into `~/.claude/skills/`.
Symlinks mean `git pull && ./setup` updates everything in place.

`setup` also wires the svc enforcement hooks into `~/.claude/settings.json`
(global, applies to all projects). This includes the eval-gate hooks that
enforce pillar assessment at task completion. Restart Claude Code after
running setup to activate them.

**For Codex:** `./setup --host codex` installs to `~/.codex/skills/`, wires hooks into `~/.codex/hooks.json`, and enables `[features] hooks = true` in `~/.codex/config.toml`.

**For Kimi:** `./setup --host kimi` installs to `~/.kimi/skills/`. Kimi hooks are wired into `~/.kimi/config.toml`.

**For OpenCode:** `./setup --host opencode` installs to `~/.config/opencode/skills/`.

**For Antigravity:** `./setup --host antigravity` installs to `~/.gemini/antigravity/skills/`. This is a skills-only target; hooks are not enforced until a verified Antigravity wirer exists.

**For Cursor:** `./setup --host cursor` installs to `~/.cursor/skills/`. This is a skills-only target; hooks are not enforced until a verified Cursor wirer exists.

**Update:** `cd ~/.claude/skills/svc && git pull && ./setup`

### Optional: browser-based skills

`test-journeys`, `write-e2e`, and `track-visuals` need a browser for runtime
QA, E2E test authoring, and screenshot diffing. The primary integration is
[gstack](https://github.com/garrytan/gstack)'s browse daemon — if you have
gstack installed, `/browse` is available and auto-starts on first use.

Fallback chain if gstack browse is not available:
1. Playwright MCP (if configured) — functional but no persistence
2. Manual browser — the skill instructs you what to do

See [`references/browse-integration.md`](references/browse-integration.md)
for the full browser integration spec.

### Optional: live market research

[last30days](https://github.com/mvanhorn/last30days-skill) searches Reddit,
HN, X, YouTube, and Polymarket for real engagement signals from the past 30
days. When installed, `validate-feature` and `analyze-competitors` use it
to ground business questions in live data instead of LLM training data.

```bash
git clone https://github.com/mvanhorn/last30days-skill.git ~/.claude/skills/last30days
```

Zero-config start: Reddit, HN, and Polymarket work with no API keys.

### Optional: voice mode on WSL2

Claude Code supports voice input. On WSL2, audio requires PulseAudio or
PipeWire bridging between Windows and the Linux kernel — it doesn't work
out of the box. Run `/wsl2-audio` to diagnose and fix the full audio chain
(Application → ALSA → PulseAudio → WSLg → Windows speakers/mic).
This covers both Claude Code voice mode and general audio in WSL2.

## Repository Modes

- **bootstrap** — greenfield, no established workflow. SSVE creates the
  structure from scratch.
- **convert** — brownfield, existing code and conventions. SSVE inventories
  first, adapts second.

Mode contract and detection logic: [`REPO_MODES.md`](REPO_MODES.md)

## Included Skills

<!-- svc:generated:begin readme-included-skills — edit skills-manifest.json / references/model-registry.json, then run: node scripts/generate-manifest-mirrors.mjs --write -->
- `ad-video-script` — Performance ad-video script writer (Senior DR Creative Strategist). Reads the real product first, then emits a placement-aware modular script + render-ready 6×10s beat sheet (per-beat image+motion prompts, character lock, last-frame seeding). One base or many variants; hands the beat sheet to the ad-video-producer agent.
- `align-feature` — Execute the story-receipts chain for one WI until STORY ALIGNED — the fixing counterpart of audit-feature
- `analyze-competitors` — Comprehensive one-shot competitive deep-dive for new entrants
- `analyze-domain` — Build domain expertise and reference packs
- `analyze-marketing` — Mine feature specs for marketing angles
- `assess-market-readiness` — Multi-role readiness judge scoring whether the product is ready for launch, hackathon, VC pitch, or PMF
- `audit-ac` — Audit and rewrite acceptance criteria for completeness
- `audit-coverage` — Audit a project against the full svc canonical artifact catalog (CANONICAL/FOREIGN/MISSING classification with consolidation recommendations)
- `audit-feature` — Full drift audit for one feature or journey — branch-index census plus independent verification, seeding the story-receipts chain
- `audit-implementation` — Deep correctness audit before landing
- `audit-session-execution` — Reconstruct a real run from WI/task graph/logs/transcript and compare expected vs actual execution to produce framework-grade gap evidence
- `base44-environment` — Operate the Example Marketplace Base44 backend environment: API calls, secrets checks, schema/function deployment, and integration debugging
- `benchmark-landing` — Score a landing page against sector reference bank on 8 dimensions
- `blend-external` — Analyze external repos and blend in useful patterns with version tracking
- `blend-private` — Blend patterns from a private repo you own or have rights to, without leaving source identifiers in the tree (authorization gate + redaction map + 30% diff ceiling)
- `blind-control-plan` — Best-of-2 retention floor: prove the framework plan is never worse than a bare-model blind baseline (cross-family judge + control-plan ROI receipt; WARN/shadow, default OFF)
- `build-personas` — Build user personas from vision and challenge libraries
- `capability-concierge` — Three-lens recommendations (ship / idle-resource / side-earning) grounded in registry + snapshot
- `capability-registry` — Per-builder inventory of AI/dev resources (paid + trial + free) with sub-budgets and reset cadence
- `capture-idea` — Zero-friction backlog intake: stores a raw idea as a canonical WI without triggering validation or spec authoring
- `catalog-domain-capabilities` — Classified industry capability catalog with gap analysis and build-priority scoring
- `comms` — Draft-only company communications proposals; never sends or publishes.
- `cos` — Chief-of-staff synthesis for company briefings and ranked priorities.
- `counsel` — Legal issue spotting and reviewable risk proposals; not legal advice.
- `craft-prompt` — Craft a world-class output-shaped prompt for a task and prove it never worse than a baseline/viral prompt via a cheap best-of-2 floor (rubric + WI-410 floor; WARN/shadow, default OFF)
- `create-skill` — Create new skills with eval infrastructure (forked from anthropics/skills)
- `customer-cs` — Customer-success analysis for churn, onboarding, and support patterns.
- `decide` — Present a decision to the founder so it can actually be decided — one choice at a time, options as outcomes, grounded confidence per option
- `define-code-style` — Define or audit the project code style contract
- `design-logo` — Produce an iterative SVG logo/lockup pack with rubric-gated refinement and live in-app evidence
- `design-tech` — Define architecture, data model, feasibility matrix
- `design-ui` — Define component specs, design tokens, visual hierarchy
- `design-ux` — Define screen flows, state machines, interaction patterns
- `diagnose-bug` — Root-cause investigation before any fix
- `discover-skills` — Find and install external skills
- `discuss-phase` — Resolve bounded gray areas into a durable discussion artifact with next-step routing
- `dispatch-waves` — Plan conflict-aware parallel WI waves, select worker transport, and validate merge-back evidence
- `evaluate-rule` — Decide whether a candidate rule (CLAUDE.md/AGENTS.md injection) beats Claude's default behaviour via a bias-isolated 2-pass probe, with optional cross-model challenge for global-scope rules. Prevents rule inflation.
- `evolve-framework` — Find improvement opportunities in the pipeline with grounded evidence
- `execute-changeset` — Execute the plan in a worktree with TDD and checkpoints
- `explore-solutions` — Challenge the chosen approach with alternative paradigms
- `explore-ux` — Interactive competitive UX exploration on live app surfaces. Browses, benchmarks against competitor knowledge, proposes improvements with citations
- `extract-bootstrap` — Extract patterns from a codebase into templates
- `fin-analyst` — Evidence-backed runway, unit-economics, and budget analysis.
- `find-opportunity` — Reverse-engineer market winners, match to builder, score top 3
- `generate-visuals` — Image/visual asset router. Takes one asset brief and routes it across image-gen providers (Codex CLI, Gemini Nano-Banana Pro / Imagen 4, Stitch MCP, Figma+Weave MCP, Claude Design, gpt-image-2 (with gpt-image-1.5 fallback), Storyset, Veo 3). License-gated; provenance log per candidate set.
- `growth-eng` — Growth instrumentation and measurement proposals; never deploys.
- `growth-lead` — Growth strategy proposals for acquisition, activation, and retention.
- `honest-diagnosis` — Evidence-graded "why haven't I shipped" answer with file/line citations; no platitudes
- `improve-framework` — Self-improvement loop: evidence → diagnosis → fix → verify → record
- `infra-sre` — Reliability, incident-readiness, SLO, and capacity review.
- `ingest-guide` — Paste long-form social content; extract, validate claims via experiments, route to discard / reference knowledge / new skill
- `ingest-guide-batch` — Parallel candidate orchestrator — fan out N pasted guides into isolated worktree sessions, aggregate decisions into one digest
- `land-changeset` — Validate, version, PR, squash-merge, clean up
- `landing-page` — End-to-end landing-page generation orchestrator. Chains marketing-context + reference-bank + copywriting + generate-visuals + component scaffold + benchmark-landing gate. Blocks below 7.5 weighted. Slots between `design-ui` and `execute-changeset` for any landing/marketing/home/pricing/feature page.
- `launch-knowledge` — Universal launch knowledge base for software founders (legal vehicles by jurisdiction, startup credit programs, hosting/platform bundles, first-100-customer distribution playbooks) layered with a thin per-builder profile that accretes over time
- `list-work-items` — Show the local svc backlog ordered by dependency and priority
- `manage-finops` — FinOps expert for cloud infrastructure selection, cost optimization, solo-developer launch planning, and MMR (Monthly Recurring Revenue) strategy
- `manage-learnings` — Review, search, prune, export project learnings
- `market-intel` — Market, competitor, trend, and positioning evidence synthesis.
- `mine-builder` — Mine builder profile (finances, skills, social, tools, project history, patterns)
- `monetization-architecture` — Map features to pricing tiers with evidence-graded justification, select gating mechanisms, and audit code enforcement against stated pricing policy
- `onboard-repo` — Inventory and map a brownfield repo
- `plan-blast-radius` — SEV-tier classifier for infra plan changes (SEV-1/2 forces human checkpoint). Phase 8 of infra-* lanes. From WI-SPINE-004.
- `plan-capabilities` — Classify project type, recommend MCPs/skills/research, maintenance plan
- `plan-changeset` — Produce implementation manifest with task graph
- `platform-operating-architect` — Classify platform operating model, split local/dev/staging/prod, define integration boundaries, and encode how svc should coexist with hosted platforms
- `privacy-dpo` — Privacy, personal-data, DPIA, and retention review.
- `procurement` — Vendor diligence and buying-decision proposals; never purchases.
- `product-lead` — Product prioritization, problem validation, and roadmap tradeoffs.
- `quick-fix` — Fast lane for trivial changes (3 or fewer files, no architecture impact)
- `recall-stack-knowledge` — Knowledge Spine recall gate (see WI-SPINE-001)
- `refresh-competitors` — Weekly diff-based refresh of tracked competitor state
- `research` — Resolve uncertainty about APIs, libraries, patterns
- `reverse-engineer` — Deconstruct any company/product/tweet/technique, produce teardown + build brief with unique twist
- `review-cross-model` — Adversarial review via a second model
- `review-exec` — Mandatory G6 gate: self-review + adversarial review of executed diff before land (mandatory-chain plan)
- `review-gate` — Run the 5-step adversarial review at gates G1-G7
- `review-plan` — Plan-level adversarial review gate between plan-changeset and execute-changeset
- `review-security` — OWASP Top 10 + STRIDE + supply chain audit
- `revops` — Revenue-funnel, pipeline-process, and lead-handoff proposals.
- `roadmap-evaluation` — Synthesize project artifacts into prioritized milestones with cost estimates and timeline to first paying customer
- `route-workflow` — Detect lane and route to the next skill
- `security-ops` — Security risk, threat-model, incident-control, and control review.
- `stage-revenue` — Break big ideas into revenue stages (fast money first, then the real thing)
- `strategic-decision` — N-way strategic decisions spanning multiple features, vendors, or years (vendor selection, build-vs-buy, framework/database/hosting/AI-model selection, pricing-model selection, strategic pivot)
- `suno-architect` — Convert Suno song, album, and lyric briefs into copy-paste-ready generation recipes with structured style, lyrics, and phonetic guidance
- `svc-advisor` — Q&A grounded in stored framework knowledge (svc capabilities, gaps, competitor comparisons)
- `sync-spec-code` — Reconcile spec annotations against codebase
- `sync-work-items` — Push repo-canonical work items to GitHub Issues
- `tax-auditor` — Tax evidence and filing-readiness review; not tax advice or filing.
- `teach-project` — Teach the builder what was built and how to manage it (owner guide)
- `test-framework` — Benchmark the svc pipeline itself
- `test-journeys` — Journey-first QA against a live URL
- `track-topology-diff` — Post-apply structural state-graph snapshot + diff. Phase 15 of infra-* lanes. From WI-SPINE-004. — Knowledge Spine recall gate. Reads stack-profile + caller's `requires_topics[]` and injects the minimal Spine slice across L1 world / L2 project intent / L3 learnings / L4 decisions / L5 identity. Logs every recall to `.svc/knowledge-recall.jsonl`. Phase A: advisory. Phase E: blocking for `infra-*` lanes. Anti-rediscovery foundation per proposal `2026-04-30-infra-project-support.md` § 3.
- `track-visuals` — Capture and diff screenshots across breakpoints
- `validate-feature` — Validate a feature idea with 8 business questions + kill signal gate
- `verify-promotion` — Post-merge verification (spec-sync + QA + E2E)
- `write-e2e` — Write E2E test files from journey docs
- `write-journeys` — Generate BDD journey docs with AC traceability
- `write-spec` — Write feature spec with user stories and ACs
- `write-vision` — Create or refine the product vision
- `wsl2-audio` — Set up, diagnose, and fix audio/voice mode on WSL2
<!-- svc:generated:end readme-included-skills -->

Framework lane rule of thumb:
`audit-session-execution` turns a messy real session into expected-vs-actual evidence.
`evolve-framework` finds and prioritizes the gaps.
`improve-framework` is for cases where findings/proposals already exist and you want to validate, implement, and replay-verify fixes.

## Full Doctrine

The complete methodology — technical argument for progressive narrowing,
review protocol specification, worktree model, promotion process, token cost
analysis, and execution model:

[`DOCTRINE.md`](DOCTRINE.md)

## Skill Pack Comparison

How svc compares to gstack and superpowers:

[`references/skill-pack-comparison.md`](references/skill-pack-comparison.md)

## External Add-Ons

Optional skill ecosystems: [`EXTERNAL_ADDONS.md`](EXTERNAL_ADDONS.md)

- `coreyhaines` marketing pack (12 skills: CRO, copy, SEO, launch strategy)

## Standing on the Shoulders of

Patterns, ideas, and code from these MIT-licensed projects made this possible:

- **[gstack](https://github.com/garrytan/gstack)** (Garry Tan) — founder persona, adversarial reviews, security audits, design exploration, ship workflow
- **[superpowers](https://github.com/obra/superpowers)** (Jesse Vincent) — task graph planning, TDD execution discipline, subagent-driven development
- **[Oh My Claude Code](https://github.com/yeachan-heo/oh-my-claudecode)** (Yeachan Heo) — ambiguity scoring, commit trailers, verified completion loops, tri-model review
- **[claude-code-setup](https://github.com/petekp/claude-code-setup)** (Pete Petrash) — solution exploration, systems analysis
- **[last30days](https://github.com/mvanhorn/last30days-skill)** (mvanhorn) — live market research for feature validation and competitive intelligence

Full attribution: [`NOTICES`](NOTICES)

## License

Proprietary source-available. Free to use as a development tool.
No redistribution, reselling, or commercializing the framework itself without permission.

See [`LICENSE`](LICENSE) for full terms — contact `angelovsan@gmail.com` for permissions.
l attribution: [`NOTICES`](NOTICES)

## License

Proprietary source-available. Free to use as a development tool.
No redistribution, reselling, or commercializing the framework itself without permission.

See [`LICENSE`](LICENSE) for full terms — contact `angelovsan@gmail.com` for permissions.
