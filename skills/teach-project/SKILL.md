---
name: teach-project
version: "1.0"
description: >-
  Teach the builder what was built and how to manage it — socratic diagnostic across technical/product/operational knowledge gaps, taught from this repo's files; updates the builder profile so downstream skills recalibrate. Mode auto generates OWNER-GUIDE.md for autorun chains. Use when: "teach me my project", "owner guide", "explain what was built". Also: "teach me about this project", "onboard me", "quiz me", "test me", "how do I manage this". Also: "check what I know", "I want to learn", "help me grow on this repo".
phases:
  - id: P1-ModeSelectionAndInputLoad
    trigger: always
    reads: ["user request", "docs/specs/vision.md", "docs/specs/features/*.md", "docs/specs/project-state.md", "~/.svc/builder-profile.md"]
    writes: [".svc/teach-project-mode.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-AutoProfileAndArtifactAnalysis
    trigger: auto-mode
    reads: ["~/.svc/builder-profile.md", "feature spec", "manifest", "source code"]
    writes: [".svc/teach-project-auto-analysis.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-AutoOwnerGuideWrite
    trigger: auto-mode
    reads: ["builder profile", "source analysis", "owner-guide template"]
    writes: ["docs/OWNER-GUIDE.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-SocraticQuestionDesign
    trigger: socratic-mode
    reads: ["source code", "vision", "features", "manifest", "builder profile"]
    writes: [".svc/teach-project-questions.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-SocraticTeachAndAssess
    trigger: socratic-mode
    reads: ["diagnostic questions", "user answers", "expected answer sketches"]
    writes: [".svc/teach-project-session.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-BuilderProfileUpdate
    trigger: socratic-mode
    reads: ["~/.svc/builder-profile.md", "socratic assessment log"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-CloseLoopSummary
    trigger: always
    reads: ["docs/OWNER-GUIDE.md", "~/.svc/builder-profile.md", "teaching session notes"]
    writes: [".svc/teach-project-summary.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify table", ".svc/lane-tasks-<WI>.json", "mode-specific artifacts"]
    writes: [".svc/teach-project-self-verify.log"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/plans/*/manifest.md", artifact: manifest }
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitors }
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
outputs:
  produces:
    - { path: "docs/OWNER-GUIDE.md", artifact: owner-guide }
  updates:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile, mode: socratic-only }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Teach the Builder

After the pipeline builds something, the builder needs to OWN it. This skill
bridges the gap between "code was shipped" and "I understand what I have."

**Announce at start:** "I'm creating your owner guide — what was built, how it works, and how to manage it."

## Why This Exists

The pipeline can build things the builder couldn't code themselves. A devops
person now has a React SaaS. A backend dev now has a mobile app. The code
works — but the builder doesn't understand it yet.

Without this skill, the builder is dependent on the pipeline for every change,
can't debug production issues, can't onboard collaborators, and can't make
informed decisions about what to build next.

## Process

### Step 0: Pick a Mode

This skill runs in one of two modes. Ask the user once at entry unless the
session already declared one:

> Two ways to learn this project:
>
> 1. **Auto** — I read your profile and generate an owner guide tailored to
>    what I think you don't know yet. Fast, one-shot. Good if you want a
>    reference you can skim.
> 2. **Self-check (Socratic)** — We walk through it together, 10 minutes or so.
>    I ask questions across technical, product, and operational dimensions;
>    you answer what you know and flag what you don't. I teach the actual
>    gaps (not profile-guessed ones) and update your profile so every future
>    pipeline run calibrates better. Good if you want to genuinely OWN this repo.

**Default mode: `socratic`.** The skill's primary value is building the
builder — document generation is secondary. Any interactive invocation
defaults to socratic unless the user explicitly asks for a guide
("give me the guide", "just write the doc", "auto mode").

The only time `auto` is the default: the autorun chain triggers this skill
after `verify-promotion` in non-interactive mode. In that case there's no
human to converse with, so the skill generates the OWNER-GUIDE.md as a
reference artifact for later human review.

Routing:
- Mode `socratic` (default) → proceed to Socratic Mode Steps (S1-S5)
- Mode `auto` (explicit request OR non-interactive autorun) → proceed to Auto Mode Steps (A1-A5)

**Scope of socratic learning: repo state, not current active work.** Questions
cover the repo as a whole — the stack that was chosen, the architecture that
exists, the product model — not the specific WI or feature the pipeline is
working on this week. Builders learning on a slower cadence than the pipeline
runs benefit from depth on what already exists, not from chasing every new
change. Re-run socratic whenever you want to deepen; the profile tracks what
was covered so questions don't repeat unnecessarily.

---

## Auto Mode

One-shot document generation calibrated to the declared profile. This is the
original behavior — fast, low-friction.

### Step A1: Read the Builder Profile

Read `~/.svc/builder-profile.md`. Understand:
- What the builder already knows (don't explain Docker to a devops person)
- What's new to them (DO explain React patterns to a backend person)
- Their learning style (terse → bullet points, detailed → walk-through)

**Calibrate depth to the gap.** If the builder knows Node but not React,
explain React concepts in Node terms. If they know infra but not frontend,
explain deployment in detail but UI architecture at a higher level.

### Step A2: Analyze What Was Built

Read the feature spec, manifest, and actual source code. Extract:

- **Stack decisions:** what technologies, why each was chosen
- **Architecture:** how the pieces connect (data flow, request flow)
- **Key files:** which files matter most, what each does
- **External dependencies:** what services, APIs, databases
- **Configuration:** env vars, config files, feature toggles
- **Build & deploy:** how to run locally, how to deploy, how to update

### Step A3: Identify the Knowledge Gap

Compare what was built (Step 2) against what the builder knows (Step 1).
The gap is what the guide needs to cover.

| Builder knows | What was built | Gap to cover |
|---|---|---|
| Python, Docker | Next.js React app | React concepts, Next.js routing, JSX |
| AWS EC2 | Vercel deployment | Vercel-specific: env vars, preview deploys, domains |
| REST APIs | Supabase + Prisma | Supabase auth, Prisma schema, migrations |
| CLI tools | Web dashboard | Browser debugging, responsive layout, state management |

### Step A4: Write the Owner Guide

Produce `docs/OWNER-GUIDE.md`:

```markdown
# Owner Guide: <project name>

## What This Is
<one paragraph — what the product does, who it's for>

## Tech Stack (and why)
| Technology | Purpose | Why this was chosen |
|---|---|---|
| Next.js | Frontend framework | Server-side rendering, file-based routing, Vercel-native |
| Supabase | Database + auth | Free tier, PostgreSQL, built-in auth, realtime |
| ... | ... | ... |

## How It Works
<data flow diagram in text — user action → frontend → API → database → response>
<keep it to ONE diagram that shows the main flow>

## Key Files You'll Touch Most
| File | What it does | When you'd change it |
|---|---|---|
| `src/app/page.tsx` | Main landing page | Change copy, layout, CTA |
| `src/lib/db.ts` | Database client | Add new queries |
| `.env.local` | Config / secrets | Add API keys, toggle features |

## How to Run Locally
```bash
<exact commands, copy-pasteable>
```

## How to Deploy
<step by step — what the builder actually types>

## How to Debug Common Issues
| Symptom | Likely cause | Fix |
|---|---|---|
| White screen | Build error | `npm run build` — read the error |
| "Unauthorized" | Supabase auth | Check `.env.local` SUPABASE_KEY |
| Slow load | Large bundle | Check `next build` output for large pages |

## Things You Should Know (that the pipeline decided for you)
<decisions made by P0 during autorun — things the builder should understand>
- Why SQLite was chosen over Postgres for this scale
- Why LemonSqueezy not Stripe (no entity needed)
- Why this architecture pattern (and when to change it)

## How to Iterate Without the Pipeline
For small changes (copy, styling, config): edit the file directly, test, deploy.
For new features: run the pipeline again — it reads project-state.md and picks up.
For bugs: `diagnose-bug` or just debug with Claude.

## What to Watch For
- <monitoring: what metrics matter for this product>
- <cost: when free tier limits will be hit and what to do>
- <security: what's exposed, what needs rotating>
- <scaling: what breaks first under load>

## Learning Path (if you want to go deeper)
<ordered list of things to learn based on the knowledge gap>
1. <most impactful thing to learn first>
2. <second most impactful>
3. <nice to know but not urgent>
```

### Step A5: Interactive Q&A

After presenting the guide, offer: "What questions do you have about the
project? I'll explain anything in detail."

Answer questions using the builder's existing knowledge as the anchor.
Don't explain fundamentals they already know — bridge from what they know
to what they need to learn.

End with: "If you want to actually test what you know and update your profile,
run me again with socratic mode."

---

## Socratic Mode

Interactive diagnostic. You ask, user answers, you identify real gaps (not
profile-claimed), teach those gaps, and update the builder profile with what
was confirmed vs what's still missing. The profile becomes living truth —
every downstream skill calibrates better because of this session.

### Step S1: Read Inputs

Read the same inputs as Auto Mode (vision, features, manifest, project-state,
builder-profile, competitors). In Socratic Mode, ALSO read source code for
the key files in the manifest — you need ground truth to write good diagnostic
questions, not just the spec-claimed behavior.

### Step S2: Generate Diagnostic Questions Across Three Dimensions

Questions are grounded in actual project artifacts, not generic frameworks.
Pick 3-5 questions per dimension (9-15 total), scaled to the builder's
declared profile (don't ask a devops person "what's Docker").

**Technical dimension** (ground truth: source + manifest + OWNER-GUIDE if it exists):

- "What does `<frontend framework>` do in this codebase? Give me one concrete
  thing it handles that you'd have to build yourself without it."
- "If the page `/<real-route-in-this-project>` breaks with a 500, where do
  you look first? Walk me through your first three steps."
- "What's the difference between `<pattern A used in codebase>` and
  `<pattern B>`? When would you reach for each?"
- "If I told you to add a new route at `/<plausible-new-route>`, which files
  would you create or edit? You don't need syntax — just names and
  responsibilities."
- "How does data get from `<source>` to `<destination>` in this app? Trace
  the path."

**Product dimension** (ground truth: features + vision + personas + competitors):

- "Who's the primary persona here, and what do they do in the first 5
  minutes after signup? What would make them churn in week 1?"
- "Which competitor is closest? What's our moat — what would they have to
  build to kill us, and why haven't they?"
- "If you had to raise prices 20% tomorrow, which feature justifies that
  increase and why? Which user segment pays; which walks?"
- "What's the one feature on the roadmap that's load-bearing for the pricing
  story? What happens to revenue if we ship a weaker version?"

**Operational dimension** (ground truth: project-state + cost model + deploy config):

- "What monitoring do we have right now, and where do you see it? If nothing
  is in place, what would you add first?"
- "At what user count does the <free-tier service> stop being free? What's
  the cost curve when you cross that threshold?"
- "What's the first thing that breaks when a deploy fails? Is there a
  rollback path, and does it work automatically?"
- "If you got a customer support ticket saying 'login is broken for
  everyone,' what's your first five minutes?"

For each question, have the expected-answer-sketch ready — you'll compare the
user's response against it, not grade it binary pass/fail.

### Step S3: Ask, Listen, Teach

Ask questions **one at a time**. Don't batch. Wait for the answer.

For each answer, classify it in your head:

| Signal | Meaning | Response |
|---|---|---|
| Clear, specific, correct | Skill confirmed | "Yep — you've got that. Moving on." |
| Partial / right direction, missing depth | Partial skill, teachable in 2 mins | Teach the missing piece with a concrete example from this repo, then move on |
| "I don't know" / obviously wrong | Real gap | Teach the concept grounded in this codebase. Show the file. Show what changes it. Confirm understanding before moving on |
| Evasive / hedging | Possibly gap, possibly shy | Ask one follow-up to disambiguate, then classify |

Track per-question: `dimension`, `question`, `assessment` (confirmed /
partial / gap), `taught` (what you explained), `evidence` (quote/paraphrase
of user's answer — short).

**Teach from the codebase, not from generic tutorials.** "React hooks let
you reuse stateful logic" is generic. "In `src/hooks/useLocation.js` the
hook owns the geolocation subscription, so any component that mounts it
gets GPS without re-wiring the API — that's why the useState+useEffect
pattern exists" is grounded.

### Step S4: Update the Builder Profile

At session end, update `~/.svc/builder-profile.md`. This is the whole point
of socratic mode — profile becomes truth, not claim.

**In the `## Skills & Strengths` section**, update entries based on what was
confirmed. Use the format:

```markdown
- **Frontend (React):** basics confirmed 2026-04-14 via teach-project socratic
  (knows: JSX, props, useState, component composition)
  (doesn't know yet: server components, Suspense, useReducer)
- **Product thinking:** understands persona model, can articulate primary
  moat, can connect pricing to features (confirmed 2026-04-14)
- **Operations:** knows Vercel deploys, rollback flow; doesn't know Supabase
  observability or quota math (identified 2026-04-14)
```

**Append one line to the `## Changelog` section** (create if absent):

```markdown
## Changelog
- 2026-04-14: teach-project socratic session on example-marketplace — confirmed React
  basics + product model; gaps identified in server components, Supabase
  observability, quota math
```

**If the user is stronger than the profile said** (e.g., profile says "no
React" but answers show solid React comprehension), upgrade the profile
entry explicitly rather than silently.

**If the user is weaker than the profile said** (e.g., profile claims
"knows payments" but they can't explain how Stripe webhooks work in this
repo), downgrade the entry with the specific gap. Don't delete the old
entry — note the revision and date.

### Step S5: Close the Loop

Summarize for the user:

> Here's what I confirmed: [list].
> Here's what I identified as gaps: [list].
> I've updated your builder-profile.md.
>
> Recommended next study: [1-3 specific things from the codebase to poke at
> next, with file paths].
>
> Want me to do a focused teach-project socratic on one dimension (e.g.,
> just operations) in a week? Re-running beats reading.

Do NOT write `OWNER-GUIDE.md` in socratic mode — that's Auto Mode's artifact.
Socratic mode's artifact is the updated profile + the session transcript
being the teaching itself.

---

## Self-Verify

**Auto Mode checks:**

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | OWNER-GUIDE.md exists | `test -f docs/OWNER-GUIDE.md` | |
| 2 | Stack decisions documented | Guide has Tech Stack section | |
| 3 | Run/deploy commands are copy-pasteable | Commands are in code blocks | |
| 4 | Knowledge gap addressed | Guide covers what builder doesn't know | |
| 5 | Builder profile was read | Guide calibrated to builder's existing skills | |

**Socratic Mode checks:**

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| S1 | All three dimensions covered | At least one question asked from technical, product, AND operational | |
| S2 | Questions grounded in artifacts | Questions reference real routes/files/personas/competitors, not generic frameworks | |
| S3 | Questions asked one at a time | No batched multi-question prompts | |
| S4 | Builder profile updated | `~/.svc/builder-profile.md § Skills` has at least one entry with today's date | |
| S5 | Changelog entry appended | `~/.svc/builder-profile.md § Changelog` has today's entry with dimensions covered | |
| S6 | No OWNER-GUIDE.md overwrite | If guide exists from a prior auto run, socratic mode did NOT rewrite it | |

## Phase Receipt Contract

When running in task-graph mode, emit one receipt per required phase before
marking the `teach-project` task complete. Use the current task id from
`.svc/lane-tasks-<WI>.json`:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeSelectionAndInputLoad --evidence command_output:.svc/teach-project-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-AutoProfileAndArtifactAnalysis --evidence command_output:.svc/teach-project-auto-analysis.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-AutoOwnerGuideWrite --evidence file:docs/OWNER-GUIDE.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-SocraticQuestionDesign --evidence command_output:.svc/teach-project-questions.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-SocraticTeachAndAssess --evidence command_output:.svc/teach-project-session.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-BuilderProfileUpdate --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-CloseLoopSummary --evidence command_output:.svc/teach-project-summary.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/teach-project-self-verify.log
```

For the inactive mode, still record that phase id with command-output evidence
explaining the mode skip. Do not complete the task until all required phase ids
appear in `skill_receipt.phases_executed`.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill\'s task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task\'s conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)
- Treat `Invoke: /skill-name` in the task description and `metadata.skill` as routing instructions, not explanatory prose
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume
- In Claude Code: mirror file state with `TaskList` / `TaskUpdate`; in Kimi use `/task` or `TaskList` / `TaskOutput` only as observation while the file remains authoritative; in Codex and other hosts without native task-mutation APIs: mirror only the active step in `update_plan`
- Mark this skill\'s task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task\'s conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

### Chaining

**Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`):**
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

This skill runs after verify-promotion (or on demand). It does not chain
to other skills. After completion, the builder owns their project.

## Key Principles

- **Teach the gap, not everything.** Don't explain Docker to a devops person.
- **Make it actionable.** Every section ends with what to DO, not just what to know.
- **Use the builder's language.** If they think in Python, explain in Python terms.
- **Copy-pasteable commands.** No "run the appropriate build command" — write the exact command.
- **Honest about complexity.** If something is genuinely hard to maintain, say so.
- **Profile is a living truth, not a declared snapshot.** Socratic mode's whole point is that the profile updates based on what the user actually demonstrated — so every downstream skill that reads the profile (P0, write-spec, design-tech) calibrates from reality, not from what was claimed once at onboarding.
- **Ground teaching in this codebase.** Generic tutorials are free on the internet. svc's edge is teaching with this repo's files, routes, and decisions as the textbook.
- **Growth is the goal.** Each socratic session closes one layer of the gap between "pipeline does it for me" and "I can do it myself." Many sessions over time = builder becomes a capable steerer.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
