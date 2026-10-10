---
name: onboard-repo
version: "1.0"
description: >
  Convert an existing repo to the svc way of working without overwriting what already
  ships: map current docs, tests and conventions into project state and work items. Use
  when onboarding a brownfield repo.
phases:
  - id: P1-StateInitRepoInventory
    trigger: always
    reads: ["REPO_MODES.md", "code layout", "existing docs", "tests", "workflow/status files"]
    writes: [".svc/orchestrator-state.json", ".svc/capability-registry.json", ".svc/framework-gaps.jsonl", ".svc/pipeline-decisions.jsonl"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-ArtifactMappingRouterTopology
    trigger: always
    reads: ["existing docs", "skills/audit-coverage/SKILL.md", "repo config", "platform/runtime signals"]
    writes: ["docs/specs/project-state.md", "docs/specs/router-context.md", "docs/specs/agent-topology.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-CoreMechanicCompetitiveSweep
    trigger: brownfield-code-present
    reads: ["src/", "app/", "lib/", "references/knowledge/competitors/", "docs/specs/domain-profile.md"]
    writes: ["docs/specs/brownfield-competitive-flags.md", "docs/specs/work-items/WI-*.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-CoverageAuditInvocation
    trigger: always
    reads: ["skills/audit-coverage/SKILL.md", "docs/specs/project-state.md", "docs/specs/router-context.md"]
    writes: ["docs/specs/coverage-audit.md", "docs/specs/project-state.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-WorkItemTriageSteeringRules
    trigger: always
    reads: ["discovered findings", "skills-manifest.json", "rulesRegistry", "host context files"]
    writes: ["docs/specs/work-items/INDEX.md", "docs/specs/work-items/WI-*.md", "CLAUDE.md", "KIMI.md", "AGENTS.md", "ANTIGRAVITY.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["docs/specs/project-state.md", "docs/specs/router-context.md", "docs/specs/agent-topology.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "docs/specs/project-state.md", artifact: existing-project-state }
outputs:
  produces:
    - { path: "docs/specs/project-state.md", artifact: project-state }
    - { path: "docs/specs/router-context.md", artifact: router-context }
    - { path: "docs/specs/agent-topology.md", artifact: agent-topology }
    - { path: "docs/specs/work-items/INDEX.md", artifact: work-item-index }
chain:
  lanes:
    brownfield-conversion: { position: 1, next: plan-capabilities }
  progressive: true
  self_verify: true
  human_checkpoint: false
---

# Repo Conversion

Brownfield work should not start by pretending the repo is clean.

This skill is the first step for existing repositories. It inventories the current
truth, maps it into svc artifact types, logs problems as work items, and stops
when the terrain is understood. It does not turn into an endless audit, and it does
not fix everything it finds while still mapping the system.

**Announce at start:** "I'm using the onboard-repo skill to map this existing repo into svc working mode."

## When To Use

- Existing repo with active product behavior
- Existing repo with docs/tests/process that predate svc
- Brownfield adoption
- Team asks "how do we bring this repo into svc?"
- Before running the full pipeline on an existing product

## Core Rule

**Log then triage. Do not fix as found.**

Conversion discovers findings and records them as work items. Resolution begins only
after the map is complete, unless the repo is so broken that mapping cannot continue.

## Step 0: Initialize Project State Infrastructure

Before mapping the repo, ensure the svc runtime state directory exists:

```bash
# Initialize .svc/ state files from framework templates
# (path depends on your CLI host — see table below)
node <SKILLS_PATH>/scripts/init-project-state.mjs
```

**Host-specific skills path:**

| Host | Skills Path | Full Command |
|------|-------------|--------------|
| Kimi | `~/.kimi/skills/` | `node ~/.kimi/skills/scripts/init-project-state.mjs` |
| Claude | `~/.claude/skills/` | `node ~/.claude/skills/scripts/init-project-state.mjs` |
| Codex | `~/.codex/skills/` | `node ~/.codex/skills/scripts/init-project-state.mjs` |
| Gemini | `~/.gemini/skills/` | `node ~/.gemini/skills/scripts/init-project-state.mjs` |
| OpenCode | `~/.config/opencode/skills/` | `node ~/.config/opencode/skills/scripts/init-project-state.mjs` |

Use `--surface-only` when a repository already has governed `.svc`, ignore, and merge state and only needs the committable identity, Codex context, and project-local skill surface.
- `orchestrator-state.json` — cross-session state machine
- `capability-registry.json` — project capability inventory
- `framework-gaps.jsonl` — append-only gap log
- `pipeline-decisions.jsonl` — append-only decision log
- `.gitignore` — auto-provisioned with standard Serious Vibe Coding ignores inside the comment envelope block
- `.agents/repository.json` — committable repository identity with a relative canonical root and central-only framework execution source
- `AGENTS.md` — created only when absent so Codex receives the repository's existing context and routing authorities
- `.agents/skills/repo-context/SKILL.md` — project-local, committable context skill; it may describe this repository but may never become the source for framework enforcement executables

If `.svc/` already exists, the `.svc` template copies are a no-op, but root `.gitignore` ignores are still idempotently updated.
Existing repository identity, `AGENTS.md`, and project-local skill files are owner-authored state and are preserved byte-for-byte on subsequent initialization.

## Outputs

Create or update these canonical files:

- `docs/specs/project-state.md`
- `docs/specs/router-context.md`
- `docs/specs/agent-topology.md`
- `docs/specs/work-items/INDEX.md`
- `docs/specs/work-items/WI-*.md`

These repo files are the source of truth. External trackers are projections.

## Project State File

**Project State File** — Write `docs/specs/project-state.md` (repo mode `convert`, conversion status, active lanes, current focus, subsystem map, compatibility notes, work-item summary, coverage gaps), `docs/specs/router-context.md` (required skills by intent, precedence repo override > project-local platform rule > generic platform heuristic > global fallback, forbidden flows, code-style authority, deployment contract, detected host and wired rules) and `docs/specs/agent-topology.md` (delegation allowed or not, roles, ownership, shared write surfaces, when to stay single-agent). The foundational artifact status MUST come from `audit-coverage` (the full catalog in `docs/specs/coverage-audit.md`): link or summarize it, never hand-list a subset, which hides gaps. Details: `references/project-state-and-work-items.md`.

## Work Item Types

**Work Item Types** — Use only these types: `conversion`, `feature`, `bugfix`, `regression`, `refactor`, `drift`, `chore`; statuses `identified`, `mapped`, `triaged`, `planned`, `in_progress`, `blocked`, `resolved`, `verified`, `deferred`; severities `critical`, `high`, `medium`, `low`. Details: `references/project-state-and-work-items.md`.

## Work Item Template

**Work Item Template** — Each file in `docs/specs/work-items/` follows the canonical schema in `references/work-item-schema.md`: title `# WI-NNN`, then Type, Status, Severity, Filed, Source (`onboard-repo`), Lane, Repo Mode (`convert`), Source Artifact and GitHub Issue fields, followed by Problem, Evidence, Route Recommendation and Notes sections (triage detail only, not implementation). Details: `references/project-state-and-work-items.md`.

## Process

### 1. Inventory current truth

Read:

- code layout
- existing docs
- existing tests
- existing workflow/status files
- issue tracker references if present

Answer:

- what is actually shipped?
- what conventions already exist?
- what docs appear canonical?
- what parts are obviously drifting?
- what repo-local docs override generic framework behavior?
- what platform/runtime signals identify how this repo actually runs?
- does the repo define a real delegation topology, or only expose platform-level agent capability?

### 2. Map current artifacts into svc form

Do not rename everything on day one.

Instead, classify current truth against the **full svc canonical artifact
catalog**. The catalog (20 canonical artifacts as of v1) lives in
`skills/audit-coverage/SKILL.md` — do not maintain a parallel subset list here.

Record compatibility notes where current structure differs from svc (e.g.,
uppercase `VISION.md` instead of `vision.md`, or specs split by user role
instead of by feature).

Create the two brownfield routing artifacts during mapping:

- `docs/specs/router-context.md` — repo-specific routing contract distilled from
  repo docs + platform/runtime config
- `docs/specs/agent-topology.md` — explicit delegation contract for the repo

Do not wait for later feature work to discover these. They are part of the
conversion map.

### 2.4 Detect core-mechanic features (per WI-140 ONB-01..04)

**2.4 Detect core-mechanic features** — Run a day-1 competitive sweep. Pass 1 (MANDATORY, universal): enumerate source directories and entry points and group them into feature areas (auth, billing, onboarding, rewards, admin), checking `references/knowledge/competitors/` for each. Pass 2 (supplementary): grep domain-specific core-mechanic patterns derived from the domain profile. For each detected mechanic, run `analyze-competitors` scoped to that mechanic only (not the full 20-competitor analysis) and write `docs/specs/brownfield-competitive-flags.md` per `references/templates/brownfield-competitive-flags.md` with code evidence, competitor match and severity: HIGH (0 of N competitors match) auto-creates a backlog WI tagged `competitive-strategy-review`, MEDIUM (1-2 of N) is flagged in the onboard report with no WI, LOW (3+ of N) is no concern. Details: `references/process-detail.md`.

### 2.5 Coverage Audit (mandatory)

After Step 2's informal mapping, invoke `audit-coverage` to produce the
formal coverage report. This is **not optional** — without it, missing
canonical artifacts (domain profile, code-style contract, design contracts,
visual baselines, marketing context) are silently absent and downstream
lanes (especially Lane 3 Brownfield Feature Extension) skip steps without
warning.

`audit-coverage` walks the full canonical catalog, classifies each slot as
CANONICAL / FOREIGN / MISSING, and writes:

- `docs/specs/coverage-audit.md` — full state report
- `## Coverage Gaps` section in `docs/specs/project-state.md` — summary

**Foreign content matters as much as missing content.** A repo with 23
competitor analysis files in `docs/analysis/` but no
`docs/specs/analyze-competitors.md` is FOREIGN, not CANONICAL — the pipeline
cannot read foreign-form research. The audit flags this for consolidation
via `analyze-competitors`.

The same rule applies to repo-local routing knowledge. A repo with critical
deploy or workflow rules in `AGENTS.md` / `CLAUDE.md` but no
`docs/specs/router-context.md` is not fully mapped. The audit must flag that
gap so the router stops rediscovering it ad hoc.

Invoke as:

```
audit-coverage --from onboard-repo
```

The `--from onboard-repo` flag tells audit-coverage to return control here
after writing its outputs, so this skill can continue to Step 3.

### Verification Rule for External Claims

When capturing findings from conversation context, prior sessions, or user reports:

1. **Every code-level claim must be verified by reading the actual file.**
   "The function bypasses secureOperation" → Read the function. Confirm.
2. **Every field/function/component name must be grep-verified.**
   "Field mismatch: writes discount_percent, reads discount_percentage" → Grep both. Confirm.
3. **Route recommendations must use Core Pack skills only.**
   Check against `skills-manifest.json` includedSkills. No external add-ons as primary routes.
4. **If verification fails, mark the finding as `unverified-report`** and note
   what couldn't be confirmed. Do not assign severity above `medium` to
   unverified findings.

Work items must contain evidence from system tools (Read, Grep, Bash),
not from conversation history.

### 3. Capture findings as work items

For each discovered issue, create a work item instead of trying to solve it inline.

Examples:

- shipped bug -> `bugfix`
- behavior regressed from expected state -> `regression`
- spec and code disagree -> `drift`
- missing canonical product artifact -> `conversion`
- real new capability request -> `feature`

### 4. Triage, then stop

Assign each item:

- type
- severity
- lane
- next skill

Conversion ends when:

- the repo has a `project-state.md`
- the repo has a `router-context.md`
- the repo has an `agent-topology.md`
- the work-item index exists
- major findings are logged
- every logged item has a route recommendation

That is the stopping rule. No endless audit loop.

### 5. Wire steering rules into project context file

**5. Wire steering rules into project context file** — After triage, detect the host (`bash scripts/detect-host.sh`; default `CLAUDE.md`, also `KIMI.md`, `AGENTS.md`, `ANTIGRAVITY.md`) and ensure the target context file contains the svc baseline line ("This repo is svc-onboarded: respect the local AGENTS.md/CLAUDE.md deployment, test, and route-workflow rules for this exact worktree; post-deploy/production validation requests require live post-deploy evidence, not local pre-deploy substitutes."), appended once if missing. Detect stacks (react-native, react, golang, rust, python, web, typescript) and, for each, wire `rulesRegistry` entries with `type: steering` and matching `stack` by `@`-import on Claude Code or an explicit read-list on Antigravity (plus `node ~/.gemini/antigravity/skills/scripts/sync-antigravity-ki.mjs`). Skip universal rules, undetected stacks, empty placeholder rules and rules already present, and record the host, stacks and wired rules in `router-context.md`. Details: `references/process-detail.md`.

Baseline contract line (stays inline because validators assert it; also in the reference):

Before stack-specific steering rules, ensure the target context file contains
this baseline svc operating contract line:

```markdown
This repo is svc-onboarded: respect the local AGENTS.md/CLAUDE.md deployment, test, and route-workflow rules for this exact worktree; post-deploy/production validation requests require live post-deploy evidence, not local pre-deploy substitutes.
```

Append it once if missing. This line is intentionally host-agnostic so agents
still respect the onboarded project contract even when the user does not name a
skill explicitly.

## Routing Rules

- `feature` -> `validate-feature` then `write-spec` in delta mode
- `bugfix` / `regression` -> `diagnose-bug`
- `drift` -> `sync-spec-code`
- `conversion` -> stay in conversion until mapped, then route
- `chore` / `refactor` -> implementation planning or change-set planning based on scope

## What Not To Do

- Do not force a clean svc structure on first pass
- Do not rewrite existing docs just because they are not canonical yet
- Do not fix every bug you notice while still mapping the repo
- Do not leave findings in freeform prose when they should be tracked as work items

## Tracker Integration

Onboarding writes local canonical work items and INDEX entries in every mode. It never infers a GitHub tracking mode from repository visibility, configures a repository, uploads a backlog, imports issues, or invokes `gh`. When external visibility is wanted, offer the explicit network-free `sync-work-items --configure` choice and a later per-item `--pull` or curated `--publish` operation. Without that owner choice, `local-only` stays the default. GitHub is public intake/projection; local WIs retain execution and receipt authority. See `docs/issue-tracking.md`.

## Phase Receipt Contract

After loading this skill into the lane task graph, emit receipts for each required phase before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-StateInitRepoInventory --evidence command_output:.svc/onboard-repo-inventory.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ArtifactMappingRouterTopology --evidence file:docs/specs/project-state.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-CoreMechanicCompetitiveSweep --evidence file:docs/specs/brownfield-competitive-flags.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-CoverageAuditInvocation --evidence file:docs/specs/coverage-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-WorkItemTriageSteeringRules --evidence file:docs/specs/work-items/INDEX.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/onboard-repo-self-verify.log
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
| 1 | project-state.md exists | `test -f docs/specs/project-state.md` | |
| 2 | router-context.md exists | `test -f docs/specs/router-context.md` | |
| 3 | agent-topology.md exists | `test -f docs/specs/agent-topology.md` | |
| 4 | work-items/INDEX.md exists | `test -f docs/specs/work-items/INDEX.md` | |
| 5 | Artifact mapping completed | project-state.md has subsystem map, current focus, and work-item summary | |
| 6 | Coverage audit ran | `test -f docs/specs/coverage-audit.md` | |
| 7 | Coverage Gaps section present | project-state.md contains a `## Coverage Gaps` section | |
| 8 | Stack detection recorded | router-context.md lists detected stacks and wired steering rules | |
| 9 | .gitignore ignores provisioned | .gitignore contains the Serious Vibe Coding ignore envelope and core ignores | |

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
- Invoke next skill: `audit-coverage --progressive --lane brownfield-conversion`
  (audit-coverage in turn chains to `sync-work-items`)

**If `--progressive` flag is absent:**
- Report results to user
- Suggest: "Next: consider running `sync-work-items`"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
