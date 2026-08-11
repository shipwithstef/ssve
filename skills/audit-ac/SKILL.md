---
name: audit-ac
version: "1.0"
description: >
  On-demand audit of feature specs to ensure every User Story has complete, testable acceptance
  criteria. Rewrites vague ACs and writes missing ones. Two modes: (1) single feature —
  "audit-ac feature-learning" or "check ACs for matching", (2) all features — "audit-ac" or
  "audit all specs". Triggers on: "audit-ac", "check the ACs for [feature]", "audit the spec",
  "are the ACs complete", "make sure all ACs are defined", "prep [feature] for QA".
phases:
  - id: P1-ModeSpecSelection
    trigger: always
    reads: ["REPO_MODES.md", "docs/specs/features/*.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SpecReadAndACDiscovery
    trigger: always
    reads: ["docs/specs/features/<name>.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-FormatConversion
    trigger: always
    reads: ["docs/specs/features/<name>.md", "legacy AC formats"]
    writes: ["docs/specs/features/<name>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ACQualityRewrite
    trigger: always
    reads: ["docs/specs/features/<name>.md", "_shared/product-question-format.md"]
    writes: ["docs/specs/features/<name>.md", "docs/specs/features/<feature>-questions.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-EdgeCaseCoverage
    trigger: always
    reads: ["docs/specs/features/<name>.md"]
    writes: ["docs/specs/features/<name>.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SummarySelfVerify
    trigger: always
    reads: ["docs/specs/features/<name>.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional: []
outputs:
  produces:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec-audited }
chain:
  lanes:
    greenfield: { position: 8, prev: write-spec, next: write-journeys }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Spec-Sync: Acceptance Criteria Completeness

Ensure every User Story in a feature spec has complete, specific, testable acceptance criteria.
Fix what's vague. Write what's missing. The feature spec is the **single source of truth** — all
AC status (QA, E2E coverage) lives in the spec, not in separate files.

**Announce at start:** "I'm using the audit-ac skill to audit acceptance criteria."

## Product Questions — MANDATORY format

When an AC is vague or missing and the product intent is ambiguous, raise as a question in `_shared/product-question-format.md` rather than inventing the answer. Append to `docs/specs/features/<feature>-questions.md` with `phase: audit-ac`. Vague-AC rewriting must preserve product intent captured via these questions.

---

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before auditing.

- `bootstrap`: if feature specs do not exist yet, create starter spec skeletons and AC tables first.
- `convert`: adapt existing spec formats in-place and convert incrementally to AC table contract.

---

## Mode

**Single feature** — user names a feature or passes a spec file name:
→ Audit that one spec only.

**All features** — user says "all", "everything", or gives no specific feature:
→ List all `.md` files in `docs/specs/features/` and audit each one.

```bash
ls docs/specs/features/*.md
```

---

## AC Table Format

All ACs MUST use this table format. This is the shared contract across all skills
(`audit-ac`, `test-journeys`, `write-e2e`, `sync-spec-code`).

```markdown
### Acceptance Criteria — [Section Name]

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| NAV-01 | Lounge appears as top-level nav | — | 🔲 | — |
| NAV-02 | Four tabs switch without reload | ✅ 03-15 | ✅ | 60-lounge-nav:35 |
```

**Column definitions:**
- **AC** — unique ID: `{SECTION-PREFIX}-{NN}` (e.g., `NAV-01`, `CHT-07`, `VIS-03`)
- **Description** — testable criterion (one behavior per row)
- **QA** — manual test status (set by `test-journeys`, not this skill):
  - `✅ MM-DD` = passed live
  - `✅ MM-DD (code)` = passed via code inspection
  - `❌ MM-DD` = failed
  - `⚠️ MM-DD` = partial (some aspects pass, issue noted)
  - `⏭️ reason` = untestable (hardware/env)
  - `—` = not yet tested
- **E2E** — automated test coverage (set by `write-e2e`, not this skill):
  - `✅` = covered by E2E test
  - `🔲` = not yet covered (but could be)
  - `⛔` = can't be E2E tested
- **Test** — E2E test file reference: `{spec-file}:{test-name-or-line}` or `—`

---

## The Audit

### 1 — Read the whole spec first

Read the spec fully before evaluating anything.

### 2 — Find AC sections

Look for AC tables (the format above), `### US-N:` sections, `## Acceptance Criteria`,
or `- [ ] / - [x]` checkbox lists.

> **Feature graph (WI-390).** On svc-native specs, the AC table is the source for
> the `ac` nodes in `.svc/feature-graph.json` — the relational store wiring
> story→AC→journey→test→task. Build/refresh it with
> `node scripts/build-feature-graph.mjs build --spec <spec> --journeys "<glob>"`;
> it FAILS on an orphan `@AC` tag (no AC node) and emits POINTERS only (the graph
> never copies AC prose — the spec stays authoritative). Coverage matrices are
> rendered views: `render-coverage-matrix.mjs --check`. See `references/feature-graph.md`.
> audit-ac keeps editing the `.md` in place; this is additive.

If the spec has **no** AC sections at all: add a `## Acceptance Criteria` section at the end,
deriving entries from the spec's behavior description.

### 3 — Convert old formats to table format

**If the spec uses `- [ ] / - [x]` checkbox format**, convert to the AC table:
- Assign AC IDs using a section prefix (e.g., `NAV-`, `CHT-`, `VIS-`)
- `- [x] text` → row with QA=`✅` and E2E=`🔲` (implementation confirmed, test status unknown)
- `- [ ] text` → row with QA=`—` and E2E=`🔲`

**If the spec already uses `| ID | Acceptance Criterion |` two-column tables**, add the missing columns:
- Append `| QA | E2E | Test |` to the header
- Set QA=`—` and E2E=`🔲` and Test=`—` for each row

**If the spec already has the full 5-column table**, preserve existing QA/E2E/Test values.
Never overwrite another skill's data.

### 4 — Evaluate each AC

For every AC, ask: **can a tester verify this purely from reading it, with no follow-up questions?**

| Example | Verdict |
|---------|---------|
| `Tapping a locked lesson shows "Complete previous lesson first"` | ✅ specific condition, exact text |
| `Path card displays title, module count, and 0% progress when not enrolled` | ✅ exact fields + initial state |
| `Academy loads correctly` | ❌ rewrite — "correctly" is undefined |
| `User sees path progress` | ❌ rewrite — what exactly is shown? |
| `Badge is awarded` | ❌ rewrite — when? under what condition? |

Rewrite vague ACs to be specific. Specify exact text, exact condition, exact state change.

### 5 — Write missing ACs

For any section with no ACs, or that only covers the happy path:
- Write ACs from the spec's behavior description
- Cover edge cases: empty states, error states, locked/disabled states, boundary conditions
- New ACs get QA=`—`, E2E=`🔲`, Test=`—`

**Viewport coverage (Web UI ACs):** For any AC describing a UI element visible in the web SPA,
ask whether it behaves differently at mobile viewport (hamburger menu open, narrow screen).
If so, write **separate ACs** — one tagged `[Web]` for desktop, one tagged `[Web, mobile viewport]`
for the hamburger/narrow view. A single generic AC is not enough when layout changes between breakpoints.

### 6 — Update the spec in place

Edit the spec file directly:
- Replace vague ACs with specific ones (keep same AC ID, update Description)
- Add missing ACs with new sequential IDs
- Leave already-good ACs unchanged
- Preserve QA/E2E/Test values — never reset another skill's data
- Do not change anything outside AC sections (problem statement, schema, metrics, design)

---

## Output

This skill writes **only to the feature spec file**. No separate checklist files.

After updating each spec, report inline:

```
## audit-ac — [feature-name].md

| Section | Total ACs | Pre-existing | Added/rewritten |
|---------|-----------|-------------|-----------------|
| Navigation | 6 | 5 | 1 added, 2 rewritten |
| Visibility | 9 | 6 | 3 added, 2 rewritten |
| **Total** | **85** | **64** | **21** |

Format conversions: [note if converted from checkbox or 2-column table]
```

### All-Features Mode

After all specs are done:

```
## Spec-Sync Complete

| Spec            | US Sections | ACs Added/Rewritten | Format Converted |
|-----------------|-------------|---------------------|------------------|
| feature-learning.md | 5           | 3                   | checkbox → table  |
| feature-matching.md  | 6           | 8                   | already table     |

Specs with no AC sections: [list any]
```

---

## Testable AC Rubric

An AC is testable when someone with no code access can perform a specific action and verify
an exact output. Before writing or approving any AC, check against this rubric:

- **Explicit trigger** — states what the user does or what condition exists
- **Exact expected output** — names the visible result, text, state change, or error
- **No undefined terms** — avoids "correctly", "properly", "works", "handles", "appropriate"
  (these words hide missing requirements — what does "correctly" mean?)
- **No comparative language without baseline** — "faster", "better", "improved" need a number
  or a before/after description, otherwise they can't be verified
- **One core behavior per row** — if a row covers two independent things, split it (see Compound AC Detection)

### Bad → Good Rewrites

| Bad AC | Problem | Good AC |
|--------|---------|---------|
| User profile loads correctly | "correctly" is undefined | Profile page displays display name, avatar, and bio within 2s of navigation |
| Error handling works | "works" hides the requirement | Submitting an empty form shows "All fields are required" inline error |
| Badge is awarded | No trigger condition | Completing all lessons in a path awards the "Path Complete" badge on the profile |
| Performance is improved | No baseline, no number | Page load time is under 1.5s on 3G throttle (Lighthouse) |
| Navigation works on mobile | "works" + vague scope | Tapping the hamburger menu opens the nav drawer; tapping outside closes it |

---

## SPLIT vs REWRITE vs ADD Decision Tree

This is the core decision when evaluating an existing AC. The wrong choice wastes effort
(rewriting something that just needed splitting) or misses the real problem (adding a new AC
when the existing one was misleading).

```
Is there an AC for this behavior at all?
├── NO → ADD a new AC (new sequential ID, QA=—, E2E=🔲, Test=—)
└── YES → Read the existing AC:
    ├── References outdated schema, fields, or removed behavior?
    │   └── REWRITE (keep same AC ID, update description)
    ├── Uses undefined terms ("correctly", "properly", "handles")?
    │   └── REWRITE (keep same AC ID, make it specific)
    ├── Contains 2+ independently-verifiable assertions joined by "and"/"or"?
    │   └── SPLIT — ask: "Can one part fail while the other passes?"
    │       ├── YES → Split into separate ACs (original ID + new ID)
    │       └── NO → Leave as-is (it describes a single composite state)
    └── Happy path only, no edge-case AC exists for this section?
        └── ADD edge-case ACs (error, empty, boundary, disabled states)
```

**Why SPLIT matters**: compound ACs hide failures. If one half passes and the other fails,
the AC is marked as failed even though half the behavior works — or worse, a tester marks it
passed because the first half looked fine and they didn't check the second.

---

## Compound AC Detection

A compound AC joins two or more independently-verifiable assertions in a single row.
These are problematic because partial failures get hidden.

**Signals of a compound AC:**
- Uses "and" or "or" joining two distinct checks
- One part can fail while the other passes
- A tester would need to verify two unrelated things to mark it done

**Compound (split it):**
- "Profile shows avatar **and** notification badge updates on new message" — avatar display
  and notification state are independent; one can break without the other
- "Form validates email **and** redirects to dashboard on success" — validation and redirect
  are separate behaviors at different steps

**NOT compound (leave it):**
- "Card displays title, subtitle, and status icon" — these are a single composite visual state;
  if the card renders, all three appear together. A tester checks one thing: does the card look right?
- "Toast appears with message text and dismiss button" — the toast is one unit; the button is
  part of the toast, not independent

**The test**: ask "can one part fail while the other passes in normal usage?" If yes, split.

---

## E2E Feasibility Guidance

When setting the E2E column, distinguish between "can't be tested automatically" and
"could be tested but no test exists yet."

**Mark as ⛔ (can't be E2E tested) when:**
- Requires a real external service that has no sandbox/mock (e.g., real payment charge,
  real SMS delivery, real OAuth from a provider with no test mode)
- Depends on time-sensitive state that can't be simulated (24h cooldowns, scheduled jobs
  that run at specific times, calendar-based triggers)
- Requires hardware interaction (camera, accelerometer, NFC, Bluetooth)
- Requires visual/perceptual judgment that automation can't verify ("looks good", "animation is smooth")

**Mark as 🔲 (not yet covered, but feasible) when:**
- A mock or test mode exists for the external service but no test uses it yet
- The behavior is deterministic and UI-verifiable but nobody wrote the test
- It requires specific test data setup but the setup is scriptable

The distinction matters because ⛔ means "skip this in E2E planning forever" while 🔲
means "add this to the backlog."

---

## Implementation Notes Conflict Detection

Before evaluating ACs, scan the spec for implementation notes, changelog entries, or
"RESOLVED" / "CHANGED" annotations. These often document schema changes, renamed fields,
or removed behaviors that happened after the ACs were originally written.

**Check for:**
- AC references a field or API that an implementation note says was renamed or removed
- AC describes behavior that a changelog entry says changed
- AC uses terminology that doesn't match current implementation notes

**When found:** flag the AC for REWRITE with a note explaining the conflict. Don't silently
fix it — the mismatch might indicate the AC was correct and the implementation note is wrong,
or vice versa. Surface the conflict so the right call can be made.

This step exists because specs are living documents. ACs written at design time often become
stale when implementation notes are added later, and nobody goes back to reconcile them.

---

## Edge Case Coverage

For every section of ACs, check: does the section only cover the happy path?

**Minimum edge-case coverage per section:**
- At least one **error state** AC (what happens when something goes wrong?)
- At least one **empty/initial state** AC (what does the user see before any data exists?)
- At least one **boundary condition** AC (max length, zero items, permission denied, rate limit)

Don't require exhaustive coverage of every possible edge case — that leads to AC bloat.
Instead, flag sections that have **zero** edge-case ACs. A section with 5 happy-path ACs
and 0 error/empty/boundary ACs almost certainly has gaps that will surface as bugs in QA.

When adding edge-case ACs, derive them from what the spec describes. Don't invent behaviors
the spec doesn't cover or imply — just ensure that for each happy-path behavior, the obvious
"what if it fails?" question has an answer somewhere in the AC table.

---

## Rules

- Don't invent behaviors not in the spec or clearly implied by the feature
- Don't rewrite ACs that are already specific and testable — leave them alone
- Don't change anything outside AC sections
- Each AC must be independently verifiable — no compound "and" chains covering multiple things
- Never overwrite QA, E2E, or Test columns — those belong to other skills
- Never produce separate `*-ac-checklist.md` files — the spec is the single source of truth

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeSpecSelection --evidence command_output:.svc/audit-ac-spec-selection.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SpecReadAndACDiscovery --evidence command_output:.svc/audit-ac-discovery.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-FormatConversion --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ACQualityRewrite --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-EdgeCaseCoverage --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SummarySelfVerify --evidence command_output:.svc/audit-ac-self-verify.log
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

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | AC table uses shared contract format | check AC tables use `| AC | Description | QA | E2E | Test |` header | |
| 2 | No compound ACs | verify no AC rows contain multiple independent assertions joined by "and"/"or" | |
| 3 | Every story has >= 2 ACs | count AC rows per story section >= 2 | |

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
- Invoke next skill: `write-journeys --progressive --lane greenfield`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `write-journeys`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
