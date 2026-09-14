## Task-Graph Execution Protocol (applies to ALL lanes)

When `route-workflow` routes to a lane, **immediately create a task for every step**
in that lane and persist the graph to `.svc/lane-tasks-<WI>.json`. This makes the
lane visible, trackable, and persistent across hosts. Claude Code may also mirror
it with `TaskCreate`, but the file is primary.

## Delivery Graph Schema (WI-298)

Every new lane-task graph created by `route-workflow` should include an additive
top-level `delivery_graph` object before downstream mutating work begins. The
delivery graph is the durable compiler output: it records why tasks are required,
which evidence families apply, which steps are conditional mandatory, and which
skills are explicitly N/A.

Minimum shape:

```json
{
  "wi": "WI-123",
  "lane": "brownfield-feature",
  "created": "2026-05-11T00:00:00.000Z",
  "status": "pending",
  "delivery_graph": {
    "compiler_version": 1,
    "user_intent": "normalized user goal",
    "repo_mode": "bootstrap|convert",
    "change_type": "feature|bugfix|regression|drift|refactor|chore|docs|framework",
    "lane": "greenfield|brownfield-conversion|brownfield-feature|bugfix|drift|refactor|framework",
    "delivery_mode": "interactive|end_to_end",
    "delivery_tier": {
      "mode": "full|compressed|rush|end_to_end",
      "selected_by": "route-workflow",
      "rationale": "Full framework validation is the default delivery tier.",
      "decision_log_ref": "",
      "validation_policy": {
        "mandatory_skills": ["validate-feature", "write-spec"],
        "skippable_skills": [],
        "blocked_behind_explicit_override": []
      }
    },
    "risk_flags": ["browser-visible", "user-facing"],
    "platform_contracts": ["base44-environment"],
    "evidence_families": {
      "product": "required|n/a|satisfied",
      "acceptance_criteria": "required|n/a|satisfied",
      "journey": "required|n/a|satisfied",
      "visual": "required|n/a|satisfied",
      "runtime": "required|n/a|satisfied",
      "plan_review": "required|n/a|satisfied",
      "code_review": "required|n/a|satisfied",
      "implementation_audit": "required|n/a|satisfied",
      "deploy": "required|n/a|satisfied",
      "promotion": "required|n/a|satisfied",
      "session_forensics": "required|n/a|satisfied"
    },
    "required_skills": ["validate-feature", "write-spec"],
    "conditional_mandatory_skills": [
      {
        "skill": "track-visuals",
        "signal": "browser-visible",
        "reason": "Browser-visible changes require visual baseline/diff evidence."
      }
    ],
    "optional_skills": [],
    "skipped_skills": [
      {
        "skill": "design-ui",
        "skip_condition_id": "design-ui:no-visual-surface",
        "reason": "Docs-only change has no browser-visible product surface.",
        "evidence": "change_type=docs"
      }
    ],
    "verification_tiers": {
      "local": ["tier-1"],
      "runtime": ["targeted-runtime-smoke"],
      "production": ["platform-deploy-verification"]
    },
    "mutation_history": [
      {
        "ts": "2026-05-11T00:00:00.000Z",
        "source": "route-workflow",
        "action": "initial_compile",
        "reason": "Compiled delivery graph at lane entry before downstream mutation."
      }
    ],
    "closeout_classification_required": true
  },
  "tasks": []
}
```

The schema is additive: older graphs without `delivery_graph` remain historical,
but new route-workflow graphs use `scripts/compile-delivery-graph.mjs` or an
equivalent compiler path before execution. `required_skills` and
`conditional_mandatory_skills` together determine generated executable tasks;
`skipped_skills` is an N/A ledger, not a task deletion.

## Persona Coverage Gate (2026-06-05)

For new feature-class task graphs, persona coverage is a mechanical task-graph
contract, not just review prose. Any `greenfield`, `brownfield-feature`, or
`delivery_graph.change_type=feature` plus `user-facing`/`admin-facing` graph
created on or after 2026-06-05 must include one of:

- a `build-personas` task; or
- a top-level `persona_coverage` decision.

Valid explicit decisions are:

```json
{
  "persona_coverage": {
    "status": "satisfied",
    "artifact": "docs/specs/personas/PERSONA_INDEX.md",
    "reason": "Existing personas are current and mapped in the feature spec."
  }
}
```

or:

```json
{
  "persona_coverage": {
    "status": "not_required",
    "reason": "This feature is backend-only and has no customer/admin journey or UX decision surface."
  }
}
```

`scripts/task-graph.mjs validate` rejects future feature graphs that silently
omit both. This catches manually assembled task graphs even when the delivery
graph compiler was bypassed.

`delivery_tier` is mandatory on new graphs. `full` is the default and means the
compiled lane plus conditional validation skills are required unless a
registry-backed skip applies. `end_to_end` means full validation continues
without permission checkpoints inside the scoped request. `compressed` and
`rush` are reduced-scope tiers and must include both a `rationale` and
`decision_log_ref`; validators reject them if they do not declare which
mandatory validation skills are blocked behind explicit override.

## Skill Outcome Mutation Contract (WI-300)

Skills that can discover new graph signals emit `skill_outcome` records using
`references/skill-outcome-contract.md`. `route-workflow` applies those records
with `scripts/apply-skill-outcome.mjs`, which uses the locked `state-io` writer
from WI-195 and appends each mutation to `delivery_graph.mutation_history`.

