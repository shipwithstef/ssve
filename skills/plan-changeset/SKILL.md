---
name: plan-changeset
version: "1.0"
description: Use when you have a BASELINED feature spec with technical design and need to produce the implementation plan for branch-first execution — task graph, file set, validation plan, checkpoints, and AC/test mapping
phases:
  - id: P1-ArchetypeClassification
    trigger: always
    reads: ["WI title and one-paragraph summary", "docs/specs/features/<name>.md metadata only when needed"]
    writes: [".svc/plan-changeset-archetype.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P2-InputCompressionAndScopeExtraction
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/ux/<name>.md", "docs/specs/ui/<name>.md", "docs/specs/design-system.md", "docs/specs/journeys/J*-<name>.feature.md", "docs/specs/style-contract.md"]
    writes: [".svc/plan-changeset-scope.log"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P3-ManifestTaskGraphMapping
    trigger: always
    reads: ["docs/specs/features/<name>.md", "docs/specs/journeys/J*-<name>.feature.md", "docs/specs/style-contract.md"]
    writes: ["docs/plans/<date>-<name>/manifest.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P4-ExternalStateAndSimulationReport
    trigger: always
    reads: ["references/external-state-lifecycle-protocol.md", "docs/plans/<date>-<name>/manifest.md", "codebase files targeted by manifest"]
    writes: ["docs/plans/<date>-<name>/manifest.md"]
    evidence_kind: file
    required_for_completion: true
  - id: P5-AdversarialReviewAndLaneValidation
    trigger: always
    reads: ["docs/plans/<date>-<name>/manifest.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/pipeline-decisions.jsonl", ".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
  - id: P6-HandoffSelfVerify
    trigger: always
    reads: ["docs/plans/<date>-<name>/manifest.md", ".svc/lane-tasks-<WI>.json"]
    writes: [".svc/lane-tasks-<WI>.json"]
    evidence_kind: command_output
    required_for_completion: true
inputs:
  required:
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional:
    - { path: "docs/specs/style-contract.md", artifact: style-contract }
    - { path: "docs/specs/ux/<name>.md", artifact: ux-design }
    - { path: "docs/specs/ui/<name>.md", artifact: ui-design }
outputs:
  produces:
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
chain:
  lanes:
    greenfield: { position: 18, prev: define-code-style, next: execute-changeset }
    brownfield-feature: { position: 13, prev: define-code-style, next: execute-changeset }
    bugfix: { position: 2, prev: diagnose-bug, next: execute-changeset }
    refactor: { position: 2, prev: sync-spec-code, next: execute-changeset }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

# Writing Change Sets

**Runtime v2 continuation:** Register the implementation manifest and its declared consumers via
`references/skill-runtime-contracts-v2.json`; follow `references/runtime-continuation-v2.md`.
The canonical DAG has exactly one plan review and one final review. Preserve all plan-specific
scope, dependency, proof, rollback and G5 obligations.

> **Cognitive routing:** 📐 [PLAN-OPUS] — architectural blueprinting demands Opus 4.8 for strict dependency graphs. See `references/model-routing.md`.

**Announce at start:** "I'm using the plan-changeset skill to produce the implementation plan."

## Before Starting

Read **as needed** (`_shared/before-starting.md`): `docs/specs/project-state.md`, `~/.svc/builder-profile.md`, `docs/specs/domain-profile.md`, the feature spec (behavior contract + AC slice the manifest must cover).

The changeset contains precise, context-rich code blueprints for every planned file to prevent downstream execution drift. The branch is the territory; this skill writes the implementation plan execution follows in the worktree.

## Product Questions — MANDATORY format

Product questions during simulation follow `_shared/product-question-format.md`, appended to `docs/specs/features/<feature>-questions.md` with `phase: plan-changeset`. **Gating:** manifest cannot reach SIMULATED unless the question file shows ≥40 accumulated AND all AGREE.

## Step 0 — Problem Archetype Reasoning (BEFORE reading inputs)

Read only the WI title + 1-paragraph summary and ask: **"What is the shape of this work?"** The wrong mode costs sessions, not minutes.

### The archetypes

| Archetype | Signal | Source of truth for scope | Planning mode |
|---|---|---|---|
| **Bounded feature** | Build new functionality with defined edges (new page, new component, new flow) | Spec defines what to build | Spec-first — standard workflow below |
| **Migration / sweep** | Fix all instances of a pattern across the codebase (token swap, rename, class replacement, config migration) | Codebase defines what exists | Grep-first — measure universe BEFORE reading spec |
| **Architectural change** | Restructure how the system works; many subsystems affected; hard to reverse | Invariants + blast radius | Map invariants and dependencies BEFORE planning tasks |
| **Cross-cutting concern** | Add a behavior that must exist everywhere (auth, logging, error handling, accessibility) | Codebase entry points + spec behavior | Enumerate entry points BEFORE designing behavior |
| **Incremental extension** | Add to an existing feature's known files | Prior implementation defines starting point | Read the existing implementation BEFORE reading the spec |

### How to classify

Reason about the shape, never keywords: doesn't exist yet w/ spec-defined edges → Bounded; finding+changing existing things → Migration; breaks/reshapes subsystems → Architectural; needed in N unknown places → Cross-cutting; extending something built → Incremental.


Log the classification (archetype, reasoning, planning mode) before proceeding. Per-archetype protocols (migration grep-universe, architectural invariants, cross-cutting entry-point enumeration, incremental deprecated-foundation scan, Base44 schema grounding, browser-visible MODIFY mock-parity ledger, capability-blocker pre-tasks): `references/archetype-protocols.md` — MANDATORY for the matching archetype.

## Inputs

Before writing anything, read and hold in context:

| Artifact | Path | What You Extract |
|----------|------|-----------------|
| Feature Spec | `docs/specs/features/<name>.md` | Stories, ACs, dependencies, technical design section |
| UX Design | `docs/specs/ux/<name>.md` | Screen flows, states, error handling |
| UI Design | `docs/specs/ui/<name>.md` | Component specs, design tokens, responsive behavior |
| Design System | `docs/specs/design-system.md` | Tokens, typography, spacing, component patterns |
| Journey Docs | `docs/specs/journeys/J*-<name>.feature.md` | Gherkin scenarios, AC cross-references, Layer 3 findings |
| Style contract | `docs/specs/style-contract.md` | Current patterns, naming, imports, tests — do NOT scan the source tree for this |
| Spec annotations | RESOLVED entries in feature spec | file:line pointers to existing code — load only these specific files when you need to understand existing implementation |

**Compression boundary:** product context is already compressed into the artifacts above — do NOT reload raw vision/personas/domain-profile/competitors by default; load one only when a specific ambiguity can't be resolved from the spec. Stale/missing upstream artifacts → stop and route back.

## Output

`docs/plans/<YYYY-MM-DD>-<feature-name>/manifest.md` — single source of truth. On the **dispatch** path (a zero-context executor builds it) it carries exact code payloads (CREATE = full contents; MODIFY = before/after context diffs, ≥3 lines each side). On the **inline** path (the orchestrator executes with full context already loaded) the Changeset Blueprint is skipped — see §3a.

## Execution Mode (resolve BEFORE planning — WI-386)

Before authoring the manifest, resolve and record the execution mode, because it decides whether §3a (Changeset Blueprint) is authored at all:

- **`dispatch`** — a zero-context subagent (`DISPATCH=mimo-pro|sonnet`) will execute from the contract alone. Blueprints are the executor's ONLY source of truth → **§3a is MANDATORY** (full payloads, no placeholders). This preserves WI-347's Lean-Executor isolation.
- **`inline`** — the orchestrator executes with the full spec/UX/UI context already loaded (the only mode used in practice per `.svc/dispatch-log.jsonl`). Re-authoring blueprints here is Opus-priced double-spend (code drafted at PLAN prices, then re-applied verbatim at EXEC) → **§3a is SKIPPED.**

Record the resolved mode in two places, both read by the chain:
1. The plan-manifest receipt's `mode` field (`dispatch` | `inline`) — `schemas/receipts/plan-manifest.schema.json` enforces "blueprints required UNLESS mode==inline" via an `if/then`, and `scripts/check-chain-receipts.mjs` mirrors that gate (the custom validator the push hook actually runs). **Absent/unmarked `mode` fails closed to dispatch semantics** — blueprints stay required, so nothing silently relaxes WI-347.
2. The `.svc/dispatch-log.jsonl` entry's `mode` field, written when execute-changeset records the dispatch (via `scripts/state-io.mjs` append helpers — never raw-write `.svc`).

Default when unsure: **`dispatch`** (author the blueprints). Only claim `inline` when the orchestrator itself will apply the change with context loaded.

## Manifest Contents (templates: `references/manifest-templates.md`)

1. **Header** — spec path, branch (lane convention), Status DRAFTED→…→VERIFIED lifecycle, base SHA, timestamp
2. **Implementation Summary** — what changes, invariants, constraints
3. **Files Planned** table + **3a. Changeset Blueprint** (dispatch mode only — full payloads/diff blueprints, NO placeholders; SKIPPED on the inline path per Execution Mode above)
4. **Task Graph** — id, title, files, deps, AC coverage, validation command, checkpoint, parallel group
5. **AC-to-Task** + 6. **AC-to-Test** mapping (Unit/E2E/Manual/N-A-with-reason) + 6a. **Prerequisite Alignment Matrix** (UX/UI/tech/style/persona traces — concrete persona IDs, never "all users")
7. **Validation Plan** + 7a. **Execution Command Sequence** (copy-pasteable bash: worktree, deps, patches, tests, checkpoints w/ trailers, receipts; RECOVERY_IF_FAIL blocks)
8. **Checkpoint Plan** + 9. **Promotion Readiness Checklist** (incl. schema-drift check: ORM file modified ⇒ migration task exists, else pre-flight blocker)

## External State Lifecycle (MANDATORY)

Before producing the manifest, every plan-changeset MUST answer the wrapper question from `references/external-state-lifecycle-protocol.md`:

> **What state outside this artifact does this change create, mutate, or rely on — and is the lifecycle of that external state explicitly coupled to the lifecycle of this artifact (create together, change together, revert together, remove together)?**

Walk the 15-environment taxonomy in `references/external-state-lifecycle-protocol.md` and emit an `## External State` section in the manifest with this shape:

```markdown
## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | (taxonomy entry # or "ad-hoc + brief description") | what is created/mutated/relied on | coupled \| decoupled-justified | path/script/check that enforces the coupling |

Untouched environments (walked the taxonomy, found nothing): <list of taxonomy entry numbers>
```

Rules:
- **Empty section is invalid.** Either list the touched environments OR state "no external state touched" with the taxonomy walk visible (list the entry numbers checked).
- **`coupled`** entries must name the file/script/check that enforces the coupling (e.g. "`setup` exits non-zero if SCRIPT_DIR is in `.worktrees/`", "post-merge GH Action `verify-symlinks.yml` runs after every PR").
- **`decoupled-justified`** entries must include a paragraph below the table explaining why decoupling is safe AND naming the monitoring/recovery path that detects drift.
- The taxonomy is a **floor, not a ceiling** — list ad-hoc environments not in the taxonomy. New environment classes that surface during a real failure get appended to the taxonomy via the same protocol doc's "Lessons" table.

This section is hard-checked by `review-plan` (see its `external-state-uncoupled` finding-type). A missing or hand-wavy section is HIGH severity and blocks `approve`.


## Review Surface

This skill produces the execution map, not reviewed code. Real surfaces: per-task `git diff --staged`; final `git diff <base>...HEAD`.

## TDD Rule

Unit tests scheduled before the services/components they constrain; e2e after the relevant implementation exists.

## Checkpoints and Loop-Backs

Anticipate loop-backs explicitly: spec ambiguity → `write-spec`; UX contradiction → `design-ux`; UI/design-system gap → `design-ui`; technical infeasibility → `design-tech`.

## What Not To Do

No placeholders/stubs/ellipses in blueprints; no vague task boundaries; no missing AC/test mapping; the manifest is not the implementation.

## Pre-Implementation Simulation (Dry Run)

After the manifest, BEFORE handoff: walk the task graph in dependency order against two layers — **disk** (files now) and **planned** (earlier CREATEs). CREATE targets must not exist; MODIFY targets must exist (grep the specific export/signature); imports resolve against the right layer; new deps checked in package.json; route conflicts grepped ONLY in the style-contract's route dir. **Scoping rule: every check targets a SPECIFIC file/dir — never grep `src/` or `.` broadly.** Append a Simulation Report (+ journey Scenario Walkthrough: every Given/When/Then maps to an implementing task or WARN). Fix FAILs, re-check, proceed only on all-PASS/acknowledged-WARN. Full protocol + report templates: `references/simulation-protocol.md`.

## Adversarial Plan Review

Plans face structured opposition before execution: mechanical checks (free), then `review-plan` (primary adversarial, structured YAML findings), convergence loop until residual ≤ MEDIUM. Product-sensitive, parallel, deletion-bearing, or claim-heavy plans place `plan-contract.json` beside the manifest; `verify-plan-mechanical.sh` consumes it through `scripts/validate-plan-contract.mjs` and rejects overlapping ownership, unsafe reversible writers, unbounded absence/completeness claims, and executables without named consumers. Self-review prompts + check catalog: `references/adversarial-review-detail.md`.

**Risk-triggered contract sections (WI-553):** if `diagnose-bug`, `write-spec`, or this skill's own classification declared any AC-553-1 flag (`runtime_concurrency`, `external_state_writer`, `config_schema_migration`, `lossless_rmw`, `idempotent_rewriter`, `cross_runtime_integration` — see `scripts/lib/risk-flags.mjs`), the manifest MUST carry a `**Risk Flags:**` line naming them AND `plan-contract.json` MUST declare the same flags in its `risk_flags` array with the matching section(s) filled in. Unmatched plans (no flags) add nothing — `plan-contract.json` grows only matched sections (AC-553-3). Section contract, required fields, and the exact WI-542 shapes each section mechanically rejects: `references/plan-contract-risk-sections.md`.

### Decision Logging

Log the plan as a `mechanical` decision (manifest path = the plan) and the G2 outcome to `.svc/pipeline-decisions.jsonl`.

### Branch Index Append (§3)

If the scope has a genesis index (`docs/specs/relations/<scope>.branches.md`, created by `write-spec`), append this stage's findings to its axis sections and re-stamp `Derived-at` to the manifest's HEAD sha at close — do not open a separate planning-only document. Run `node scripts/branch-index-freshness.mjs --stamp-imports <index-path>` alongside the re-stamp, so the §3f#3 import-shape check has a current recording to diff against; an un-run stamp is a silent no-op at check time, not a failure, but skipping it defeats the check's purpose. At this restamp, move any row this stage's diff contradicts to a `## Superseded` tail section rather than deleting it (G6) — keeps the index bounded and honest instead of an unbounded append-only log.

## Handoff

### Mandatory: validate task graph against lane model

```bash
node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-<WI>.json
```

Fail → add the missing mandatory skills as tasks and re-run until PASS (prevents silent omission of review-gate / audit-implementation / land-changeset / verify-promotion). Log the result.

### Step 5: Review the Plan (Mandatory)

`review-plan` is a built-in sub-step, not optional: mechanical verification → primary adversarial review → convergence (residual ≤ MEDIUM). Insert as a lane task between manifest completion and `execute-changeset`; set `blocked_by`. Log outcome.

### Route to execution

→ `execute-changeset`. G5 happens after execution using staged diffs + task checkpoints. The manifest is the map; the branch is the territory.

## Scope Reduction Prohibition

The planner MUST NOT silently simplify requirements. These phrases are banned
in task descriptions, action steps, and done conditions:

| Banned phrase | Why | What to do instead |
|---|---|---|
| "v1", "initial version", "basic version" | Implies incomplete delivery | Build the full AC or split the phase |
| "simplified version", "simplified for now" | Downgrades the requirement | Implement the full requirement or flag as infeasible |
| "placeholder", "placeholder for now" | Ships non-functional code | Implement or remove |
| "static for now", "hardcoded for now" | Defers the real work to undefined future | Make it dynamic or split into a task |
| "will be wired later", "TODO: connect" | Leaves disconnected code | Wire it now or split into explicit tasks |
| "stubbed out", "mock implementation" | Ships fake code (exception: mock implementations for external services per feature-toggle convention) | Implement for real |
| "priority pages / priority files" without a total count | Migration scope reduction disguised as phasing — "priority pages first" with no stated universe is identical to "simplified version" | State: "Phase 1: 7/71 files (10%). Phase 2 deferred: 64 files — WI-032." |
| "Under N-file threshold" on a migration archetype | Low file count means incomplete scope on a migration, not small scope | State actual coverage ratio from grep baseline |

**If the plan cannot cover all ACs from the feature spec:**

Do NOT silently drop ACs. Instead:

1. Produce a **coverage matrix** mapping every AC to a task
2. Flag any AC with `PARTIAL` or `MISSING` coverage as a **BLOCKER**
3. Recommend a **phase split**: "This feature needs 2 phases. Phase A covers
   AC-01 through AC-05 (core flow). Phase B covers AC-06 through AC-09
   (edge cases + integrations). Ship Phase A first."

The review gate checks for scope reduction. If the plan contains banned
phrases, the gate will FAIL.


## Deprecated-Foundation & Mock-Parity Gates

Run `node scripts/scan-deprecated-foundations.mjs --root . --path <file-or-dir> --first-hit-codebase-scan --promote-findings .svc/deprecated-foundation-findings.jsonl --fail-on-findings` (blocks on findings; promotes them to the ledger for future sessions). **Browser-visible MODIFY mock parity gate:** when a task modifies an existing component, route, shared component, visual state, or browser-visible screen, the manifest MUST reference a Production-Derived Mock Parity Ledger from `design-ui` before those tasks are runnable; generic standalone mocks cannot pass — route back to `design-ui`. Detail: `references/archetype-protocols.md`.

## Pipeline Continuation

### Phase Receipt Contract

Record each phase before completing the task — canonical form:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ArchetypeClassification --evidence command_output:.svc/plan-changeset-archetype.log
```

All six commands (P1-ArchetypeClassification … P6-HandoffSelfVerify): `references/manifest-templates.md` §Phase receipt commands. WI-363 autoemit records observable phases; manual commands stay valid/idempotent.

### Task-graph mode

source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Claude mirrors TaskList; Kimi observes /task; for Codex coordination, mirror only the active step in `update_plan` (never the full graph). Treat `Invoke: /skill-name` + `metadata.skill` as routing instructions. Host UI mirroring only in the parent session (no `SVC_SUBAGENT=1`); subagents never TaskUpdate. Mark this task completed before leaving; evaluate next task (runnable → in_progress + load skill; skippable → completed + reason).

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 0 | Archetype logged | Step 0 classification block appears in response before any spec was opened | |
| 1 | Manifest file exists | `test -f docs/plans/<date>-<name>/manifest.md` | |
| 2 | Task graph has ≥1 task | grep for `task-` in manifest | |
| 3 | AC-to-task mapping complete | every AC from spec maps to ≥1 task | |
| 4 | AC-to-test mapping complete | every AC maps to a test type | |
| 5 | Simulation report appended | Simulation Report section in manifest | |
| 6 | No unresolved FAIL in simulation | all FAIL items fixed or acknowledged | |
| 7 | No unresolved questions | grep for TBD, TODO | |
| 8 | Type/naming consistency across tasks | Scan all tasks for function names, type names, file paths, API endpoints, DB columns. Same entity must use the same name in every task. Flag drift (e.g., Task 2 says `clearLayers()`, Task 5 says `clearFullLayers()`). | |
| 9 | Schema-migration consistency | If any task modifies an ORM schema file (prisma/schema.prisma, drizzle/*.ts, *.entity.ts), a migration task exists in the same or later plan | |
| 10 | Base44/backend ground truth checked | If Base44 entity/schema/RLS/persistence behavior is in scope, manifest cites `audit-base44-entity-rls.mjs`, a live schema round-trip dump, or an explicit non-Base44 N/A reason | |
| 11 | Migration universe recorded | If archetype = migration: manifest header contains grep baseline (N files, M instances per pattern family) | |
| 12 | Lane-model validation passed | `node scripts/validate-task-graph-lane.mjs .svc/lane-tasks-<WI>.json` exits 0 with no missing mandatory skills | |
| 13 | New-lane necessity checked | If the work does not fit any existing lane (greenfield, brownfield-conversion, brownfield-feature, bugfix, drift, refactor, framework), the manifest contains a `**Proposal:** New lane <name> needed because <reason>` block with proposed skill sequence and routing signals | |
| 14 | Migration phase split accounted | If archetype = migration AND plan covers <100% of grep matches: deferred files/instances are named and counted, not implied | |

If any check FAILs, fix before continuing.

### Chaining

`--progressive` + self-verify passed → `execute-changeset --progressive --lane <lane>` (honor `--skip`). Otherwise report the manifest summary and suggest `execute-changeset`.

## Post-Compaction Recovery

Lane-tasks file is the sole source of truth: first `in_progress`/unblocked `pending`, `task-graph.mjs load-skill`, re-read this SKILL.md, resume; never ghost-complete; checkpoint file disagreement → trust lane-tasks + re-run `task-graph.mjs checkpoint`.

## Skill Outcome Contract

On new delivery-graph signals, emit `skill_outcome` per `references/skill-outcome-contract.md` before completing the task.

## Chain Receipt Emission (Mandatory Chain)

This skill emits receipt type `plan-manifest` per `references/chain-receipt-contract.md`: written to `.svc/receipts/staging/<tree-hash>/plan-manifest.json` pre-commit (post-commit hook promotes to the SHA mirror + consolidated git note on `refs/notes/svc-receipts`). Emit via `scripts/emit-receipt.mjs --type plan-manifest --wi <WI> --sha <SHA> --body <file>`. Self-verify: receipt exists, passes `schemas/receipts/plan-manifest.schema.json`, reflected in the consolidated note.

**Pipeline baton (WI-381) — emit at `schema_version: 3`.** After `review-plan` PASS, distill the spec's acceptance criteria into the receipt's `ac_digests` so the 5 downstream chain skills read a one-page nav index instead of re-reading the whole spec:
- `ac_digests.spec_path` — the authoritative spec (e.g. `docs/specs/features/<name>.md`, or the WI doc for framework work).
- `ac_digests.spec_ac_table_sha256` — `SPEC=docs/specs/features/<name>.md node -e 'import("./scripts/lib/normalize-ac-table.mjs").then(m=>console.log(m.acTableSha256(require("fs").readFileSync(process.env.SPEC,"utf8"))))'`. This hash-binds the baton to the spec AC table; `check-chain-receipts` recomputes it and FAILS if the ACs are revised after distillation (forcing a re-distill).
- `ac_digests.entries[]` — one `{ac_id, digest, anchor}` per AC; `digest` is a one-line attention router, NEVER the authoritative text. The live spec at `spec_path` remains the sole AC source.
- `mocked_deps[]` — `{dep, reason, mock_location}` for anything the plan stubs (optional).
Regenerate the baton on any manifest/AC revision — it can only carry reviewed content. Legacy v1/v2 plan-manifests without the baton stay valid (grandfathered).
