---
name: onboard-repo
version: "1.0"
description: >
  Convert an existing repository into the svc way of working before applying
  the full pipeline. Use when the repo already has shipped behavior, docs, tests,
  or conventions that must be preserved and mapped instead of overwritten. Produces
  repo-canonical project state, compatibility notes, and structured work items for
  discovered features, bugs, regressions, drift, and chores.
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
    brownfield-conversion: { position: 1, prev: null, next: audit-coverage }
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

`docs/specs/project-state.md` should capture:

- repo mode: `convert`
- conversion status: `identified | mapping | mapped | triaged`
- active workflow lanes in use
- current focus (active WI, active lane, active task graph, fallback next item)
- foundational artifact status (the **full svc canonical artifact catalog** — see `audit-coverage` Step 2 for the catalog table; do not list a subset)
- subsystem map
- compatibility notes
- work-item summary by type and status
- coverage gaps section (populated by `audit-coverage` Step 2.5)

`docs/specs/router-context.md` should capture:

- required skills by intent
- precedence rule: repo override > project-local platform rule > generic platform heuristic > global fallback
- forbidden tools or flows
- code-style authority
- deployment/runtime contract
- platform/runtime signals
- repo-local overrides discovered in docs/config

`docs/specs/agent-topology.md` should capture:

- whether delegation is allowed
- whether the repo is merely platform agent-capable vs actually configured for delegation
- preferred roles by work type
- ownership boundaries
- shared write surfaces
- when to stay single-agent

**Critical:** the foundational artifact status section must be sourced from
`audit-coverage`. Hand-listing a subset of artifacts (vision/personas/journeys
only) silently hides gaps in domain-profile, code-style, design contracts,
visual baselines, and marketing context. The audit produces the full catalog
state in `docs/specs/coverage-audit.md` — link or summarize, do not redefine.

## Work Item Types

Use these canonical types:

- `conversion`
- `feature`
- `bugfix`
- `regression`
- `refactor`
- `drift`
- `chore`

Status values:

- `identified`
- `mapped`
- `triaged`
- `planned`
- `in_progress`
- `blocked`
- `resolved`
- `verified`
- `deferred`

Severity values:

- `critical`
- `high`
- `medium`
- `low`

## Work Item Template

Each file in `docs/specs/work-items/` should follow the canonical WI schema (`references/work-item-schema.md`):

```markdown
# WI-001: Short title

**Type:** bugfix
**Status:** identified
**Severity:** high
**Filed:** <ISO date>
**Source:** onboard-repo
**Lane:** bugfix
**Repo Mode:** convert
**Source Artifact:** path/to/file-or-area
**GitHub Issue:** —

## Problem

What is wrong or missing.

## Evidence

Concrete files, runtime behavior, docs, or test references.

## Route Recommendation

Which skill or lane should take this next and why.

## Notes

Anything needed for triage, not full implementation.
```

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

Day-1 brownfield competitive sweep — closes the "we shipped receipt OCR for 60 days before discovering zero competitors do this" failure mode (Example Marketplace origin case).

**Detection (two-pass, per WI-142 GROUND-14):**

Pass 1 — Directory + entry-point analysis (universal, no keyword bias):
```bash
# Enumerate top-level source directories and entry points
find src/ app/ lib/ -maxdepth 2 -type d 2>/dev/null | sort
# Identify API surface, route definitions, or main entry points
grep -rlE "^(export |module\.exports|app\.|router\.|def |func )" \
  src/ app/ lib/ --include="*.ts" --include="*.js" --include="*.py" --include="*.go" 2>/dev/null | head -30
```

**Transform directory listing into feature-area groups:**
Group entry points by domain concept. Examples:
- `src/auth/`, `src/login/`, `src/session/` → **Authentication**
- `src/billing/`, `src/subscription/`, `src/invoices/` → **Billing & Payments**
- `src/onboarding/`, `src/welcome/`, `src/tutorial/` → **Onboarding**
- `src/rewards/`, `src/loyalty/`, `src/points/` → **Loyalty / Rewards**
- `src/admin/`, `src/dashboard/`, `src/reports/` → **Admin / Analytics**

For each group, check `references/knowledge/competitors/` (or run `analyze-competitors` scoped to that group) to determine if competitors implement the same concept.

Pass 2 — Core-mechanic regex (domain-specific supplement):
```bash
grep -rE "processReceipt|verifyVisit|earnPoints|redeem[A-Z]|grantPoints|secureCheckIn|loyalty[A-Z]|posIntegration|cardLink" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --include="*.py" --include="*.rb" --include="*.go" \
  src/ app/ lib/ 2>/dev/null | head -30
```

Project-specific patterns: derive from domain profile. For loyalty/SMB-rewards domain, the patterns above. For other domains (e.g., e-commerce checkout, subscription billing), generate domain-appropriate keyword set.

**WI-142 requirement:** Pass 1 is mandatory — directory analysis ensures ALL major feature areas are enumerated, not just those matching core-mechanic regex. Pass 2 is supplementary.

