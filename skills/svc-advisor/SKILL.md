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
    reads: ["user question", "calling context"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-KnowledgeIndexLoad
    trigger: always
    reads: ["references/advisor/framework-knowledge-index.md", "references/knowledge/svc/CAPABILITIES.md", "references/knowledge/INDEX.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2b-MechanicalFactVerification
    trigger: counts-or-wiring-claims
    reads: ["references/advisor/framework-knowledge-index.md Verify commands"]
    writes: [".svc/svc-advisor-fact-verification.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-RelevantEvidenceLoad
    trigger: always
    reads: ["references/knowledge/svc/details/*.md", "FRAMEWORK-STATE.md", "competitor CAPABILITIES.md files"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-CitedAnswerComposition
    trigger: always
    reads: ["loaded knowledge evidence", "citation requirements"]
    writes: ["assistant response"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-StalenessCompetitiveContext
    trigger: always
    reads: ["Last updated lines", "docs/specs/analyze-competitors.data.json", "references/templates/competitive-context-block.md"]
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
    - { path: "references/knowledge/svc/CAPABILITIES.md", artifact: svc-capabilities }
  optional:
    - { path: "references/knowledge/svc/details/*.md", artifact: svc-details }
    - { path: "references/knowledge/gstack/CAPABILITIES.md", artifact: gstack-capabilities }
    - { path: "references/knowledge/superpowers/CAPABILITIES.md", artifact: superpowers-capabilities }
    - { path: "references/knowledge/gsd/CAPABILITIES.md", artifact: gsd-capabilities }
    - { path: "references/knowledge/harness/CAPABILITIES.md", artifact: harness-capabilities }
    - { path: "FRAMEWORK-STATE.md", artifact: framework-state }
outputs:
  produces: []
  updates: []
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

## Process

### Step 1: Classify the question

All question types below resolve through Step 2's canonical advisor index
first; the CAPABILITIES/detail files named here are the depth layer.

| Question type | What to load |
|---|---|
| "Is svc good at X?" / "How does svc handle X?" | `svc/CAPABILITIES.md` → relevant detail file |
| "Is there a skill for X?" | `svc/CAPABILITIES.md` skills tables |
| "What's missing / what gap exists?" | `svc/CAPABILITIES.md` + `FRAMEWORK-STATE.md` Known Gaps |
| "Compare svc to gstack/superpowers for X" | `svc/CAPABILITIES.md` + target competitor's CAPABILITIES.md |
| "What do you think about this scenario?" | `svc/CAPABILITIES.md` + relevant details + competitor if relevant |

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
3. Then continue with the domain detail files below for depth.

Read `references/knowledge/svc/CAPABILITIES.md` next — it's the Layer-2 detail index.
Then read the specific detail file(s) that cover the question's domain:

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

Citation format: `references/knowledge/svc/CAPABILITIES.md § Pre-Pipeline` or
`FRAMEWORK-STATE.md § Known Gaps`. Be specific — "the knowledge says so" is not a citation.

### Step 4: Flag staleness

Check the `Last updated` line in the CAPABILITIES.md you read. If it's more than
30 days old, note it: "This analysis is from [date] — re-run `research` on svc if
you need current state."

### Step 5: Auto-surface Competitive Context (per WI-140 KNOW-01..03 + WI-142 GROUND-13)

When `docs/specs/analyze-competitors.data.json` exists for this project, append a `## Competitive Context` block to the answer using the template at `references/templates/competitive-context-block.md`. **WI-142 change:** auto-surface is no longer gated on topic-match against `references/knowledge/competitive-domains.json` — domain matching is now a *priority hint* that escalates the block's prominence, not a gate that decides whether to surface at all. Domain miss → still surface the block, with a generic landscape summary; domain match → surface the matching competitor mechanics first.

Source: project's `docs/specs/analyze-competitors.data.json`. If missing or stale per `validate-competitor-analysis-freshness.sh`, surface a stale-data warning rather than fabricating context (KNOW-03).

Domain-match examples (drive prominence, not surfacing): query mentions "loyalty", "rewards", "POS integration", "card-link", "fraud prevention", "enrollment flow", "checkout", "verification" → priority surface with matching mechanics first.

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
| 4 | Competitive context rule applied | If project competitor data exists, confirm the competitive-context block or stale-data warning was included. | |
| 5 | Counts mechanically verified | Every asserted count/wiring fact was re-derived via its index Verify command with output logged to `.svc/svc-advisor-fact-verification.log`, not quoted from memory. | |
| 6 | Citation format respected | Material claims carry `path § section` citations; no "the knowledge says so" without a path. | |

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

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
- Read and update `.svc/lane-tasks-<WI>.json` first — this is the cross-host,
  cross-session, cross-subagent source of truth.
- Host UI mirroring (TaskList/TaskUpdate in Claude Code; `/task` + `TaskList`/`TaskOutput` observation in Kimi; `update_plan` in Codex)
  is ONLY performed when running in the parent/top-level session. Detect via:
  host exposes TaskList tool AND no `SVC_SUBAGENT=1` marker in env. If either
  check fails, skip host mirroring — file state is the durable record; the
  orchestrator parent will re-read and re-mirror after the subagent returns.
- Subagents MUST NOT attempt TaskUpdate calls. Trying and failing is not
  graceful; it's silent drift between the subagent's intent and the host UI.
- This skill is usually terminal evidence or answer generation. If it was invoked from a task graph, update the current task only after the cited answer is ready.
- Mark this skill's task `completed` in `lane-tasks.json` before leaving the skill, then update the host-specific mirror
- Evaluate the next task's conditions from its description
- If runnable: mark the next task `in_progress`, persist it to `lane-tasks.json`, and load that skill before doing work (`Skill` tool in Claude Code; direct `SKILL.md` load by skill name in Codex)
- If skippable: mark the next task `completed` in `lane-tasks.json` with a skip reason, then mirror that status and evaluate the one after
- Per `route-workflow` Task-Graph Execution Protocol

---

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
