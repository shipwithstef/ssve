# write-spec — Task graph setup (full template)

### 0. Task Graph Setup

> **write-spec is usually NOT the graph owner.** In the full feature lane,
> validate-feature runs first and creates `.svc/lane-tasks-<WI>.json`.
> This step has three cases depending on what already exists.

**Case (a) — JSON exists AND Task {T} already has `process_tasks`:**
Skip this section entirely. Confirm Task {T} is `in_progress`, hydrate if
needed (Claude Code: call `TaskCreate` for {T}.1–{T}.10 if not already hydrated),
and proceed to Step 0 below.

**Case (b) — JSON exists but Task {T} has no `process_tasks`:**
Embed the process_tasks array into Task {T}'s entry in the JSON file now,
then hydrate and proceed.

**Case (c) — No JSON file exists (standalone write-spec run):**
Write `.svc/lane-tasks-<WI>.json` now with a minimal single-task graph
using the process_tasks block below. For Case (c), adapt: `"id": 2` → `"id": 1`,
all `"2.X"` IDs → `"1.X"`, and `"blocked_by": [1]` → `"blocked_by": []`
(no predecessor).

In all cases, `{T}` is your lane task ID — `1` in a standalone run, `2` when
following validate-feature (most common abbreviated lane), `6` in a full
greenfield feature lane. Process task IDs are composite: `{T}.1` through
`{T}.10`. The `name` field uses `skill|phase` convention.

**process_tasks block to embed (adapt `id` values to your `{T}`):**

```json
{
  "id": 2,
  "skill": "write-spec",
  "subject": "write-spec: feature spec for <WI>",
  "status": "in_progress",
  "blocked_by": [1],
  "process_tasks": [
    { "id": "2.1",  "name": "write-spec|type-classify",  "status": "in_progress", "blocked_by": [],       "subject": "Step 0: classify as Feature / Enabler / Integration — determines authoring mode and template" },
    { "id": "2.2",  "name": "write-spec|context-scan",   "status": "pending",     "blocked_by": ["2.1"],  "subject": "Step 1 + Step 0b: scan project (specs, journeys, ACs, WI) THEN classify mode: greenfield / brownfield / convert" },
    { "id": "2.3",  "name": "write-spec|problem-frame",  "status": "pending",     "blocked_by": ["2.2"],  "subject": "Step 2: problem statement, user value, goals, non-goals, success metric" },
    { "id": "2.4",  "name": "write-spec|story-draft",    "status": "pending",     "blocked_by": ["2.3"],  "subject": "Step 3: user stories (As a / I want / So that) per persona" },
    { "id": "2.5",  "name": "write-spec|ac-draft",       "status": "pending",     "blocked_by": ["2.4"],  "subject": "Step 4: acceptance criteria — testable, persona-scoped, edge cases covered" },
    { "id": "2.6",  "name": "write-spec|dep-check",      "status": "pending",     "blocked_by": ["2.5"],  "subject": "Step 5: surface blocking/enabling dependencies (entities, auth, pricing tier, external APIs)" },
    { "id": "2.7",  "name": "write-spec|spec-assemble",  "status": "pending",     "blocked_by": ["2.6"],  "subject": "Steps 6–8: write spec file to docs/specs/features/, sync journeys, add references + Pillars Coverage Matrix" },
    { "id": "2.8",  "name": "write-spec|scope-review",   "status": "pending",     "blocked_by": ["2.7"],  "subject": "[IN-PLACE REVISION] G0 Scope Review: apply 9 prime directives to assembled spec, revise file if scope changes" },
    { "id": "2.9",  "name": "write-spec|dep-queue",      "status": "pending",     "blocked_by": ["2.8"],  "subject": "Step 9: register dependency WIs in INDEX, queue for design-tech or write-spec (separate features)" },
    { "id": "2.10", "name": "write-spec|finalize",       "status": "pending",     "blocked_by": ["2.9"],  "subject": "Step 10: handoff brief → design-tech, update lane-tasks.json, mark lane task completed" }
  ]
}
```

**Task {T}.2 `write-spec|context-scan` absorbs mode classification (old Step 0b).**
Mode (greenfield / brownfield / convert) can only be determined AFTER scanning
what exists. Step 0b is NOT a separate step — it is the conclusion of {T}.2.
After {T}.2 completes, record the mode in Task {T}.3's `subject` if it changes
the approach materially.

**Task {T}.8 `write-spec|scope-review` is dynamic (in-place revision, NOT a loop).**
G0 Scope Review runs AFTER the spec is assembled — not before. If a prime
directive fires (spec too broad, no clear owner, missing ACs, etc.), revise
the spec file as part of {T}.8's own work. Do NOT reset {T}.4–{T}.7 to
`pending` — the revision is part of {T}.8. Once {T}.8 is `completed`, the
spec is final.

