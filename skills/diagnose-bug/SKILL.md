---
name: diagnose-bug
version: "1.0"
handles_concerns:
  - auth-surface
  - oauth-callback
  - paid-external-api
description: >
  Root-cause-first bug and regression planning for svc repos. Use when a work item
  describes broken behavior, a regression, or a production issue that needs correction
  without forcing full feature-spec authoring. Produces an implementation-ready bugfix
  brief with reproduction, root cause, expected behavior, smallest safe fix surface,
  and proof-of-fix plan.
phases:
  - { id: P1-Inputs, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-Reproduction, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P3-RootCause, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P4-FixPlan, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P5-PillarRevisit, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
inputs:
  required: []
  optional:
    - { path: "docs/specs/features/*.md", artifact: feature-spec }
outputs:
  produces:
    - { path: "docs/specs/bugfix/<name>-brief.md", artifact: diagnose-bug }
chain:
  lanes:
    bugfix: { position: 1, prev: null, next: plan-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

> **Cognitive routing:** 🧠 [STRAT-OPUS] + 🌐 [DISC-SEARCH] — root-cause reasoning is Opus-class; pair with web_search for live dependency/issue tracker data. See `references/model-routing.md`.

# Bugfix Brief

Bug work is not feature discovery.

A bugfix lane should answer: what is broken, why is it broken, what is the smallest
safe fix, and how do we prove it is fixed?

This skill is influenced by systematic debugging approaches: reproduce first, isolate
the fault, reason about root cause, then define the correction and verification.

**Announce at start:** "I'm using the diagnose-bug skill to plan a root-cause-first fix."

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-Inputs --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-Reproduction --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-RootCause --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-FixPlan --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-PillarRevisit --evidence file:<path>
```

## Product Questions — MANDATORY format

When the root cause of a bug requires a product decision ("fix it properly = schema migration; work around = client-side patch — which?"), frame in `_shared/product-question-format.md` with `phase: diagnose-bug`. Surface the options to user with decision synthesis before coding the fix.

## When To Use

- Existing behavior is wrong
- A regression broke something that worked before
- A work item is classified as `bugfix` or `regression`
- The repo is brownfield and the correction should not go through full feature authoring

## Flags

| Flag | Behavior |
|------|----------|
| *(none)* | Full Lane 4 — diagnosis + implementation tasks created, all pending, stop hook enforces completion |
| `--diagnose-only` | Diagnosis + Changeset Brief only. Creates task graph with Tasks 2-3 (plan-changeset, execute-changeset) marked `manual` so stop hook doesn't block on them. Use when implementation CANNOT be performed by `execute-changeset` alone — e.g. the fix lives in a resource that requires an external deploy step (Base44 **pages** via `coding/write`, Base44 **entity schemas** via `coding/write`, Shopify app metadata, Cloudflare zone config via API). Do NOT use for resources that auto-deploy from git push alone (Base44 **backend functions**, Base44 **components**, Vercel-on-push repos, Cloudflare Workers with git integration) — those fit normal `execute-changeset`. Run the Auto-Deploy Pre-check (see Step 0 below) before setting this flag. |
| `mode: e2e-test` / `--mode=e2e-test` | Diagnose a failing, flaky, or misleading E2E/Playwright test. Read the latest trace/screenshot/error first, bisect whether the failure persists, check helper-app parity, tenant/scope setup, transient assertions, and selector ambiguity before proposing app or test changes. |
| `--retroactive` | Retroactive mode — reads committed diff instead of reproducing from broken state. Equivalent to "code is already in main." |
| `--progressive` | Chain immediately to next skill after self-verify passes. |

## E2E Test Diagnosis Mode

See [references/advanced-diagnosis.md](references/advanced-diagnosis.md#e2e-test-diagnosis-mode) — invoke this mode when the failing artifact is an E2E test.

## Cross-System Falsification Mode

See [references/advanced-diagnosis.md](references/advanced-diagnosis.md#cross-system-falsification-mode) — invoke when the bug spans runtimes/origins/protocols/storage layers.

## Inputs

**Read in this order — do not skip ahead to code:**

1. The work-item file (`docs/specs/work-items/WI-*.md`)
2. The relevant journey(s) and ACs for the affected feature area
3. Any reproduction evidence
4. Code paths — only after steps 1-3 are complete

## Outputs

Update the work item with:

- reproduction steps
- expected behavior
- actual behavior
- root cause summary
- smallest safe fix surface
- verification plan
- whether specs need updating after the fix
- **Pillar Revisit Audit** — mandatory walk of all 8 pillars per `references/pillars-coverage-matrix.md` (see Process Step 4.4)
- **pattern scan results** — mandatory grep of the codebase for the same class of defect elsewhere (see Process Step 4.5)
- **register discoveries** — decomposition of findings into independent work items with WI files, INDEX update, and priority routing (see Process Step 5.5)
- **affected artifacts** — list of specs, journeys, ACs, e2e tests, feedback memories, and rule files that need updating because of this bug (derived from the Pillar Revisit Audit)
- **learnings** — rule, feedback memory, or code-style entry that would have prevented the bug, framed so a future agent catches it before merge
- **Pillars Coverage Matrix** — final post-fix state of all 8 pillars in the canonical format from `references/pillars-coverage-matrix.md`. Required at close-out; the matrix is what `review-gate` and `land-changeset` validate.

Optional output:

- a short bugfix brief section in the work item, or a linked brief file if the repo prefers that pattern

## Process

### Step 0 Pre-flight: Gemini Context Budget (MANDATORY on Gemini CLI)

Before diagnosis, on Gemini CLI:
```bash
bash hooks/svc-gemini-context-check.sh
```
Blocks at POOR tier (>4 MB chat JSON). Diagnosis requires holding spec + code + reproduction in attention simultaneously — impossible at POOR tier. On Claude Code this is a no-op. See [references/gemini-context-budget.md](../references/gemini-context-budget.md). G1 from 2026-04-19 WI-085 audit.

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

Before setting the flag, inspect the file paths in the Changeset Brief against the project's auto-deploy matrix:

1. Read `docs/specs/router-context.md` if it exists. It should contain a "Deployment / Runtime Contract" section listing which resource categories auto-deploy from `git push` vs which require an external call.
2. For each changed file path, classify as `auto-deploys` or `needs-external-call`.
3. **If ALL paths auto-deploy from `git push` alone:** do NOT set `--diagnose-only`. Run the normal Lane 4. `execute-changeset` handles the implementation; `git push` IS the deploy.
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

### 0.3. Bug-Domain Classification — MANDATORY FIRST HYPOTHESIS GATE

**Before any "what code is broken" hypothesis, classify which DOMAIN the bug lives in.** Agents default to code-bug hypotheses and chase React state races / SDK quirks / framework internals for hours when the real cause is fixture state, platform quirk, or test-logic error. Forced classification at turn 1 prevents this.

For every diagnose-bug invocation, answer:

| Domain | Signals | Resolution path |
|---|---|---|
| **Code** | Error traces land inside `src/` or `base44/functions/`; bug reproduces with any test data | Hypothesize code bugs; read source |
| **Test-logic** | Error is in the test spec itself (wrong assertion, wrong locator, timing assumption); bug reproduces for any fixture | Fix the test; don't touch app code |
| **Test-fixture** | Test account / seeded entity / test database has wrong shape; bug does NOT reproduce for real users | Fix the fixture; don't touch app code OR test logic |
| **Platform** | Upstream service behavior (cache, consistency, auth, rate limit) differs from what code assumes | Workaround in app or test; file upstream issue |

Classify BEFORE reading the code. Write the classification in the brief. If you're not sure, say "ambiguous — will refine after Step 0.4–0.5 evidence" and revisit at Step 1.6 (root cause).

**WI-087 archetype (2026-04-19):** 8 hours chasing Code-domain hypotheses (H1 useEffect clobber, H2 Radix race, H13 state cascade) when the real bug was Test-fixture (test account didn't own seeded location) + Platform (filter-query cache not invalidated by entity API). One forced classification round at turn 1 would have flipped the whole investigation immediately.

### 0.35. Read the Failing File's Own Comments — MANDATORY BEFORE HYPOTHESIS

Before generating cause hypotheses, read every comment in the failing file that starts with SKIP / TODO / FIXME / KNOWN ISSUES / XXX / NOTE — and any multi-line block comment whose first line mentions the same symbol/test/feature. The previous author may have already documented the cause.

Mechanical check:
```bash
grep -nE "SKIP|TODO|FIXME|KNOWN|XXX|NOTE" <failing-file-path>
```

If a SKIP comment explains WHY a test was skipped or is marked un-skipped, that comment IS the diagnosis. Do not restart investigation — verify whether the comment's stated cause still applies, then fix or escalate.

**WI-087 archetype (2026-04-19):** the spec at `e2e/specs/journeys/WI081-sop-friendly-toggle.spec.ts:150-170` had a SKIP-comment block explicitly naming the root cause ("test account is TEAM MEMBER, not OWNER"). Every investigation round (Base44 AI × 2, Claude) missed it because we anchored on "the upstream WI-085 fix should have resolved this" instead of reading the test's own prior documentation.

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

### 0.6. Persistence Bisect — MANDATORY for empty/zero visibility symptoms

For any symptom matching "expected record/entity/item visible, got empty/zero/not
found" or "after save/upload/create, the page shows nothing", bisect persistence
before reading frontend rendering code.

Run a direct authenticated SDK/API probe against the same entity and scope the
test or user action wrote:

```bash
node scripts/classify-persistence-bisect.mjs --records .svc/<WI>-persistence-records.json
```

The records file can be a raw array or `{ "records": [...] }` captured from the
project SDK/API query.

| Result | Meaning | Next search space |
|---|---|---|
| `CLASS_A_NOT_PERSISTED` | Backend rejected, stripped, rolled back, blocked, or failed to store the data | Write response, RLS/security rules, schema allowlists, `secureOperation`, validation, transactions, idempotency |
| `CLASS_B_PERSISTED_UI_SCOPE` | Data exists but UI/test does not read it | Tenant/scope mismatch, query operators, cache keys, query enabled state, helper-app parity |

Do not inspect React rendering, fallback copy, or empty-state components until this
bisect is complete. If the direct probe cannot run, record why and route to
`base44-environment` for backend/schema/readback proof instead of guessing.
Check `_shared/backend-query-gotchas.md` before interpreting an empty Base44,
Supabase, Firebase, or similar backend result as proof of non-persistence.

### 1. Reproduce

**Before reading any code, write the structured repro in this form:**

```
Trigger:  [the action the user or system performed]
Expected: [what should have happened]
Actual:   [what happened instead]
```

**Temporal qualifier check (MANDATORY):** If the report says "after doing X, Y is wrong" or "when I upload/save/click X, it shows Y" — X is part of the repro, not background. Classify the bug by causal structure before looking at any code:

| Classification | Meaning | First thing to trace |
|---|---|---|
| **Action bug** | X itself doesn't complete — data never persisted | The write path (mutation, save handler, entity update) |
| **Propagation bug** | X completes but the effect doesn't reach Y — stale cache, wrong query key, missing invalidation | The invalidation path (onSuccess, queryClient.invalidateQueries, query keys used by readers vs writers) |
| **Rendering bug** | Data reaches Y correctly but Y displays it wrong — fallback, null guard, field mismatch | The rendering/fallback code only |

**Do NOT start reading code until you've written the structured repro and chosen one of these three causal categories.** Jumping to code exploration before this step causes category errors — the agent finds the nearest plausible-looking bug (often a rendering fallback) instead of the actual broken path.

If repro is not yet reliable, record the best-known repro and the uncertainty — then still classify by causal category before exploring.

### 2. Define expected behavior

By this point, Step 0.5 already gave you the spec/journey/AC. Use it.

If Step 0.5 found spec coverage, copy the relevant AC or journey step verbatim — that IS the expected behavior. Do not paraphrase it, do not derive it from code behavior.

If Step 0.5 found no spec coverage, use the strongest remaining source:

1. **Existing spec or journey** — what the product spec says should happen (found in Step 0.5; if present, this is authoritative)
2. **User-visible contract in code/tests/docs** — what an explicit test or contract says
3. **Current shipped behavior before regression** — only valid for regressions; if it worked before, the pre-regression behavior is the ground truth
4. **Explicit stakeholder intent** — user's own words from the bug report

Do not silently invent the expected behavior. Do not derive expected behavior from the current broken code.

### 3. Isolate the fault surface

Identify the smallest relevant subsystem:

- UI state/rendering
- request validation
- business logic
- integration boundary
- persistence/data model
- background process

**For propagation-class bugs (from Step 1):** verify these three things in order before any other code reading:

1. **Does the action persist?** Read the mutation/save handler. Confirm the entity field is actually written (not just local state updated).
2. **Does the reader see the updated data?** Find the query key the affected view reads from. Find all `invalidateQueries` calls in the action's `onSuccess`. Confirm the keys match. A mismatch here is the most common propagation bug — the save invalidates `['locations']` but the reader queries `['batch-location-data']`.
3. **Does the renderer display it correctly?** Only check the rendering/fallback code AFTER confirming steps 1 and 2 are not the issue.

Skipping to step 3 when the bug report says "after I did X, Y is wrong" is a category error. Step 3 (rendering) is a valid root cause only when steps 1 and 2 are verified clean.

### 4. Write root cause

Summarize:

- immediate cause
- enabling condition
- why the system allowed it

If true root cause is still unknown, say so plainly and log the current best hypothesis.

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

### 4.5. Pattern scan — MANDATORY

Before proposing a fix, grep the codebase for the same class of defect elsewhere. A bug that surfaced in one place almost always exists in others that nobody has noticed yet. The mandate: **find all instances, not just the reported one.**

Pattern scan types (pick the ones that match the root cause):

| Root cause class | Scan to run | Expected finding |
|---|---|---|
| Silent prop-shape mismatch between component and callers | Grep each shared component's exported prop destructure vs every call site's passed props; flag any mismatch | Other components exported one shape, called with another |
| Missing null/undefined guard | Grep for `.foo.bar` patterns on values with the same shape as the broken one | Other call sites will crash the same way |
| Stale cache invalidation | Grep for the cache key + all its writers; check every writer invalidates | Other writers skip invalidation |
| Missing auth/permission check | Grep the endpoint pattern; check every similar endpoint has the check | Other endpoints are unguarded |
| Race condition on shared state | Grep every writer to the shared state; check locking/ordering | Other writers race too |
| Schema drift between layers | Grep the field name across frontend/backend/DB; check all three agree | Other fields drift too |
| Dead error path / unhandled rejection | Grep `await` or `.then` without corresponding `.catch`/try-catch | Other async calls swallow errors |

Document the scan in the work item under **Pattern Scan:**

```markdown
## Pattern Scan

**Scope:** <what was grepped — exact patterns, directories, file types>
**Findings:** <list every hit, file:line — or "no other instances found">
**Followups:** <new work items created for each additional instance, or "none needed">
```

If the pattern scan finds additional broken instances, the bugfix scope expands to cover them OR new WIs are filed for each, depending on severity and safety of bundling.

Skipping the pattern scan is a self-verify failure. If the root cause is so specific that no scan is possible (e.g., a one-time data corruption event in a single row), document that explicitly: "Pattern scan: N/A — root cause is non-generalizable. Reason: ..."

### 5. Define smallest safe fix

Specify:

- file/class/module scope
- behavior to preserve
- behavior to change
- whether this is a code-only fix or requires spec/journey updates

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

### 6. Define proof of fix

List the exact validation:

- targeted unit/integration test
- manual repro replay
- journey or regression verification
- monitoring/log check if needed

### 6.5 Emit the impact-triad subsumption receipt

Write `.svc/impact-triad/WI-N/task-N.json` using `schemas/change-impact-triad.schema.json`. Map `breaks_what` to the affected-artifact and pattern-scan evidence, `intended_behavior` to Step 2, and `product_surface` to the Pillar Revisit Audit. `subsumed_by` must name those phases plus Step 6 proof artifacts and the verify-promotion plan.

Run `node scripts/classify-change-risk.mjs --staged --json` and bind the receipt to its exact SHA. If mapped coverage is missing, create a child task with owner, blockers, and validation before the receipt can pass; prose acknowledgement is not closure. High risk requires behavioral/runtime proof at the task checkpoint and exact binding to the one final different-family `review-exec` task even when the richer bug phases subsume the three questions.

## Causal Chain Summary (cutting-edge technique #6)

After completing the diagnosis (all phases + root cause), emit a structured causal chain so the prevention level is reusable by other skills:

```yaml
symptom: "<what failed, observably>"
proximate_cause: "<direct cause — what broke>"
root_cause: "<why the proximate cause existed>"
systemic_cause: "<why the system allowed the root cause to exist>"
prevention: "<structural change that prevents this CLASS of failure>"
```

Append it to `.svc/causal-chains.jsonl` (gitignored, ephemeral per-session):

```bash
echo '{"ts":"'"$(date -Iseconds)"'","symptom":"...","proximate":"...","root":"...","systemic":"...","prevention":"..."}' >> .svc/causal-chains.jsonl
```

This chain feeds:
- **`manage-learnings`** — capture the `prevention` level as a learning candidate
- **`evolve-framework`** — detect `systemic` causes that recur across multiple skills
- **future `diagnose-bug` runs** — check whether a new bug matches a known `systemic` cause before re-deriving it

## Retroactive Mode — code already committed

See [references/advanced-diagnosis.md](references/advanced-diagnosis.md#retroactive-mode--code-already-committed) — invoke when the code is already committed and you are reconstructing the root cause.

## Regression vs Bugfix

- **Bugfix**: behavior is wrong or incomplete
- **Regression**: behavior used to work and stopped working

Regression briefs should explicitly capture the last-known-good behavior and how confidence in that expectation was established.

## Iron Law: No Fixes Without Root Cause

**Do not propose a fix until the root cause is identified.** The natural instinct
is to jump to a patch — resist it. A patch without root cause understanding:
- May fix the symptom but not the cause
- May introduce new bugs in adjacent code
- May mask a deeper architectural problem

### Investigation Protocol

1. **Reproduce** (Step 1 above)
2. **Hypothesize** — form a concrete, falsifiable hypothesis about the root cause
3. **Scope lock** — restrict investigation to the smallest relevant subsystem:
   ```bash
   scripts/worktree.sh freeze <directory>  # if available
   ```
   This prevents accidentally "fixing" unrelated code while investigating.
4. **Trace** — follow the data flow end-to-end through the fault surface.
   **Multi-boundary instrumentation:** when the fault surface spans multiple
   components (API → service → DB → response), add logging at EVERY component
   boundary in a single pass — log what enters and what exits each layer. Run
   once. Read all boundary logs simultaneously. This pinpoints the exact layer
   where data corrupts without iterative guess-and-check (4 runs → 1 run).
   Source: superpowers systematic-debugging Phase 1.
5. **Verify hypothesis** — find code evidence that confirms or refutes. For
   cross-system flows, the probe must include both a confirmation check and a
   falsification check, then pass
   `scripts/validate-cross-system-probe-evidence.mjs`.
6. **If refuted** — form a new hypothesis. Max 3 attempts before escalating.
7. **If confirmed** → proceed to Step 5 (smallest safe fix)

### 3-Attempt Escalation

After 3 failed investigation hypotheses:
- Stop investigating. The root cause is non-obvious.
- Report: what was tried, what was ruled out, current best hypothesis.
- **Explicitly consider: is this a design problem (wrong architecture) or a
  code problem (wrong implementation)?** If all 3 hypotheses targeted code-level
  causes and all failed, the root cause may be architectural — the component is
  doing the wrong thing, not doing the right thing incorrectly. Surface this
  distinction in your escalation report.
- Escalate: ask the user for domain knowledge or pair debugging.
- Do NOT start guessing fixes.

### Pattern Library

Common root cause patterns to check:

| Pattern | Signature | How to verify |
|---------|-----------|--------------|
| Race condition | Intermittent, timing-dependent | Add logging around shared state access |
| Null/undefined access | Crashes on specific paths | Trace data flow, find where value becomes null |
| State machine violation | Wrong state after specific sequence | Map valid transitions, find the illegal one |
| Stale cache | Correct after restart, wrong after time | Check cache invalidation triggers |
| Schema mismatch | Works in dev, fails in prod | Compare migration state across environments |
| Off-by-one | Edge cases fail, middle cases pass | Test boundary values explicitly |

## What Not To Do

- Do not turn a small bug into a full feature-spec rewrite
- Do not skip root cause and jump to patch ideas
- Do not patch widely when a smaller safe fix is available
- Do not update product specs unless intended behavior actually changes
- Do not investigate for more than 3 hypotheses without escalating
- **Do not skip the pattern scan** — a bug in one place almost always has siblings
- **Do not treat "code is committed" as "work item is done"** — run retroactive Lane 4 and verify end-to-end
- **Do not propose a new skill to handle out-of-band fixes** — `diagnose-bug` in retroactive mode IS the framework's answer
- **Do not launch a broad Explore subagent before reading the spec** — the spec names the relevant components; read them directly with Read/Grep. Broad exploration without spec context costs 10x more and answers the wrong question ("what does the code do?" instead of "does the code match the spec?")
- **Do not derive expected behavior from the broken code** — broken code describes actual behavior, not expected. Expected behavior comes from spec/journey/AC or user intent, never from reading what the code currently does and calling that correct

## Routing After This Skill

- implementation work -> `plan-changeset` or direct execution flow, depending on repo practice
- **user-facing or admin-facing bugfix -> `write-e2e` is MANDATORY before close-out** (per route-workflow Lane 4 step 5)
- drift discovered instead of bug -> `sync-spec-code`
- issue is actually missing capability -> `validate-feature`
- retroactive mode (code already committed) -> chain through Lane 4 retroactively: `write-e2e` → `review-gate` → `land-changeset` (verify landing) → `verify-promotion` → close WI
- **`--diagnose-only` mode** → after self-verify passes, emit a **Changeset Brief** (exact file:line, before/after delta, one-sentence rationale), set Tasks 2-3 to `manual` in `lane-tasks.json`, mark Task 1 `completed`, then: `**Next:** implement via [platform path] per changeset brief above, then resume Task 4: review-gate`

All outputs MUST end with the `**Next:**` trailer per `route-workflow` Output Protocol.

### Changeset Brief Format (`--diagnose-only`)

Emitted at the end of the skill when `--diagnose-only` is active. Replaces the
"Next: plan-changeset" routing with a hand-off to the platform path:

```
## Changeset Brief

**File:** `<path/to/file.jsx>`
**Line:** <line number or range>
**Change type:** <add / remove / replace>

### Before
```<lang>
<old code>
```

### After
```<lang>
<new code>
```

**Rationale:** <one sentence why this fixes the root cause>
**Confidence:** <high / medium — if medium, note the uncertainty>
**Test surface:** <how to verify the fix works in the platform UI>
```

## Pipeline Continuation

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
| 1 | Bugfix brief file exists | `test -f docs/specs/bugfix/<name>-brief.md` or brief section in work item | |
| 2 | Has reproduction steps and root cause section | grep for "Reproduce", "Root cause", "Expected behavior" in brief | |
| 3 | No unresolved questions | grep for TBD, TODO, open questions in brief | |
| 4 | Pillar Revisit Audit run | grep for "Pillar Revisit Audit" section with all 8 pillars, each marked affected/unaffected with evidence | |
| 5 | No unresolved `affected` pillars | Every `affected` pillar must be bundled into the fix OR filed as a follow-up WI with ID | |
| 6 | Pattern scan run and documented | grep for "Pattern Scan" section with Scope/Findings/Followups OR explicit N/A justification | |
| 7 | Register Discoveries completed | grep for "Register Discoveries" section — either decomposed WIs with IDs or explicit "single correction — no decomposition needed" | |
| 8 | Affected artifacts list present | grep for "Affected artifacts" — specs, journeys, ACs, e2e, memories | |
| 9 | Learnings captured | grep for "Learnings" — rule/memory that would have caught the bug | |
| 10 | write-e2e path identified for user-facing surfaces | If surface is user-facing, brief must name the e2e that covers the fix (existing or new) | |
| 11 | Retroactive mode handled correctly | If code already in main, brief must say "retroactive mode" and compare committed diff vs brief prescription | |
| 12 | Pillars Coverage Matrix complete | grep for "Pillars Coverage Matrix" with all 8 pillars populated, no blank cells, no TODO, no un-verified `[UNCHANGED]` | |
| 13 | Task graph written | `test -f .svc/lane-tasks-<WI>.json` — file must exist with ≥7 tasks and Task 1 = `completed` | |
| 14 | All process tasks completed | TaskList — all 10 `diagnose-bug|*` tasks must be `completed`. `diagnose-bug|fault-isolate` subject must reflect the causal classification from `diagnose-bug|repro-classify` (not the placeholder "[DYNAMIC]" text) | |
| 15 | Close-out uses the latest evidence | final brief/summary cites the latest reproduction artifact, failing assertion, or runtime log rather than an earlier superseded theory | |

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

**`--diagnose-only` mode (after self-verify passes):**
1. Emit the Changeset Brief (see format above)
2. Set Tasks 2-3 to `"status": "manual"` in `lane-tasks.json`
3. Mark Task 1 `completed` in `lane-tasks.json`
4. Emit: `**Next:** implement via [platform path] per changeset brief above, then resume Task 4: \`review-gate\``
5. Do NOT invoke `plan-changeset` or `execute-changeset`

**If `--progressive` flag is present AND self-verify passed:**
- Check `--skip` list. If this skill is in the skip list, pass through to next.
- Invoke next skill: `plan-changeset --progressive --lane bugfix`

**If `--progressive` flag is absent:**
- Report results to user
- Emit the mandatory `**Next:**` trailer per `route-workflow` Output Protocol — typically `**Next:** \`write-e2e\` ...` for user-facing bugfixes, or `**Next:** \`plan-changeset\` ...` for internal fixes

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per
`references/skill-outcome-contract.md` before completing the task.
