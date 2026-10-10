---
name: mine-builder
version: "1.0"
description: >
  Create or update the builder profile (~/.svc/builder-profile.md): finances, time,
  skills, team, audience, tools, entity, goals, past projects. Use when: first pipeline
  run, update my profile, anything changed.
phases:
  - id: P1-ProfileModeDetection
    trigger: always
    reads: ["~/.svc/builder-profile.md", "task request"]
    writes: [".svc/mine-builder-mode.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ContextInferenceQuestionCluster
    trigger: always
    reads: ["user prompt", "existing builder profile"]
    writes: [".svc/mine-builder-inference.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-SocialProjectHistoryMining
    trigger: always
    reads: ["builder responses", "social presence", "past projects"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-PatternGapAnalysis
    trigger: always
    reads: ["project history", "skills", "tools", "distribution"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ProfileWriteOrUpdate
    trigger: always
    reads: ["profile draft", "profile changelog", "builder confirmations"]
    writes: ["~/.svc/builder-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["~/.svc/builder-profile.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
outputs:
  produces:
    - { path: "~/.svc/builder-profile.md", artifact: builder-profile }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Mine the Builder Profile

Understand WHO is building before deciding WHAT to build or HOW. The builder
profile captures the user's real-world context — financial situation, time,
skills, team, tools, business entity, social presence, and goals. This is
project-agnostic and reusable across everything they build.

**The gap this fills:** Without this skill, the pipeline treats every builder
identically. A funded full-time founder and a 9-5 employee with 5 evening hours
get the same recommendations. The result: plans that are technically correct but
practically impossible — 3-month MVPs for people who abandon at month 3,
marketing-heavy strategies for builders with zero distribution, payment
integrations for people without a business entity.

**Announce at start:** "I'm using mine-builder to understand your situation before
we plan anything."

---

## Modes

### Mode 1: First-Time Interview

Triggered when `~/.svc/builder-profile.md` does not exist. Deep interview that
creates the full profile. Happens once per builder.

### Mode 2: Change-Check

Triggered when `~/.svc/builder-profile.md` exists. Quick summary and
confirmation. Updates only what changed.

### Mode 3: Post-Project Update

Triggered after a project ships (verify-promotion) or is abandoned. Updates
project history, patterns, and gap analysis.

### Mode 4: Proactive Update

Triggered when the pipeline notices something that contradicts the profile
during normal operation.

---

## Mode 1: First-Time Interview

### Step 0: Check for Existing Profile

```
ls ~/.svc/builder-profile.md
```

If the file exists, switch to Mode 2. If not, proceed with the interview.

### Step 1: Extract Before Asking

Read the user's initial message and any available context. Their prompt often
reveals budget, skills, and urgency implicitly. Fill in what you can infer
before asking a single question.

**Inference rules:**

| Signal in user's message | What to infer |
|---|---|
| Mentions a 9-5 job | Time-constrained, income exists, probably needs side revenue |
| Says "first project" | Conservative strategy, no entity, free tiers only |
| Mentions a co-founder | Capture their skills, affects what to build |
| Lists subscriptions/tools | Log them, affects tech choices and budget |
| Says "I can invest $X" | Budget ceiling, affects build-vs-buy decisions |
| Mentions any social handle | Ask follower count + engagement + niche |
| Posts content anywhere | That is a distribution channel, capture it |
| Has no social presence | Flag it, plan for cold-start distribution |
| Says "I'm a [role]" | Primary technical skill, implies strengths and gaps |
| Mentions past projects | Extract outcomes, stack, timeline, reason for ending |

### Step 2: Ask Critical Unknowns

After extracting what you can, identify the 2-3 most impactful unknowns and
ask them. Do not interrogate with a 20-question form. Cluster related questions
naturally.

**Priority order for unknowns (ask the highest-impact ones first):**

1. **Time** — how many hours/week, when, employed or not (affects everything)
2. **Revenue goal** — what does success look like financially (sets strategy)
3. **Skills** — what can they build themselves (determines feasible products)
4. **Distribution** — where is their audience, if any (determines launch plan)
5. **Past projects** — what shipped, what died, why (reveals patterns)
6. **Budget** — what they can invest (determines tool choices)
7. **Business entity** — can they accept payments (determines payment stack)

**Interview behavior by mode:**

- **Interactive mode:** Ask one cluster at a time. Wait for the answer. Do not
  dump all questions at once. Infer aggressively, confirm lightly.
- **Autorun mode:** The interview is woven into the single prompt. Extract what
  you can from the initial message, ask 2-3 critical unknowns, create the
  profile, and continue the pipeline — all in one flow.

### Questioning Anti-Patterns

- **Do not walk through checklists** — asking "What's your budget? OK. What's your time? OK. What are your skills?" is the #1 anti-pattern. Instead: read context, infer what you can, then ask the 2-3 most impactful unknowns.
- **Progressive depth** — start broad ("Tell me about yourself and what you want to build"), dig where interesting.
- **No corporate speak** — "What are your core competencies?" → "What are you good at?"
- **Infer before asking** — if the user said "I'm a devops engineer at a startup", you already know: technical (infra), employed, probably Linux/AWS/Docker. Don't ask what they already told you.

**Mode 1 Steps 3-6: Mining** — Step 3: capture social presence for every platform the builder has, even if irrelevant to the current project (account age, followers, engagement quality, niche, posting frequency, paid tiers, content history, conversion history); engagement beats follower count, and account age and paid subscriptions are assets. Step 4: record each past project (what, when, stack, furthest milestone, revenue, honest reason it ended, reusable assets, what they would change), including side projects. Step 5: detect patterns only from 2+ projects, each with an id, confidence 1-10, observation count, source and pipeline action. Step 6: write a gap analysis (current capabilities, gaps blocking the next milestone, concrete recommendations such as tools and skills). Details: `references/mode-1-mining-steps.md`.

### Step 7: Write the Profile

Write `~/.svc/builder-profile.md` using the full template below.

---

**Builder Profile Template** — `~/.svc/builder-profile.md` has these sections in order: Financial Context, Time Context, Skills & Strengths, Team & Network, Distribution & Social Presence (one subsection per platform), Existing Infrastructure, Business Situation, Strategic Goal, Project History, Builder Patterns (empty on first run, filled by the pipeline), Tool & Capability Gap Analysis, and Changelog. Mark unknown fields as unknown rather than inventing them. Details and field prompts: `references/builder-profile-template.md`.

## Mode 2: Change-Check

Triggered when `~/.svc/builder-profile.md` already exists.

### Step 1: Read and Summarize

Read the existing profile. Present a one-line summary:

```
Builder profile: [role], [budget], [time], [key skill], [distribution].
Anything changed?
```

### Step 2: Branch on Response

- **User says "no" / "looks good" / moves on** -- proceed to the pipeline.
  No update needed.
- **User mentions changes** -- update the specific sections they mention.
  Do not re-interview everything.
- **User says "update my profile"** -- run through each section briefly,
  asking "Still accurate?" for each. Update what changed.

### Step 3: Contextual Triggers

The change-check is more proactive in these situations:

| Trigger | What to ask |
|---|---|
| New project started | "Anything changed since last time? New skills, tools, revenue?" |
| 30+ days since last update | "Quick check: your profile says [X]. Still accurate?" |
| User mentions something contradicting profile | Update silently or confirm: "Your profile says [old]. You just said [new]. Want me to update?" |
| Previous project shipped | "Did shipping [project] change anything? New revenue? New skills? Updated tools?" |
| Previous project abandoned | "What was the real reason you stopped [project]?" (See Mode 3) |

### Step 4: Append Changelog

After any update:

```markdown
## Changelog
- <date>: <what changed and why>
```

---

## Mode 3: Post-Project Update

The MOST valuable update. Triggered at two points:

### After verify-promotion (project shipped)

Update the builder profile:
- Add project to Project History with outcome `shipped`
- Update skills (did they learn a new framework? use a new tool?)
- Update financial context (did revenue start? did they register an entity?)
- Update social presence (did they grow followers? launch on ProductHunt?)
- Run pattern detection: compare this project's timeline, decisions, and outcome
  against past projects. If a new pattern emerges (or an existing one is
  reinforced), append to Builder Patterns.
- Run gap analysis: what blocked them this time? What tool would have saved the
  most time? Append recommendation.

### After project abandonment

**Abandonment detection triggers:**
- User explicitly says "I'm stopping this" / "abandoning" / "moving on"
- User starts a NEW project via `route-workflow` while a previous project has an
  unmerged feature branch (route-workflow detects this at Session Setup by
  checking `git worktree list` and `git branch --no-merged main`)
- User has not touched the project in 30+ days and starts a new session
  (route-workflow checks `git log -1 --format=%ci` at session start)

**When triggered, ask:**
- "What was the real reason you stopped?"
- Add project to history with outcome `abandoned` and honest reason
- Check: does this match a pattern? If 2+ projects died the same way, create
  or strengthen a Builder Pattern with high confidence.
- Check: was there a tool, skill, or person that could have prevented this?
  Update gap analysis.

---

## Mode 4: Proactive Update

Triggered during normal pipeline operation when any skill notices something
that contradicts or updates the builder profile.

**Examples:**
- "Your profile says you can't do frontend, but you just wrote a React
  component. Should I update your skills?"
- "You said budget is $0 but you just signed up for a $20/mo service.
  Updated budget context."
- "Your X engagement jumped — you got 50 replies on your last post.
  Updating social presence from 'dormant' to 'warming up'."

These updates happen inline during other skills. The profile is always
eventually consistent with the builder's real situation.

**Shared writers:** mine-builder is the initial writer of the profile.
`teach-project` in `socratic` mode is a secondary authorized writer — it
updates the Skills & Strengths section and appends to the Changelog based
on diagnostic results. This is intentional: socratic teaching is the
primary way the profile's skill entries transition from "claimed at
onboarding" to "confirmed against real code." Any other skill that wants
to write to the profile should route through mine-builder's Proactive
Update mode instead of writing directly.

---

**Profile Pipeline Effects** — Downstream skills adapt to the profile: no capital means free tiers and quick ships, an existing audience allows a smaller MVP, dormant channels are not launch plans, and no presence means SEO or marketplace distribution. Revenue advice follows stages ($0-1K reverse-engineer a winner, $1-3K double down and register an entity, $3-10K build the real product, $10K+ scale). Key principles: infer before asking, one cluster of questions at a time, the profile describes the person not the project, honest gaps beat invented answers, and patterns need evidence from 2+ projects. Details: `references/profile-pipeline-effects.md`.

## What This Produces

`~/.svc/builder-profile.md` — a global, project-agnostic profile that persists
across all projects. Contains:

- Financial context and constraints
- Time availability and employment status
- Technical and non-technical skills with identified gaps
- Team composition and network leverage
- Full social presence and distribution channel inventory
- Existing infrastructure and tool subscriptions
- Business entity status and payment capabilities
- Strategic goals, risk tolerance, and success definition
- Complete project history with outcomes and honest reasons
- Builder patterns (learned over time from project outcomes)
- Tool and capability gap analysis with specific recommendations
- Changelog of all profile updates

This file is consumed by: `route-workflow` (session setup), `validate-feature`
(builder history weighting for kill signals, pivot protocol), `plan-changeset`
(timeline estimates adjusted by patterns), and every skill that makes
strategy or scope decisions.

---

## Baseline Failure This Skill Fixes

Without this skill, the pipeline has no concept of WHO is building. Every
recommendation assumes an idealized builder with unlimited time, full-stack
skills, existing distribution, and a business entity. The result:

- MVPs scoped for 3 months when the builder has 5 hours/week
- Marketing plans for builders with zero social presence
- Payment integrations recommended before the builder has a company
- Features requiring frontend skills for backend-only developers
- The same idea failing repeatedly because nobody tracks the failure pattern

---

## Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Profile file exists | `ls ~/.svc/builder-profile.md` | |
| 2 | Financial Context section populated | grep for "Financial Context" heading and at least one non-template value | |
| 3 | Time Context section populated | grep for "Time Context" heading and at least one non-template value | |
| 4 | Skills section populated | grep for "Skills & Strengths" heading and at least one non-template value | |
| 5 | Distribution section present | grep for "Distribution & Social Presence" heading | |
| 6 | Strategic Goal section populated | grep for "Strategic Goal" heading and at least one non-template value | |
| 7 | Gap Analysis section present | grep for "Gap Analysis" heading | |
| 8 | No unresolved placeholders | grep for angle-bracket placeholders like `<what they>` — all should be filled or marked "unknown" | |
| 9 | Changelog entry exists | grep for "Changelog" heading with at least one dated entry | |

If any check FAILs, fix before continuing. If a fix requires user input that
was not provided, mark the section as "unknown — ask next session" and note it
in the changelog.

---

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `mine-builder` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ProfileModeDetection --evidence command_output:.svc/mine-builder-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ContextInferenceQuestionCluster --evidence command_output:.svc/mine-builder-inference.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SocialProjectHistoryMining --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-PatternGapAnalysis --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProfileWriteOrUpdate --evidence file:~/.svc/builder-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/mine-builder-self-verify.log
```

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

This skill has no lane position. It is invoked by `route-workflow` before the
pipeline starts, not as part of the pipeline sequence.

**After mine-builder completes:**
- Control returns to `route-workflow` which continues with Session Setup
  (detect repo mode, identify change type, recommend lane and next skill).
- The builder profile is now available for all downstream skills to read.

**When invoked standalone** (user says "update my profile"):
- Run the appropriate mode (2, 3, or 4)
- Report what changed
- Suggest: "Profile updated. Ready to continue with your current project."

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.


## Modes (added by WI-SPINE-002)

### `--mode=stack-profile`

Produces `docs/specs/stack-profile.md` per the template at `skills/mine-builder/templates/stack-profile.md`. Used by `recall-stack-knowledge` (the Spine gate) at phase 0 of every infra-* lane.

**Inputs:** project files (Terraform `*.tf`, `Chart.yaml`, `package.json`, CI configs), user's existing `~/.svc/builder-profile.md`, optional pasted summary.

**Process:**
1. Detect declared infra components from filesystem signals:
   - `*.tf` → terraform
   - `Chart.yaml` / `values.yaml` → helm
   - `pulumi.yaml` → pulumi
   - `terragrunt.hcl` → terragrunt
   - `.github/workflows/*.yml` → github-actions
   - `.gitlab-ci.yml` → gitlab-ci
   - `provider "aws"` → aws
   - `provider "google"` → gcp
2. Pre-fill the template with detected values.
3. Ask the user to confirm/correct envelopes (cost, peak load, RTO/RPO, criticality tier).
4. Write `docs/specs/stack-profile.md`.
5. Append entry to `references/knowledge/domains/<primary-stack>/` request list (the gap → research auto-loop will populate it on first recall).

**Output:** `docs/specs/stack-profile.md`. Refresh cadence: 90 days OR when components change. `validate-stack-profile-freshness.sh` warns when stale.

**When to use:** First time on an infra project. Subsequent infra-* lanes read stack-profile via the Spine.

Default invocation (`mine-builder` without `--mode`) is unchanged.

Reference: `proposals/done/2026-04-30-infra-project-support.md` § 3.1 + § 17.2.
