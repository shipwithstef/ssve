# Process — detail

Moved verbatim from SKILL.md (progressive disclosure).

### 0. Task Graph Setup — MANDATORY

Before any diagnosis work, establish a task graph. This makes Lane 4 trackable
by the stop hook and persistent across sessions.

**WI file naming:** `.svc/lane-tasks-WI-009.json` for WI-009, `.svc/lane-tasks-WI-022.json`
for WI-022, etc. Each WI gets its own file — parallel work items coexist without collision.
Never use the bare `.svc/lane-tasks-<WI>.json` (that name would stomp any active WI).

**Skip if:** `.svc/lane-tasks-<WI>.json` already exists AND its `wi` field matches
the current work item (route-workflow already created the graph). Just confirm
Task 1 is `in_progress` and proceed to Step 1.

**Otherwise — initialize `.svc/lane-tasks-<WI>.json` now** (e.g., `.svc/lane-tasks-WI-009.json`):

```bash
node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI-###> --lane bugfix
```

Then populate it using the schema below while preserving the helper-generated
`created` timestamp.

Process tasks for Lane Task 1 (diagnose-bug) are embedded inside Task 1's entry as a `process_tasks` array. This is the **source of truth** for both progress and the stop hook. The Claude task system is a UI mirror only — convenient but not required and not durable across context resets.

IDs are composite: lane task `1`, process tasks `1.1` through `1.10`. The `name` field uses the `skill|phase` convention so the task is identifiable in any flat task list.

The top-level `flags` array starts empty here and is populated at Step 4.6 (Risk-Flag Classification) with any AC-553-1 flags the fix matches — leave it `[]` until that step runs.

```json
{
  "wi": "<WI-###>",
  "lane": "bugfix",
  "created": "<helper-generated ISO 8601 wall-clock timestamp>",
  "flags": [],
  "tasks": [
    {
      "id": 1,
      "skill": "diagnose-bug",
      "subject": "diagnose-bug: root cause + pillar revisit + pattern scan for <WI>",
      "status": "in_progress",
      "blocked_by": [],
      "process_tasks": [
        { "id": "1.1",  "name": "diagnose-bug|spec-anchor",    "status": "in_progress", "blocked_by": [],      "subject": "Read journey + ACs → product expectation, persona, what spec says should happen" },
        { "id": "1.2",  "name": "diagnose-bug|repro-classify", "status": "pending",     "blocked_by": ["1.1"], "subject": "Trigger/Expected/Actual + Action|Propagation|Rendering (from report + spec, NO code)" },
        { "id": "1.3",  "name": "diagnose-bug|reading-list",   "status": "pending",     "blocked_by": ["1.2"], "subject": "Derive 2-4 specific files from spec component names + causal class" },
        { "id": "1.4",  "name": "diagnose-bug|code-read",      "status": "pending",     "blocked_by": ["1.3"], "subject": "Read/Grep the listed files → match/drift/gap per file" },
        { "id": "1.5",  "name": "diagnose-bug|fault-isolate",  "status": "pending",     "blocked_by": ["1.4"], "subject": "[DYNAMIC — updated after 1.2 causal classification, see below]" },
        { "id": "1.6",  "name": "diagnose-bug|root-cause",     "status": "pending",     "blocked_by": ["1.5"], "subject": "State: immediate cause, enabling condition, why the system allowed it" },
        { "id": "1.7",  "name": "diagnose-bug|pillar-audit",   "status": "pending",     "blocked_by": ["1.6"], "subject": "8 pillars + eval_matrix (eval gate hook fires here)" },
        { "id": "1.8",  "name": "diagnose-bug|pattern-scan",   "status": "pending",     "blocked_by": ["1.7"], "subject": "Grep for same defect class → list all instances" },
        { "id": "1.9",  "name": "diagnose-bug|register-disc",  "status": "pending",     "blocked_by": ["1.8"], "subject": "Decompose into WIs or document 'single correction — no decomposition needed'" },
        { "id": "1.10", "name": "diagnose-bug|brief",          "status": "pending",     "blocked_by": ["1.9"], "subject": "Changeset brief + affected artifacts + learnings" }
      ]
    },
    {
      "id": 2, "skill": "plan-changeset",
      "subject": "plan-changeset: SKIP if committed fix is complete",
      "status": "pending",
      "conditions": "SKIP if committed fix is complete. --diagnose-only: mark manual, implement via platform path.",
      "blocked_by": [1]
    },
    {
      "id": 3, "skill": "execute-changeset",
      "subject": "execute-changeset: apply fix",
      "status": "pending",
      "conditions": "SKIP if plan-changeset was skipped. --diagnose-only: mark manual, implement via platform path.",
      "blocked_by": [2]
    },
    {
      "id": 4, "skill": "review-gate",
      "subject": "review-gate: validate fix against brief",
      "status": "pending", "blocked_by": [3]
    },
    {
      "id": 5, "skill": "write-e2e",
      "subject": "write-e2e: MANDATORY if user-facing surface",
      "status": "pending",
      "conditions": "MANDATORY if user-facing. SKIP if background-only fix with logged justification.",
      "blocked_by": [4]
    },
    {
      "id": 6, "skill": "land-changeset",
      "subject": "land-changeset: verify landing complete",
      "status": "pending", "blocked_by": [5]
    },
    {
      "id": 7, "skill": "verify-promotion",
      "subject": "verify-promotion: production smoke on affected surfaces",
      "status": "pending", "blocked_by": [6]
    }
  ]
}
```

