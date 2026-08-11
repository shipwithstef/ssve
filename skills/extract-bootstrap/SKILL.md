---
name: extract-bootstrap
version: "1.0"
description: >
  Extract production-verified patterns from a real codebase into a reusable
  bootstrap template. Use when "extract patterns from", "create bootstrap from",
  "analyze this repo for patterns", "make a template from", or when pointing
  at a public/local repo to capture its architecture for reuse. Produces a
  manifest.md + decisions.md under references/bootstraps/.
phases:
  - id: P1-SourceAccessScope
    trigger: always
    reads: ["source repo path or URL", "references/bootstraps/*/manifest.md"]
    writes: [".svc/extract-bootstrap-source.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-StackVersionExtraction
    trigger: always
    reads: ["package.json", "go.mod", "Cargo.toml", "requirements.txt", "pyproject.toml", ".nvmrc", ".node-version"]
    writes: ["references/bootstraps/<name>/manifest.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P3-ArchitectureConventionExtraction
    trigger: always
    reads: ["source tree", "src/", "app/", "lib/", "components/", "tests/"]
    writes: ["references/bootstraps/<name>/manifest.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-KeyDecisionExtraction
    trigger: always
    reads: ["source repo architecture", "deployment files", "README/docs"]
    writes: ["references/bootstraps/<name>/decisions.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-ProductionVerificationAndCleanup
    trigger: always
    reads: ["git log", "git shortlog", ".github/workflows/", "Dockerfile", "docker-compose.yml", "public repo metadata when available"]
    writes: ["references/bootstraps/<name>/manifest.md", ".svc/extract-bootstrap-cleanup.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-SelfVerifyContinuation
    trigger: always
    reads: ["references/bootstraps/<name>/manifest.md", "references/bootstraps/<name>/decisions.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required: []
  optional:
    - { path: "references/bootstraps/*/manifest.md", artifact: existing-templates }
outputs:
  produces:
    - { path: "references/bootstraps/<name>/manifest.md", artifact: bootstrap-manifest }
    - { path: "references/bootstraps/<name>/decisions.md", artifact: bootstrap-decisions }
chain:
  lanes: {}
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Bootstrap Extract

Analyze a real codebase and extract its production-verified patterns into
a reusable bootstrap template for `references/bootstraps/`.

**Announce at start:** "I'm using extract-bootstrap to capture patterns from this codebase."

## When To Use

- You have a repo that's running in production and want to reuse its patterns
- You found a well-architected open-source project and want to capture its approach
- Your team wants to standardize on patterns from a proven project
- You want `explore-solutions` to auto-skip for a known-good stack

## Process

### Step 1: Access the Codebase

**Local repo:**
```bash
ls <path>/package.json <path>/go.mod <path>/Cargo.toml <path>/requirements.txt 2>/dev/null
```

**Public repo (clone to temp):**
```bash
git clone --depth 1 <url> /tmp/bootstrap-source-<name>
```

**GitHub API (no clone needed for analysis):**
```bash
gh api repos/<owner>/<repo>/contents
gh api repos/<owner>/<repo>/languages
```

### Step 2: Extract Stack

Identify the exact versions — not just "Node.js" but "Node.js 20 + Next.js 14 App Router + Prisma 5.x + PostgreSQL":

```bash
# Node.js
cat package.json | head -50        # dependencies + devDependencies
cat .nvmrc .node-version 2>/dev/null

# Python
cat pyproject.toml requirements.txt setup.py 2>/dev/null | head -50

# Go
cat go.mod | head -20

# Rust
cat Cargo.toml | head -30
```

Record: runtime, framework, database, ORM, API style, auth, testing, CI.

### Step 3: Extract Architecture Patterns

Map the codebase structure:

```bash
find <path> -type f -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.rs" | head -50
ls -la <path>/src/ <path>/app/ <path>/lib/ <path>/components/ 2>/dev/null
```

Identify:
- **Module structure** — how code is organized (by feature, by layer, by domain)
- **Data flow** — how requests flow through the system
- **State management** — how state is held and shared
- **Error handling** — patterns for errors, validation, fallbacks
- **API design** — REST/GraphQL/tRPC, versioning, auth middleware
- **Database access** — ORM patterns, migrations, query style
- **Testing approach** — unit/integration/E2E split, fixtures, mocks vs real DB

### Step 4: Extract Conventions

Read actual code to identify naming and style:

```bash
# Naming conventions
grep -r "export function\|export const\|export class" <path>/src/ | head -20

# Import style
head -20 <path>/src/**/*.ts 2>/dev/null | head -40

# Error handling patterns
grep -r "throw\|catch\|Error\|Result" <path>/src/ | head -20

# Test patterns
ls <path>/tests/ <path>/__tests__/ <path>/src/**/*.test.* 2>/dev/null | head -20
```

### Step 5: Extract Key Decisions

For each major architectural choice, document:
- What was chosen
- What alternatives exist
- Why this choice works (evidence: scale, team size, deployment target)

Focus on decisions that `explore-solutions` would normally investigate:
- Why this database (not another)?
- Why this API pattern?
- Why this component structure?
- Why this deployment model?

### Step 6: Check Production Verification

Assess how battle-tested this is:

```bash
# Commit history depth
git log --oneline | wc -l

# Contributors
git shortlog -sn | head -10

# Recent activity
git log --oneline -10

# CI/CD
ls .github/workflows/ Dockerfile docker-compose.yml 2>/dev/null
```

If public repo: check stars, forks, issues, last release.
If internal: ask about user count, uptime, incident history.

### Step 7: Produce Template

Write to `references/bootstraps/<name>/`:

**manifest.md:**
```markdown
# Bootstrap: <name>

## Stack
- Runtime: <exact version>
- Framework: <exact version>
- Database: <exact version + ORM>
- API: <style + library>
- Testing: <frameworks>
- CI: <platform>

## Verified By
- Source repo: <url or "internal">
- Users: <scale>
- Last verified: <date>
- Commits: <count>
- Contributors: <count>

## When To Use
<specific conditions>

## When NOT To Use
<specific conditions>

## Patterns
### Module Structure
<how code is organized>

### Data Flow
<how requests flow>

### Error Handling
<patterns>

### Testing
<approach, split, fixtures>

## Conventions
### Naming
<functions, files, components, routes>

### File Structure
<directory layout>

### Import Style
<absolute vs relative, barrel files, etc.>
```

**decisions.md:**
```markdown
# Decisions: <name>

Pre-made paradigm decisions from production-verified codebase.
These replace explore-solutions's Phase 2-5 when the stack matches.

## Decision 1: <topic>
**Chose:** <what>
**Over:** <alternatives>
**Evidence:** <why this works — from the source repo>

## Decision 2: <topic>
...
```

### Step 8: Clean Up

If a temp clone was created:
```bash
rm -rf /tmp/bootstrap-source-<name>
```

## Audit Mode

When invoked with `--audit` on an existing template:

1. Re-check the source repo (if URL available) for updates
2. Compare template stack versions against current latest
3. Flag stale conventions or deprecated patterns
4. Report: CURRENT / OUTDATED / NEEDS-REFRESH

## Phase Receipt Contract

When running in task-graph mode, record these phase receipts before marking the `extract-bootstrap` task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-SourceAccessScope --evidence command_output:.svc/extract-bootstrap-source.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-StackVersionExtraction --evidence file:references/bootstraps/<name>/manifest.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ArchitectureConventionExtraction --evidence file:references/bootstraps/<name>/manifest.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-KeyDecisionExtraction --evidence file:references/bootstraps/<name>/decisions.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProductionVerificationAndCleanup --evidence command_output:.svc/extract-bootstrap-cleanup.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-SelfVerifyContinuation --evidence command_output:.svc/extract-bootstrap-self-verify.log
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
| 1 | manifest.md exists | `test -f references/bootstraps/<name>/manifest.md` | |
| 2 | decisions.md exists | `test -f references/bootstraps/<name>/decisions.md` | |
| 3 | Stack section has exact versions | grep for version numbers in manifest | |
| 4 | At least 3 decisions documented | count `## Decision` headers in decisions.md | |
| 5 | "Verified By" has source and date | grep for source and date in manifest | |

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

This skill is standalone — no progressive chain. After extraction, suggest:
- "Template saved. `explore-solutions` will auto-skip when this stack matches."

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
