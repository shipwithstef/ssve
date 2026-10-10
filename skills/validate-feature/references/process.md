# Process — detail

Moved verbatim from SKILL.md (progressive disclosure).

### 0. Task Graph Setup — MANDATORY

Before any validation work, establish a task graph. This makes the FEATURE lane
trackable by the stop hook and persistent across sessions.

**WI file naming:** `.svc/lane-tasks-WI-###.json`. Each WI gets its own
file — parallel work items coexist without collision.

**Case (a) — JSON exists AND Task {T} already has `process_tasks`:**
Skip this section entirely. Confirm Task {T} is `in_progress`, hydrate if
needed (Claude Code: call `TaskCreate` for {T}.1–{T}.9 if not already hydrated),
and proceed to Step 0 below.

**Case (b) — JSON exists but Task {T} has no `process_tasks`:**
Embed the process_tasks array into Task {T}'s entry in the JSON file now,
then hydrate and proceed. Do NOT overwrite the file — add only to Task {T}'s entry.

**Case (c) — No JSON file exists (standalone validate-feature run):**
Initialize it now:

```bash
node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI-###> --lane feature
```

Then populate it using the template below while preserving the helper-generated
`created` timestamp.

In all cases, `{T}` is your lane task ID — `1` in a standalone run, `5` in a
full greenfield feature lane. Process task IDs are composite: `{T}.1` through
`{T}.9`. The `name` field uses `skill|phase` convention.

```json
{
  "wi": "<WI-###>",
  "lane": "feature",
  "created": "<helper-generated ISO 8601 wall-clock timestamp>",
  "flags": [],
  "tasks": [
    {
      "id": 1,
      "skill": "validate-feature",
      "subject": "validate-feature: market validation + ship decision for <WI>",
      "status": "in_progress",
      "blocked_by": [],
      "process_tasks": [
        { "id": "1.1", "name": "validate-feature|context-scan",        "status": "in_progress", "blocked_by": [],      "subject": "Scan project for existing artifacts: WI, spec, brief, journeys, ACs related to this idea" },
        { "id": "1.2", "name": "validate-feature|escape-check",        "status": "pending",     "blocked_by": ["1.1"], "subject": "[CONDITIONAL] P2 applicability: bootstrap missing context or bounded repair/consolidation with sufficient evidence; skip only non-applicable business work and route" },
        { "id": "1.3", "name": "validate-feature|market-check",        "status": "pending",     "blocked_by": ["1.2"], "subject": "Resolve applicable market uncertainty; reuse current evidence when sufficient" },
        { "id": "1.4", "name": "validate-feature|business-questions",  "status": "pending",     "blocked_by": ["1.3"], "subject": "Step 1: unresolved business decisions with user — problem, persona, evidence, alternatives" },
        { "id": "1.5", "name": "validate-feature|brief-present",       "status": "pending",     "blocked_by": ["1.4"], "subject": "Step 2: reuse or present brief; resolve only consequential open choices" },
        { "id": "1.6", "name": "validate-feature|cross-validate",      "status": "pending",     "blocked_by": ["1.5"], "subject": "Step 3: cross-validate against existing specs, journeys, ACs, market position" },
        { "id": "1.7", "name": "validate-feature|ship-decision",       "status": "pending",     "blocked_by": ["1.6"], "subject": "Step 3b: evaluate K1–K7 kill signals → ship / no-ship / pivot verdict" },
        { "id": "1.8", "name": "validate-feature|route",               "status": "pending",     "blocked_by": ["1.7"], "subject": "Step 4: write WI file + route to write-spec or escalate to strategic/technical skill" },
        { "id": "1.9", "name": "validate-feature|finalize",            "status": "pending",     "blocked_by": ["1.8"], "subject": "Update lane-tasks.json: mark process_tasks complete, mark Task 1 completed" }
      ]
    },
    {
      "id": 2, "skill": "write-spec",
      "subject": "write-spec: feature spec for <WI>",
      "status": "pending",
      "blocked_by": [1]
    }
  ]
}
```

When Task `{T}` reaches a new top-level status, use:

```bash
node scripts/task-graph.mjs set-status .svc/lane-tasks-<WI>.json {T} completed
```

This keeps `completed_at` tied to real wall-clock time instead of hand-written placeholders.

**Task {T}.2 `validate-feature|escape-check` is dynamic (conditional skip).**
After completing {T}.1 (context-scan), evaluate the HARD-GATE condition:
- If the project is standalone/greenfield with no existing product → set tasks
  {T}.3 through {T}.7 to `"status": "skipped"` in the JSON file AND in the
  Claude task system. Proceed directly to {T}.8 (route).
- If the project has existing context → evaluate the applicability below; retain relevant cross-validation and routing, and skip only work whose evidence is already sufficient.

**Market-check applicability:** Evaluate each market question with `researchDecision(question)` from `scripts/lib/research-decision.mjs`. External research runs only for an explicit request, necessary freshness with a stated reason, or a consequential externally answerable question below 7/10. Missing ordinary confidence is analysis. Sufficient verified current cited evidence can resolve the question; a numerical score alone is not evidence. Tool availability does not itself justify research. For an already-authorized bounded change, reuse accepted scope and current AC/persona/spec/code evidence; do not create a new market-validation cycle or rescore its business case without new contradictory evidence.