**`--diagnose-only` mode:** after writing the file, immediately set Tasks 2 and 3
to `"status": "manual"` and add `"diagnose-only"` to the `flags` array. The stop
hook treats `manual` as non-blocking — the user implements via their platform
(Base44 `coding/write`, external agent, etc.), then resumes at Task 4.

**Auto-Deploy Pre-check (MANDATORY before setting `--diagnose-only`):**

First honor an explicit owner diagnosis-only/no-edit boundary: finish the requested report and stop before implementation; do not run this routing pre-check to override that boundary. Otherwise, when implementation is authorized, inspect target paths against the project's auto-deploy matrix:

1. Read `docs/specs/router-context.md` if it exists. It should contain a "Deployment / Runtime Contract" section listing which resource categories auto-deploy from `git push` vs which require an external call.
2. For each changed file path, classify as `auto-deploys` or `needs-external-call`.
3. **If implementation is authorized and ALL paths auto-deploy from `git push` alone:** do NOT set `--diagnose-only`. Run the normal Lane 4. `execute-changeset` handles the implementation; `git push` IS the deploy.
4. **If ANY path needs an external call:** set `--diagnose-only`. The brief routes to platform-specific implementation.
5. **If `router-context.md` does not exist:** default conservatively to `--diagnose-only` AND file a drift WI routed to `onboard-repo` (router-context is required repo-local routing contract per `route-workflow` Session Setup).

Example (Example Marketplace Base44):
| Changed path | Classification | Conclusion |
|---|---|---|
| `base44/functions/atomicEmployeeCreate/entry.ts` | auto-deploys (Base44 function, git-push → auto-deploy) | normal Lane 4 |
| `src/pages/Dashboard.jsx` | needs-external-call (Base44 page, needs `coding/write` + `/deploy`) | `--diagnose-only` |
| `base44/entities/Location.json` | needs-external-call (Base44 entity, needs `coding/write`) | `--diagnose-only` |
| `src/components/PhotoUpload.jsx` | auto-deploys (Base44 component, bundled with git push) | normal Lane 4 |

**Why this pre-check:** `--diagnose-only` is designed for cases where the framework's implementation skills (`plan-changeset`, `execute-changeset`) cannot complete the deploy — they can edit files and commit, but they cannot call Base44's `coding/write` API or equivalent external endpoints. Setting the flag unnecessarily strands the lane: tasks 2–3 become `manual`, the agent hands the work back to the user, and the implementation happens outside framework tracking. Reserve the flag for genuinely external paths.

**Task 1.5 `diagnose-bug|fault-isolate` is dynamic.** After completing 1.2 (`repro-classify`), update the `subject` field in the JSON file AND the Claude task description before marking 1.2 complete:
- Propagation → `"Trace: write path → invalidation keys → reader queryKeys (must match)"`
- Action → `"Trace: mutation handler → entity field write → confirm persisted"`
- Rendering → `"Trace: fallback code → null guard → field name"`

**Why this order (1.1 → 1.2 before 1.3 → 1.4):** Structured repro and causal classification (1.2) need only the user report + spec — no code. Classification determines WHERE to look, making the reading list (1.3) targeted. Code reads before classification are unanchored and cause category errors.

