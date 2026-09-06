---
name: sync-spec-code
version: "1.0"
description: >-
  Audit feature specs against the actual codebase to find drift — PLANNED items now implemented, RESOLVED references pointing at dead files/lines — and update Implementation Notes. Single-feature or all-features mode. Use when: "does the spec reflect the code", "sync-spec-code", "audit spec vs code". Also: "check for spec drift", "check if spec is up to date", "sync spec to code". Single-feature form: "sync-spec-code feature-learning"; also "are the implementation notes current".
phases:
  - id: P1-ModeSpecSelection
    trigger: always
    reads: ["REPO_MODES.md", "docs/specs/features/*.md"]
    writes: []
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-SpecReadAndPlannedAudit
    trigger: always
    reads: ["docs/specs/features/*.md", "source code"]
    writes: ["docs/specs/features/*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-ResolvedReferenceAudit
    trigger: always
    reads: ["docs/specs/features/*.md", "source code", "git log"]
    writes: ["docs/specs/features/*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-NarrativeCodeDriftAudit
    trigger: always
    reads: ["docs/specs/features/*.md", "source code"]
    writes: ["docs/specs/features/*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-JourneyGapSpecCoverage
    trigger: always
    reads: ["docs/specs/journeys/*.feature.md", "docs/specs/features/*.md", "source code"]
    writes: ["docs/specs/features/*.md", "docs/specs/work-items/WI-*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-WorkItemSummarySelfVerify
    trigger: always
    reads: ["docs/specs/features/*.md", "docs/specs/work-items/INDEX.md"]
    writes: ["docs/specs/work-items/INDEX.md"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
  optional: []
outputs:
  produces:
    - { path: "docs/specs/features/*.md", artifact: annotated-specs }
chain:
  lanes:
    brownfield-feature: { position: 1, prev: null, next: validate-feature }
    drift: { position: 1, prev: null, next: write-journeys }
    refactor: { position: 1, prev: null, next: plan-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Spec-Code-Sync: Spec-to-Code Drift Audit

Find where a feature spec has drifted from what the code actually does. Update Implementation
Notes to reflect reality — turning PLANNED items into RESOLVED (with file:line proof) and
flagging RESOLVED references that have gone stale.

**Announce at start:** "I'm using the sync-spec-code skill to sync specs against the codebase."

## Product Questions — MANDATORY format

Expose spec/code drift and follow affected dependencies; do not silently choose existing code over intended behavior or stale specs over current owner decisions. Follow `_shared/product-question-format.md` with `phase: sync-spec-code`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work.

---

## Repository Mode Gate

Detect mode from `REPO_MODES.md` before audit.

- `bootstrap`: if no spec baseline exists yet, create minimal spec scaffolds first and mark
  initial implementation notes.
- `convert`: map existing docs/code conventions first, then perform drift audit without forcing
  immediate structural migration.

---

## Mode

**Single feature** — user names a feature or passes a file name:
→ Audit that one spec only.

**All features** — user says "all", "everything", or gives no specific feature:
→ List all `.md` files in `docs/specs/features/` and audit each one.

```bash
ls docs/specs/features/*.md
```

---

## The Audit

### Step 1 — Read the whole spec

Read the spec fully. Pay attention to:
- The Implementation Notes block (italicized `>` blockquote lines near the top)
- Any section describing behaviors, UI states, logic, or components
- PLANNED / RESOLVED / FIXED annotations

### Step 2 — Audit PLANNED items

For each `PLANNED` annotation, the spec is claiming: *this behavior is described but not yet in the code.*

Search the codebase to check if it's been implemented since:

```bash
# Find the relevant file
grep -r "keyword" web/src/ --include="*.tsx" --include="*.ts" -l

# Verify the specific behavior
grep -n "specificFunction\|specificString" web/src/path/to/file.tsx
```

**If code confirms it's implemented:**
- Change `PLANNED` → `RESOLVED YYYY-MM-DD` with file:line reference AND tier tag
- Tier tags: `[DB]` (schema/migration), `[API]` (route/handler), `[UI]` (component/page), `[TEST]` (test file), `[SERVICE]` (backend logic)
- Example: `> - **VA-5 RESOLVED 2026-03-22 [UI]:** LessonView.tsx:84 — "Mark Complete" now gated on lessonType === 'content'`
- Multi-tier: `> - **PAY-3 RESOLVED 2026-03-25 [API][DB][TEST]:** stripe-webhook.ts:22, payments.ts:45, payment.test.ts:18`

Tier tags let downstream skills (audit-implementation, verify-promotion) check
coverage per layer without re-scanning — they can see at a glance "AC PAY-3 is
verified at API and DB but not UI."

**`[TEST]`-tier corroboration (WI-391):** for the `[TEST]` tier specifically,
the spec's `Test`/`E2E` columns and the `[TEST]` tag are now backed by a
machine-readable anchor — the `@AC-<ID>` comments `write-e2e` emits into test
source. Run `node scripts/verify-test-ac-tags.mjs --root .` to derive, from the
tests themselves, which spec ACs carry a still-present correctly-tagged test,
and to fail on orphan tags (a `@AC-<ID>` naming an AC that was renamed or
removed). Use that derived result to corroborate `[TEST]`-tier `RESOLVED`
claims instead of re-greping by hand. This **does not** replace Steps 2-4's
judgment: a tag-grep cannot tell `REVERTED` (behavior intentionally removed)
from a test that was simply never tagged, cannot adjudicate partial
implementations, cannot reason about multi-tier `[DB][API][UI][TEST]` coverage,
and cannot clear the false-positive classes — those stay LLM-judged here. The
verifier corroborates the present-and-tagged case; everything else remains your
call.

**If still unimplemented:**
- Leave as PLANNED, optionally update the date if context has changed

### Step 3 — Audit RESOLVED / FIXED items

For each `RESOLVED` or `FIXED` annotation that references a specific file:line, verify that reference is still valid:

```bash
# Check file still exists
ls web/src/path/to/file.tsx

# Check the specific line/function still exists
grep -n "specificFunction" web/src/path/to/file.tsx
```

**If the reference is stale** (file renamed, function moved, logic refactored away):
- Update the file:line to the new location
- If the behavior was removed entirely, mark it `REVERTED YYYY-MM-DD` with a note

### Step 4 — Audit Spec Descriptions Against Code

For major behaviors described in the spec's narrative sections (not just annotations), spot-check that the code actually does what the spec says:

- UI states described in spec → do the relevant components render them?
- Business logic described in spec → does the code implement it?
- Edge cases described in spec → are they handled in code?

Flag drift as a new annotation:
```
> - **[PREFIX]-N DRIFT 2026-03-22:** Spec says X but code does Y — [file:line]. Spec needs update or code is wrong.
```

Don't try to resolve drift — just flag it. The developer decides whether to fix the code or update the spec.

### Step 4b — Audit Code Against Journey Requirements

Journeys are the source of truth for what the product SHOULD do. Specs detail
how. Code implements. This step checks whether the code actually supports what
the journeys need — not just what the spec describes.

```bash
# Find journeys that reference this feature spec
grep -l "feature-name" docs/specs/journeys/*.feature.md 2>/dev/null
```

For each journey that covers this feature:

1. **Read the journey's Background and Given steps.** These are preconditions
   the journey assumes the code supports.

2. **Read the journey's Journey Analysis section** (if it exists). Look for
   Ungrounded Preconditions, Logical Issues, and Product Gaps that reference
   this feature.

3. **Check each precondition against the code:**
   - Does the entity/field the journey assumes actually exist in the schema?
   - Does the UI the journey describes actually render that state?
   - Does the backend validation the journey assumes (plan limits, permissions)
     actually run on the code path the UI uses?
   - Do the side effects the journey expects (notifications, cache updates)
     actually fire?

4. **Flag journey-code gaps** with a new annotation type:

```
> - **[PREFIX]-N JOURNEY-GAP YYYY-MM-DD:** Journey J07 assumes [behavior] but code [doesn't support it / bypasses it / uses wrong field] — [file:line]
```

JOURNEY-GAP is different from DRIFT. DRIFT means "spec says X, code does Y."
JOURNEY-GAP means "the journey needs X to work, but the code doesn't provide
it — and the spec may not even mention it." These are the gaps that only
become visible when you trace from journey → spec → code.

This is the check that catches: "the customer claim journey assumes flash deals
exist, but the only creation UI bypasses the security middleware that sends the
push notifications the customer journey depends on."

### Step 4c — Write Missing Spec Coverage

Steps 4 and 4b find what's wrong. This step **writes** what the spec SHOULD say
but doesn't — behaviors the journeys require that aren't in the spec at all.

For each JOURNEY-GAP found in Step 4b, ask: **does the feature spec have a
user story or section that covers this behavior?**

- If yes but the code doesn't implement it → that's a PLANNED item (Step 2 handles it)
- If no → the spec itself is incomplete. The journey requires behavior that
  nobody ever wrote into the spec. **Write it now.**

**Why write, not just flag:** This skill is called sync, not audit. Specs are
documentation — writing a missing section is safe, reversible, and unblocks
the downstream pipeline (audit-ac can't add ACs to a section that doesn't
exist). Code drift gets flagged because code changes are risky. Spec gaps get
filled because specs are the plan, and a plan with holes blocks everything downstream.

**What to write for each gap:**

1. **Add a new User Story section** to the feature spec with:
   - A clear user story statement ("As a [role], I want to [action], so that [outcome]")
   - A narrative paragraph explaining the behavior the journey requires
   - An empty AC table in the shared format, with placeholder ACs marked
     `QA=—`, `E2E=🔲`, `Test=—`
   - A `[SPEC-GENERATED]` tag so reviewers know this was auto-generated
     from journey requirements, not hand-written

2. **Annotate the source journey** in the Implementation Notes:
```
> - **[PREFIX]-N SPEC-GENERATED YYYY-MM-DD:** Added US-[N] "[title]" to cover
>   Journey [JID] precondition: [what the journey assumes]. AC table ready for
>   audit-ac to refine.
```

3. **Route to audit-ac** after writing — the placeholder ACs are
   intentionally vague (you're grounding from journeys, not reading code).
   audit-ac's job is to make them testable and specific.

**Example:** Journey J07 assumes "owner creates flash deal through validation."
The spec has no user story for owner-side deal creation. Write:

```markdown
### US-N: Owner Flash Deal Creation [SPEC-GENERATED]

**As a** business owner on the dashboard,
**I want to** create a time-limited flash deal for my location,
**so that** nearby followers are notified and can claim the deal before it expires.

This user story was generated from Journey J07's Background precondition:
"one of his favorite cafés has posted a 30% off flash deal." No existing
user story covered the owner-side creation flow for this entity.

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| FLASH-01 | Owner can create a flash deal from the dashboard with discount %, duration, and optional message | — | 🔲 | — |
| FLASH-02 | Flash deal creation goes through the security/validation pipeline (plan limits enforced) | — | 🔲 | — |
| FLASH-03 | Creating a flash deal triggers push notifications to nearby followers | — | 🔲 | — |
```

This unblocks the entire downstream pipeline:
- audit-ac refines the placeholder ACs into testable criteria
- write-e2e writes tests against the ACs
- The developer implements the code to make the ACs pass

**What NOT to write:** Don't invent behaviors the journey doesn't require.
Only write spec content for gaps that a specific journey precondition demands.
If no journey needs it, it doesn't get a section — that's validate-feature's
job to evaluate.

This completes the three-layer check:
- **Step 4:** Does code match spec? (spec → code) — flags DRIFT
- **Step 4b:** Does code support journeys? (journey → code) — flags JOURNEY-GAP
- **Step 4c:** Does spec cover what journeys need? (journey → spec) — **writes** the missing section

### Step 5 — Update the spec in place

Edit the spec file directly. Only touch the Implementation Notes block and any annotations. Do not rewrite narrative, schema, metrics, or design sections.

### Step 5b — Emit or update work items

If the repo already uses svc work-item tracking, mirror serious findings into
`docs/specs/work-items/` so they can be routed and tracked outside the inline spec note.

Create or update a work item when:

- a `DRIFT` annotation is added
- a `JOURNEY-GAP` annotation is added
- a `[SPEC-GENERATED]` section reveals missing work that needs follow-through
- the same finding spans multiple specs, journeys, or code areas

Recommended mapping:

- `DRIFT` -> work-item type `drift`
- broken shipped behavior discovered during sync -> `bugfix` or `regression`
- missing but valid new capability -> `feature`

Repo files remain canonical. If tracker visibility is needed after that, route to `sync-work-items`.
When emitting a high or critical WI, include `Affected Files` and
`Affected Specs` sections. If the scope cannot be known during sync, write
`unknown: <reason>` explicitly so dispatch tooling can block or serialize the
item deterministically.

Annotation format used in this project:
```
> - **[PREFIX]-N RESOLVED YYYY-MM-DD:** [description] — [file:line]
> - **[PREFIX]-N PLANNED YYYY-MM-DD:** [description]
> - **[PREFIX]-N FIXED YYYY-MM-DD:** [description] — [file:line]
> - **[PREFIX]-N DRIFT YYYY-MM-DD:** [description] — [file:line]
> - **[PREFIX]-N UPDATED YYYY-MM-DD:** [description] — [new file:line] (was [old file:line])
> - **[PREFIX]-N REVERTED YYYY-MM-DD:** [reason] — intentionally removed
```

### Status Definitions

| Status | Meaning |
|--------|---------|
| PLANNED | Spec describes behavior not yet in code |
| RESOLVED | Behavior confirmed in code, with file:line proof |
| FIXED | A bug or drift was corrected in code |
| DRIFT | Code contradicts what the spec says |
| JOURNEY-GAP | A journey requires behavior the code doesn't support — the spec may not even mention it |
| SPEC-GENERATED | A journey requires behavior with no spec coverage — user story + AC table written |
| UPDATED | Code was refactored but behavior preserved — file moved, renamed, or restructured. Update the file:line reference to the new location. |
| REVERTED | Feature was intentionally removed from the codebase. Note the date and reason. |

**Decision tree when a reference is stale:**
1. Did the behavior move but still exist? → **UPDATED** (find new location, update reference)
2. Was it intentionally removed? → **REVERTED** (note why)
3. Does the code now contradict the spec? → **DRIFT** (flag the contradiction)

Prefix convention: `VA` = Learning Hub, `LC` = Lifecycle, `MT` = Matching, etc. Match whatever prefix the spec already uses. If no annotations exist yet, start at `[PREFIX]-1`.

---

## Output

After updating each spec, report:

```
## sync-spec-code — [feature-name].md

PLANNED → RESOLVED:
  - VA-5: LessonView.tsx:84 — Mark Complete gating confirmed
  - VA-7: VibeAcademyPage.tsx:201 — empty state confirmed

Still PLANNED (not yet in code):
  - VA-6: PathView.tsx — no empty state found for 0 modules

Stale references fixed:
  - VA-9: was LessonView.tsx:91, now LessonView.tsx:103 (file updated)

Drift flagged:
  - VA-NEW: Spec says badge push notification sent, but send-notification function has no academy trigger

Journey gaps:
  - VA-J1: J07 assumes flash deals exist, but creation path bypasses validation — [file:line]

Downstream impact:
  - J07 (customer claim): references VA-05 (DRIFT) — journey may describe stale behavior
  - e2e/specs/journeys/J07.spec.ts: tests VA-05 — may need updating
```

### All-Features Mode

After all specs are done:

```
## sync-spec-code Complete

| Spec            | PLANNED→RESOLVED | Still PLANNED | Stale refs fixed | Drift flagged |
|-----------------|-----------------|---------------|-----------------|----------------|
| feature-learning.md | 2               | 1             | 1               | 1              |
| feature-matching.md  | 0               | 3             | 0               | 0              |
```

---

## Rules

- Don't rewrite existing acceptance criteria — that's audit-ac's job
- Don't resolve PLANNED by assumption — only mark RESOLVED if you found the code
- Don't fix code drift yourself — flag it (DRIFT), let the developer decide
- DO write missing spec sections when journeys require them (SPEC-GENERATED) —
  specs are documentation, not code. A missing spec section blocks the entire
  downstream pipeline (audit-ac, write-e2e, implementation). Writing it
  is safe and reversible. Tag with `[SPEC-GENERATED]` so reviewers know.
- Don't change existing narrative, schema, metrics, or design sections
- When in doubt about whether code matches spec, flag as DRIFT rather than silently passing
- Use relative paths from project root in annotations (e.g., `src/components/Foo.tsx:42`), not bare function names — paths are greppable, function names aren't
- DRIFT annotations should state both sides: what the spec says AND what the code does, so the developer can decide which is correct without re-investigating

---

## Where to Search

Features rarely live in a single file. A thorough audit checks all tiers where behavior might be implemented:

| Tier | What to look for | Why it matters |
|------|-----------------|----------------|
| **Database schema** | Migrations, table definitions, constraints, triggers | The schema often encodes business rules (e.g., NOT NULL, CHECK constraints, enums) that the spec assumes exist |
| **API / backend** | Handlers, edge functions, server routes, RPC definitions | Business logic and validation often live here, not in the UI |
| **Frontend UI** | Components, pages, stores, hooks | Where user-facing behavior is rendered |
| **Tests** | Unit tests, integration tests, E2E tests | Tests often confirm behavior more precisely than the implementation code |

When marking an item RESOLVED, note which tier you verified. If a feature spans multiple tiers (e.g., "users cannot exceed 10 team members" needs a DB constraint AND a UI guard), verify both before marking RESOLVED.

---

## Behavior Moved vs Deleted

When a RESOLVED annotation points to a file that no longer exists:

1. **Search by keyword** — grep for the function name, component name, feature description, or unique strings from the original code
2. **If found elsewhere** → mark **UPDATED** with the new file:line reference. The behavior survived a refactor.
3. **If gone entirely** → mark **REVERTED** with a reason (check git log for the commit that removed it if the reason isn't obvious)
4. **If partially gone** → mark **DRIFT**. Some of the behavior was removed or broken during refactoring. Note what's missing.

This matters because stale RESOLVED annotations give false confidence that a feature works when it may have been silently lost.

---

## Partial Implementation

Not every PLANNED item is binary. Use this rubric:

| Situation | Status | Notes |
|-----------|--------|-------|
| All acceptance criteria behaviors verifiable in code | **RESOLVED** | Full implementation confirmed |
| Core behavior present, some edge cases or minor variants missing | **RESOLVED** with a note | Add "(edge case X not yet handled)" to the annotation |
| Core behavior missing — only a skeleton, stub, or TODO exists | Stays **PLANNED** | Stubs don't count as implementation |
| Code exists but doesn't match the spec's described behavior | **DRIFT** | Implementation diverged from design |

The key question: could a user exercise the described behavior today? If yes, it's RESOLVED (possibly with gaps noted). If no, it stays PLANNED.

---

## Cross-Feature Dependencies

Some features depend on other features being implemented:

- If Feature A is PLANNED and Feature B's behavior only works when Feature A exists, note the dependency: `"(depends on [PREFIX]-N from feature-a.md being implemented)"`
- Don't mark Feature B items as RESOLVED if they only work because of hardcoded fallbacks, mock data, or temporary workarounds. That's a false positive — the feature will break when the fallback is removed.
- When auditing, briefly check whether RESOLVED items rely on infrastructure from other features. If that infrastructure is still PLANNED elsewhere, flag it.

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ModeSpecSelection --evidence command_output:.svc/sync-spec-code-selection.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-SpecReadAndPlannedAudit --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ResolvedReferenceAudit --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-NarrativeCodeDriftAudit --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-JourneyGapSpecCoverage --evidence file:docs/specs/features/<name>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-WorkItemSummarySelfVerify --evidence command_output:.svc/sync-spec-code-self-verify.log
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
| 1 | Specs have RESOLVED/DRIFT annotations | grep for RESOLVED, DRIFT, JOURNEY-GAP in updated spec files | |
| 2 | Audit report produced | Output summary includes PLANNED->RESOLVED counts, drift flags, journey gaps | |
| 3 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |

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
- Next skill varies by lane:
  - `brownfield-feature`: Invoke `validate-feature --progressive --lane brownfield-feature`
  - `drift`: Invoke `write-journeys --progressive --lane drift`
  - `refactor`: Invoke `plan-changeset --progressive --lane refactor`

**If `--progressive` flag is absent:**
- Report results to user
- Suggest next based on lane:
  - brownfield-feature: "Next: consider running `validate-feature`"
  - drift: "Next: consider running `write-journeys`"
  - refactor: "Next: consider running `plan-changeset`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