Producer skills:

- `diagnose-bug`
- `validate-feature`
- `write-spec`
- `design-tech`
- `plan-changeset`
- `execute-changeset`
- `review-plan`
- `review-gate`
- `audit-implementation`
- `test-journeys`
- `write-e2e`
- `verify-promotion`
- `audit-session-execution`

**Host mechanics:**
- **Claude Code:** use native `TaskCreate`, `TaskUpdate`, `TaskList`, and `Skill` tool invocation exactly as written below.
- **Codex:** the Codex host in `provision/hosts/codex.json` supports installed skills, but not Claude's task APIs. Use the same task ordering and conditions, persist status in `.svc/lane-tasks-<WI>.json`, and mirror only the active step in `update_plan` during the live session. `Invoke: /skill-name` and `metadata.skill` are still mandatory routing metadata, not descriptive prose.
- **Kimi CLI:** the Kimi host in `provision/hosts/kimi.json` supports installed skills plus native `TaskList` / `TaskOutput` for background-task observation. Persist status in `.svc/lane-tasks-<WI>.json`; treat `/task`, `TaskList`, and `TaskOutput` as observational tools, not the source of truth. Load the named skill with `/skill:<name>` or by opening the matching `SKILL.md`, and record the load receipt before execution.
- **Gemini CLI:** the Gemini host in `provision/hosts/gemini.json` supports installed skills but does not have native task tools that map to `.svc/lane-tasks-<WI>.json`. Use the same task ordering and conditions, persist status in `.svc/lane-tasks-<WI>.json`, and mirror the active task step into the CLI's native session UI using the `write_todos` tool for visual continuity. `Invoke: /skill-name` and `metadata.skill` are still mandatory routing metadata.
- **OpenCode CLI:** the OpenCode host in `provision/hosts/opencode.json` supports installed skills plus native `todowrite` for task tracking. Skills load via the `skill` tool (reads from `~/.config/opencode/skills/`). Persist status in `.svc/lane-tasks-<WI>.json`; treat `todowrite` as observational, not the source of truth. Hooks are implemented as TypeScript plugins in `~/.config/opencode/plugins/`.
- **Antigravity / Cursor:** skills are installed from `provision/hosts/antigravity.json` and `provision/hosts/cursor.json`; hooks are intentionally disabled until verified host-specific wirers exist. Persist status in `.svc/lane-tasks-<WI>.json`.
- **Rule across all hosts:** never start the next task until the named skill has been loaded. In Claude Code that means the `Skill` tool; in Kimi that means `/skill:<name>` or opening the named `SKILL.md`; in Codex, Gemini, Antigravity, or Cursor that means opening the named `SKILL.md` directly and following it before doing any work; in OpenCode that means the `skill` tool (native). Record the load with `node scripts/task-graph.mjs load-skill ...` before the task can be completed.

### How it works

