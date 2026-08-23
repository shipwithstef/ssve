---
name: write-spec
version: "1.0"
handles_concerns:
  - feature-validation-closeout
  - provider-fidelity
phases:
  - { id: P1-ContextAndModeSelection, required_for_completion: true }
  - { id: P2-DiscussionPreflightAndAlternatives, required_for_completion: true }
  - { id: P3-StoryAcceptanceCriteriaDraft, required_for_completion: true }
  - { id: P4-ScopeReviewDecisionLog, required_for_completion: true }
  - { id: P5-JourneySyncDependencyQueue, required_for_completion: true }
  - { id: P6-SelfVerifyHandoff, required_for_completion: true }
description: Use when defining a new feature or change — produces a DRAFT feature spec with user stories, ACs, and journeys before any technical design or code. Supports greenfield new-feature work and brownfield delta-spec work for extensions, bugfix behavior, and contract changes.
inputs:
  required:
    - { path: "docs/specs/vision.md", artifact: vision }
    - { path: "docs/specs/personas/P*.md", artifact: personas }
  optional:
    - { path: "docs/specs/features/*-brief.md", artifact: ship-brief }
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: "docs/specs/analyze-competitors.md", artifact: competitor-analysis }
outputs:
  produces:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec, status: DRAFT }
chain:
  lanes:
    greenfield: { position: 7, prev: validate-feature, next: audit-ac }
    brownfield-feature: { position: 3, prev: validate-feature, next: write-journeys }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

# Writing Spec

**Runtime v2 continuation:** Register the feature spec and its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
Preserve AC, journey, concern and G1 obligations; task acceptance never closes the product.

**Announce at start:** "I'm using the write-spec skill to define the feature requirements."

## Before Starting

Read **as needed** (not all unconditionally — `_shared/before-starting.md`): `docs/specs/project-state.md` (pipeline state), `~/.svc/builder-profile.md`, `docs/specs/domain-profile.md`, and the relevant feature spec (brownfield deltas only).

## Overview

A feature spec is the single source of truth for what a feature is. Lifecycle:

```
DRAFT → UX-REVIEWED → DESIGNED → BASELINED → CHANGE-SET-APPROVED → PROMOTED → VERIFIED
```

This skill produces **DRAFT** specs — WHAT we build and HOW it's experienced, never how to implement. UX design comes next (design-ux).

## Phase Receipt Contract