**For each detected mechanic**, invoke `analyze-competitors` (Phase 2 deep-research path per WI-140 COMP-02) scoped to that mechanic. Don't run the full 4-tier 20-competitor analysis — scope: "which loyalty competitors use receipt-OCR vs POS-attestation". Time-box to 30 minutes per mechanic.

**Output:** `docs/specs/brownfield-competitive-flags.md` per `references/templates/brownfield-competitive-flags.md`. Lists each detected mechanic with: code evidence, competitor match (yes/no/partial), severity rating.

**Severity rules:**
- **HIGH:** the brownfield approach is unique across direct competitors (0 of N match) → auto-create backlog WI tagged `competitive-strategy-review`
- **MEDIUM:** the approach is rare (1-2 of N) → flag in onboard report, no auto-WI
- **LOW:** universal pattern (3+ of N) → no concern

**This is the change that would have caught Example Marketplace on day 1 instead of day 60.**

---

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

After triage, detect the project's tech stacks and inject per-project steering
rules so the right rules fire for this project and no others.

**Detect the active host and target context file:**

| Host | Context file | Skills path |
|---|---|---|
| Claude Code | `CLAUDE.md` | `~/.claude/skills/` |
| Kimi Code CLI | `KIMI.md` | `~/.kimi/skills/` |
| Codex | `AGENTS.md` | `~/.codex/skills/` |
| Antigravity | `ANTIGRAVITY.md` | `~/.gemini/antigravity/skills/` |
| OpenCode CLI | `AGENTS.md` | `~/.config/opencode/skills/` |

Detect active host: use `bash scripts/detect-host.sh` from the framework repo. Fallback:
if `~/.gemini/antigravity/skills/route-workflow/SKILL.md` exists and the session is
running inside Antigravity, target `ANTIGRAVITY.md`. Else if `~/.kimi/skills/route-workflow/SKILL.md`
exists, target `KIMI.md`. Otherwise target `CLAUDE.md` (default). Record the detected
host in `router-context.md`.

Before stack-specific steering rules, ensure the target context file contains
this baseline svc operating contract line:

```markdown
This repo is svc-onboarded: respect the local AGENTS.md/CLAUDE.md deployment, test, and route-workflow rules for this exact worktree; post-deploy/production validation requests require live post-deploy evidence, not local pre-deploy substitutes.
```

Append it once if missing. This line is intentionally host-agnostic so agents
still respect the onboarded project contract even when the user does not name a
skill explicitly.

**Stack detection signals (check in order, use all that match):**

| Signal | Stack |
|---|---|
| `react-native` in package.json dependencies | `react-native` |
| `react` in package.json dependencies (and not react-native) | `react` |
| `go.mod` present | `golang` |
| `Cargo.toml` present | `rust` |
| `requirements.txt` / `pyproject.toml` / `setup.py` present | `python` |
| `*.html` / `*.css` / web framework in package.json (next, vite, astro, etc.) | `web` |
| `*.ts` / `*.tsx` files present | `typescript` (if not already covered by react/react-native) |

**For each detected stack**, look up `rulesRegistry` in `skills-manifest.json`
for entries with `type: steering` and `stack: <detected>`. For each match:

1. Verify the rule file exists in the detected host's skills path
2. Skip if the rule file is empty/placeholder (no actual content below frontmatter)
3. If running on **Claude Code**: append an `@`-import to `CLAUDE.md`:
   ```markdown
   <!-- svc steering rules — auto-wired by onboard-repo -->
   @~/.claude/skills/rules/react/patterns.md
   ```
4. If running on **Antigravity**: append a reference block to `ANTIGRAVITY.md`
   under `## Steering Rules (Stack-Specific)`:
   ```markdown
   <!-- svc steering rules — auto-wired by onboard-repo -->
   <!-- Antigravity: read these files at session start for stack-specific rules -->
   - `~/.gemini/antigravity/skills/rules/react/patterns.md`
   ```
   Antigravity does not support `@`-imports. Rules are listed as explicit
   read-on-start references instead. Antigravity will read them when the
   session context file is loaded.
5. If running on **Antigravity**: run `node ~/.gemini/antigravity/skills/scripts/sync-antigravity-ki.mjs`
   to instantly mirror the project state into Antigravity's Knowledge Items system.
   This guarantees Antigravity auto-loads the context in future sessions.

**Do not inject:**
- Universal rules (`stack: universal`) — globally active on Claude Code via `~/.claude/rules/`;
  on Antigravity these are encoded in the behavioral enforcement block in `ANTIGRAVITY.md`
- Rules for stacks not detected in this project
- Placeholder rules with no content (would waste tokens for nothing)
- Rules already present in the project context file (idempotent)

**Record in `router-context.md`** which host was detected, which stacks were found,
and which steering rules were wired, for auditability.

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

After the repo-canonical work items exist, use `sync-work-items` to project them to GitHub Issues.
GitHub is a projection. Repo files remain canonical.

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