**At lane entry (route-workflow's responsibility):**

**Continuation preference (when user asks to keep going until done):** Treat
"use /loop" and similar phrasing as a request for autorun discipline, not proof
that a loop capability exists. Keep executing within the current session, write
the full task graph, and rely on `lane-tasks-<WI>.json` for resume if the
session ends. Do NOT reference or invoke a `loop` skill unless a verified
continuation mechanism actually exists for this host/project and its contract
has been loaded first.

**Current Focus sync (MANDATORY if `docs/specs/project-state.md` exists):**
after writing `lane-tasks-<WI>.json` and before starting task 1, update
`docs/specs/project-state.md` `Current Focus` with the active WI, lane, and
task-graph path.

**Resume invariant:** if `lane-tasks-<WI>.json` and `project-state.md`
disagree on active focus, repair `project-state.md` before resuming execution
or answering a status/resume question.

**Stop-hook active-intent invariant:** a completion guard or stale task graph is
not sufficient authority to resume a WI after the user has corrected, stopped,
ignored, or marked it unrelated. When `.svc/active-intent-state.json` suppresses
the WI for the current cwd/session, Stop-hook output is advisory-only. Resume
execution only after an explicit same-WI continuation such as `continue WI-123`
or `resume WI-123`.

1. Read the lane's step list (Lane 1, 3, 4, 5, or 6)

2. **Task graph lane-consistency check (before writing):**
   After determining the lane AND the change type, verify that the task graph
   you're about to write is consistent with that lane's required steps.

   For each step in the lane definition that is not N/A for this WI:
   - Either include it as a task
   - Or explicitly mark it `SKIP` with a one-line justification in the task description

   A task graph that silently omits lane steps (no skip reason logged) is
   a contract violation. The number of tasks in the graph is not required to
   match the lane step count, but every omitted step requires a documented skip.

   Example: Lane 3 step 2 `validate-feature` — skip if WI already passed
   validate-feature in a prior session and ACs are locked (cite the prior session).
   Lane 3 step 5 `design-ux` — skip if WI has zero user-visible changes (cite:
   "pure JS useEffect, no JSX/CSS touched").

3. Append a fresh `.svc/session-contract.jsonl` entry for the WI before creating the task graph. It must reference the active WI, be less than 4 hours old, and use `bound_to` of `wi-backlog`, `user-request`, or `framework-evolution`.
4. Write `.svc/lane-tasks-<WI>.json` with `node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI> --lane <lane>`. The helper blocks graph creation if the matching session-contract entry is missing, stale, or bound to a different WI. The lane-tasks file is the cross-host source of truth for status, skip reasons, and resume.
5. For each step, create a task entry in the file and, when running in Claude Code, also `TaskCreate` with:
   - `subject`: step number + skill name + one-line scope (e.g., "1. diagnose-bug: root cause + pillar revisit + pattern scan for WI-012")
   - `description`: MUST start with `Invoke: /skill-name`. In Claude Code this is the exact slash-command to call via the `Skill` tool. In Codex this is the exact skill name that must be loaded from disk before work starts. After the `Invoke:` line, describe what the skill must produce for this specific work item, including any conditions (e.g., "MANDATORY — user-facing surface" or "skip if committed fix is complete")
   - `metadata`: `{"skill": "diagnose-bug"}` — machine-readable skill name for the executing agent to pass to the `Skill` tool in Claude Code or resolve to the matching `SKILL.md` in Codex
   - `activeForm`: present-continuous form for the spinner (e.g., "Running diagnose-bug on WI-012")

**Execution rule — NEVER work without loading the skill:**
When an agent picks up a task, it MUST load the skill named in `metadata.skill` BEFORE doing any work. In Claude Code that means invoking the `Skill` tool. In Kimi that means `/skill:<name>` or opening the matching `SKILL.md`. In Codex and Gemini that means opening the matching `SKILL.md` directly. Immediately after loading, record the receipt in the task graph:

```bash
node scripts/task-graph.mjs load-skill .svc/lane-tasks-<WI>.json <task-id> <skill-name> --via <skill_tool|slash_skill|direct_skill_file>
```

`set-status ... completed` rejects non-skip completions without a matching receipt for `metadata.skill`. The loaded skill contract contains the self-verify checks, output requirements, pillar revisit rules, pattern scan rules, and chaining obligations. An agent that "just does the work" without loading the skill is violating the framework — the contract does not exist in the agent's context until the skill is loaded. This is the difference between "I know what diagnose-bug does" and "I loaded diagnose-bug's 300-line contract and will follow every check."

For skills that declare `phases:` in frontmatter, record required phase evidence
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> <phase-id> --evidence <type>:<path>
```

Phase D enforces this for current completed tasks. Older pre-enforcement task
graphs remain compatible, but new completed tasks for migrated skills must carry
every required phase receipt.
6. After all tasks are created, set up dependencies in the active `lane-tasks-<WI>.json` file and, in Claude Code, mirror them via `TaskUpdate` with `addBlockedBy`
7. **Mandatory-step validation (applies to ALL lanes — Lane 1, 3, 4, 5, 6):** After building the task graph, detect browser-visible impact by scanning the WI's planned file set for ANY of:
   - file paths ending in `.jsx` / `.tsx` / `.vue` / `.svelte` / `.html` / `.css` / `.scss` / `.module.css`
   - `className` / `class` string modifications in the diff plan
   - Tailwind utility, design token, or theme variable references
   - SVG / image / icon / asset file changes

   If ANY match, the WI is browser-visible REGARDLESS OF LANE. The task graph MUST include ALL of:
   - `track-visuals` (baseline mode, before execution) — captures what the pages look like now
   - `track-visuals` (diff mode, after execution) — captures what changed
   - `review-gate` with viewport evidence gate — blocks PASS without visual evidence
   - `verify-promotion` with canary monitoring — produces per-page health report post-deploy

   If a lane (including Lane 6 chore/refactor) omits these steps for a browser-visible WI without explicit `SKIP: not browser-visible because [specific reason]` logged in the task description, this is a CONTRACT VIOLATION. The agent creating the task graph must either include them or refuse to proceed until the user confirms the skip reason.

   **Why this fires for chore/refactor too:** "Mechanical class additions" is a common Lane 6 classification that still produces visual changes. The chore lane's "no behavior change" refers to JS behavior, not CSS rendering. CSS class changes MUST go through visual verification even in Lane 6.

   **Anti-pattern — do not bypass:** Classifying a CSS-only change as chore to skip visual verification. If the change touches className strings, it's browser-visible. Period.

   **When creating track-visuals tasks, always pass WI context in the task description** so the skill's Step 0 pre-flight has an anchor:
   ```
   "subject": "7. track-visuals BASELINE: <WI-ID> context — run Step 0 pre-flight first"
   "description": "Invoke: /track-visuals baseline. WI: <WI-ID>. Feature spec: docs/specs/features/<name>.md. Step 0 MANDATORY: read WI spec → read feature spec → mine journeys → check E2E → log pre-flight → THEN build inventory."
   ```
   A track-visuals task without a WI context anchor in its description is incomplete — the skill cannot execute Step 0 without it.
8. Mark the first task `in_progress` in the active `lane-tasks-<WI>.json` file, mirror that state in the host-specific task view, and invoke the corresponding skill

**Decision log initialization (immediately after writing `lane-tasks-<WI>.json`):**

Initialize `.svc/pipeline-decisions.jsonl` with a lane-start entry. Use `run_id` = the WI ID from the task graph (e.g., `WI-001`). Every downstream skill uses this same `run_id`.

```bash
node scripts/pipeline-log.mjs append \
  --path .svc/pipeline-decisions.jsonl \
  --run-id "<WI-ID>" \
  --skill route-workflow \
  --phase 0 \
  --type mechanical \
  --decision "Starting lane: <lane-name>, mode: <auto|interactive>, WI: <WI-ID>" \
  --reasoning "Routed based on repo mode (<bootstrap|convert>) and change type (<type>)" \
  --decided-by P0 \
  --overrideable false
```

If the file already exists (resumed session), append — do not overwrite.

**At each skill's completion (every skill's responsibility):**

1. Mark the current task `completed` in `.svc/lane-tasks-<WI>.json`
2. Mirror that state in the host-specific task view (`TaskUpdate` in Claude Code, `update_plan` in Codex)
3. The next task is now unblocked
4. Check its conditions (from the task description):
   - If conditions are met: mark it `in_progress` in the active `lane-tasks-<WI>.json` file, mirror that state in the host, then load the skill (`Skill` tool in Claude Code; direct `SKILL.md` load in Codex)
   - If conditions say "skip": mark it `completed` in the active `lane-tasks-<WI>.json` file with a note in description ("Skipped: committed fix is complete, no delta needed"), mirror that status in the host, move to the next task
   - If conditions say "mandatory" and the precondition is not met (e.g., no e2e exists for a user-facing surface): **stop and create the task content** — do not skip
5. After the last task completes, emit the `**Next:**` trailer suggesting the next project-level work item

**On context exhaustion or session exit:**

For task-graph sessions on **all hosts**:
1. Read `.svc/lane-tasks-<WI>.json`
2. If the graph has **no actionable tasks** (`pending` or `in_progress`) and the WI file is already `VERIFIED`, return a closed-state summary and stop. Do not resume execution unless the user explicitly asks to replay, audit, or reopen the WI.
3. Otherwise resume from the first `in_progress` task; if none exists, resume from the first `pending` task
4. Load the `Invoke: /skill-name` instruction for that task before doing work

Claude Code MUST rebuild the visible task list from the file via TaskUpdate when resuming
after compaction or starting a fresh session with an existing `lane-tasks-<WI>.json`.
Call TaskUpdate for every task whose status in the JSON differs from what TaskList shows —
the JSON is authoritative, the in-session mirror is disposable. Stale mirrors (from a
prior session's TaskCreate that was never synced back) cause agents to re-run or skip
tasks that were already completed.
Codex may mirror the current step in `update_plan`.

`.continue-here.md` is a fallback only for non-task-graph sessions.

### Conditional tasks

Some lane steps are conditional. Express conditions in the task description, not the subject.

| Condition type | How to express | Example |
|---|---|---|
| Always run | No condition in description | "diagnose-bug: root cause + pillar revisit + pattern scan" |
| Run if user-facing | Description starts with "MANDATORY if user-facing." | "MANDATORY if user-facing. write-e2e: runtime photo upload test across 6 pages with test image fixture" |
| Skip if already done | Description starts with "SKIP if <condition>." | "SKIP if committed fix is complete. plan-changeset: formal implementation plan" |
| Run if affected | Description starts with "RUN if pillar revisit finds affected." | "RUN if pillar revisit finds affected UX pillar. design-ux: update Design-UX section" |

The executing agent evaluates conditions at runtime. A skipped task is still marked `completed` (not deleted) with a skip reason appended to its description — this preserves the audit trail.

### Example: Lane 4 retroactive for WI-012

```
TaskCreate: subject="1. diagnose-bug: root cause + pillar revisit + pattern scan for WI-012 (retroactive)"
  description="Invoke: /diagnose-bug WI-012 retroactive mode. Read commit 42ef5c7 + all 6 PhotoUpload call sites. Produce root-cause brief, Pillar Revisit Audit (8 pillars), pattern scan, affected artifacts, learnings, Pillars Coverage Matrix."
  metadata={"skill": "diagnose-bug"}

TaskCreate: subject="2. plan-changeset: SKIP if committed fix is complete per diagnose-bug brief"
  description="Invoke: /plan-changeset. SKIP if diagnose-bug brief confirms committed fix is complete with no delta."
  metadata={"skill": "plan-changeset"}

TaskCreate: subject="3. execute-changeset: SKIP if no delta from plan-changeset"
  description="Invoke: /execute-changeset. SKIP if plan-changeset was skipped."
  metadata={"skill": "execute-changeset"}

TaskCreate: subject="4. review-gate: gate committed diff against diagnose-bug brief"
  description="Invoke: /review-gate. Gate 42ef5c7 retroactively — does commit match what brief prescribes?"
  metadata={"skill": "review-gate"}

TaskCreate: subject="5. write-e2e: MANDATORY user-facing. Runtime photo upload test"
  description="Invoke: /write-e2e. MANDATORY — user-facing surface. Test photo upload across Competitions, Deals, Menu, Settings, LocationProfile, Profile with real image fixture."
  metadata={"skill": "write-e2e"}

TaskCreate: subject="6. land-changeset: verify landing + wire assertion script"
  description="Invoke: /land-changeset. Verify landing complete, wire assert-photo-upload-compat.mjs into npm scripts."
  metadata={"skill": "land-changeset"}

TaskCreate: subject="7. verify-promotion: production smoke on example-marketplace.app"
  description="Invoke: /verify-promotion. Upload test image on each of the 6 affected pages via example-marketplace.app."
  metadata={"skill": "verify-promotion"}

TaskCreate: subject="8. close WI-012: reclassify + update INDEX + learnings + journey promotion"
  description="No skill invocation. Reclassify chore→bugfix, status VERIFIED, update INDEX.md, update project-state.md, append learnings to feedback memory, project to GitHub issue. Journey tag promotion: if write-e2e ran with passing evidence for J*.feature.md scenarios, promote [SPEC]→[LIVE] in those files and run node scripts/check-journey-tags.ts (if present)."
  metadata={"skill": null}

TaskUpdate: task 2 addBlockedBy [1]
TaskUpdate: task 3 addBlockedBy [2]
TaskUpdate: task 4 addBlockedBy [3]
TaskUpdate: task 5 addBlockedBy [4]
TaskUpdate: task 6 addBlockedBy [5]
TaskUpdate: task 7 addBlockedBy [6]
TaskUpdate: task 8 addBlockedBy [7]

TaskUpdate: task 1 status: in_progress
Skill: diagnose-bug
```

### Pre-Flight Protocol (at each skill's START)

**Before doing ANY work, the agent MUST execute the skill's pre-flight checklist.** Loading a skill is not the same as following it. The pre-flight catches the #1 failure mode: agent jumps to the "interesting" part (writing code) while skipping the "boring" part (reading existing infrastructure).

When a skill is loaded, before the first process step:

1. **Read the skill's PREREQUISITE / Step 0 section** (if it has one). Execute each check — read the files, grep for patterns, check for existing infrastructure. This is not optional reading — it is mandatory execution.
2. **Run the repo-contract scan in precedence order.** Check, in this order:
   - `docs/specs/router-context.md` if present
   - `AGENTS.md` if present
   - `CLAUDE.md` if present
   - platform/runtime config (`package.json`, framework manifests, deploy config files)
   - repo-local skill directories (`.claude/skills/`, repo-specific skill folders)
   - global skill directories (`~/.claude/skills/`)
   This is the precedence stack for routing-critical repo knowledge. Do not skip directly to skill directories and pretend the repo contract was checked.
3. **Check for project-specific skills** that overlap with the loaded skill. If a project skill covers the same domain (e.g., `e2e-automation` for `write-e2e`, a repo-local deploy skill for deploy work), read it after the repo-contract scan — it may contain repo-specific auth patterns, selectors, conventions, or overrides.
4. **Check for existing infrastructure** the skill will build on. For `write-e2e`: `ls e2e/pages/ e2e/helpers/`. For `plan-changeset`: `ls docs/plans/`. For `execute-changeset`: check worktree state. The skill's PREREQUISITE section names what to check; the Pre-Flight Protocol says CHECK IT NOW, don't skip it.
5. **If delegation is relevant, read `docs/specs/agent-topology.md` if present.** If absent, default conservatively. Do not infer "platform supports agents" => "delegation preferred in this repo."
6. **Log the pre-flight results** in a brief checklist (in chat or in the output file):
   ```
   Pre-flight for write-e2e:
   ✅ Read PhotoUpload.jsx (311 lines, 3 upload methods)
   ✅ Read router-context.md — deploy and code-style overrides noted
   ✅ Checked AGENTS.md / CLAUDE.md — no stronger overrides than router-context
   ✅ Read Settings.jsx:272 (PhotoUpload call site)
   ✅ Found LoginPage in e2e/pages/ — will reuse
   ✅ Found e2e-automation project skill — checked, no overrides needed
   ✅ Found account-pool.ts — using getBusinessOwnerAccount()
   ```
7. **Only THEN start Process Step 1** of the skill.

A skill execution that skips pre-flight is a contract violation — same severity as skipping self-verify.

### Skill contract obligation (at each skill's END)

Every skill except `route-workflow` MUST carry an explicit task-graph block in its own chaining or pipeline-continuation section. No inheritance-by-reference. When a skill finishes:

1. **Run ALL self-verify checks.** If any check FAILS, the task stays `in_progress` and the failure is reported. A task CANNOT be marked `completed` with failing self-verify checks. This is the enforcement mechanism — self-verify is not advisory, it is a gate.
2. Mark current task `completed` in the active `lane-tasks-<WI>.json` file first, then mirror to host (`TaskUpdate` in Claude Code)
3. Evaluate next task's conditions
4. If runnable: mark next task `in_progress`, then load the named skill
5. If skippable: mark next task `completed` (with skip reason), advance to the one after
6. If lane is done: emit `**Next:**` trailer per Output Protocol

A skill that completes without updating its task status is a contract violation. A skill that treats `Invoke: /skill-name` as plain explanatory text instead of "load this skill now" is also a contract violation. **A skill that marks a task `completed` while self-verify checks are failing is a contract violation.**

### AP-27: Ghost Skill Execution — explicit rule

**Do NOT mark a task `completed` in `lane-tasks-<WI>.json` unless that task's skill was loaded via the Skill tool (Claude Code), `/skill:<name>` or `SKILL.md` (Kimi), or `SKILL.md` (Codex/Gemini) in the current session, and the load was recorded with `node scripts/task-graph.mjs load-skill ...`.**

The pattern that violates AP-27 looks like this: the agent reads the skill description in the task graph, decides it knows what the skill does, executes the work inline (without invoking the skill), then marks the task `completed`. The skill's self-verify checks, pre-flight, pillar audit, pattern scan, and output-to-file rules are ALL skipped because the skill contract was never loaded.

**Why this is a hard contract violation:**

- The skill's contract is the enforcement mechanism. Its self-verify rules, mandatory sections, and output format are what make svc compound over time.
- Ghost execution produces output that *looks* compliant but skipped every contract check. G5 review-gate may catch it retroactively — that's too late.
- Every ghost-executed task silently degrades framework value. The next agent that replays or audits the lane assumes the contract ran. The record lies.

**Each skill's self-verify MUST include this check (or an equivalent):**

> "This skill was loaded via the Skill tool (Claude Code), `/skill:<name>` or `SKILL.md` (Kimi), or by opening `SKILL.md` directly (Codex/Gemini) BEFORE this self-verify ran. If I cannot point to the corresponding `task-graph.mjs load-skill` receipt that preceded this work, I have ghost-executed. Revert the task to `in_progress` and LOAD the skill now."

The helper layer is the canonical proof: `node scripts/task-graph.mjs load-skill` writes a receipt onto the task, and `set-status ... completed` rejects non-skip completion without that receipt. Host-native traces remain supplemental evidence.

**Valid SKIP path for legitimate skip-tasks:** when `conditions` say `SKIP`, the correct status is `completed` with a filled `skip_reason` field — NOT a ghost-execution with fabricated content. A skipped task is not executed; an executed task requires its skill loaded.

**Hook support:** the svc Stop hook (`hooks/svc-task-completion-guard.sh`) globs all `lane-tasks-*.json` (2026-04-17 fix) and blocks stop when any WI has pending/in-progress tasks. The helper-layer receipt is the primary cross-host enforcement for AP-27; host-native traces remain secondary evidence.

## Prompt-Time Progress Audit

Stop-hook enforcement is not the only progress checkpoint. `hooks/svc-prompt-stale-state.mjs`
runs on `UserPromptSubmit` and warns when an active lane task has stayed
`in_progress` longer than `SVC_PROMPT_PROGRESS_WARN_MINUTES` (default `45`)
without updated task state. This is deliberately advisory: prompts are not safe
hard-block points across every host, but they are frequent enough to catch long
sessions that have not reached Stop.

When the warning fires, update `.svc/lane-tasks-<WI>.json`, record a
`task-graph.mjs load-skill` or phase receipt, or mark the blocker explicitly
before continuing.

## Skill Prerequisites

`chain.requires` is intentionally rejected as a second prerequisite system.
The canonical prerequisite contract is lane-task `blocked_by` plus `task-graph.mjs
next`, which returns only runnable tasks after blockers complete. `set-status
... completed` then enforces the matching skill receipt. A second skill-local
`chain.requires` field would split truth between skill frontmatter and the
active graph and recreate the silent-skip failure this protocol is designed to
prevent.

Validators enforce this choice by scanning first-party `SKILL.md` files for
`chain.requires` / top-level `requires` declarations and by checking the
task-graph receipt completion path.

### Relationship to Output Protocol

The Task-Graph Execution Protocol and the Output Protocol coexist:

- **Task graph** tracks progress and persists across sessions — it's the execution engine
- **Codex equivalent** is explicit skill loading plus `lane-tasks-<WI>.json`/`update_plan` mirroring — same sequencing, less native UI
- **`**Next:**` trailer** is the human-readable summary at the end of each response — it's the UX layer
- When a task graph is active, the `**Next:**` trailer should reference the next task: `**Next:** Task 5 of 8: \`write-e2e\` — runtime photo upload test across 6 pages (MANDATORY, user-facing surface)`
- When no task graph is active (conversational responses, status checks), the `**Next:**` trailer falls back to project-state suggestions

### Output Protocol — Next Command Suggestion (applies to ALL skills)

Every response from every skill MUST end with exactly one `**Next:**` line. Rules:

- **Paste-ready.** The user should be able to copy the command verbatim. No placeholders like `<your-wi>` — resolve from project state.
- **Exactly one trailer.** If parallel paths exist, express as options A/B inside one line.
- **Never omit Next.** Even for status/conversational responses, emit a `**Next:**` suggesting the next action or a project-state review.

**Reference grounding (2026-04-19, from capture-idea-and-reference-family-gaps evolution):** when a `**Next:**` trailer names specific references, competitors, URLs, targets, or pattern examples for the next skill to consume, those names MUST be checked against the caller's product context (`docs/specs/vision.md`, primary persona) for family fit BEFORE being emitted.

- If the target family is uncertain or mismatched: emit the Next-line with the skill invocation but OMIT the specific targets. Add: *"Provide targets aligned to: [product-family descriptor]. Examples: [2–3 family-matched references]."*
- If the target family is confirmed aligned: emit targets as normal.

**Why this rule exists:** without it, `route-workflow` can suggest dev-tool references (Linear/Stripe/Vercel) for local-business products; the user pastes verbatim into `reverse-engineer`; mismatch propagates silently. The named-reference case is the failure mode; single-skill invocations without references don't need this check.

### Anti-Rationalization Rules (when task graph is active)

Source: blader/taskmaster compliance prompt, adapted for svc.

These rationalizations are INVALID reasons to stop mid-lane. If you catch yourself thinking any of them, that is a signal to CONTINUE, not to stop:

- "Context is getting large" — auto-compact handles this. Not your job.
- "Recommend starting in a fresh session" — the task graph persists in `lane-tasks-<WI>.json`. Keep going.
- "This session has used significant context on framework work" — irrelevant. Tasks remain.
- "Given the heavy context use" — auto-compact. Keep going.
- "This is a significant context-consuming task" — so? Do it.
- "Diminishing returns" — not a valid stop reason when tasks are pending.
- Progress summaries instead of execution — **DO NOT NARRATE. EXECUTE.**

**PROGRESS IS NOT COMPLETION.** A lane with 4/8 tasks done is not "good progress" — it is an incomplete lane. The only valid stop reasons when a task graph is active are:
1. All tasks completed
2. User explicitly said stop
3. A blocker that requires user input (and you've tried to resolve it first)
4. The Stop hook escape hatch counter (`SVC_COMPLETION_MAX`) was exceeded

Everything else — context concerns, token counts, session length, "recommending a fresh session" — is rationalization. The framework handles context (auto-compact) and persistence (`lane-tasks-<WI>.json`). Claude hooks may add pressure, but correctness comes from the file-backed task graph and explicit skill loading. Your job is to execute tasks, not manage infrastructure.

### File-Backed Task Persistence (`lane-tasks-<WI>.json`)

**When `route-workflow` creates a task graph, it MUST write `.svc/lane-tasks-<WI>.json` first.**

This file is the **cross-host source of truth** for task state.
`TaskCreate`/`TaskUpdate` (Claude Code) and `update_plan` (Codex) are mirrors.
The file persists across sessions, is readable by hooks (bash scripts), and is
diffable in git.

**Format:**

```json
{
  "wi": "WI-012",
  "lane": "bugfix-retroactive",
  "created": "<helper-generated ISO 8601 wall-clock timestamp>",
  "status": "pending",
  "tasks": [
    {
      "id": 1,
      "skill": "diagnose-bug",
      "metadata": { "skill": "diagnose-bug" },
      "subject": "diagnose-bug: root cause + pillar revisit for WI-012",
      "status": "completed",
      "completed_at": "<helper-generated ISO 8601 wall-clock timestamp>",
      "skill_receipt": {
        "skill": "diagnose-bug",
        "loaded_at": "<helper-generated ISO 8601 wall-clock timestamp>",
        "loaded_via": "skill_tool"
      },
      "skip_reason": null,
      "blocked_by": []
    },
    {
      "id": 5,
      "skill": "write-e2e",
      "metadata": { "skill": "write-e2e" },
      "subject": "write-e2e: MANDATORY runtime photo upload test",
      "status": "pending",
      "conditions": "MANDATORY — user-facing surface",
      "blocked_by": [4]
    }
  ]
}
```

**Write rules:**
- `route-workflow` writes the matching `.svc/session-contract.jsonl` entry first, then creates the task graph before any host-specific task calls. Use `node scripts/task-graph.mjs init .svc/lane-tasks-<WI>.json --wi <WI> --lane <lane>` when bootstrapping a new graph from the shell; the helper fails if the session contract is missing, stale, or references a different WI.
- Persisted task-graph timestamps are audit-grade wall-clock evidence. Do not write illustrative midnight/example times into live `.svc/lane-tasks-*.json` files.
- Graph closure is helper-owned. `scripts/task-graph.mjs` derives top-level graph `status` from child tasks and rejects stale or impossible states (for example, `status: completed` while actionable tasks remain).
- `mid_task_hints[]` is an optional top-level audit array for user corrections received during an active graph. Each entry records `ts`, `user_text`, `normalized_intent`, `classification`, `applied_method_swap`, `new_artifacts_allowed`, and `resolved_skill_hints[]`. Use it for method corrections instead of starting a new lane.
- `mutation_history[]` entries that auto-continue across a verification/review/closeout seam may set `requires_continuation_decision: true`; those entries must have a matching `.svc/pipeline-decisions.jsonl` `end_to_end_continuation` record before closeout.
- Record the skill-load receipt before execution with `node scripts/task-graph.mjs load-skill .svc/lane-tasks-<WI>.json <task-id> <skill-name> --via <mode>`. Non-skip `set-status ... completed` rejects tasks whose `metadata.skill` has no matching receipt.
- For top-level task status changes, use `node scripts/task-graph.mjs set-status .svc/lane-tasks-<WI>.json <task-id> <status> [--skip-reason ...]` so `completed_at` is helper-generated from real wall-clock time. Use `--completed-at` only when replaying a real historical event with known evidence.
- Each skill updates the file when it completes — change `status`, let the helper add `completed_at`, add `skip_reason` only for real skips, and only then update the host-specific mirror
- Validate or inspect the graph with `node scripts/task-graph.mjs validate .svc/lane-tasks-<WI>.json`, `summary`, `graph-status`, and `next`
- The optional Claude Stop hook may read this file to check if pending tasks remain
- On session resume (including compaction-continuations): read the file FIRST, call TaskUpdate for every task whose status in the JSON differs from TaskList, THEN resume from first `in_progress` else first `pending`. Do not trust in-session TaskList state without verifying against the JSON.

**These files replace `.continue-here.md` for task-graph sessions.** When any `.svc/lane-tasks-*.json` exists with pending tasks, those ARE the continue-here signals. Multiple WI files can be active simultaneously — each is independent. `.continue-here.md` remains as a fallback for non-task-graph sessions.

### Phase Receipt Extension Fields (WI-213 Phase D — enforcing)

`skill_receipt` accepts three optional extension fields beyond the required `{skill, loaded_at, loaded_via}` triple:

- `phases_executed[]` — array of `{id, ts, evidence_artifacts[]}` recording which declared phases ran with what evidence
- `evidence_level` — one of `V0` / `V1` / `V2` / `V3` (shared with WI-197 / WI-199)
- `target_class` — one of `browser-visible` / `api` / `data-only` / `infra` (shared with WI-197 / WI-199)

Current completed task graphs must record every phase declared by the loaded
skill with `required_for_completion: true`. Historical pre-enforcement receipts
with only `{skill, loaded_at, loaded_via}` remain compatible, but new completed
tasks are blocked by `validate-skill-receipt-shape.sh` and the Stop hook when
required phase entries are missing.

**Canonical schema:** `references/phase-receipts.md`. That document is the single source of truth — do NOT redefine the schema here. Any field reference, allowed-values table, or migration roadmap belongs there.

**WI file naming convention:**
- Work items with IDs: `.svc/lane-tasks-WI-022.json`
- Framework/ad-hoc work without WI IDs: `.svc/lane-tasks-<slug>.json` (e.g., `lane-tasks-dark-mode-framework-fix.json`)
- **Never use the bare `.svc/lane-tasks.json`** — that name collides across parallel WIs

### Worktree Branch-Point Guard — MANDATORY before `git worktree add`

When creating a worktree for a WI's work, a common failure mode is: main working dir has uncommitted changes that belong to the WI (spec updates, manifest, scratch files), but `git worktree add` only copies the HEAD tree — uncommitted changes stay behind in main. The agent then re-applies the same edits in the worktree, costing time and risking divergence.

**Before running `git worktree add`, the agent MUST check:**

```bash
# From the repo root — detect WI-related uncommitted changes in main.
# If the WI has any tracked artifacts (spec, plan, WI file) that are modified
# or untracked in main, block worktree creation with a clear message.

WI="$1"  # e.g. "WI-066"
DIRTY=$(git status --porcelain=v1 | grep -E "docs/specs/work-items/${WI}\.md|docs/specs/work-items/${WI}[a-z]\.md|docs/plans/.*${WI}|docs/specs/features/.*\.md" || true)
if [ -n "$DIRTY" ]; then
  echo "⚠️ WORKTREE GUARD: uncommitted changes in main related to ${WI}:"
  echo "$DIRTY"
  echo "Commit or stash them before creating a new worktree, or the new worktree"
  echo "will branch from main's HEAD (which doesn't include your uncommitted edits)"
  echo "and you'll re-apply the same changes twice."
  exit 1
fi
```

**Apply the guard in these scenarios:**
- `execute-changeset` before creating the feature worktree
- `diagnose-bug` (Lane 4 retroactive) before creating the validation worktree
- Any manual `git worktree add` invoked from a skill or by the agent directly

**If the guard fires, the resolution order is:**
1. If the uncommitted changes are final (spec updates that belong on main), commit them on main and push first
2. If they belong on the WI's feature branch, switch to main's clean state briefly, create the worktree, then apply the changes in the worktree (never in main)
3. If they're scratch/exploratory, stash them with a labeled message and restore in the worktree

**This guard protects against:** silent drift between main and worktree, duplicate fixes, lost work at worktree creation.

### Output-to-File Convention

**Skill outputs go to files. Chat carries summaries.**

When a skill produces verbose output (root-cause brief, pillar revisit audit, pattern scan, pillars coverage matrix), write the full output to the appropriate file:
- Bugfix: `docs/specs/work-items/WI-NNN.md`
- Feature spec: `docs/specs/features/<name>.md`
- Plan: `docs/plans/<date>-<name>/manifest.md`

Chat carries a **3-5 line summary** + the `**Next:**` trailer. The summary states: what was done, key findings, where the full output lives.

Example for `diagnose-bug`:
```
diagnose-bug complete (retroactive mode). Root cause: prop-shape mismatch on PhotoUpload — all 6 callers used value/onChange, component exported currentPhotoUrl/onPhotoUpdate. Pattern scan: 0 additional mismatches in 31 components. 3 pillars affected (journey, AC, cost). Full brief: docs/specs/work-items/WI-012.md

**Next:** Task 5 of 8: `write-e2e` — runtime photo upload test across 6 pages (MANDATORY, user-facing)
```

When a downstream skill needs the full output, it **reads the file** — not the chat history. This cuts chat tokens by ~80% for verbose skills while preserving all information in persistent files.

### Optional Claude Stop Hook: Completion Guard

**Optional acceleration for Claude Code only. Not required for correctness.**

The required contract is:
1. `lane-tasks-<WI>.json` is written and updated correctly
2. every named skill is loaded before work starts
3. the next task is chosen from the file-backed graph

### Level B: Full state machine (deferred)

This protocol is Level A — task creation at lane entry with manual condition evaluation + file-backed persistence. Claude Stop hook enforcement is optional acceleration, not a correctness dependency. Level B (a full state machine engine with automatic condition evaluation, branching, and auto-advance without human intervention) is deferred as a separate WI in the svc repo. Level A is the foundation that Level B will build on.