When a task graph exists, record each phase before completing the task — canonical form:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextAndModeSelection --evidence command_output:.svc/write-spec-context-mode.log
```

All six phase commands (P1-ContextAndModeSelection … P6-SelfVerifyHandoff, ids in frontmatter): `references/process-details.md` §Phase receipt commands. The WI-363 autoemit hook records observable phases automatically; manual commands stay valid and idempotent.

## Product Questions — MANDATORY format

Every product question follows `_shared/product-question-format.md` (12 sections), accumulated phase-tagged in `docs/specs/features/<feature>-questions.md`. **Gating:** DRAFT → BASELINED requires all `validate-feature` + `write-spec` phase questions AGREE AND ≥40 total (≥20 customer + ≥20 system).

## Discussion Artifact Pre-Flight

Before defining requirements for a topic, check `docs/specs/discussions/<topic>.md`. Treat `decided` rows as fixed constraints; `blocked` → stop and surface; `rerouted` → hand off to `recommended_next_skill`; reopen settled decisions only via an explicit Revision Log supersession.

## Design Alternatives

For each key decision (scope, story granularity, AC approach) follow `references/design-alternatives.md`: 5 ranked alternatives → `--interactive` user pick or `--auto` P0 pick → log to `docs/specs/decisions/<feature-name>.md`.

## G0: Scope Review (after spec is drafted)

Mandatory CEO-mode gate before handoff. Choose a scope mode — **Expand** (vision ambitious, strong market signals → 10-star version) | **Selective Expand** (good baseline + 1-2 cherry-picked additions) | **Hold** (right-sized → bulletproof as-is) | **Reduce** (too much for constraints → narrowest viable wedge) — against the 9 Prime Directives and cognitive patterns; auto mode: P0 picks from research; interactive: present with recommendation. Log a `gate-result` decision (mode, reasoning, directives cited) to `.svc/pipeline-decisions.jsonl`. Full protocol: `references/scope-review.md`.

## Authoring Modes & Feature Types

| Signal | Type |
|--------|------|
| A human uses it directly (UI, CLI, notification) | `Feature` |
| Other features/services depend on it, no direct user interaction | `Enabler` |
| Handles communication with an external system | `Integration` |

Modes: existing repo + new capability → `extend-feature`; broken known behavior → `bugfix-behavior`; interface/dependency contract → `contract-change`; clean repo/subsystem → `new-feature`. Unmapped brownfield → route to `onboard-repo` first. Type/mode interplay, provider-backed & generated ACs, consumer-first stories, journeys-are-wrappers model: `references/authoring-modes.md`.

## Process

### Task Graph Setup

Initialize `.svc/lane-tasks-<WI>.json` with the write-spec process tasks before authoring. Full graph template + process_tasks list: `references/task-graph-setup.md`.

### Genesis Branch Index (§3)

Create `docs/specs/relations/<scope>.branches.md` at spec time — not later, via `align-feature` — using `references/branch-index-template.md` (`Derived-at:` followed by the resolved 40-hex output of `git rev-parse HEAD`, never the symbolic word HEAD; declared `Scope-paths`; all axis sections present but empty). Every later stage appends to this same file instead of writing a separate document, so the scope reaches "done" with a fresh index already in place.

Seed the 2 mechanically-derivable axes (Callers, Journeys & tests) instead of hand-walking them first:

```bash
node scripts/derive-branch-axes.mjs --scope <glob> --symbols <csv>
```

Adjudicate the output into the index: every `IN` entry is a candidate, not a fact — read each one and write it (or its exclusion, as `OUT`/`FILED`) into the matching axis section yourself; the script never writes the index. A genesis index with zero citations is not yet trustworthy — `node scripts/check-branch-index.mjs --index <path>` returns `EMPTY` until at least one axis is filled, so finish adjudicating before treating the scope as spec-complete.

### Step 1: Context Scan

Ground the spec in product reality: glob existing specs/personas/journeys, read `vision.md` head, learn the project's spec format from an existing spec. Read `domain-profile.md` (AC feasibility) and `analyze-competitors.md` (scope boundaries — differentiate on whitespace).

**SDKG Industry Grounding gate (WI-140/142):** every spec MUST carry `## Industry Grounding` (four-question compass) before DRAFT → BASELINED — no keyword gating. The structured-gate-engine branches on `landscape_state` from `analyze-competitors.data.json`: populated+aligned → PASS; populated+divergent → BLOCK unless `## Compensating Control` (4 fields); nascent → WARN + `thin_evidence_acknowledged`; none-found → `## First-Mover Risk Checklist`; inapplicable → SKIP + frontmatter reason + decision log. Templates: `references/templates/industry-grounding.md`, `references/templates/compensating-control.md`. Exemptions: explicit `landscape_inapplicable_reason`, or Enabler/Integration with UX/UI pillars `[N/A — justified]`.

**Vision-to-spec traceability (MANDATORY):** every vision concept implying user-visible behavior maps to ≥1 AC — the spec is the only artifact code generation reads.

**Zero-state UX (MANDATORY):** every Feature includes a first-visit AC (`[PREFIX]-ZERO`); "configure first" empty states allowed only with a CTA and <30s setup.

**Delta-first rule (brownfield modes):** state invariant behavior, changed behavior, and which journeys/specs are extended rather than replaced.

**Base44 schema truth rule:** specs touching Base44 entities/RLS/persistence must ground in `node scripts/audit-base44-entity-rls.mjs --root .` (or cite the app-config dump / N/A reason) — never inherit app code as schema truth.

Brownfield: also read `project-state.md` + open WIs; reuse a WI's framing when it defines the problem. WI files follow `references/work-item-schema.md`. Enablers/Integrations: scan which specs reference this capability as a dependency.

### Steps 2-6: Author the spec (templates: `references/spec-section-templates.md`)

2. **Problem Statement** — per-mode template (new/extend/bugfix/contract).
3. **Consumer Stories** — consumer-first; human or system consumers.
4. **Acceptance Criteria** — per story: happy + error + edge; testable, numbered, no compound ACs; shared AC table format.
5. **System Dependencies** — both directions (depends-on / depended-on-by).
6. **Remaining sections** — Event Contracts, Feature Toggles, Technical Design stub, **Pillars Coverage Matrix** (all 8 pillars, explicit states, no blanks — `references/pillars-coverage-matrix.md`), Implementation Notes, Journey References.

### Steps 7-10: Close the loop (details: `references/process-details.md`)

7. **Trigger Journey Sync** — run `write-journeys` so journeys wrap the new/changed ACs.
8. **Update Journey References** — spec ↔ journey cross-links.
9. **Dependency Spec Queue** — queue enabler specs for ungrounded dependencies (recursive via this skill).
10. **Handoff** — spec lands DRAFT; route per Routing table. Cascade effect, anti-patterns, AC/spec revision logs: `references/process-details.md`.

## Routing

