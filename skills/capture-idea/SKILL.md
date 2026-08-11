---
name: capture-idea
version: "1.0"
description: >-
  Zero-friction backlog intake — formats a loose idea as a canonical repo work item without business validation or PRD ceremony. Use when: "store this idea", "just an idea", "remember this for later", "put this in the backlog", "someday maybe". Also: "quick capture", "rough idea", "don't forget", "I was thinking about"; From-Proposal Mode: "I want to build this now", "add this feature".
phases:
  - id: P1-LightContextLoad
    trigger: always
    reads: ["docs/specs/vision.md", "docs/specs/personas", "docs/specs/features", "docs/specs/work-items/INDEX.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SimilarityDirectiveScan
    trigger: always
    reads: ["raw user input", "docs/specs/features", "docs/specs/work-items"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-IdeaStructure
    trigger: always
    reads: ["raw user input", "directive signals", "source proposal"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-WorkItemEmission
    trigger: always
    reads: ["docs/specs/work-items/INDEX.md", "skills/capture-idea/references/from-proposal.md"]
    writes: ["docs/specs/work-items/WI-*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-IndexArchiveDecision
    trigger: always
    reads: ["docs/specs/work-items/WI-*.md", "proposals/*.md"]
    writes: ["docs/specs/work-items/INDEX.md", "proposals/done/*.md", ".svc/pipeline-decisions.jsonl"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyReport
    trigger: always
    reads: ["docs/specs/work-items/WI-*.md", "docs/specs/work-items/INDEX.md", ".svc/pipeline-decisions.jsonl"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/personas", artifact: personas }
    - { path: "docs/specs/features", artifact: feature-specs }
    - { path: "docs/specs/work-items/INDEX.md", artifact: work-item-index }
    - { path: "proposals/*.md", artifact: source-proposal, mode: "--from-proposal" }
outputs:
  produces:
    - { path: "docs/specs/work-items/WI-*.md", artifact: captured-idea }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Capture Idea

This skill is a frictionless intake hopper. When the builder has a thought they want
to preserve without being interrogated, this skill captures, lightly classifies,
deduplicates against existing items, and persists it as a canonical backlog work item.

**Announce at start:** "I'm using capture-idea to store your idea in the backlog without triggering validation."

## 1. Load Context (lightweight, non-blocking)

Before structuring, silently peek at project context to inform the classification and deduplication —
not to validate the idea, but to frame it better:

1. **Check `docs/specs/vision.md`** (if it exists): read the product one-liner and
   domain. This tells you which product the idea belongs to and helps give it a
   more precise title.

2. **Check `docs/specs/personas/` directory** (if it exists): scan persona names/roles only
   (first 5 lines of each file). This helps you note which persona the idea most
   benefits.

3. **Check `docs/specs/features/` and `docs/specs/work-items/`** (if they exist): scan titles
   and goals of existing features and work items to prepare for the similarity check.

4. **Do NOT block** if files are absent. Skip silently and proceed with what you have.

The point is light alignment and deduplication.

## 1.5. Similarity Check

Compare the new idea against the scanned features and work items:

1. **Search for Similarities:** Look for existing items that cover the same goal or context.
2. **Flag Duplicates:** If an item is 80%+ similar (covering the exact same user need), mark it as a "Potential Duplicate."
3. **Flag Overlaps:** If an item is 40-80% similar (covering a related but distinct need), mark it as "Related Item."

## 1.6. Directive Signal Detection

Pure intake means "save this for later, don't think about it now." Directive intake means "save this AND apply light product judgment to shape it." They are different user intents and they produce different WIs.

**Scan the raw input for directive phrases** before structuring:

| Signal type | Example phrases |
|---|---|
| Product judgment request | *"figure out (best X / what it should be)"*, *"pick the right X"*, *"what's the best way"*, *"recommend X"* |
| Capability / gap question | *"do we have X"*, *"can we X"*, *"check if we have"*, *"flag gaps"* |
| Conditional framing | *"if you think that will help"*, *"if it makes sense"*, *"if we can"* |
| Assessment request | *"assess this"*, *"is this good"*, *"does this fit"* |
| Embedded question mark | any `?` inside an otherwise-declarative intake |

**If ZERO directive signals fire:** this is pure intake. Skip to Step 2. Do NOT add a Product-Grounded Assessment section.

**If ONE OR MORE directive signals fire:** this is directive intake. Proceed to Step 2 as normal AND add a **Product-Grounded Assessment** section to the WI (template includes it in Step 4). The assessment must:

- Stay ≤ 200 words
- Answer the specific directive questions embedded in the input, using project context (vision.md, personas/, features/)
- NOT invoke validate-feature, write-spec, or research
- NOT ask the user any clarifying questions (still frictionless)
- Name any capability gaps the input asked about explicitly

The skill stays frictionless for pure intake. It stops being obtuse for directive intake. Both modes produce a WI in one turn without user interrogation.

## 2. Structure the Idea

Parse the builder's unstructured input into these components:

- **Goal:** What user-visible capability is this? One sentence.
- **Context:** Why did this come up? What problem or observation triggered it?
- **Hypothesized Value:** What outcome do we expect if this were built? Who benefits?
- **Broad Scope:** What are the rough moving parts? (Avoid technical design — stay conceptual.)
- **Persona Fit:** (optional) If a persona match is obvious from step 1, name it.
- **Similar Items:** (mandatory if any found) List IDs and titles of potentially duplicate or related items found in Step 1.5.
- **Product-Grounded Assessment:** (mandatory if Step 1.6 detected directive signals) ≤ 200 words answering the directive questions in the input, grounded in project context.

## 3. Generate a Next WI Number

Read `docs/specs/work-items/INDEX.md` to find the current highest WI number, then use
`WI-{N+1}`. If INDEX.md doesn't exist yet, start at WI-001.

```bash
# Get next WI number
ls docs/specs/work-items/WI-*.md 2>/dev/null | grep -oP 'WI-\K\d+' | sort -n | tail -1
```

## 4. Write the Work Item

Create `docs/specs/work-items/WI-###.md` using this exact template (canonical WI schema — see `references/work-item-schema.md`):

```markdown
# WI-###: [Idea Title]

**Type:** feature
**Status:** backlog
**Severity:** low
**Filed:** <ISO date>
**Source:** capture-idea
**Lane:** TBD

## Goal
[Extracted goal — one sentence]

## Context
[Context or problem statement — 2-3 sentences. What triggered this idea?]

## Hypothesized Value
[Expected benefit, and who benefits]

## Broad Scope
[High-level moving parts — concepts only, no technical design]

## Affected Files
- unknown: captured idea has not been designed yet

## Affected Specs
- unknown: captured idea has not been validated yet

## Persona Fit
[Named persona from docs/specs/personas/, or blank if unclear]

## Similar Items
[List of Similar Items found, or "None found"]

## Product-Grounded Assessment
[ONLY if Step 1.6 detected directive signals. ≤ 200 words. Answer the directive questions embedded in the input, grounded in project context (vision.md, personas, existing features). Name any explicit capability gaps. Otherwise omit this section entirely.]

## Notes
> Status: backlog — not yet validated. Use validate-feature to assess before building.
```

## 5. Update the Index

Append one line to `docs/specs/work-items/INDEX.md`, creating the file if it doesn't exist:

```markdown
- [WI-###](WI-###.md) — [Idea Title] — status:backlog
```

## 6. Report

Tell the builder:
- The WI number and file path where the idea was stored
- The persona match (if any)
- **Similarity Findings:** If any similar items were found, mention them: "Something like that might exist (see [ID])." If it's a potential duplicate, ask a follow-up: "This looks very similar to [ID]. Is this a duplicate or a new angle?"
- Confirm: "No validation triggered — this is safely in your backlog."

Do NOT:
- Invoke `validate-feature`
- Invoke `write-spec`
- Ask business questions (except for the duplicate follow-up)
- Ask for more detail (except for the duplicate follow-up)

## Rationalization Table

| Thought | Reality |
|---------|---------|
| "I should ask the user a few questions first to understand the idea better" | No. Store what you have. Still frictionless — even for directive intake, don't interrogate. |
| "I should run validate-feature to check if this is worth building" | No. The user explicitly chose NOT to validate yet. |
| "I should check if a similar WI already exists" | **MANDATORY.** Always check against features and work items to prevent bloat. |
| "The vision file doesn't exist, I can't proceed" | Vision is optional context. Store the idea without it. |
| "The user embedded 'figure out best way' in the intake — that's still pure intake" | **No.** Directive phrases (Step 1.6) trigger a Product-Grounded Assessment section ≤ 200 words. Do NOT ask the user, but do NOT ignore the directive. |
| "Directive signals fired — I should invoke validate-feature instead" | No. The user still said "log" / "store" / "capture." Stay in capture-idea. Just add the assessment section. |

## Red Flags

- You asked the user a business question → stop, store the idea as-is
- You mentioned `validate-feature` in the output → remove it
- You created a spec, journeys, or ACs → delete them; this is a backlog entry only
- You opened `docs/specs/features/` instead of `docs/specs/work-items/` → wrong path
- The input contained directive phrases (*"figure out"*, *"best way"*, *"check if we have"*) and you stored it with no Product-Grounded Assessment section → re-run Step 1.6, add the section
- You wrote a Product-Grounded Assessment > 200 words → this is capture-idea, not validate-feature. Compress to ≤ 200 words or route to validate-feature instead

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-LightContextLoad --evidence command_output:.svc/capture-idea-context.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SimilarityDirectiveScan --evidence command_output:.svc/capture-idea-similarity.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-IdeaStructure --evidence command_output:.svc/capture-idea-structure.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-WorkItemEmission --evidence file:docs/specs/work-items/WI-<n>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-IndexArchiveDecision --evidence file:docs/specs/work-items/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyReport --evidence command_output:.svc/capture-idea-self-verify.log
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

This skill does not chain. It is a standalone fast lane.
After completion, suggest: "Done. Idea safely stored in the backlog."

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## 7. From-Proposal Mode

When the builder invokes `capture-idea` with `--from-proposal <path>`, the skill switches to a deterministic promotion path that converts a reviewed proposal into one or more canonical work items. This is distinct from the freeform intake flow described in Sections 1–6 and does NOT run similarity checks, directive-signal detection, or product-grounded assessment.

**When to use this mode:**
- A proposal file under `proposals/<date>-<name>.md` has been reviewed (e.g., adversarial kimi + codex review converged).
- The builder wants each leaf item in the proposal's phased plan promoted to its own WI.
- For monolithic proposals (no phases), the mode emits exactly one WI.

**Invocation:**
```bash
node skills/capture-idea/scripts/emit-wis.mjs proposals/<date>-<name>.md
# or with a dry-run to preview
node skills/capture-idea/scripts/emit-wis.mjs proposals/<date>-<name>.md --dry-run
```

The emitter internally invokes `skills/capture-idea/scripts/parse-proposal.mjs` to build a deterministic JSON AST of the proposal, then iterates over leaves.

### 7.1 Grammar & parser contract

The canonical grammar for leaf detection, block extraction, and inheritance rules lives in `skills/capture-idea/references/from-proposal.md`. Summary:

- **Phase detection:** `### Phase <N>` or `### Phase <X>` at heading level 3.
- **Leaf detection (Pattern A — heading):** `##### P<N>.<M>` at heading level 5.
- **Leaf detection (Pattern B — table fallback):** used only when a phase has zero heading-based leaves.
- **Monolithic fallback:** if the proposal has zero `### Phase ...` headings, emit exactly one WI from the top-level content.
- **AC inheritance:** leaf with no Acceptance Criteria block inherits its parent phase's AC block. If neither exists, emit the `_TBD — defer to plan-changeset_` sentinel.

### 7.2 Self-exclusion rule (AC-01.1)

Before emitting any WI, the emitter scans `docs/specs/work-items/WI-*.md` for any existing WI whose `**Source:**` frontmatter field matches the candidate leaf's `source_anchor`. If a match is found, the leaf is **skipped** — no duplicate WI is created. This handles the bootstrap-exception case where a proposal's own P0.1 has already been authored as a WI before the `--from-proposal` mechanism existed.

Skipped leaves appear in the decision-log entry with `existing_wi` populated, and in the archival trailer as `**Skipped (already-existing):**`.

### 7.3 Idempotency contract

The mode covers four partial-failure / re-run states (per `skills/capture-idea/references/from-proposal.md` §6):

| Case | Detection | Behavior |
|---|---|---|
| A — fully complete | Proposal at `proposals/done/` + trailer present + all listed WIs exist + decision logged | Exit 0, message "already promoted — no action" |
| B — trailer missing | Proposal at `proposals/done/` without trailer, WIs exist | Re-append the trailer; no duplicate WIs |
| C — decision missing | Trailer present, WIs exist, no matching decision log entry | Append missing decision entry only |
| D — invoked on done-path | User passes `proposals/done/<basename>.md` | Detect via path prefix; run A/B/C detection |

All four cases exit 0; none create duplicates. Re-runs are safe.

### 7.4 Archival & audit trail

On successful emission:

1. The proposal moves from `proposals/<basename>.md` to `proposals/done/<basename>.md`.
2. A trailer is appended at EOF:
   ```
   ---
   **Promoted to:** docs/specs/work-items/WI-NNN.md, ...
   **Promoted at:** <ISO-8601 timestamp>
   **Skipped (already-existing):** WI-NNN (leaf P0.1) — per self-exclusion rule
   ```
3. One JSON line is appended to `.svc/pipeline-decisions.jsonl` with `decision_type: "taste"`, `skill: "capture-idea"`, `mode: "from-proposal"`, and lists of emitted + skipped leaves.

### 7.5 Bootstrap exception

The initial WI that builds this mode itself (currently `WI-073`) cannot be promoted via `--from-proposal` because the mode does not yet exist at the time WI-073 is authored. That WI is written via direct `write-spec` with a `mechanical` decision entry in `.svc/pipeline-decisions.jsonl`. All subsequent WIs drawn from the same proposal flow through this mode.

### 7.6 What this mode does NOT do

- Does not re-validate the proposal content — review convergence is upstream (via `review-plan` / adversarial kimi+codex).
- Does not run `validate-feature`, `write-spec`, or `research`.
- Does not prompt for clarification — the proposal's bytes are the contract.
- Does not touch `docs/specs/work-items/INDEX.md` or `DONE.md` beyond the WI file itself.
- Does not cross repositories — both the proposal and emitted WIs live in the current repo.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Captured WI is canonical | Verify the emitted `docs/specs/work-items/WI-*.md` uses the required work-item schema fields and a unique WI number. | |
| 2 | Intake stayed frictionless | Confirm no skills/validate-feature/write-spec/research workflow was invoked and no clarifying question blocked capture. | |
| 3 | Duplicate/overlap handling is recorded | Check the WI lists potential duplicate or related items when similarity was detected, or omits that section only when none were found. | |
| 4 | Proposal promotion is idempotent | In `--from-proposal` mode, verify skipped leaves, emitted WIs, archive trailer, and decision log agree. | |
