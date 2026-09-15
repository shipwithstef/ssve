---
name: analyze-domain
version: "1.0"
description: >
  Identify and build domain expertise for the project. Reads vision to determine
  industry, tech stack, and domain. Loads or creates stack convention packs. In
  identify mode, produces docs/specs/domain-profile.md. In research mode, resolves
  domain questions for other skills. Use when: "what domain is this", "domain expertise",
  "what do I need to know about this space", "industry context", or automatically
  after write-vision in progressive mode. Also invoked by other skills when they need
  domain-specific knowledge beyond what training data provides.
phases:
  - id: P1-KnowledgeFirstCheck
    trigger: always
    reads: ["references/knowledge/INDEX.md", "references/knowledge/domains/<domain>/CAPABILITIES.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-DomainSignalExtraction
    trigger: always
    reads: ["docs/specs/vision.md", "package.json", "tsconfig.json", "Dockerfile"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ProfileSynthesis
    trigger: always
    reads: ["domain signals", "stack convention packs", "internal knowledge"]
    writes: ["docs/specs/domain-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-GapResolution
    trigger: always
    reads: ["docs/specs/domain-profile.md", "research output", "discover-skills output"]
    writes: ["docs/specs/research-log.md", "docs/specs/domain-profile.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-KnowledgePersistence
    trigger: always
    reads: ["docs/specs/domain-profile.md"]
    writes: ["references/knowledge/domains/<domain>/CAPABILITIES.md", "references/knowledge/INDEX.md"]
    evidence_kind: file
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: existing-domain-profile }
    - { path: "package.json", artifact: package-json }
    - { path: "docs/specs/analyze-competitors.md", artifact: analyze-competitors }
outputs:
  produces:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
chain:
  lanes:
    greenfield: { position: 2, prev: write-vision, next: analyze-competitors }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Domain Expert

**Runtime v2 continuation:** Register every produced artifact with its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve this skill's unique domain constraints and evidence conditions.

Build and maintain domain expertise for the project. This is the bridge between
"we have a vision" and "we understand the space well enough to make good decisions."

**Announce at start:** "I'm using the analyze-domain skill to build domain expertise for this project."


**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## Knowledge-First

Before doing any research, check what's already known:

```bash
cat references/knowledge/INDEX.md 2>/dev/null
```

If the domain already has a knowledge entry (e.g., `references/knowledge/domains/selfhosted-monitoring/`),
read its CAPABILITIES.md first. This may answer questions without any research.

If the domain is new: proceed with identify mode, then write knowledge layers
when done (see Step 7).

## Modes

### Identify Mode (default — no existing domain-profile.md)

Run when the project has a vision but no domain profile yet.

**Step 1: Extract domain signals from vision**

Read `docs/specs/vision.md` and extract:
- **Industry:** What sector? (edtech, fintech, devtools, healthtech, etc.)
- **Tech stack:** What's being built with? (read package.json, tsconfig, Dockerfile if they exist)
- **Domain concepts:** What entities, workflows, or patterns does the product deal with?
- **User domain:** What expertise do the target users have? (developers, doctors, teachers, etc.)

**Step 2: Check for existing stack convention packs**

```bash
ls references/domains/ 2>/dev/null
```

If a matching pack exists (e.g., `references/domains/react-19/` for a React project), load it and note: "Domain reference pack found for [X]. Loading conventions."

**Step 3: Build domain profile from internal knowledge**

For the identified domain, produce what you confidently know:
- Key industry patterns and conventions
- Common architectural approaches
- Known pitfalls and anti-patterns
- Regulatory or compliance considerations (if applicable)
- Standard metrics and KPIs for this type of product

**Step 4: Identify knowledge gaps**

For each area, rate your confidence: high / medium / low.

- **High confidence:** Established patterns, well-known frameworks, stable APIs
- **Medium confidence:** Recent versions, evolving best practices, niche domains
- **Low confidence:** Brand-new frameworks, industry-specific regulations, regional conventions

For low-confidence areas, build a question record and call `researchDecision(question)` from `scripts/lib/research-decision.mjs`. Missing ordinary confidence is analysis. External research only when the predicate returns `external_research_required`. Bind `requesting_decision_id` and `requesting_task_id`; reuse a matching existing task on the same decision ID; keep the requester blocked while unresolved; a changed claim invalidates only that claim's old proof.
1. If `external_research_required`, invoke `research` for that question
2. If research reveals a framework/library gap, invoke `discover-skills` to check for external skills
3. Log findings to `docs/specs/research-log.md` when research ran; otherwise record the analysis gap in Knowledge Gaps

**Step 5: Write domain profile**

Produce `docs/specs/domain-profile.md`:

```markdown
# Domain Profile

**Generated:** YYYY-MM-DD
**Industry:** [sector]
**Tech Stack:** [detected]
**Domain Concepts:** [key entities and patterns]

## Industry Context

[What this space looks like — major players, common approaches, user expectations]

## Technical Domain

[Framework conventions, architecture patterns, standard tooling]
[Version-specific notes if applicable]

## Known Pitfalls

[Common mistakes in this domain, anti-patterns, things that seem right but aren't]

## Regulatory / Compliance

[If applicable — GDPR, HIPAA, PCI-DSS, accessibility standards, etc.]
[If not applicable: "No specific regulatory requirements identified."]

## Success Metrics (industry standard)

[What KPIs matter in this space? DAU, conversion rate, time-to-value, etc.]

## Knowledge Gaps

[Areas where research was needed — with findings and confidence levels]
[Links to research-log.md entries]

## External Skills Discovered

[Skills found via discover-skills that could help — installed or recommended]

## Stack Convention Packs

[Packs loaded from references/domains/ — or packs created during this run]
```

**Step 6: Create stack convention pack if warranted**

If the domain profile reveals persistent tech-stack knowledge (not one-off findings), create a pack at `references/domains/<stack>/`:

```bash
mkdir -p references/domains/<stack>
```

Write conventions.md and testing.md with CODE-LEVEL conventions (naming,
imports, patterns, test setup). These are for `execute-changeset` during
code generation — not for industry/domain understanding. Industry knowledge
goes in `references/knowledge/domains/<domain>/` (Step 7).

**Step 7: Write knowledge layers**

After producing domain-profile.md, also extract into the knowledge system
so future projects in the same domain don't re-research:

```bash
mkdir -p references/knowledge/domains/<domain-slug>
```

Write `CAPABILITIES.md` — one sentence per key finding:
- What the space looks like (major players, user expectations)
- Key technical patterns (frameworks, architecture, tooling)
- Known pitfalls
- Regulatory requirements (if any)
- Standard metrics

Write `.sha` with today's date (domains don't have git SHAs — use date as
staleness marker, stale after 30 days).

Update `references/knowledge/INDEX.md` with a new row.

**This is how domain expertise compounds across projects.** Project 2 in the
same domain starts with Layer 2 already populated — no re-research needed.

### Research Mode (invoked by other skills)

When another skill calls analyze-domain with a specific question:

1. Read the existing `docs/specs/domain-profile.md`
2. If the answer is in the profile: return it immediately
3. If not: analyze locally; invoke `research` only when `researchDecision(question)` returns `external_research_required`, then update the domain profile with the finding and return the answer
4. If research reveals a capability gap: invoke `discover-skills` to check for external skills

### Update Mode (existing domain-profile.md)

When invoked on a project that already has a domain profile:

1. Read the existing profile
2. Check if tech stack has changed (compare package.json against profile's Tech Stack)
3. Check if vision has evolved (compare vision.md against profile's Industry/Domain)
4. If changes detected: update the profile; run `researchDecision` per new-area question and research only when `external_research_required`
5. If no changes: report "domain profile is current"

## Auto Mode vs Guided Mode

**Auto mode** (`--progressive --auto-approve`):
- Extracts domain signals silently
- Resolves gaps with analysis; researches only when the predicate requires it, without asking
- Creates domain profile and reference packs
- Chains to analyze-competitors

**Guided mode** (standalone or `--progressive`):
- Presents extracted domain signals: "I see this as a [sector] product using [stack]. Sound right?"
- For each knowledge gap: "I'm not confident about [X]." Analyze first; research only if `researchDecision` returns `external_research_required`.
- Presents findings with recommendations
- User can correct domain classification, add context, or skip research

### Auto-Invoke On-Demand Skills

Based on signals detected during domain analysis, conditionally insert these skills:

| Signal | Skill | Insertion Point | Why |
|--------|-------|-----------------|-----|
| After Layer 2 and domain-profile, `researchDecision(question)` returns `external_research_required` | `research` | Inline before the requesting analysis step; reuse matching decision ID | Predicate-required external evidence; missing score stays analysis |
| Capability gap discovered that an external skill could fill | `discover-skills` | After research completes, before returning domain profile | Ensures capability inventory is complete before downstream work |

If any on-demand skill is inserted, update `.svc/lane-tasks-<WI>.json` with the new task and set `blocked_by` so downstream work waits for the on-demand skill's output. Log the insertion as a `mechanical` decision in `.svc/pipeline-decisions.jsonl`.

## Phase Receipt Contract

When running under `.svc/lane-tasks-<WI>.json`, emit receipts for each required
phase before marking the task completed:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-KnowledgeFirstCheck --evidence command_output:.svc/analyze-domain-knowledge.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-DomainSignalExtraction --evidence command_output:.svc/analyze-domain-signals.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ProfileSynthesis --evidence file:docs/specs/domain-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-GapResolution --evidence file:docs/specs/domain-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-KnowledgePersistence --evidence file:references/knowledge/INDEX.md
```

If no external research is needed, record `P4-GapResolution` against the
`Knowledge Gaps` section in `docs/specs/domain-profile.md` that explains why.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | `docs/specs/domain-profile.md` exists | `test -f docs/specs/domain-profile.md` | |
| 2 | Profile has Industry and Tech Stack | grep for both sections | |
| 3 | Low-confidence areas evaluated with `researchDecision`; research only if `external_research_required` | Knowledge Gaps section present | |
| 4 | Domain reference pack created if warranted | check references/domains/ | |
| 5 | Knowledge protocol conformance | Library checked first, project artifact written, knowledge persisted, .version updated | |

## Audit Mode

When invoked with `--audit` to re-evaluate domain profile:

1. Read `docs/specs/domain-profile.md`
2. Check tech stack: does package.json match the profile's declared stack?
3. Check knowledge gaps: have any low-confidence areas been resolved by new code/research?
4. Check stack convention packs: still match the current framework versions?
5. Report: section-by-section CURRENT/STALE/OUTDATED

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

**Discovery wave (WI-387 — opt-in, faster):** analyze-domain, analyze-competitors, and build-personas each need only `vision.md` and write disjoint paths, so they can run as ONE concurrent wave via `dispatch-waves` (catalog-domain-capabilities as wave 2) instead of the serial chain — ~55% faster discovery. **Before dispatching, the disjoint-write fence is mandatory:** `node scripts/discovery-wave-fence.mjs` (fails closed on any write-scope overlap). `validate-feature` still gates the merged discovery. Serial-domain-context is a soft, stated cost. See `references/discovery-wave.md`. Permitted mutating transport per the S5 policy (recorded 2026-06-09).

**If `--progressive` and self-verify passed (serial default):**
- Chain to analyze-competitors: `analyze-competitors --progressive --lane greenfield`

**If standalone:**
- Report domain profile summary
- Suggest: "Next: run `analyze-competitors` if not already done, or `build-personas`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
