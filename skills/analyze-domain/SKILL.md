---
name: analyze-domain
version: "1.0"
description: >
  Identifies the project's industry, stack and domain, loads stack convention packs, and
  writes docs/specs/domain-profile.md; also answers domain questions for other skills. Terms
  mode names 10 expert terms and the question to settle first, before a bounded plan. Use
  for "what domain is this", "industry context", "domain expertise", "teach me the terms".
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

**Outcome:** a current `docs/specs/domain-profile.md` with confidence-rated knowledge and
explicit gaps, persisted to the knowledge system so the next project starts ahead.
**Check:** Self-Verify below. **Boundary:** mark what comes from memory; low-confidence
claims go through `researchDecision`, never presented as settled.

**Knowledge protocol:** follow `references/knowledge-protocol.md` for extraction, storage, and staleness rules.

## Knowledge-First

Start from `references/knowledge/INDEX.md`. If the domain already has an entry (e.g.,
`references/knowledge/domains/selfhosted-monitoring/`), read its CAPABILITIES.md first — it
may answer questions without any research. If the domain is new, run identify mode and write
knowledge layers when done (Step 7).

## Modes

### Terms Mode (first step of a bounded plan)

People outside a field cannot yet say precisely what they want, so the work goes back and forth round after round. Before any brief or code, settle the words; this mode plans nothing and writes no code.
1. Name **10 terms** an expert in this field would use for what is being built. For each term, write one line on what it means and one line on how it changes what the owner should ask for.
2. Name **the one question to settle first** and what its answer decides. For a chess web app, "who plays whom" decides whether a server is needed at all.
3. Ground the terms in `references/knowledge/` and the stack packs, not memory alone. Mark any term that comes from memory.
4. Write the terms to section 0 of the brief. Put the first question in the cockpit steering box and the teaching page, **with the default you will build on**, and proceed on that default straight away: never wait for the answer. The default goes into the decision log as an assumption; an answer that arrives later is an amendment.

Why non-blocking: as a blocking question, terms-first added 0.72 owner rounds per request (p < 0.001) for a claim-match gain that was not established (+7 pts, CI [-2, 15], n = 36 per arm; `test-framework/outcome-evals/results/2026-10-10-ambiguity-terms-first.json`). Asked alongside the build, it costs the owner no rounds.

### Identify Mode (default — no existing domain-profile.md)

Run when the project has a vision but no domain profile yet.

**Step 1: Extract domain signals from vision**

From `docs/specs/vision.md` (and package.json, tsconfig, Dockerfile if present), extract:
**Industry** (edtech, fintech, devtools, healthtech, …), **Tech stack**, **Domain concepts**
(entities, workflows, patterns), and **User domain** (what expertise target users have).

**Step 2: Check for existing stack convention packs**

If a matching pack exists under `references/domains/` (e.g., `references/domains/react-19/` for a React project), load it and note: "Domain reference pack found for [X]. Loading conventions."

**Step 3: Build domain profile from internal knowledge**

For the identified domain, write down what you confidently know: industry patterns and
conventions, common architectural approaches, known pitfalls and anti-patterns,
regulatory/compliance considerations (if applicable), and standard metrics and KPIs.

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

Produce `docs/specs/domain-profile.md` with Generated date, Industry, Tech Stack and Domain
Concepts, then sections Industry Context, Technical Domain, Known Pitfalls, Regulatory /
Compliance, Success Metrics, Knowledge Gaps (with findings, confidence and research-log
links), External Skills Discovered, and Stack Convention Packs. Template:
`references/domain-profile-template.md`.

**Step 6: Create stack convention pack if warranted**

If the profile reveals persistent tech-stack knowledge (not one-off findings), create a pack
at `references/domains/<stack>/` with conventions.md and testing.md holding code-level
conventions (naming, imports, patterns, test setup). These serve `execute-changeset` during
code generation; industry knowledge goes in `references/knowledge/domains/<domain>/` (Step 7).

**Step 7: Write knowledge layers**

Extract the profile into `references/knowledge/domains/<domain-slug>/` so future projects in
the same domain don't re-research: `CAPABILITIES.md` with one sentence per key finding (the
space, technical patterns, pitfalls, regulatory requirements, metrics); `.sha` holding
today's date (domains have no git SHA; stale after 30 days); and a new row in
`references/knowledge/INDEX.md`. **This is how domain expertise compounds across projects.**

### Research Mode (invoked by other skills)

When another skill calls analyze-domain with a specific question:

1. Read the existing `docs/specs/domain-profile.md`
2. If the answer is in the profile: return it immediately
3. If not: analyze locally; invoke `research` only when `researchDecision(question)` returns `external_research_required`, then update the domain profile with the finding and return the answer
4. If research reveals a capability gap: invoke `discover-skills` to check for external skills

### Update Mode (existing domain-profile.md)

When a domain profile already exists, compare package.json against its Tech Stack and
vision.md against its Industry/Domain. On change, update the profile, running
`researchDecision` per new-area question and researching only when
`external_research_required`. Otherwise report "domain profile is current".

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

When invoked with `--audit` to re-evaluate the domain profile, check whether package.json
still matches the declared stack, whether new code or research resolved any low-confidence
gaps, and whether stack convention packs still match current framework versions; report
section-by-section CURRENT/STALE/OUTDATED.

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

**Discovery wave (WI-387 — opt-in, faster):** analyze-domain, analyze-competitors, and build-personas each need only `vision.md` and write disjoint paths, so they can run as ONE concurrent wave via `dispatch-waves` (catalog-domain-capabilities as wave 2) instead of the serial chain — ~55% faster discovery. **Before dispatching, run the disjoint-write fence:** `node scripts/discovery-wave-fence.mjs` (fails closed on any write-scope overlap), because concurrent writers to one path corrupt each other. `validate-feature` still gates the merged discovery. Serial-domain-context is a soft, stated cost. See `references/discovery-wave.md`. Permitted mutating transport per the S5 policy (recorded 2026-06-09).

**After self-verify passes:** report the domain profile summary and follow `## Handback` at the end of this file; the lane graph, not this skill, names the next stage.

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

Run `node "$SVC_ROOT"/scripts/svc-next.mjs --root . --done analyze-domain --receipt load-skill` and follow the printed card: do only what its `SKILL` says. `progressive: true` means do not ask a person; it never names the next skill.