---

**How to hydrate and follow the task graph — by platform:**

The JSON file is written first. Then each platform hydrates it into its native task system and follows from there. The flow is always: **file → hydrate → follow → update file on each completion.**

**Claude Code (has TaskCreate):**

1. **Hydrate:** Read the JSON file. Call `TaskCreate` for every lane task (1–7) and every process task (1.1–1.10). Name format: `[{id}] {name}` — e.g. `[1.1] diagnose-bug|spec-anchor`. Set 1.1 → `in_progress`; all others → `pending`.
2. **Follow:** Work through the hydrated task list in order. Claude adheres to its own task system — this is not a convenience, it's how the model stays on track and completes every step.
3. **On each completion:** Update the process task status in the JSON file AND call `TaskUpdate`. File first, then task system.

```
ToolSearch("select:TaskCreate") →
  Create lane tasks 1–7 (use subject from JSON)
  Then create process tasks 1.1–1.10 (name: "[{id}] {name}", subject from process_tasks array)
  Set 1.1 → in_progress; all others → pending
```

**After auto-compact (context reset in Claude Code):**

The task system is wiped but the JSON file survives. Re-hydrate:

```
1. Read .svc/lane-tasks-<WI>.json
2. Find Task 1's process_tasks array
3. Re-create all tasks via TaskCreate (completed ones as completed, first incomplete as in_progress)
4. Resume from the first incomplete process task
```

Never re-run completed process tasks. The file tells you where you left off.

**Codex, Gemini, and other platforms (no TaskCreate):**

1. **Read** the JSON file directly — it IS your task list.
2. **Follow** the process_tasks array in order. The `subject` field is your instruction for each step.
3. **On each completion:** Update `process_tasks[*].status` in the file. No mirroring needed.
4. **After context reset:** Re-read the JSON file, find first incomplete task, continue.

**Stop hook enforcement (all platforms):** The stop hook reads `lane-tasks.json`. Task 1 cannot be marked `completed` until all 10 `process_tasks` have `status: "completed"`. Task 1.7 (`pillar-audit`) additionally requires `eval_matrix` to be fully populated — the eval gate hook enforces this.

---

**The two-level picture (full):**

```
LANE TASKS (lane-tasks.json, persisted, all platforms)
  1. diagnose-bug           ← process_tasks: 1.1–1.10 (embedded in JSON)
  2. plan-changeset         ← where changeset is planned
  3. execute-changeset      ← where code is written
  4. review-gate            ← where fix is validated
  5. write-e2e              ← where e2e coverage is added
  6. land-changeset
  7. verify-promotion

PROCESS TASKS for Task 1 (in lane-tasks.json process_tasks array)
  1.1  diagnose-bug|spec-anchor        read spec/journey/AC
  1.2  diagnose-bug|repro-classify     Trigger/Expected/Actual + causal class
  1.3  diagnose-bug|reading-list       2-4 files from spec
  1.4  diagnose-bug|code-read          first code read → match/drift/gap
  1.5  diagnose-bug|fault-isolate      [DYNAMIC] targeted trace
  1.6  diagnose-bug|root-cause         cause + enabling condition + why
  1.7  diagnose-bug|pillar-audit       8 pillars + eval_matrix (hook)
  1.8  diagnose-bug|pattern-scan       grep same defect class
  1.9  diagnose-bug|register-disc      decompose WIs or single-correction
  1.10 diagnose-bug|brief              changeset brief + artifacts + learnings
```

### 0.4. Pre-Lock Rejection — reject WIs with pre-specified fixes

**This step runs before Step 0.5 (spec anchor). It costs <1K tokens. Skipping it lets solution anchoring bias the entire diagnosis — you end up validating a pattern-matched guess instead of investigating openly.**

Before reading the spec or code, scan the WI file (`docs/specs/work-items/WI-*.md`)
for sections that pre-specify the fix:

| Pattern | What it looks like | Status |
|---|---|---|
| `## Proposed fix` / `## Proposed solution` / `## How to fix` | Named section headers | **REJECT** |
| `## Solution` / `## Plan` / `## Resolution` (before diagnose-bug has run) | Named section headers | **REJECT** |
| Code blocks with `-` or `+` diff markers, or `diff` / `jsx` / `ts` code fences proposing changes, under any section before this skill's output | Fenced code showing suggested modifications | **REJECT** |
| "Option A (preferred)" / "Option B" prose comparing fix approaches | Solution-shopping before diagnosis | **REJECT** |
| Inline pull-request body, commit-message draft, or changeset brief | Implementation-ready artifacts | **REJECT** |
| `## Symptom` / `## Reproduction` / `## Evidence` / `## Impact` / `## Out of scope` | Diagnosis-phase content only | **KEEP** |
| `## Open questions for diagnose-bug to answer` | Explicit non-answers | **KEEP** |
| `## Acceptance Criteria` written as testable outcomes (no implementation detail) | AC-level statements | **KEEP** |

**If any REJECT pattern is present, the skill HALTS with one of two outputs:**

**(a) If the WI was filed from a `BLOCKING_DISCOVERY` artifact, from an
external report, or from a prior session's pattern-match:** rewrite the WI
file, stripping the fix proposals while preserving symptom, reproduction,
evidence, impact, and open questions. Commit the strip as a WI edit with
message `chore(wi-###): strip pre-locked fix per diagnose-bug 0.4`. Then
proceed to Step 0.5.

**(b) If the WI is a user-authored spike or the user explicitly anchored
the fix:** ask the user once:

> "WI-### has a fix pre-specified before diagnosis. I can either:
> (1) strip the fix proposal and run diagnose-bug openly — recommended
> because pre-locked fixes bias diagnosis toward validating the guess
> rather than finding the real root cause, OR
> (2) proceed with the anchored fix acknowledged — only if you have
> already confirmed root cause yourself and want `diagnose-bug` to run in
> `--retroactive` validation mode over your fix.
> Which?"

Do not proceed silently with a pre-locked conclusion. A WI whose body
contains the answer before the investigation is not a WI — it is a
pull-request description misfiled in the work-items directory.

**Why this gate matters:** `diagnose-bug` produces its highest value when it
investigates openly — reading spec, AC, security boundary, persona, journey,
and code **without** a committed hypothesis. Pattern-matched fixes are a
known failure mode: the agent (or author) sees a familiar shape, proposes
the textbook fix, and `diagnose-bug` then rationalizes it. Real root causes
frequently sit one layer deeper than the first-guess fix — e.g., a backend
401 that looks like "relax the guard" may actually be "the frontend is
calling the wrong function from the wrong context." Step 0.4 exists to
force open investigation before any solution commits.

**Exceptions:**

- Retroactive mode (`--retroactive`) is explicitly validation-over-existing-diff;
  the WI body in that mode may describe what was fixed. Step 0.4 is skipped
  when `--retroactive` is set.
- `sync-spec-code` drift corrections are not diagnose-bug's scope and route
  elsewhere — this step does not apply there.

### 0.5. Spec/Journey/AC Anchor — MANDATORY BEFORE ANY CODE EXPLORATION

**This step runs before Step 1. It costs ~2K tokens. Skipping it and going straight to code costs 50K–200K tokens and produces answers to the wrong question.**

On any project with docs (check: `docs/specs/` exists):

1. **Find and read the relevant journey(s).** Journeys describe what the persona is trying to accomplish step by step — they are the ground truth for expected behavior, written from the product perspective.
   - Locate in `docs/specs/journeys/`, `*_FLOW_AUDIT.md`, or the feature spec
   - Read the step(s) that correspond to the broken behavior
   - If no journey exists for this area → document as spec gap, continue with user report as source

2. **Find and read the relevant ACs.** ACs are testable pass/fail conditions.
   - Check the WI file, the feature spec, and any flow audit for the affected area
   - Ask: "Is there an AC that covers the broken behavior?" If yes, copy it verbatim. If no → document as spec gap.

3. **Answer these four product questions before opening any code:**
   - Who is the affected persona (owner / employee / customer)?
   - What were they trying to accomplish at this step?
   - What does the spec/journey say SHOULD happen here?
   - Is the broken behavior a **code defect** (spec says X, code does Y) or a **spec gap** (spec never described this behavior at all)?

4. **Derive a targeted code reading list from the spec — before opening any code.**

   The spec and journey name the feature area, the affected persona flow, and often the specific pages or components involved. Use them as a navigation map:

   - From the journey step(s), identify which page(s) or component(s) handle this flow
   - From the AC, identify which field(s), action(s), or boundary(ies) are asserted
   - Write a reading list of 2-4 specific files: `"I will read [file1], [file2] to verify this"`
   - **Do NOT launch a broad Explore subagent.** Read those specific files with Read/Grep.

   The spec will be approximately right. If it points to `LocationCard` and the bug is actually in `useLocationDiscovery`, you'll find that in 1-2 targeted reads — not 50K tokens of broad exploration.

