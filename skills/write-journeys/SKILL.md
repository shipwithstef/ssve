---
name: write-journeys
version: "1.0"
description: >
  Generate or update BDD journey docs (.feature.md) with Gherkin scenarios traced to spec
  ACs. Use for 'generate journeys', 'define user flows', 'journey coverage', 'journey
  sync', 'discover journeys', or when specs exist but docs/specs/journeys/ does not.
phases:
  - { id: P1-InputAudit, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-ScenarioGeneration, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P3-Traceability, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P4-JourneyIndex, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
  optional:
    - { path: "docs/specs/journeys/J*.feature.md", artifact: existing-journeys }
outputs:
  produces:
    - { path: "docs/specs/journeys/J*-<name>.feature.md", artifact: journey-docs }
    - { path: "docs/specs/journeys/Chrome-*.feature.md", artifact: chrome-journey-docs }
    - { path: "docs/specs/journeys/J-CAP-*.feature.md", artifact: capability-journey-docs }
    - { path: "docs/specs/journeys/JOURNEY_INDEX.md", artifact: journey-index }
    - { path: "docs/specs/journeys/SUMMARY.md", artifact: chrome-discovery-summary }
chain:
  lanes:
    greenfield: { position: 9, prev: audit-ac, next: design-ux }
    brownfield-feature: { position: 5, prev: audit-ac, next: design-ux }
    drift: { position: 2, prev: sync-spec-code, next: sync-work-items }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Journey Sync

Generate and maintain BDD journey documents that describe how real users move through
the product across multiple features. Journeys are the connective tissue between
capability specs (what the system can do) and E2E tests (proving it works).

**Announce at start:** "I'm using the write-journeys skill to generate journey scenarios."

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-InputAudit --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ScenarioGeneration --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-Traceability --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-JourneyIndex --evidence file:<path>
```

**The three-layer model:**
- **SDD** (feature specs) — what to build and why → `docs/specs/features/*.md`
- **BDD** (journey docs) — how users behave across features → `docs/specs/journeys/*.feature.md`
- **TDD** (E2E tests) — automated proof it works → `e2e/*.spec.ts` or `test/`

Journey docs use Cucumber's Markdown with Gherkin (MDG) format: standard GitHub-flavored
markdown with Gherkin scenarios embedded using `#` headers for keywords and `-` list items
for steps. Files use the `.feature.md` extension. This renders beautifully on GitHub while
remaining parseable by the Gherkin parser (JS v19.0.0+).

See references/persona-trace-contract.md for "Persona Trace Contract" (full detail moved verbatim).

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before running any journey mode.

- `bootstrap`: initialize missing journey/spec folders and generate first baseline journeys.
- `convert`: inventory existing flows/tests/docs and map them into journey format before
  introducing new naming or file conventions.

---

## Prerequisites

Journey-sync depends on accurate, up-to-date feature specs. Before running for the
first time (or after significant code changes), ensure:

1. **sync-spec-code** has been run — specs reflect what code actually does
2. **audit-ac** has been run — every user story has complete, testable ACs

Check this automatically at the start of every run:

```bash
# Check when sync skills last ran (look for recent spec changes)
git log --oneline -5 --format="%h %s" -- docs/specs/features/
```

If the last spec-touching commit is NOT from a sync skill, warn the user:
"Feature specs may be stale. Run `/sync-spec-code` then `/audit-ac` first
for best results. Continue anyway?"

---

## Modes

### Mode 1: Bootstrap (first run, no journeys exist)

Triggered when `docs/specs/journeys/` doesn't exist or is empty.
This is the big initial generation. Works in iterations to avoid overwhelming the user.

### Mode 2: Expand (journeys exist, add more)

Triggered when journeys exist but coverage is incomplete.
Adds new journeys for uncovered personas or feature combinations.

### Mode 3: Refresh (journeys exist, check for drift)

Triggered when the user says "sync journeys" or "are journeys up to date?"
Compares journey AC references against current feature specs. Flags broken refs,
new ACs not covered by any journey, and stale scenarios.

### Mode 4: Migrate (old test runbooks exist)

Triggered when `MANUAL_TEST_RUNBOOK_*.md` or similar legacy journey docs are detected.
Extracts useful flows from legacy docs, generates proper journey files, and archives
the originals.

See references/modes.md for "Mode 5: Auto (full codebase, no stopping)" (full detail moved verbatim).

### Mode 6: Tiered Auto-Discovery (proposal gate, new product or full reset)

Triggered when the user says "tiered journeys", "discover journeys", "classify journeys",
"journey tiers", "full journey discovery", "journeys from personas", or is starting
fresh on a product that already has persona files and feature specs but no journeys yet.

Mirrors the structure of build-personas Mode 7: reads specs deeply, proposes a
classified journey set (Tier 1/2/3) for the user to approve BEFORE writing a single
journey file, then builds only what was approved. Tier 2 journeys show both the
current path (what works today) and the enhanced path (what becomes possible with
1-3 backlog additions). Tier 3 journeys become stub files only.

See references/modes.md for "Mode 7: Regression Refresh" (full detail moved verbatim).

See references/modes.md for "Mode 8: Chrome Auto-Discovery" (full detail moved verbatim).

See references/modes.md for "Mode 9: Capability Auto-Scaffolding" (full detail moved verbatim).

## Phase 1: Deep Project Analysis

This is the most important phase. You MUST deeply understand the product before
generating a single journey. Shallow reading produces generic, disconnected output.

See references/phase-1-deep-project-analysis.md for "1a. Read ALL feature specs — FULLY, not just headers" (full detail moved verbatim).

### 1b. Map the journey BEFORE writing it

After reading specs, create a written outline of the journey:

```
JOURNEY MAP: [title]
Step 1: User is on [screen]. They see [what]. They choose [action] because [motivation].
Step 2: System responds with [what]. User now sees [screen/state].
Step 3: User decides [choice] because [goal]. If [alternative], then [branch].
...
```

This map is your draft. It forces you to think through the COMPLETE experience
before writing Gherkin. If you can't describe what the user sees at every step,
you haven't read the specs deeply enough. Go back and read more.

### 1c. Read existing E2E tests for real flow evidence

```bash
ls e2e/*.spec.ts test/e2e/*.spec.ts web/e2e/*.spec.ts 2>/dev/null
```

E2E tests encode REAL flows — actual selectors, actual navigation, actual assertions.
Read the test bodies (not just names) to understand:
- What screens actually exist
- What the real navigation flow is
- What assertions are made (these are the real "Then" steps)
- Where tests use workarounds (reveals gaps in the product)

### 1c. Read existing journeys (Mode 2/3)

```bash
ls docs/specs/journeys/*.feature.md 2>/dev/null
```

### 1d. Read legacy docs (Mode 4)

```bash
ls docs/testing/MANUAL_TEST_RUNBOOK_*.md 2>/dev/null
```

Extract user flows described in legacy docs. These are proto-journeys — the flows
are valuable even if the format is wrong.

### 1e. Read spec index

```bash
cat docs/specs/INDEX.md 2>/dev/null
```

The index often has a feature dependency map or coverage matrix.

### 1f. Build the feature graph

From what you've read, build a mental model of:
- Which features reference each other (shared AC IDs, shared user stories)
- Which E2E tests cross feature boundaries
- Which features are entry points (onboarding, landing) vs mid-flow vs terminal
- What user types exist (look for persona references in specs, entity types, role systems)

Output a summary: "Here's what I understand about this project's feature graph..."

---

See references/phase-2-load-personas-from-build-persona.md for "Phase 2: Load Personas (from build-personas)" (full detail moved verbatim).

## Phase 3: Generate Journeys (Iterative)

Work in batches. Each iteration generates 2-3 journeys, gets user approval,
then continues. This prevents overwhelming the user and allows course correction.

### Iteration 1: Critical journeys

Start with the journeys that matter most:
1. **New user activation** — signup to first value moment
2. **Core loop** — the thing users do most often (daily session)
3. **Conversion/upgrade** — free to paid, or equivalent

These are almost always the right starting three. Adjust based on the project.

### Iteration 2+: Expand by persona and coverage

For each subsequent iteration:
1. Check which personas have no journeys yet
2. Check which feature specs have ACs not referenced by any journey
3. Check which E2E tests don't map to a journey
4. Propose the next 2-3 journeys based on gaps

### Journey numbering

Use sequential IDs: J01, J02, J03...
File names: `J01-descriptive-name.feature.md`

See references/phase-3-generate-journeys-iterative.md for "Journey document format" (full detail moved verbatim).

### AC reference syntax

AC IDs use backtick-wrapped Gherkin tags on the line above each scenario:

```
`@MT-26` `@MT-30` `@CH-01`
# Scenario: Enter queue and get matched
```

This is:
- Parseable by the MDG Gherkin parser (tags)
- Grep-able: `grep -r '@MT-26' docs/specs/journeys/`
- Readable on GitHub (rendered as inline code)

See references/phase-3-generate-journeys-iterative.md for "Writing good scenarios" (full detail moved verbatim).

### What BDD scenarios MUST capture

Each scenario is a complete picture of the user's experience at that moment:
- **What the user sees** — screens, buttons, labels, indicators (in plain language)
- **What the user decides** and **why** — their goal, their motivation
- **What happens** as a result — transitions, feedback, confirmations
- **Alternative user paths** — what happens when the user chooses differently (e.g., skip tour, cancel auth, no match found)
- **Timing and feel** — how long things take, what loading states look like

### What BDD scenarios must NOT include

- **Emotional narration** — "I'm excited but nervous" is UX research, not BDD. Describe behaviors, not feelings.
- **Infrastructure failures** — "server is down", "internet drops", "GitHub is unavailable" belong in ops runbooks, not journeys.
- **Implementation details** — no file names, database columns, CSS classes, API endpoints.
- **Technical architecture** — "Supabase Realtime delivers in 200ms" becomes "my partner receives it almost instantly."

**The test:** Can this scenario step be verified by watching someone use the app?
If yes, it belongs. If it requires reading server logs or checking database state, it doesn't.

---

## Phase 3.5: Three-Layer Journey Analysis

Every journey must be analyzed through three lenses. Present each layer clearly
in the journey doc so the PM can see reality, intent, and gaps at a glance.

### Layer 1: What IS (spec-driven baseline)

Map the journey from existing feature specs. Every scenario step must trace to
a real AC ID. If the spec says it, include it. If the spec doesn't mention it,
don't invent it. This is the faithful reflection of the documented product.

Mark each scenario with its source: `[SPEC: feature-name]` so it's clear
which spec drives that behavior.

### Layer 2: What SHOULD BE (spec-ideal, implementation uncertain)

Some ACs in the spec may describe planned or partially built features. Flag these
honestly. The journey should include them (they're the intended experience) but
mark them so the PM knows what's aspirational vs confirmed:

- `[LIVE]` — this behavior is confirmed working (has passing E2E test or QA check)
- `[SPEC]` — the spec describes this, but no test confirms it's built
- `[PLANNED]` — the spec explicitly marks this as Phase 2/3/future

This prevents the journey from lying. A PM reading a `[SPEC]` step knows:
"This is what we designed but I should verify it actually works."

See references/phase-3-5-three-layer-journey-analysis.md for "Layer 3: What's MISSING + What's WRONG (journey reasoning)" (full detail moved verbatim).

See references/phase-3-5-three-layer-journey-analysis.md for "Routing Layer 3 findings to other skills" (full detail moved verbatim).

### When validate-feature routes BACK to write-journeys

Feature-discovery may route back here when it produces a brief for a feature
that needs journey coverage. When that happens, the brief becomes input to
the journey — read it for the business context, the persona mapping, and
the MVP scope. The brief's "Who / Problem" section directly informs the
journey's User Motivation. The brief's "Explicit Non-Scope" prevents the
journey from over-covering.

### Iteration flow with three layers

When presenting a journey to the PM:
1. First show the journey (Layers 1+2 woven together with status tags)
2. Then show the product gaps (Layer 3) as a separate section
3. Show the recommended skill routes for each finding type
4. Ask: "Which of these gaps should become real specs?"
5. If the PM approves gaps, create placeholder ACs in the relevant feature spec
   (with `[PLANNED]` status) and reference them in the journey

---

## Phase 4: Coverage Analysis

After generating journeys, produce a coverage report:

See references/phase-4-coverage-analysis.md for "AC Coverage Matrix" (full detail moved verbatim).

### E2E Test Mapping

For each E2E test file, show which journey (if any) it validates:
- Tests mapped to a journey: working as expected
- Tests NOT mapped to any journey: either standalone feature tests (fine)
  or cross-feature tests missing a journey doc (gap)

See references/phase-4-coverage-analysis.md for "Cross-Journey Dependency Graph (supply-side validation)" (full detail moved verbatim).

### Missing journey candidates

Identify feature combinations that have no journey but probably should:
- Features that share user stories
- Features connected by navigation flows
- Features that E2E tests exercise together
- **Producer-side flows with no journey** — if the dependency graph above found
  missing producer journeys, these are the top candidates for new journeys

Present as suggestions: "These feature combinations might need journeys..."

---

## Phase 5: Migration (Mode 4)

When legacy journey-like docs exist (manual test runbooks, old flow docs):

1. Read each legacy doc
2. Extract the user flows described
3. Map flows to current feature specs and AC IDs
4. Generate proper journey docs that capture the same flows
5. Archive originals: `mv docs/testing/MANUAL_TEST_RUNBOOK_*.md docs/testing/archive/`

Tell the user what was migrated and what was dropped (outdated flows that
no longer match the current product).

---

See references/phase-6-persist-state.md for "Phase 6: Persist State" (full detail moved verbatim).

See references/important-rules.md for "Important Rules" (full detail moved verbatim).

## Mode 6: Tiered Auto-Discovery

See [references/mode-6.md](references/mode-6.md) for full details — the complete
proposal-gated, tiered journey-discovery instructions (Phases 6A–6E, deep read,
proposal gate, tier classification, output templates).

## Audit Mode

When invoked with `--audit` to review existing journeys:

1. Glob `docs/specs/journeys/J*.feature.md`
2. For each journey:
   - Persona referenced exists in `docs/specs/personas/`?
   - ACs referenced exist in the linked feature spec?
   - Layer 3 analysis: any ungrounded preconditions?
   - Background steps: do producer journeys exist for each dependency?
3. Cross-journey check: are there dead-end flows (journey ends but user has no next step)?
4. Report: journey-by-journey PASS/WARN/FAIL

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
| 1 | At least one journey file exists | `ls docs/specs/journeys/J*.feature.md` | |
| 2 | JOURNEY_INDEX.md exists | `test -f docs/specs/journeys/JOURNEY_INDEX.md` | |
| 3 | Layer 3 analysis completed | verify Layer 3 section present in journey output | |
| 4 | E2E bridge validated | `node scripts/verify-journey-e2e-bridge.mjs docs/specs/journeys/*.feature.md` passes for generated E2E-ready journeys | |
| 5 | Journey format validates | `node scripts/validate-journey-format.mjs --root .` passes | |
| 6 | AC/persona coverage validates | `node scripts/verify-journey-coverage.mjs --root .` passes | |

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
- In greenfield lane: `design-ux --progressive --lane greenfield`
- In brownfield-feature lane: `design-ux --progressive --lane brownfield-feature`
- In drift lane: `sync-work-items --progressive --lane drift`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `design-ux`" (greenfield or brownfield-feature), or "`sync-work-items`" (drift)

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

**Boilerplate rationale:** references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup for journey skills. The duplicated host-specific chaining blocks stay temporarily for host readability; future changes should update the shared phase-receipt/task-graph references first and use validators instead of hand-maintaining divergent journey-skill copies.
