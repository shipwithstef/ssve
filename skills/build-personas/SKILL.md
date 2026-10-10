---
name: build-personas
version: "1.0"
description: >
  Builds and maintains user personas in docs/specs/personas/ from vision, specs, domain
  and competitor data; modes for build, audit, add, expand, interview and gap discovery.
  Use for "build personas", "who are our users", "persona gaps", or when personas are
  empty.
phases:
  - id: P1-ModeContextGate
    trigger: always
    reads: ["REPO_MODES.md", "docs/specs/vision.md", "docs/specs/personas/PERSONA_INDEX.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SourceDeepRead
    trigger: always
    reads: ["docs/specs/vision.md", "docs/personas/*.md", "docs/specs/features/*.md", "docs/specs/domain-profile.md", "docs/specs/analyze-competitors.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-PersonaCandidateModeling
    trigger: always
    reads: ["product roles", "feature surface", "existing personas", "journey analysis"]
    writes: ["docs/specs/personas/PERSONA_INDEX.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-PersonaArtifactBuild
    trigger: always
    reads: ["approved persona candidates", "persona template"]
    writes: ["docs/specs/personas/P*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-IndexVisionFeedback
    trigger: always
    reads: ["docs/specs/personas/P*.md", "vision feedback findings"]
    writes: ["docs/specs/personas/PERSONA_INDEX.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/personas/P*.md", "docs/specs/personas/PERSONA_INDEX.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "docs/specs/personas/P*.md", artifact: existing-personas }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/personas/P*.md", artifact: personas }
    - { path: "docs/specs/personas/PERSONA_INDEX.md", artifact: persona-index }
chain:
  lanes:
    greenfield: { position: 5, prev: catalog-domain-capabilities, next: validate-feature }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Persona Builder

**Runtime v2 continuation:** Register every produced artifact with its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve this skill's human evidence and persona-index obligations.

Build user personas that are grounded in the product's reality AND the user's 2026 world.
These personas become the shared source of truth that other skills consume when they need
to think from the user's perspective.

**Announce at start:** "I'm using the build-personas skill to build user personas."

**The gap this fills:** Feature specs describe what the system does. Journey docs describe
how users move through it. But neither asks: "Does this person actually get what they came
for? Are we earning their trust or burning their patience at each step?" Personas answer that.

**Two inputs, one output:**
- INPUT 1: `docs/specs/vision.md` + `docs/specs/features/*.md` (what the product IS)
- INPUT 2: `docs/personas/*.md` (qualitative challenge library — who these people ARE)
- OUTPUT: `docs/specs/personas/*.md` (structured, consumable persona files with 2026 context)

---

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before choosing a mode below.

- `bootstrap`: create persona scaffold and derive first personas from available vision/code context.
- `convert`: read existing user docs/segments first, then map them into persona format without
  discarding current taxonomy on first pass.

---

## Modes

### Mode 1: Build / Refresh Personas

Reads vision, feature specs, and qualitative challenge library. Produces structured
persona files that any skill can consume.

### Mode 2: Skill Audit

Reads persona files + skill files. Produces a report of where skills fail to serve
specific personas. Feeds findings back to vision.md when personas reveal vision gaps.

### Mode 3: Add New Persona

Interactively build a single new persona through guided questions. The skill asks
the product owner targeted questions one at a time to flesh out a complete persona
from scratch — useful when you discover a user type not covered by existing personas.

### Mode 4: Expand Existing Persona

Deepen an existing persona by asking the product owner targeted questions about gaps,
thin sections, or areas where the persona feels generic. Also used when real user
feedback or new market data should be incorporated into a persona.

### Mode 5: Interview Mode

The skill flips the dynamic — instead of building artifacts, it interviews the
product owner to surface insights, corrections, and suggestions. It reads existing
personas, vision, and specs, then asks probing questions to find what's wrong,
missing, or outdated. Produces a findings document with recommended changes.

### Mode 6: Discover Persona Gaps

Proactively scans the product's features, entity types, lifecycle stages, and
user flows to suggest new persona candidates that the existing set doesn't cover.
Unlike Mode 1 (builds from challenge narratives) or Mode 5 (interviews the owner),
Mode 6 reasons FROM THE PRODUCT OUTWARD — it looks at what the product can do
and asks "who is this for, and do we have a persona for them?"

### Mode 7: Tiered Auto-Discovery

Fully automatic, zero-input required. No challenge library (`docs/personas/`)
needed. Reads vision + feature specs + entity list, reasons from the product
outward, and PROPOSES a tiered set of personas for owner approval before writing
anything. Each proposed persona is classified by how much product effort is needed
to fully serve them today:

- **Tier 1 — Platform-Native:** Fully served by the current platform. 0 feature gaps.
- **Tier 2 — Near-Future:** Mostly served; 1-3 small, focused additions close the gap. No architectural changes.
- **Tier 3 — Vision:** Would require significant new capabilities, new entities, or major features.

The owner approves which tiers/personas to build. Only approved personas become
full documents. Tier 3 personas are summarized as lightweight "Future Persona" stubs
(not full documents) unless the owner explicitly asks for the full build.

---

**Mode 1: Build / Refresh Personas** — Read vision, challenge narratives, feature specs and the existing PERSONA_INDEX in full (Phase 1), cluster challenges into 3-7 persona archetypes and get user confirmation (Phase 2), write one file per persona with the fixed section structure including a 2026 world, lifecycle instances, skepticism, patience, trust triggers and skill implications (Phase 3), write `PERSONA_INDEX.md` with the lifecycle coverage matrix (Phase 4), then record vision gaps in its Vision Feedback section. NEVER edit `vision.md` directly; present findings to the user instead (Phase 5). Details: `references/mode-1-build-refresh.md`.

**Mode 2: Skill Audit** — On "persona audit" style requests, read all persona files and each consuming skill (write-journeys, copywriting, cro, onboarding, signup, popups, content-strategy) and judge whether it serves different personas or treats users as identical. Findings must be specific, tied to a named persona, and ranked by impact; these are recommendations only, so do not change skills. Save the result to `docs/specs/personas/SKILL_AUDIT.md` with a datestamp. Details: `references/mode-2-skill-audit.md`.

**Mode 3: Add New Persona** — When the user describes a missing user type, load existing personas, challenges and vision, then interview the owner ONE question per message (identity, background, tools and budget, goals, fears, trust triggers, and how they differ from existing personas). After roughly 5-8 answers, draft the persona with the Mode 1 template for review, assign the next `P[N]` ID, write `docs/specs/personas/P[N]-name.md`, update `PERSONA_INDEX.md`, and log any vision gap. Details: `references/mode-3-add-persona.md`.

**Mode 4: Expand Persona** — For a thin persona, read its file and flag generic or vague sections (world, skepticism, patience, trust triggers, touchpoints, skill implications). Ask the owner 1-2 targeted questions per thin section, update only the thin parts and show the diff, then check the cascade: overlap with other personas, changed skill guidance, new vision gaps. Details: `references/mode-4-expand-persona.md`.

**Mode 5: Interview** — Interview the product owner instead of building artifacts: load all personas, vision and challenges, then ask one question at a time across five categories (reality check on existing personas, who is missing, what is wrong, competitive landscape, product implications). Follow the conversation rather than a template, then synthesize key insights, persona updates needed, new persona candidates, vision feedback and affected skills. Details: `references/mode-5-interview.md`.

**Mode 6: Discover Persona Gaps** — Reason from product to users: load personas, the Lifecycle Coverage Matrix, feature specs and the journey analysis sections (ungrounded preconditions, "missing persona" findings), then run six gap analyses (entity types, feature touchpoints, lifecycle stages, progression dead ends, new features, journey-driven gaps). Rank candidates in a gap report, ask the user which to pursue, route to Mode 3 (new) or Mode 4 (expand), and mark skipped ones "reviewed, not needed" in `PERSONA_INDEX.md`. Details: `references/mode-6-discover-gaps.md`.

**Mode 7: Tiered Auto-Discovery** — Read the product's specs, entity list and flows without asking, propose personas as Tier 1 (platform-native), Tier 2 (near-future, small specific additions) and Tier 3 (vision, needs new entities or integrations), and classify honestly. Do NOT write any files during Phase 4; the user must approve the proposal first. Then build only approved personas (Tier 3 as lightweight stubs), keep 2026 context mandatory, make Tier 2 additions specific enough to estimate, and write them to `docs/specs/personas/TIER2_BACKLOG.md`. Details: `references/mode-7-tiered-auto-discovery.md`.

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeContextGate --evidence command_output:.svc/build-personas-mode-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SourceDeepRead --evidence command_output:.svc/build-personas-source-read.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PersonaCandidateModeling --evidence file:docs/specs/personas/PERSONA_INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-PersonaArtifactBuild --evidence file:docs/specs/personas/P1.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-IndexVisionFeedback --evidence file:docs/specs/personas/PERSONA_INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/build-personas-self-verify.log
```

---

## Important Rules

1. **Qualitative personas are input, not output.** `docs/personas/` contains the raw
   challenge narratives. `docs/specs/personas/` contains the structured, consumable
   personas. Don't modify `docs/personas/` — that's the source material.

2. **3-7 personas.** Fewer means you're not capturing real diversity. More means
   you're creating distinctions without differences. Merge aggressively.

3. **2026 context is mandatory.** Every persona must be grounded in what's true NOW
   (2026), not hypothetical future state. AI coding is mainstream. Solo shipping is
   possible. The collaboration problem is real and unsolved. Trust is scarce.

4. **Outcomes, not features.** The "What They Came For" section describes outcomes
   the person wants, not features they'll use. "Find a reliable co-founder for my
   SaaS idea within 2 weeks" not "use the 7D matching system."

5. **Vision feedback is upstream.** Findings go to PERSONA_INDEX.md as recommendations,
   not directly into vision.md. The product owner decides what to adopt.

6. **Personas decay.** The 2026 context will shift. Re-run the build when the market
   changes (new tools launch, new competitors appear, user research reveals new patterns).
   The index tracks when personas were last built.

7. **Skill audit is honest.** If a skill is doing fine, say so. Don't manufacture
   findings to justify the audit. Empty findings = "this skill handles personas well."

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

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Persona files exist | `ls docs/specs/personas/P*.md` | |
| 2 | PERSONA_INDEX.md exists | `test -f docs/specs/personas/PERSONA_INDEX.md` | |
| 3 | At least 1 persona created | count files matching `docs/specs/personas/P*.md` >= 1 | |
| 4 | Domain context consumed | If domain-profile.md exists, personas reference industry patterns | |
| 5 | Competitor context consumed | If analyze-competitors.md exists, personas reflect real market users not hypothetical ones | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

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

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- Invoke next skill: `validate-feature --progressive --lane greenfield`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `validate-feature`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