**Why spec-assemble before scope-review ({T}.7 before {T}.8):** The G0 prime
directives ("is this scope right?", "does this need splitting?") can only be
answered on a real draft. Assembling first, then critiquing, avoids premature
scope decisions made without a complete picture.

**Why context-scan before mode classification ({T}.2 combined):** Mode
(greenfield / brownfield / convert) depends on what already exists. Running
old Step 0b before Step 1 was backwards — you cannot know the mode before
the scan. {T}.2 merges them in the correct order.

---

**How to hydrate and follow the task graph — by platform:**

The JSON file is written or updated first. Then hydrate and follow. The flow
is always: **file → hydrate → follow → update file on each completion.**

**Claude Code (has TaskCreate):**

1. **Hydrate:** Read the JSON file. Call `TaskCreate` for each process task
   ({T}.1–{T}.10) if not already hydrated. Name format: `[{id}] {name}` — e.g.
   `[2.1] write-spec|type-classify`. Set {T}.1 → `in_progress`; all others → `pending`.
2. **Follow:** Work through the hydrated task list in order.
3. **On each completion:** Update the process task status in the JSON file AND
   call `TaskUpdate`. File first, then task system.

```
ToolSearch("select:TaskCreate") →
  Create process tasks {T}.1–{T}.10 (name: "[{id}] {name}", subject from process_tasks array)
  Set {T}.1 → in_progress; all others → pending
```

**After auto-compact (context reset in Claude Code):**

```
1. Read .svc/lane-tasks-<WI>.json
2. Find Task {T}'s process_tasks array
3. Re-create all tasks via TaskCreate (completed ones as completed, first incomplete as in_progress)
4. Resume from the first incomplete process task
```

Never re-run completed process tasks. The file tells you where you left off.

**Codex, Gemini, and other platforms (no TaskCreate):**

1. Read the JSON file directly — it IS your task list.
2. Follow the process_tasks array in order. The `subject` field is your instruction.
3. On each completion: Update `process_tasks[*].status` in the file.
4. After context reset: Re-read the JSON, find first incomplete task, continue.

**Stop hook enforcement (all platforms):** Task {T} cannot be marked `completed`
until all 10 process_tasks have `status: "completed"`.

---

**The two-level picture:**

```
LANE TASKS (lane-tasks-<WI>.json, persisted, all platforms)
  {T-1}. validate-feature         ← process_tasks: {T-1}.1–{T-1}.9 (written by validate-feature)
  {T}.   write-spec               ← process_tasks: {T}.1–{T}.10 (written here, Step 0)
  {T+1}. design-tech              ← lane-level only
  ...

PROCESS TASKS (embedded in lane task {T}, UI mirror in Claude Code)
  {T}.1   write-spec|type-classify  ← Step 0 (Feature/Enabler/Integration)
  {T}.2   write-spec|context-scan   ← Step 1 + Step 0b (scan THEN mode: greenfield/brownfield/convert)
  {T}.3   write-spec|problem-frame  ← Step 2 (problem statement + goals)
  {T}.4   write-spec|story-draft    ← Step 3 (user stories)
  {T}.5   write-spec|ac-draft       ← Step 4 (acceptance criteria)
  {T}.6   write-spec|dep-check      ← Step 5 (dependency surface)
  {T}.7   write-spec|spec-assemble  ← Steps 6–8 (write spec file + journey sync + refs + Pillars Matrix)
  {T}.8   write-spec|scope-review   ← G0 Scope Review (in-place revision, NOT a loop)
  {T}.9   write-spec|dep-queue      ← Step 9 (queue dependency WIs)
  {T}.10  write-spec|finalize       ← Step 10 (handoff + JSON update)
```

**Process task → skill step mapping:**

| Process Task | Skill Step | Notes |
|---|---|---|
| {T}.1 type-classify | Step 0 | Feature/Enabler/Integration |
| {T}.2 context-scan | Step 1 + Step 0b | Scan first, THEN derive mode — fixes old Step 0b ordering |
| {T}.3 problem-frame | Step 2 | Problem statement, goals, non-goals |
| {T}.4 story-draft | Step 3 | User stories per persona |
| {T}.5 ac-draft | Step 4 | Acceptance criteria (testable) |
| {T}.6 dep-check | Step 5 | Blocking/enabling dependencies |
| {T}.7 spec-assemble | Steps 6–8 | Write spec + journey sync + refs + Pillars Matrix |
| {T}.8 scope-review | G0 Scope Review | After draft — in-place revision if needed |
| {T}.9 dep-queue | Step 9 | Dependency WI registration |
| {T}.10 finalize | Step 10 | Handoff brief + lane-tasks update |

---