For concept fragmentation, an existing pipeline break, or a missing journey describing existing functionality, P2 reuses the established expected behavior and skips P3–P5 when no new consequential business uncertainty exists. Route to diagnose-bug, plan-changeset, write-journeys or audit-ac according to the actual gap; retain relevant dependency and spec/code conflict checks.

**Apply the context-scan result to the existing graph:** P2 records whether P3–P5 apply and why. For a bounded authorized change with sufficient current evidence, mark non-applicable process tasks using the existing conditional-skip convention and continue relevant cross-validation and routing. Do not fabricate executed phase receipts or new brief artifacts. A new idea, missing consequential evidence, or a material conflict still requires the applicable business work; authorization alone is not evidence of demand. P6 accepts the existing brief or canonical owner scope as its routing input.

---

**How to hydrate and follow the task graph — by platform:**

The JSON file is written first. Then each platform hydrates it into its native
task system and follows from there. The flow is always:
**file → hydrate → follow → update file on each completion.**

**Claude Code (has TaskCreate):**

1. **Hydrate:** Read the JSON file. Call `TaskCreate` for every lane task and
   every process task ({T}.1–{T}.9). Name format: `[{id}] {name}` — e.g.
   `[1.1] validate-feature|context-scan`. Set {T}.1 → `in_progress`; all others → `pending`.
2. **Follow:** Work through the hydrated task list in order.
3. **On each completion:** Update the process task status in the JSON file AND
   call `TaskUpdate`. File first, then task system.

```
ToolSearch("select:TaskCreate") →
  Create lane tasks (use subject from JSON)
  Then create process tasks {T}.1–{T}.9 (name: "[{id}] {name}", subject from process_tasks array)
  Set {T}.1 → in_progress; all others → pending
```

**After auto-compact (context reset in Claude Code):**

```
1. Read .svc/lane-tasks-<WI>.json
2. Find Task {T}'s process_tasks array
3. Re-create all tasks via TaskCreate (completed/skipped ones as-is, first incomplete as in_progress)
4. Resume from the first incomplete process task
```

Never re-run completed process tasks. The file tells you where you left off.

**Codex, Gemini, and other platforms (no TaskCreate):**

1. Read the JSON file directly — it IS your task list.
2. Follow the process_tasks array in order. The `subject` field is your instruction.
3. On each completion: Update `process_tasks[*].status` in the file.
4. After context reset: Re-read the JSON, find first incomplete task, continue.

**Stop hook enforcement (all platforms):** Task {T} cannot be marked `completed`
until all 9 process_tasks have `status: "completed"` or `"skipped"` (skipped
is valid for {T}.3–{T}.7 on the escape-hatch path).

---

**The two-level picture:**

```
LANE TASKS (lane-tasks-<WI>.json, persisted, all platforms)
  {T}. validate-feature           ← process_tasks: {T}.1–{T}.9 (embedded in JSON)
  {T+1}. write-spec               ← process_tasks: added by write-spec when it runs
  {T+2}. design-tech              ← lane-level only
  ...

PROCESS TASKS (embedded in lane task {T}, UI mirror in Claude Code)
  {T}.1  validate-feature|context-scan       ← Step 0 (always first)
  {T}.2  validate-feature|escape-check       ← HARD-GATE (dynamic: may skip {T}.3–{T}.7)
  {T}.3  validate-feature|market-check       ← applicable market evidence gaps only
  {T}.4  validate-feature|business-questions ← Step 1 (relevant dimensions, grounded in real data)
  {T}.5  validate-feature|brief-present      ← Step 2 (reuse accepted scope; resolve open choices)
  {T}.6  validate-feature|cross-validate     ← Step 3 (spec/journey alignment)
  {T}.7  validate-feature|ship-decision      ← Step 3b (K1–K7 kill signals)
  {T}.8  validate-feature|route              ← Step 4 (write WI + route)
  {T}.9  validate-feature|finalize           ← update JSON, mark lane task done
```

**Process task → skill step mapping:**

| Process Task | Skill Step | Notes |
|---|---|---|
| {T}.1 context-scan | Step 0 | Full context scan before anything |
| {T}.2 escape-check | HARD-GATE | Dynamic: sets {T}.3–{T}.7 to skipped if fires |
| {T}.3 market-check | Step 1 (Q3/Q4 proxy) | Relevant existing evidence or targeted research for an open market question |
| {T}.4 business-questions | Step 1 (full) | Relevant business dimensions and unresolved choices, grounded in {T}.3 data |
| {T}.5 brief-present | Step 2 | Accepted scope reused; unresolved consequential choices resolved |
| {T}.6 cross-validate | Step 3 | Alignment with existing specs/journeys |
| {T}.7 ship-decision | Step 3b | K1–K7 kill signals → verdict |
| {T}.8 route | Step 4 | Write WI or escalate |
| {T}.9 finalize | (meta) | JSON update + lane task completion |

---