5. **Read the targeted files and classify each finding as match / drift / gap:**

   | Finding | Meaning | Action |
   |---|---|---|
   | **Match** | Spec says X, code does X | Bug is elsewhere — follow the causal chain (Step 1 → Step 3) |
   | **Drift** | Spec says X, code does Y | Root cause candidate — document and verify |
   | **Gap** | Spec doesn't describe this behavior at all | Spec gap — document, then use user report as expected-behavior source |

   Code exploration that flows from spec → navigation → targeted read → match/drift/gap is cheap, precise, and produces product-anchored findings. Broad exploration that skips the spec produces code-centric descriptions of symptoms, not root causes.

   **If you find unexpected things while reading:** code exploration often surfaces things not in the spec (missing invalidation, additional fallback paths, related components). These are secondary findings — document them, don't pivot the whole diagnosis. If they're independent bugs, file them as new WIs per Step 5.5 (Register Discoveries).

6. **Classify: code defect, spec drift, or spec gap?**
   - **Code defect** (spec says X, code does something different) → continue to Step 1
   - **Spec drift** (found in step 5 above — spec describes wrong behavior) → file drift WI alongside the bugfix
   - **Spec gap** (spec never described this behavior) → document in WI, use user intent as expected-behavior source in Step 2

**Why this order:** The spec is the cheapest, most authoritative source of expected behavior — and the cheapest navigation tool to targeted code. An agent that reads the spec first asks "does the code implement what the spec requires?" and reads 3 files. An agent that skips the spec asks "what does the code do?" and explores 30 files. Same answer, 10x the cost.

### 4.4. Pillar Revisit Audit — MANDATORY

Before proposing a fix, walk all 8 product pillars from `references/pillars-coverage-matrix.md` and audit each one against the bug. A bugfix that ignores the product pillars fixes the symptom while leaving the product in an incoherent state.

For each pillar, answer: **does this bug (or its fix) change anything here?** Record `affected` or `unaffected` with one-line evidence.

| # | Pillar | Audit question | If affected, route to |
|---|---|---|---|
| 1 | Product fit | Does the bug reveal that this capability should not exist, or should work differently at the product level? Does it expose a kill signal (user confusion, workarounds, "why does this exist")? | `validate-feature` re-run before the fix lands |
| 2 | Journey | Which journey does this bug live inside? Does the journey spec accurately describe the step that broke? Does the fix imply a new/removed/changed journey step? | `write-journeys` in expand mode OR file Lane 3 follow-up |
| 3 | Acceptance criteria | Which AC would have caught this bug? Does it exist? Was it wrong? | Update AC checklist + `audit-ac` |
| 4 | UX | Does the fix change what the user sees/clicks/reads? New error/empty/loading states? Accessibility change? | Update `## Design-UX` OR route to `design-ux` if scope is large |
| 5 | UI | Visual layout, component choice, tokens, breakpoints, motion — any change? Screenshot baseline update needed? | Update `## Design-UI` + `track-visuals --diff` OR route to `design-ui` |
| 6 | Tech architecture | Does the fix change where code lives, data flow, dependencies, external integrations? Should a component be split/merged/replaced? | Update `## Technical Design` OR route to `design-tech` |
| 7 | Cost model | Does the fix increase per-request compute/storage/bandwidth/API calls? Change the scaling curve? Move something from free to paid tier? | Update `## Cost Model`; if material, escalate to user BEFORE landing |
| 8 | Operations & ownership | Does the fix change who operates this in prod, SLA/SLO, monitoring, alerts, runbook, failure modes? | Update `## Operations`; if SLA changes, escalate to user |

Document the audit in the work item under **Pillar Revisit Audit:**

```markdown
## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | no | Feature still validated; no kill signal exposed |
| 2 | Journey | yes | J07 step 4 does not describe photo upload failure path → follow-up WI-XYZ (Lane 3) |
| 3 | Acceptance criteria | yes | No AC exists for "photo upload works on every page importing PhotoUpload" → adding AC to feature spec |
| 4 | UX | no | Fix does not change what the user sees |
| ... | ... | ... | ... |
```

