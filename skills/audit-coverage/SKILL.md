---
name: audit-coverage
version: "1.0"
description: >-
  Audit a project against the svc canonical artifact catalog — classifies each artifact CANONICAL / FOREIGN / MISSING, produces docs/specs/coverage-audit.md plus ordered next-skill recommendations. Standalone or from onboard-repo Step 2.5. Use when: "audit coverage", "what artifacts are missing". Triggers: "audit-coverage", "what svc artifacts are missing", "check brownfield alignment". Contract: log then triage, do not fix as found. Also: "check svc artifact coverage", "coverage gap audit", "are all canonical artifacts in place", "what alignment is needed"; output includes a "Coverage Gaps" section.
inputs:
  required: []
  optional:
    - { path: "docs/specs/project-state.md", artifact: existing-project-state }
outputs:
  produces:
    - { path: "docs/specs/coverage-audit.md", artifact: coverage-audit }
phases:
  - id: P1-ProjectStateAndOnboardingCheck
    trigger: always
    reads: ["docs/specs/project-state.md"]
    writes: ["onboarded-state recommendation"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-CanonicalCatalogWalk
    trigger: after:P1-ProjectStateAndOnboardingCheck
    reads: ["canonical artifact catalog", "docs/specs/**", ".svc/**", "e2e/**"]
    writes: ["per-artifact canonical status notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ForeignLocationScan
    trigger: after:P2-CanonicalCatalogWalk
    reads: ["foreign location patterns", "repo documentation paths"]
    writes: ["foreign content inventory notes"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P4-SummaryStatsComputation
    trigger: after:P3-ForeignLocationScan
    reads: ["per-artifact status notes"]
    writes: ["coverage summary counts"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P5-CoverageAuditArtifact
    trigger: after:P4-SummaryStatsComputation
    reads: ["coverage summary counts", "foreign content inventory notes"]
    writes: ["docs/specs/coverage-audit.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P6-ProjectStateCoverageGaps
    trigger: after:P5-CoverageAuditArtifact
    reads: ["docs/specs/coverage-audit.md", "docs/specs/project-state.md"]
    writes: ["docs/specs/project-state.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P7-TriageStopRecommendation
    trigger: after:P6-ProjectStateCoverageGaps
    reads: ["docs/specs/coverage-audit.md"]
    writes: ["recommended alignment sequence summary"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P8-SelfVerifyContinuation
    trigger: after:P7-TriageStopRecommendation
    reads: ["docs/specs/coverage-audit.md", "docs/specs/project-state.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
chain:
  lanes:
    brownfield-conversion: { position: 2, prev: onboard-repo, next: sync-work-items }
  progressive: false
  self_verify: true
  human_checkpoint: false
---

# Coverage Audit

A brownfield repo can have most things "mapped" without having most svc-canonical
artifacts. This skill closes that gap. It enumerates the full svc artifact catalog
and classifies every slot as CANONICAL, FOREIGN, or MISSING — then writes a gap
report with concrete next-skill recommendations.

**Announce at start:** "I'm using audit-coverage to evaluate this repo against the full svc canonical artifact catalog."

## When To Use

- After `onboard-repo` mapped a repo but you suspect canonical artifacts are absent
- On a repo that was onboarded before `audit-coverage` existed
- Before starting Lane 3 (Brownfield Feature Extension) work, to confirm foundational
  artifacts exist (otherwise skills/design-ux/ui/track-visuals silently skip context)
- When the user asks "is this fully aligned with svc?" or "what's missing?"
- Periodically — coverage drifts as svc adds new canonical artifact types

## Core Rule

**Three-state classification, no false positives.**

For every canonical artifact, the answer must be one of:

- `CANONICAL` — file exists at the svc-canonical path with non-trivial content
- `FOREIGN` — equivalent content exists outside the canonical path and needs consolidation
- `MISSING` — no content exists anywhere; the artifact is genuinely absent

A `FOREIGN` classification is **not** "good enough." It is a finding that requires
a consolidation skill run (analyze-domain, analyze-competitors, define-code-style,
analyze-marketing, etc.) to map foreign content into canonical form.

## Canonical Artifact Catalog

This is the source of truth for what svc considers a complete project. Update this
table when svc adds new canonical artifact types.

### Foundational specs

| # | Artifact | Canonical path | Foreign location patterns | Producer skill |
|---|---|---|---|---|
| 1 | Vision | `docs/specs/vision.md` | `VISION.md`, `docs/VISION*.md`, `README.md` (vision section) | `write-vision` |
| 2 | Domain profile | `docs/specs/domain-profile.md` | `docs/domain*.md`, `docs/strategy/*domain*`, business specs with domain analysis | `analyze-domain` |
| 3 | Competitor analysis | `docs/specs/analyze-competitors.md` | `docs/analysis/*competitor*`, `docs/strategy/*competitor*`, `docs/research/*` | `analyze-competitors` |
| 4 | Personas | `docs/specs/personas/P*.md` + `PERSONA_INDEX.md` | `docs/personas/`, `docs/users/`, persona sections in business specs | `build-personas` |
| 5 | Product marketing context | `.agents/product-marketing-context.md` | `docs/marketing/*`, `docs/strategy/*`, `docs/positioning*` | `analyze-marketing` |

### Feature lifecycle

| # | Artifact | Canonical path | Foreign location patterns | Producer skill |
|---|---|---|---|---|
| 6 | Feature specs | `docs/specs/features/*.md` | `docs/features/`, `docs/specs/*-spec.md`, RFC docs | `write-spec` |
| 7 | AC checklists | `docs/specs/features/*-ac-checklist.md` | inline AC sections in feature specs | `audit-ac` |
| 8 | Journeys | `docs/specs/journeys/J*.feature.md` + `JOURNEY_INDEX.md` | `e2e/specs/journeys/*.feature`, `docs/flows/`, flow audit docs | `write-journeys` |

### Design contracts

| # | Artifact | Canonical path | Foreign location patterns | Producer skill |
|---|---|---|---|---|
| 9 | UX design | inline in `docs/specs/features/*.md` (Design-UX section) OR `docs/specs/design-ux/` | Figma links in features, `docs/design/ux/`, wireframe directories | `design-ux` |
| 10 | UI design | inline in `docs/specs/features/*.md` (Design-UI section) OR `docs/specs/design-ui/` | `tailwind.config.*`, `components/ui/`, design token files, Figma libraries | `design-ui` |
| 11 | Tech design | inline in `docs/specs/features/*.md` (Design-Tech section) OR `docs/specs/design-tech/` | architecture docs, RFC docs, ADR files | `design-tech` |
| 12 | Visual baselines | `docs/track-visuals/baseline/` or `e2e/snapshots/baseline/` | Playwright `__screenshots__/`, `tests/visual/`, `cypress/snapshots/` | `track-visuals --mode baseline` |

### Code & style contracts

| # | Artifact | Canonical path | Foreign location patterns | Producer skill |
|---|---|---|---|---|
| 13 | Code style contract | `docs/specs/code-style.md` | `.eslintrc*`, `.prettierrc*`, `CONTRIBUTING.md` style sections, `CLAUDE.md` rules, `~/.claude/rules/*` (global) | `define-code-style --mode audit` |
| 14 | Security spec | `docs/specs/SECURITY_SPEC.md` (project-specific allowed) | `SECURITY.md`, security audit docs | manual / `review-security` |

### Test contracts

| # | Artifact | Canonical path | Foreign location patterns | Producer skill |
|---|---|---|---|---|
| 15 | E2E test suite | `e2e/specs/journeys/J*.spec.*` (1:1 with journey files) | `tests/e2e/`, `cypress/e2e/`, `__tests__/` | `write-e2e` |

### State files

| # | Artifact | Canonical path | Foreign location patterns | Producer skill |
|---|---|---|---|---|
| 16 | Project state | `docs/specs/project-state.md` | — (no foreign form) | `onboard-repo` / any svc skill |
| 17 | Router context | `docs/specs/router-context.md` | `AGENTS.md`, `CLAUDE.md`, deploy runbooks, platform/runtime docs carrying routing-critical rules | `onboard-repo` |
| 18 | Agent topology | `docs/specs/agent-topology.md` | platform docs that mention agents, local orchestration docs, delegation notes in repo docs | `onboard-repo` |
| 19 | Work items index | `docs/specs/work-items/INDEX.md` + `WI-*.md` | GitHub Issues (projection only), `TODO.md`, `BACKLOG.md` | `onboard-repo` / `sync-work-items` |
| 19a | WI schema conformance | `references/work-item-schema.md` | — | this skill (audit flag) |
| 20 | Pipeline decision log | `.svc/pipeline-decisions.jsonl` | — | `route-workflow` |
| 21 | Coverage audit | `docs/specs/coverage-audit.md` | — | this skill |

### Global (per-builder, not per-project)

| # | Artifact | Canonical path | Notes |
|---|---|---|---|
| 22 | Builder profile | `~/.svc/builder-profile.md` | Read-only check; not project-scoped. Report present/absent only. |

## Process

### Step 1: Read project state if it exists

Check `docs/specs/project-state.md`. If it exists, the repo has been onboarded.
If not, recommend running `onboard-repo` first — this skill expects at least a
mapped repo.

### Step 2: Walk the catalog

For each row in the canonical artifact catalog:

1. Check the canonical path. If a file exists with non-trivial content (>10 lines
   or >500 bytes for markdown; for directories, >0 matching files): mark `CANONICAL`.
2. If canonical is absent or trivial, scan the foreign location patterns.
   - Use `Glob` for path patterns (e.g., `docs/analysis/*competitor*`)
   - Use `Grep` for content patterns where the pattern is content-based
   - For each match, record the path
3. Classify:
   - Canonical present + non-trivial → `CANONICAL`
   - Canonical absent + foreign found → `FOREIGN` (with source paths)
   - Canonical absent + no foreign → `MISSING`
4. For inline-design artifacts (UX/UI/Tech sections in feature specs), grep
   feature spec files for the section markers (`## Design-UX`, `## Design-UI`,
   `## Design-Tech`). If at least 50% of feature specs have the section,
   classify as `CANONICAL`. Otherwise, `MISSING`.

### Step 3: Compute summary stats

- `CANONICAL` count
- `FOREIGN` count (consolidation needed)
- `MISSING` count (creation needed)
- Coverage percentage: CANONICAL / total catalog rows

### Step 4: Write coverage-audit.md

Create or overwrite `docs/specs/coverage-audit.md` with this structure:

```markdown
# Coverage Audit

**Generated:** <ISO date>
**Generated by:** audit-coverage skill
**Catalog version:** v1.1 (22 canonical artifacts)

## Summary

- **CANONICAL:** N / 22
- **FOREIGN:** N (consolidation needed)
- **MISSING:** N (creation needed)
- **Coverage:** N%

## Catalog Status

| # | Artifact | State | Canonical path | Foreign sources | Action |
|---|---|---|---|---|---|
| 1 | Vision | CANONICAL | docs/specs/VISION.md (compat: uppercase) | — | none |
| 2 | Domain profile | MISSING | — | — | run analyze-domain |
| 3 | Competitor analysis | FOREIGN | — | docs/analysis/02-COMPETITOR-ANALYSIS.md (+22 sibling files) | run analyze-competitors to consolidate |
| ... | ... | ... | ... | ... | ... |

## Recommended Alignment Sequence

Ordered by dependency (foundational → derivative). Run these to close all gaps:

1. **onboard-repo (refresh mapping if needed)** — produces/refreshes `router-context.md` and `agent-topology.md`
2. **analyze-domain** — produces docs/specs/domain-profile.md
3. **analyze-competitors** — consolidates docs/analysis/* into svc form
4. **define-code-style --mode audit** — locks code style contract from CLAUDE.md + global rules
5. **analyze-marketing** — consolidates docs/marketing/* into product-marketing-context.md
6. **track-visuals --mode baseline** — captures visual baselines for browser routes
7. (per-feature, on-demand) **design-ux / design-ui** — backfill design contracts as features are touched

## Foreign Content Inventory

Detailed list of foreign-form content discovered, by source path:

### docs/analysis/ (competitor analysis - 23 files)
- 02-COMPETITOR-ANALYSIS.md
- 03-SWOT-ANALYSIS.md
- 04-FEATURE-COMPARISON-MATRIX.md
- ...

### docs/marketing/ (marketing context)
- PRICING_LOYALTY_SCOUT_PLAN.md
- PROMOTION_STRATEGY.md
```

### Step 5: Update project-state.md

Append (or replace, if already present) a `## Coverage Gaps` section in
`docs/specs/project-state.md` with the summary stats and a link to
`coverage-audit.md`. Do not duplicate the full table.

### Step 6: Triage, then stop

Like onboard-repo, this skill **logs then stops**. It does not run the
recommended alignment skills. The user (or `route-workflow`) decides what
to run next.

## Foreign-Location Heuristics

Foreign-location detection uses **hardcoded glob patterns** (predictable,
deterministic) plus **content keyword grepping** for inline cases. Do NOT
do open-ended LLM-driven semantic matching — that produces inconsistent results
across runs. If a pattern is missed, add it to the catalog above.

## What Not To Do

- Do not run the recommended alignment skills automatically (violates "log then triage")
- Do not classify as CANONICAL if the file exists but is empty or a stub
- Do not skip the foreign-location scan — that's the whole point
- Do not modify foreign-source files; only inventory them
- Do not delete or move project-state.md sections you didn't author; append/replace only the `## Coverage Gaps` section

## Phase Receipt Contract

When this skill runs inside a task graph, emit one receipt per completed phase
before marking the task complete:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ProjectStateAndOnboardingCheck --evidence command_output:.svc/audit-coverage-project-state-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-CanonicalCatalogWalk --evidence command_output:.svc/audit-coverage-catalog-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ForeignLocationScan --evidence command_output:.svc/audit-coverage-foreign-scan-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-SummaryStatsComputation --evidence command_output:.svc/audit-coverage-summary-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-CoverageAuditArtifact --evidence file:docs/specs/coverage-audit.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ProjectStateCoverageGaps --evidence file:docs/specs/project-state.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-TriageStopRecommendation --evidence command_output:.svc/audit-coverage-triage-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/audit-coverage-self-verify-<WI>.log
```

If `docs/specs/project-state.md` is absent, still record
`P1-ProjectStateAndOnboardingCheck` with the recommendation to run
`onboard-repo`, then stop without fabricating coverage output. If a task graph
is absent, report the same phase evidence in the assistant response.

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
| 1 | coverage-audit.md exists | `test -f docs/specs/coverage-audit.md` | |
| 2 | All catalog rows classified | Count rows in audit Catalog Status table = 22 | |
| 3 | Summary stats present | Audit file contains CANONICAL/FOREIGN/MISSING counts | |
| 4 | Recommended sequence written | Audit file contains "Recommended Alignment Sequence" section with at least one entry if gaps exist | |
| 5 | project-state.md updated | project-state.md contains a "## Coverage Gaps" section | |

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

**If invoked from onboard-repo Step 2.5 (`--from onboard-repo`):**
- Return control to onboard-repo, which continues its own self-verify and chaining

**If invoked standalone with `--progressive`:**
- Check `--skip` list. If this skill is in the skip list, pass through.
- This skill does NOT auto-invoke remediation skills. Report results and stop.

**If invoked standalone without flags:**
- Report results to user
- Suggest: "Next: review coverage-audit.md and run the recommended alignment sequence"

## Post-Compaction Recovery

If Kimi CLI compacted context and you lost track of framework state:

1. **Read the lane-tasks file** — `.svc/lane-tasks-<WI>.json` is the sole source of truth
2. **Find the next task** — First `in_progress`, else first `pending` with blockers satisfied
3. **Re-load the skill** — `node scripts/task-graph.mjs load-skill <path> <task-id> <skill>`
4. **Re-read this SKILL.md** — Refresh context for the current step
5. **Resume execution** — Continue from where the task left off
6. **Never ghost-complete** — Verify `skill_receipt` exists before marking any task complete

If a checkpoint file exists (`.svc/.checkpoint-<WI>.checkpoint.json`), compare its `next_task` against the lane-tasks file. If they differ, trust the lane-tasks file and re-run `node scripts/task-graph.mjs checkpoint <path>` after recovery.