| Situation | Route to |
|-----------|----------|
| Spec complete, ready for UX design | `design-ux` |
| Layer 3 reveals missing persona | `build-personas` (then return) |
| Layer 3 reveals concept fragmentation | Fix in spec, then re-run `write-journeys` |
| Layer 3 reveals dependency on unbuilt feature | Create enabler spec (this skill, recursive) |
| User wants to validate the feature idea first | `validate-feature` (then return here) |
| Spec exists but ACs are weak/missing | `audit-ac` (can run standalone) |
| Dependency queue approved | Run this skill again for each queued spec |

**Auto-invoke:** Layer 3 surfacing marketing-worthy differentiators → insert `analyze-marketing` before design-ux handoff; unknown domain concept/API → inline `research`. Update lane-tasks with `blocked_by` + log a `mechanical` decision.

## Audit Mode

`--audit` reviews all feature specs (traceability, zero-state, AC format, dependencies, lifecycle status) and reports PASS/WARN/FAIL per spec. Checklist: `references/process-details.md` §Audit mode.

## Base44 Brownfield Schema Truth

**Base44 brownfield schema truth rule:** when brownfield specs mention Base44 entities, backend schemas, entity fields, RLS, or "data did not persist" behavior, do not inherit the current app code as truth — run or require the backend schema grounding path (live `base44` schema) first; the deployed schema is the source of truth, not the app code.

## Pipeline Continuation

Task-graph mode — source of truth: `.svc/lane-tasks-<WI>.json`:
- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Claude mirrors TaskList; Kimi observes /task; for Codex coordination, mirror only the active step in `update_plan` (never the full graph). Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions.
- Host UI mirroring only in the parent/top-level session (TaskList tool present AND no `SVC_SUBAGENT=1`); subagents never call TaskUpdate — file state is the durable record.
- Mark this task `completed` before leaving; evaluate the next task's conditions; runnable → `in_progress` + load that skill before work; skippable → `completed` + skip reason, evaluate the one after.

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Feature spec file exists | `ls docs/specs/features/<name>.md` | |
| 2 | Spec has Status: DRAFT | grep for "Status: DRAFT" in spec | |
| 3 | Spec has AC table | grep for AC table header in spec | |
| 4 | Spec has System Dependencies section | grep for "System Dependencies" heading in spec | |
| 5 | Vision-to-spec traceability check | verify vision concepts map to ACs in spec | |
| 6 | Zero-state AC exists (Feature type) | grep for ZERO AC in spec (Feature type only) | |
| 7 | No unresolved questions | grep for TBD, TODO, open questions in spec | |
| 8 | Scope bounded by competitors | If analyze-competitors.md exists, spec doesn't re-invent competitor strengths | |
| 9 | Pillars Coverage Matrix present and complete | grep for "## Pillars Coverage Matrix" section in spec + verify all 8 pillars populated with explicit state (`[NEW]`, `[UPDATED]`, `[UNCHANGED — VERIFIED]`, or `[N/A — justified]`). No blank cells, no TODO, no "skipped". See `references/pillars-coverage-matrix.md`. | |
| 10 | Task graph written | `test -f .svc/lane-tasks-<WI>.json` — file must exist with Task {T} entry and process_tasks | |
| 11 | All process tasks completed | In lane-tasks-<WI>.json, all 10 `write-spec|*` process_tasks must have `status: "completed"` | |
| 12 | AC table is machine-parseable (FP-029) | `node --input-type=module -e "import{acSignatures}from './scripts/lib/normalize-ac-table.mjs';import fs from'node:fs';const sigs=acSignatures(fs.readFileSync('docs/specs/features/<name>.md','utf8'));if(!sigs.length){console.error('no parseable AC signatures');process.exit(1)}console.log(sigs.length+' ACs bound')"` — a malformed AC section (missing table/checklist rows, wrong heading) yields zero signatures and FAILS here at authoring time instead of failing later at plan-changeset digest binding | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

Task-graph mode: per Pipeline Continuation above. `--progressive` + self-verify passed: greenfield → `audit-ac --progressive --lane greenfield`; brownfield-feature → `write-journeys --progressive --lane brownfield-feature` (honor `--skip`). Without `--progressive`: report and suggest the same next skill.

## Post-Compaction Recovery

Lane-tasks file is the sole source of truth: find first `in_progress`/unblocked `pending` task, re-load the skill via `task-graph.mjs load-skill`, re-read this SKILL.md, resume. Never ghost-complete (verify `skill_receipt` first). If a checkpoint file disagrees, trust lane-tasks and re-run `task-graph.mjs checkpoint`.

## Skill Outcome Contract

When this skill discovers new delivery-graph signals, emit `skill_outcome` per `references/skill-outcome-contract.md` before completing the task.