**Critical rule:** `unaffected` means you opened the artifact, read the relevant section, and confirmed the fix does not contradict it. "I didn't think about it" or "probably fine" is not unaffected — it is a self-verify failure. If you don't know, mark it `unknown — needs investigation` and stop the lane until it is resolved.

If the audit surfaces ≥1 pillar as `affected`, the bugfix either bundles the pillar update into the current fix (when scope and safety allow) OR files follow-up WIs routed to the correct lane. Unresolved affected pillars block close-out.

**Eval matrix sync — hooks-enforced:** After completing the Pillar Revisit Audit, update the `eval_matrix` field in `.svc/lane-tasks-<WI>.json` for this task. Translate each pillar's conclusion to the hook vocabulary:

| Audit conclusion | `eval_matrix` value |
|---|---|
| `affected` — follow-up WI filed | `"UPDATED — WI-NNN"` |
| `unaffected` — artifact opened and verified | `"UNCHANGED — VERIFIED — <file:line>"` |
| genuinely not applicable | `"N/A — <specific reason (>15 chars)>"` |

The `PreToolUse` eval gate blocks `TaskUpdate(completed)` until all 8 `eval_matrix` entries are non-null. In structural mode (default) it also enforces correct prefix and evidence references. In AI mode (`SVC_EVAL_MODE=ai`) it runs `claude -p` to verify evidence is substantive. The gate fires only on TaskUpdate — zero overhead on other tools.

### 5.5. Register Discoveries — MANDATORY

Before defining proof of fix, evaluate whether the diagnosis has surfaced
**multiple independent corrections** — the root cause fix, pattern-scan siblings,
pillar-affected follow-ups, spec/journey drift, missing ACs, missing e2e coverage.
These are often independent work items that should be tracked separately rather
than bundled into a single monolithic fix.

**Do NOT ask the user "want me to implement or file?"** — that question is an
anti-pattern. The framework already has the answer: decompose, register, route.

#### Protocol

1. **Decompose.** List every distinct correction surfaced by Steps 1-5 and the
   pattern scan. Group by independence: can correction A land without correction B?
   If yes, they are separate work items.

2. **Register.** For each independent correction:
   - If no WI file exists: create `docs/specs/work-items/WI-<next>.md`
     following the canonical WI schema (`references/work-item-schema.md`).
     Heading MUST be `# WI-NNN: title` (colon form). Required metadata block:
     `Type`, `Status: identified`, `Severity`, `Filed: <today>`,
     `Source: diagnose-bug WI-<parent>`. Body sections: `Problem`, `Evidence`,
     `Affected Files`, `Affected Specs`, plus lane classification (bugfix /
     drift / brownfield-feature) and a one-line root cause. If scope is not yet
     knowable, write `unknown: <reason>` instead of omitting the section.
   - If a WI file already exists and the correction is a sub-task: update the
     existing WI with the new scope.
   - Update `docs/specs/work-items/INDEX.md` with the new entry.

3. **Prioritize.** Rank the child WIs:
   - The original reported bug fix is always highest priority.
   - Pattern-scan siblings that affect user-facing surfaces rank next.
   - Spec/journey/AC drift corrections rank after.
   - Cosmetic or low-severity items rank last.

4. **Route.** Set the `**Next:**` trailer to target the highest-priority child WI.
   If the current WI is the only one (no decomposition needed), proceed normally
   to Step 6. If multiple WIs were created, the current diagnose-bug brief
   covers the parent; each child WI will enter its own lane independently.

#### When decomposition is not needed

If the diagnosis produced exactly one correction (the reported bug, no pattern-scan
siblings, no affected pillars requiring follow-up), document it explicitly:
"Register Discoveries: single correction — no decomposition needed." and proceed
to Step 6.

#### Document in the work item

```markdown
## Register Discoveries

**Corrections found:** <count>
**Decomposed into:**
- WI-042 (this WI) — <original bug fix> — Lane 4 bugfix — **HIGH**
- WI-043 — <pattern-scan sibling in module X> — Lane 4 bugfix — **MEDIUM**
- WI-044 — <journey J07 step 4 missing failure path> — Lane 5 drift — **LOW**

**Routing:** WI-042 continues to Step 6. WI-043 and WI-044 enter their lanes independently.
```
