---
disable-model-invocation: true
name: svc-advisor
version: "1.0"
description: >
  Answer questions about the svc framework grounded in stored knowledge —
  not improvised. Use when the user asks "is svc good at X?", "how does
  svc handle Y?", "what's missing for Z scenario?", "compare svc to
  gstack/superpowers for X", "is there a skill for X?", "what do you think
  about this case?", or any question about framework quality, capability,
  or coverage on a specific scenario. Always invoke this before giving an
  opinion about the framework — your improvised answer will be weaker than
  what the analyzed knowledge says.
phases:
  - id: P1-QuestionClassification
    trigger: always
    reads: ["user question", "calling context", "phase triggers and evidence applicability"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-KnowledgeIndexLoad
    trigger: always
    reads: ["relevant block of references/advisor/framework-knowledge-index.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2b-MechanicalFactVerification
    trigger: counts-or-wiring-claims
    reads: ["references/advisor/framework-knowledge-index.md Verify commands"]
    writes: [".svc/svc-advisor-fact-verification.log"]
    evidence_kind: command_output
    required_for_completion: false
  - id: P3-RelevantEvidenceLoad
    trigger: additional-evidence-needed
    reads: ["only detail, framework state or competitor evidence needed beyond the advisor index"]
    writes: []
    evidence_kind: command_output
    required_for_completion: false
  - id: P4-CitedAnswerComposition
    trigger: always
    reads: ["loaded knowledge evidence", "citation requirements"]
    writes: ["assistant response"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-StalenessCompetitiveContext
    trigger: always
    reads: ["dates on cited evidence", "relevant competitor data only for comparison questions"]
    writes: ["assistant response"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["Self-Verify checklist", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "references/advisor/framework-knowledge-index.md", artifact: advisor-index }
  optional:
    - { path: "references/knowledge/svc/CAPABILITIES.md", artifact: svc-capabilities }
    - { path: "references/knowledge/svc/details/*.md", artifact: svc-details }
    - { path: "references/knowledge/gstack/CAPABILITIES.md", artifact: gstack-capabilities }
    - { path: "references/knowledge/superpowers/CAPABILITIES.md", artifact: superpowers-capabilities }
    - { path: "references/knowledge/gsd/CAPABILITIES.md", artifact: gsd-capabilities }
    - { path: "references/knowledge/harness/CAPABILITIES.md", artifact: harness-capabilities }
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
outputs:
  produces:
    - { path: ".svc/svc-advisor-fact-verification.log", artifact: fact-verification-log, note: "appended when P2b runs" }
  updates:
    - { path: ".svc/lane-tasks-<WI>.json", artifact: lane-tasks, note: "task graph closeout" }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# svc Advisor

Answer questions about the svc framework grounded in stored knowledge files.
The knowledge evolves — always read the files at query time, never answer from memory.

**Announce at start:** "I'm using svc-advisor to answer from stored framework knowledge."

---

## Why This Exists

Your improvised answer about svc's capabilities will be weaker than what the
analyzed knowledge says. The knowledge files were extracted systematically via
`research` and updated by `blend-external` and `improve-framework`. They contain
competitor comparisons, gap analysis, and decisions that aren't in your context.
Reading them first produces grounded, consistent, cross-session answers.

---

## Applicability (derived from the phase contract)

| Source phase | Apply when | Required work |
|---|---|---|
| P1-QuestionClassification, P2-KnowledgeIndexLoad | Always | Classify the question, record evidence/branch selection, read the relevant advisor index block. |
| P2b-MechanicalFactVerification | counts-or-wiring-claims | Run the index Verify command for every asserted count/wiring fact. |
| P3-RelevantEvidenceLoad | additional-evidence-needed | Load only evidence needed beyond the index; no automatic capability/detail sweep. |
| P4-CitedAnswerComposition, P5-StalenessCompetitiveContext, P6-SelfVerifyContinuation | Always | Cite the answer, check freshness of cited evidence, verify grounding and close the current task. Competitor context requires relevance. |

P1 records which conditional branches apply and why the evidence suffices. Optional phase metadata permits an untriggered branch to be absent; it does not excuse skipping triggered verification. Record actual conditional phase evidence only when executed. Never fabricate skipped receipts.

## Process

### Step 1: Classify the question

All question types resolve through Step 2's canonical advisor index first (`references/advisor/framework-knowledge-index.md`). The depth layer below is conditional on that index being insufficient; these are navigation hints, not required reads.

| Question type | What to load |
|---|---|
| "Is svc good at X?" / "How does svc handle X?" | `framework-knowledge-index.md § 1, § 8` → `svc/CAPABILITIES.md` (only if deeper detail needed) |
| "Is there a skill for X?" | `framework-knowledge-index.md § 1` + `skills-manifest.json` `includedSkills` |
| "What's missing / what gap exists?" | `framework-knowledge-index.md § 1, § 8` + `FRAMEWORK-STATE.md` Known Gaps |
| "Review topology, reviewer policy, or Cursor CLI x-high review stations" | `framework-knowledge-index.md § 3, § 6` + `FRAMEWORK-STATE.md § Session recovery and reviewer availability` |
| "Host wiring, hooks, or Landlock filesystem containment" | `framework-knowledge-index.md § 4, § 5` + `FRAMEWORK-STATE.md § Host Capability Matrix` |
| "Worktree authority, session recovery, or read-only observation" | `framework-knowledge-index.md § 5` + `FRAMEWORK-STATE.md § Session recovery` |
| "Receipts, pipeline baton, or L3 reconcile gate" | `framework-knowledge-index.md § 7` + `references/chain-receipt-contract.md` |
| "PreTool decision engine or guard arsenal" | `framework-knowledge-index.md § 4, § 8` + `hooks/lib/pretool-decision-engine.mjs` |
| "Commercial engine, landing benchmark, or direct-response video" | `framework-knowledge-index.md § 8` + `skills/benchmark-landing/SKILL.md`, `skills/landing-page/SKILL.md` |
| "5-layer Knowledge Spine or JIT topic recall" | `framework-knowledge-index.md § 8` + `skills/recall-stack-knowledge/SKILL.md` |
| "Self-evolution loop or framework improvement" | `framework-knowledge-index.md § 8` + `skills/evolve-framework/SKILL.md`, `skills/improve-framework/SKILL.md` |
| "Change Impact Triad, risk floors, or mutation impact proofs" | `framework-knowledge-index.md § 8` + `references/change-impact-triad.md` |
| "Persona Trace Contract, living BDD journeys, or persona grounding" | `framework-knowledge-index.md § 8` + `_shared/persona-trace-contract.md` |
| "Autonomous loops, recurring routines, or two-tier action model" | `framework-knowledge-index.md § 8` + `references/autonomous-loop-contract.md` |
| "Company Operating Fleet, multi-brain topology, or C-suite roles" | `framework-knowledge-index.md § 8` + `references/company-operating-fleet.md` |
| "Context budget, degradation tiers, or subagent token economics" | `framework-knowledge-index.md § 8` + `references/context-budget.md` |
| "Compare svc to gstack/superpowers for X" | `framework-knowledge-index.md § 1, § 8` + target competitor's CAPABILITIES.md |
| "What do you think about this scenario?" | `framework-knowledge-index.md § 1, § 8` + relevant details + competitor if relevant |

### Step 2: Load the canonical advisor index FIRST

**WI-FW-ADVISOR-KNOWLEDGE-01:** `references/advisor/framework-knowledge-index.md`
is the canonical first-load surface for framework facts (counts, lanes, gates,
review topology, host wiring, worktree authority, governors, routing). It
carries per-block `Derived-at` stamps and a mechanical **Verify** command per
fact block.

**Cite-before-assert contract:**

1. Any load-bearing count or wiring claim (skill/gate/host/validator counts,
   hook availability, review stations, lane lists) MUST be re-derived by
   running that block's Verify command — never quoted from memory, from this
   skill's prose, or from a stale knowledge pack. Append command + output to
   `.svc/svc-advisor-fact-verification.log` as phase evidence.
2. The index supersedes `svc/CAPABILITIES.md` count lines where they disagree;
   known-stale pack claims are flagged inside the index itself.
3. If the verified index block answers the question, compose the cited answer. Load domain detail only for an unresolved evidence need.

When more evidence is needed, use `references/knowledge/svc/CAPABILITIES.md` as the Layer-2 detail index, then load only the relevant detail:

| Domain | Detail file |
|---|---|
| Skills catalog, pipeline order, lane structure | `svc/details/skills.md` |
| Doctrine, methodology, anti-patterns | `svc/details/doctrine.md` |
| Infrastructure, hooks, scripts, host configs | `svc/details/infrastructure.md` |
| References, knowledge index, blend registry | `svc/details/references.md` |

For comparisons, load the competitor's CAPABILITIES.md from `references/knowledge/`.
Check `references/knowledge/INDEX.md` to see what sources exist and their versions.

For gap questions, also read `FRAMEWORK-STATE.md` — the Known Gaps section is the
authoritative list of what's been identified but not yet fixed.

**Don't load everything.** Load only what's needed to answer the specific question.
The knowledge files are large — loading all of them for a narrow question wastes context.

### Step 3: Answer with citations

Structure your answer:

1. **Direct answer** — yes/no/partial, stated plainly
2. **Evidence** — cite the specific file and section that supports the answer
3. **Nuance** — what the knowledge says about edge cases, limitations, or conditions
4. **Comparison** (if relevant) — what gstack/superpowers/gsd does differently and whether it matters
5. **Action** (if needed) — which skill to run, or whether a gap should be filed via `evolve-framework`

Citation format: `references/advisor/framework-knowledge-index.md § 1 (Identity & Counts)`, `references/advisor/framework-knowledge-index.md § 3 (Review topology)`, or `FRAMEWORK-STATE.md § Known Gaps`. Be specific — "the knowledge says so" is not a citation.

### Step 4: Flag staleness

Check dates only on evidence actually cited, including the used index block and any CAPABILITIES.md you read. Disclose missing dates; do not load an otherwise irrelevant file just to check its date. If it's more than
30 days old, note it: "This analysis is from [date] — re-run `research` on svc if
you need current state."

### Step 5: Relevant competitive context

Include competitive context only when it helps answer the actual comparison or product-domain question. Existing project competitor data alone does not make it relevant. For a relevant comparison, use `docs/specs/analyze-competitors.data.json` and `references/templates/competitive-context-block.md` as needed; disclose missing/stale evidence instead of fabricating a landscape summary. A narrow count/wiring answer needs its source and mechanical verification, not unrelated competitors.

---

## Answer Tone

- **Take a position.** "svc handles this well" or "svc handles this poorly" — not "there are tradeoffs."
- **Cite evidence.** Every claim maps to a file:section.
- **Surface the gap clearly** if the question reveals something the knowledge doesn't cover.
  Say "this isn't in the stored knowledge — it would need a `research` run to answer properly"
  rather than improvising.
- **Short.** One to three paragraphs. No unnecessary preamble.

---

## When the Knowledge Doesn't Cover It

If the stored knowledge doesn't answer the question:

1. Say so explicitly: "The stored knowledge doesn't cover this scenario."
2. Offer one of:
   - Run `research` to extract it (if it's about svc itself or a known source)
   - Run `evolve-framework` to analyze it as a gap
   - Answer from first principles with a clear disclaimer that it's not grounded in stored analysis

Never silently improvise when the knowledge is absent — that defeats the purpose of this skill.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Answer is grounded | Confirm every material claim cites a loaded knowledge file or clearly says the stored knowledge does not cover it. | |
| 2 | Relevant scope was loaded only | Verify advisor index plus only the detail or competitor files needed for the question were read. | |
| 3 | Staleness was handled | Check each cited capabilities file's last-updated date AND each used index block's Derived-at date; disclose if stale. | |
| 4 | Competitive context rule applied | If competitor context is relevant, confirm the evidence-backed block or scoped missing/stale-data disclosure; otherwise omit it. | |
| 5 | Counts mechanically verified | Every asserted count/wiring fact was re-derived via its index Verify command with output logged to `.svc/svc-advisor-fact-verification.log`, not quoted from memory. | |
| 6 | Citation format respected | Material claims carry `path § section` citations; no "the knowledge says so" without a path. | |

## Phase Receipt Contract

After loading this skill into a lane task graph, emit actual receipts for required phases and any triggered conditional phases. P1 records selection; P2b/P3 below run only when their triggers apply:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-QuestionClassification --evidence command_output:.svc/svc-advisor-question-classification.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-KnowledgeIndexLoad --evidence command_output:.svc/svc-advisor-knowledge-index.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2b-MechanicalFactVerification --evidence command_output:.svc/svc-advisor-fact-verification.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RelevantEvidenceLoad --evidence command_output:.svc/svc-advisor-evidence-load.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CitedAnswerComposition --evidence command_output:.svc/svc-advisor-cited-answer.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-StalenessCompetitiveContext --evidence command_output:.svc/svc-advisor-staleness-competitive-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/svc-advisor-self-verify.log
```

## Pipeline Continuation

### Task-graph mode (when authorized; source of truth: `.svc/lane-tasks-<WI>.json`)

Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In the parent Codex session, mirror only the active step in `update_plan`. These instructions apply only when a task graph is authorized; report-only and terminal-answer boundaries below remain controlling.

Read and update `.svc/lane-tasks-<WI>.json` first when invoked from a task graph. Complete the current task only after the cited answer and actual required phase evidence are ready. Follow `references/task-graph-chaining-protocol.md` for authorized handoffs: evaluate the next task's conditions, persist its status and load its skill before work; host UI is a parent-session mirror, and subagents do not call TaskUpdate.

This skill normally returns a terminal answer. Do not turn an answer request into automatic backlog execution. Continue only when the caller authorized further work.

## Examples of Good Answers

**Question:** "Is svc good at brownfield repos that already have specs?"

> **Yes, with conditions.** `svc/CAPABILITIES.md § Brownfield Conversion` shows Lane 2
> (onboard-repo) maps existing artifacts into svc working mode and produces
> `project-state.md` + `router-context.md`. If specs already exist, `sync-spec-code`
> runs first to verify alignment before any new work. The gap: `FRAMEWORK-STATE.md §
> Known Gaps` notes that onboard-repo doesn't yet handle repos where specs exist but
> aren't in svc format — it assumes either svc-native or no specs. For those cases,
> manual adaptation is needed before Lane 2 runs cleanly.

**Question:** "Compare svc's visual QA to gstack's for dark mode coverage."

> **gstack has a structural advantage.** `gstack/CAPABILITIES.md § Design Tools` shows
> gstack's review system includes a `design-checklist.md` with AI-slop detection and
> comprehension scoring built into the review gate. svc's `track-visuals` (added
> `svc/CAPABILITIES.md § QA`) does baseline/diff capture and review mode with the same
> comprehension rubric — but it's a sidecar, not embedded in the review gate. Practically:
> svc catches visual regressions when `track-visuals` is invoked; gstack catches them at
> every gate pass. For dark mode specifically, svc's S0/S1 tier classification (code
> inspection first, browser second) is more rigorous than gstack's grep-only approach.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
