---
name: manage-learnings
version: "1.0"
description: >
  Manage project learnings that compound across sessions. Review, search,
  prune, and export what was discovered during pipeline runs. Use when
  "what did we learn", "show learnings", "prune stale learnings", "search
  learnings for <topic>", or when starting a new session to load context.
phases:
  - id: P1-LearningsSourceModeSelection
    trigger: always
    reads: ["task request", "docs/learnings/learnings.jsonl", "references/framework-learnings.jsonl"]
    writes: [".svc/manage-learnings-mode.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ReviewOrSearchExecution
    trigger: review-or-search-mode
    reads: ["docs/learnings/learnings.jsonl", "search query"]
    writes: [".svc/manage-learnings-review.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-PruneCandidateAnalysis
    trigger: prune-mode
    reads: ["docs/learnings/learnings.jsonl", "referenced files"]
    writes: [".svc/manage-learnings-prune.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-ExtractLearningQualityGate
    trigger: extract-mode
    reads: ["debugging outcome", "quality gate answers"]
    writes: ["docs/learnings/learnings.jsonl"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ExportOrDisplayOutput
    trigger: user-facing-output
    reads: ["selected learnings", "export grouping"]
    writes: ["assistant response", ".svc/manage-learnings-export.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/learnings/learnings.jsonl", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/learnings/learnings.jsonl", artifact: learnings-log }
outputs:
  produces:
    - { path: "docs/learnings/learnings.jsonl", artifact: learnings-log }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: false
handles_concerns:
  - auto-learning-capture
---

# Review Learnings

## Product-runtime v2 learning gate

Do not promote a framework learning merely because text was recalled or a task was accepted. Require
a digest-bound source evidence object already acknowledged by a named product consumer, an observed
outcome evidence object, and a recorded next product decision. Compile the link with
`scripts/lib/runtime-memory-company-v2.mjs`.

Manage the project's institutional memory. Every skill logs operational
discoveries during pipeline runs. This skill lets you review, search,
prune, and export those learnings.

Blended from gstack /learn. Adapted for svc's pipeline.

**Announce at start:** "I'm reviewing project learnings."

## How Learnings Are Captured

Every skill's Pipeline Continuation section should log discoveries to
`docs/learnings/learnings.jsonl` (append-only).

### JSONL Schema

Each entry is a single JSON line with these fields:

```json
{
  "date": "2026-04-04",
  "skill": "execute-changeset",
  "type": "operational",
  "key": "prisma-force-flag-ci",
  "insight": "Prisma needs --force flag for reset in CI environment",
  "confidence": 8,
  "source": "observed",
  "files": ["prisma/seed.ts", ".github/workflows/ci.yml"],
  "saves_minutes": 15
}
```

### Framework-Level Learnings

Project learnings go to `docs/learnings/learnings.jsonl`. Framework-level learnings
(mistakes that affect the svc framework itself, not a specific project) go to
`references/framework-learnings.jsonl`.

Framework learnings are loaded at every **SessionStart** by the `svc-learning-preload`
hook. They appear in the agent's context before any work begins, turning passive
logs into active guardrails.

**When to log a framework learning:**
- A framework skill was invoked incorrectly and caused degradation
- A host API assumption was wrong (training data staleness)
- A validator caught a mistake that should have been prevented
- A test was flaky due to framework-level state leakage

**When to log a project learning:**
- A project-specific build step, env var, or tool quirk
- A domain convention not in the codebase
- A pattern that worked well for this specific project

| Field | Required | Description |
|-------|----------|-------------|
| `date` | yes | ISO date of discovery |
| `skill` | yes | Which skill logged this |
| `type` | yes | One of: `pattern`, `pitfall`, `preference`, `architecture`, `tool`, `operational` |
| `key` | yes | Unique kebab-case identifier (e.g., `prisma-force-flag-ci`) |
| `insight` | yes | The learning itself — what was discovered |
| `confidence` | yes | Integer 1-10 (see scoring below) |
| `source` | yes | One of: `observed`, `user-stated`, `inferred`, `cross-model` |
| `files` | no | Array of file paths relevant to this learning |
| `saves_minutes` | yes | Estimated minutes saved if this learning is applied in a future session |

### Confidence Scoring

| Score | Meaning | When to use |
|-------|---------|-------------|
| 10 | User-stated | User explicitly told us this fact |
| 8-9 | Verified in code | Confirmed by reading source, running tests, or observing behavior |
| 7 | Observed not verified | Saw it happen but didn't trace root cause |
| 4-5 | Uncertain | Hypothesis based on limited evidence |
| 1-3 | Speculation | Guess based on patterns, not confirmed |

### Deduplication

Latest entry with the same `key` + `type` combination wins. When logging a new entry,
check if an entry with the same key+type already exists. If so, the new entry supersedes
it — do not delete the old one (append-only), but during `review` and `export`, only
the latest entry per key+type is shown.

### 5-Minute Threshold

Only log a learning if it would save 5+ minutes in a future session. Ask:
"If I encountered this situation again without this knowledge, would I lose 5+ minutes?"

**What's worth logging:**
- Commands that failed and how they were fixed
- Project-specific quirks (build order, env vars, test setup)
- Patterns that worked well (or didn't)
- Tools discovered during research
- Domain conventions that aren't in the codebase

**What's NOT worth logging:**
- Generic programming knowledge
- Things already documented in README or CLAUDE.md
- One-time fixes that won't recur

### Compound Mechanism

When a learning matches a finding during any future skill run, display:

```
Prior learning applied: [key]
  Insight: <the insight text>
  Confidence: <N>/10  |  Source: <source>
```

This creates a feedback loop: learnings become more valuable each time they fire.
When a learning fires, consider bumping its confidence by +1 (cap at 10).

## Modes

### `review` (default)

Show the last 20 learnings, newest first:

```bash
tail -20 docs/learnings/learnings.jsonl | jq -r '.date + " [" + .skill + "] " + .insight'
```

### `search <query>`

Find learnings matching a keyword:

```bash
grep -i "<query>" docs/learnings/learnings.jsonl | jq '.'
```

### `prune`

Remove stale or conflicting learnings:
- **Stale:** learning references a file/pattern that no longer exists
- **Conflicting:** two learnings say opposite things (same key, contradictory insights)
- **Low-confidence:** confidence <= 3 and older than 30 days
- **Superseded:** duplicate key+type where a newer entry exists

**Staleness detection:** for each learning with a `files` array, check if the referenced
files still exist in the repo:

```bash
for file in $(jq -r '.files[]?' docs/learnings/learnings.jsonl); do
  [ ! -f "$file" ] && echo "STALE: $file no longer exists"
done
```

If a file no longer exists, mark the learning as stale candidate. Present all stale
candidates to the user for confirmation before removing.

### `promote --from-auto` (review and promote auto-captured candidates)

Auto-capture (per WI-343) writes detector-produced learning candidates to the
gitignored audit log `.svc/auto-learnings.jsonl`. Promotion is **always
explicit** — never automatic — and routes each candidate to the correct
tracked destination based on its `candidate_target` field.

```bash
# Interactive per-candidate review (default)
node scripts/promote-auto-learnings.mjs

# Non-interactive: accept every candidate that survives dedup
node scripts/promote-auto-learnings.mjs --accept-all

# Inspect without writing
node scripts/promote-auto-learnings.mjs --dry-run

# Read the draft log instead (when SVC_AUTO_LEARN_REVIEW=1 was set)
node scripts/promote-auto-learnings.mjs --from-draft

# Promote only one signal heuristic
node scripts/promote-auto-learnings.mjs --filter correction-after-failure
```

**Destination routing (decided at promotion time):**

| `candidate_target` | Destination |
|---|---|
| `framework-learnings` | `references/framework-learnings.jsonl` |
| `project-learnings`   | `docs/learnings/learnings.jsonl` |
| `user-memory`         | Resolved via `scripts/lib/resolve-user-memory-path.mjs` — writes a `<type>_<slug>.md` memory file and appends a pointer to `MEMORY.md` in the host's user-memory directory (Claude Code: `~/.claude/projects/<slug>/memory/`; other hosts fall back to `~/.svc/per-host/<host>/projects/<slug>/memory/`). |

**Dedup rules:**

- JSONL targets: skip-if-existing-equal-or-higher-confidence on `(key, insight_prefix)` per `scripts/lib/learning-dedup.mjs`.
- Directory targets (user-memory): skip if the resolved `<type>_<slug>.md` file already exists.

**Audit-log lifecycle on promotion:**

- Accepted candidates are removed from `.svc/auto-learnings.jsonl` (or `.svc/auto-learnings.draft.jsonl` when `--from-draft`).
- Dedup-redundant candidates are also removed.
- Skipped or quit-from-review candidates stay in the audit log for the next promotion run.
- Survivor identity uses object reference, not signal+key — two candidates sharing signal+key but different targets both promote without data loss.

**Standalone capture:**

`scripts/capture-session-learnings.mjs` mirrors the hook's behavior for hosts without the right trigger surface, or for retrospective scans over a custom `--scope <ref>`. Same audit-log target, same gitignore-by-default contract. See `scripts/capture-session-learnings.mjs --help`.

### `extract` (skill extraction from debugging)

After solving a tricky problem, extract the pattern into a reusable learning:

**Quality gate (ALL must be true):**
- "Could someone Google this in 5 minutes?" → NO
- "Is this specific to THIS codebase or stack?" → YES  
- "Did this take real debugging effort to discover?" → YES

If all three pass, log it as type `pattern` with confidence 9-10.

**Format:**
```json
{"skill": "executing-change-set", "type": "pattern", "key": "prisma-reset-force-flag", "insight": "In CI environments, Prisma migrate reset requires --force flag because stdin is not a TTY. Without it, the command hangs waiting for confirmation that never comes.", "confidence": 9, "source": "observed", "files": ["prisma/migrations/"], "saves_minutes": 30}
```

This is not just a note — it's a reusable debugging heuristic that prevents the same 30-minute investigation from happening again.

### `export`

Export learnings to markdown for inclusion in CLAUDE.md or onboarding docs.

The export groups learnings by `type`, using only the latest entry per key+type
(deduplication applied). Only learnings with confidence >= 5 are exported.

**Export format for CLAUDE.md embedding:**

```markdown
## Project Learnings (auto-generated)

### Patterns
- [prisma-seed-ordering] Seed files must run in alphabetical order due to FK constraints (confidence: 8, observed)
- [api-error-shape] All API errors return {code, message, details} shape (confidence: 9, verified)

### Pitfalls
- [prisma-force-flag-ci] Prisma needs --force flag for reset in CI environment (confidence: 8, observed)
- [auth-middleware-order] Auth middleware must be loaded before rate limiter (confidence: 9, verified)

### Preferences
- [test-naming] Test files use .test.ts suffix, not .spec.ts (confidence: 10, user-stated)

### Architecture
- [service-layer-pattern] Business logic lives in /src/services, controllers are thin (confidence: 7, observed)

### Tool
- [playwright-headed-debug] Use --headed flag for Playwright debugging in WSL (confidence: 8, observed)

### Operational
- [dev-server-port] E2E tests require the dev server running on port 3000 (confidence: 8, observed)
```

Each bullet includes the key in brackets for traceability, the insight text,
and parenthetical confidence + source metadata.

## Integration

`route-workflow` reads learnings at session start to inform routing:
- If a learning says "feature X requires special build step", the compass
  flags it when routing to `execute-changeset`
- If a learning says "this API pattern causes issues", `design-tech`
  can avoid it

Every skill can query learnings before making decisions:
```bash
grep -i "<topic>" docs/learnings/learnings.jsonl
```

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `manage-learnings` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-LearningsSourceModeSelection --evidence command_output:.svc/manage-learnings-mode.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ReviewOrSearchExecution --evidence command_output:.svc/manage-learnings-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-PruneCandidateAnalysis --evidence command_output:.svc/manage-learnings-prune.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ExtractLearningQualityGate --evidence file:docs/learnings/learnings.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ExportOrDisplayOutput --evidence command_output:.svc/manage-learnings-export.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/manage-learnings-self-verify.log
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

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | learnings.jsonl exists or was created | `test -f docs/learnings/learnings.jsonl` | |
| 2 | All entries use canonical schema | `jq -e '.insight and .confidence and (.confidence | type == "number")' docs/learnings/learnings.jsonl` returns no errors | |
| 3 | Stale learnings identified and acted on (prune mode) | stale candidates presented to user before removal | |

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

Standalone skill — not in progressive chains. Invoke at session start
to load context, or after any skill to review what was learned.

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
