---
name: execute-changeset
version: "1.0"
description: >
  Use after plan-changeset has produced a manifest and task graph. Triggers on
  "execute the plan", "implement the changeset", "run the tasks", "start
  building", or when a plan-changeset manifest exists and is ready for execution.
phases:
  - { id: P1-DispatchPreflight, trigger: always, reads: [".svc/receipts/<sha>/plan-manifest.json#ac_digests (WI-381 baton: AC nav index, read FIRST; live spec stays authoritative)"], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P2-ApplyPlan, trigger: always, reads: [], writes: [], evidence_kind: file, required_for_completion: true }
  - { id: P3-Verification, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
  - { id: P4-Checkpoint, trigger: always, reads: [], writes: [], evidence_kind: command_output, required_for_completion: true }
inputs:
  required:
    - { path: "docs/plans/<date>-<name>/manifest.md", artifact: implementation-manifest }
    - { path: "docs/specs/features/<name>.md", artifact: feature-spec }
  optional:
    - { path: "docs/specs/style-contract.md", artifact: style-contract }
    - { path: "references/verification-patterns.md", artifact: verification-patterns }
    - { path: "references/anti-patterns.md", artifact: anti-patterns }
    - { path: "references/context-budget.md", artifact: context-budget }
outputs:
  produces:
    - { path: "(branch checkpoint commits)", artifact: executed-code }
chain:
  lanes:
    greenfield: { position: 19, prev: plan-changeset, next: review-gate }
    brownfield-feature: { position: 14, prev: plan-changeset, next: review-gate }
    bugfix: { position: 3, prev: plan-changeset, next: review-gate }
    refactor: { position: 3, prev: plan-changeset, next: review-gate }
  progressive: true
  self_verify: true
  human_checkpoint: true
---

# Executing Change Set

> **Cognitive routing:** ⚙️ [EXEC] — high-volume file editing per the svc-default profile (Sonnet 4.6 since WI-357). See `references/model-routing.md`.

**Announce at start:** "I'm using the execute-changeset skill to implement the planned changeset."

## Phase Receipt Contract

When a `.svc/lane-tasks-<WI>.json` task is active, record each required phase
before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-DispatchPreflight --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ApplyPlan --evidence file:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-Verification --evidence command_output:<path>
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-Checkpoint --evidence command_output:<path>
```

(Canonical ids in frontmatter; WI-363 autoemit records observable phases automatically — manual commands stay valid and idempotent.)

## Before Starting

Read **as needed** (`_shared/before-starting.md`): `docs/specs/project-state.md`, `~/.svc/builder-profile.md`, `docs/specs/domain-profile.md`, the feature spec (ACs the implementation must satisfy). The change set is the branch state, not markdown code payloads.

## Step 0 — MANDATORY dispatch preflight (hard rule, 2026-04-20)

Resolve the execution harness BEFORE touching files: `bash scripts/resolve-model.sh EXEC --json`. Honor the active profile (svc-default → Claude Sonnet direct; keyed MiMo profiles delegate; missing keys fall back per preflight). Full profile branches, MiMo delegation mechanics, and fallback table: `references/dispatch-preflight.md`.

## Product Questions — MANDATORY format

Surface implementation discoveries that change consequential product choices; do not hide them as code decisions. Follow `_shared/product-question-format.md` with `phase: execute-changeset`. Reuse accepted decisions and task authorization; ask only unresolved consequential owner choices. Record real decisions in the existing companion or canonical decision artifact. No empty companion or numeric question floor is required. Unresolved consequential decisions block dependent work.

## Inputs

Read and hold in context:

| Artifact | Path | Purpose |
|----------|------|---------|
| Implementation manifest | `docs/plans/<date>-<name>/manifest.md` | Task graph, file set, validation plan |
| Feature spec | `docs/specs/features/<name>.md` | ACs, dependencies, status |
| UX/UI/tech design | `docs/specs/ux/<name>.md`, `docs/specs/ui/<name>.md`, technical design section | Execution constraints |
| Journeys | `docs/specs/journeys/J*-<name>.feature.md` | Flow constraints |
| Domain profile | `docs/specs/domain-profile.md` | Industry context, tech conventions |
| Domain conventions | `references/domains/*/conventions.md` | Framework-specific patterns |
| Style contract | `docs/specs/style-contract.md` | Naming, imports, test patterns |
| Verification patterns | `references/verification-patterns.md` | Stub detection, 4-level verification (L1-L3 during self-verify) |
| Anti-patterns | `references/anti-patterns.md` | Universal execution anti-patterns |
| Context budget | `references/context-budget.md` | Context degradation tiers and read depth rules |

**Context loading rule:** Do NOT scan the full source tree. Load code files
ONLY from these sources, in this priority:
1. **Manifest file list** — the manifest names every file to create/modify
2. **Spec RESOLVED annotations** — file:line pointers to existing implementations
3. **Import resolution** — when a manifest file imports from another file, load that file
4. **On-demand** — if a test fails referencing an unknown file, load it then

This scoped loading eliminates 30-100K tokens of irrelevant code. The style
contract already encodes the project's patterns — you don't need to re-derive
them from source.

## Core Rules

- **Write once.** Code is written directly on the branch — not described in
  a plan and re-implemented. The manifest provides intent and constraints.
  The execution produces code. The diff IS the changeset. No double-spend.
- Stage only the current task's changes.
- Create a lightweight checkpoint commit after each accepted task.
- **No per-task quality review.** Style contract + spec constraints are
  sufficient per task. One holistic review of the full diff after ALL tasks.
- If a task reveals a spec, UX, UI, or tech-design defect, loop back before continuing.

## Execution Architecture

Model assignment per profile; task-graph execution order from the manifest; parallel groups via the partition fence; each mutating child receives its own inner worktree and a generation-bound, path-scoped delegation. Each subagent gets SCOPED context (manifest task, style contract, blueprint, validation command — never the full tree). Full detail incl. capability acceptance, completion receipts, sequential merge-back, and Adaptive Context Enrichment for 1M models: `references/subagent-dispatch.md`.

## Process

### Step 0 pre-flights

- **Gemini context budget** (Gemini CLI only), **local-first execution**, **Pre/Post Validation Baseline** (corrective/regression work runs the SAME proof before and after — `references/pre-post-validation-loop.md`): protocols in `references/process-details.md`.

### Step 0c: Delegation Contract Check

Default to single-agent unless the manifest's task structure makes the split obviously safe and cheap. A host may mutate through a child only when its capability declaration proves stable child identity and real filesystem containment. Full delegation-contract protocol: `references/process-details.md`.

### Step 0: Worktree Guard

Implementation code must never land directly on main. Run the worktree guard:

```bash
scripts/worktree.sh guard --skill execute-changeset --lane <lane> --branch <branch-name>
```

The guard handles all scenarios:
- **NEED_WORKTREE** → creates the worktree (idempotent — resumes if exists), runs setup and baseline tests
- **IN_WORKTREE** → already in the right place, proceed
- **STAY_MAIN** → should not happen for this skill (guard will warn)

The branch name comes from the manifest header. Convention: `feature-<name>`, `bugfix-<name>`, `refactor-<name>`.

After the guard, `cd` into `.worktrees/<branch-name>` if not already there.

See `WORKTREES.md` for the full lifecycle.

### Step 1: Read the manifest and confirm branch state

Extract branch, base SHA, task order, expected files, validation commands; branch must be clean. **1f. Verify test infrastructure:** run the manifest's validation command (dry/--list); on "no runner": detect language → install standard framework (vitest/jest, pytest, rspec, go test) → trivial passing test → re-run until exit 0. No TDD without a working runner (idempotent). Persistence model (Execution Progress file) + Cost-Aware Sequential Debugging standard (trial loop, budget caps): `references/process-details.md`.

#### Step 1g: Conditional mobile worktree development build

After implementation validation, check for the consumer contract at
`schemas/mobile-build-contract.json`.

- If it is absent, record the mobile-build phase as `N/A` with repository
  evidence showing the path is absent. Do not infer mobile support from Gradle,
  Xcode, Capacitor, or package files alone.
- If it is present, validate it against
  `schemas/mobile-build-contract.schema.json`, then call
  `node scripts/mobile-build-identity.mjs allocate-dev --contract
  schemas/mobile-build-contract.json --branch <branch> --sha <source-sha>`.
  Keep its worktree-local state and lock inside the gitignored path declared by
  the contract.
- Invoke the repository-reviewed `commands.prepare_dev`, `commands.build_dev`,
  and `commands.inspect_artifact` JSON argv arrays directly, without shell
  parsing, interpolation, `eval`, or an argv supplied by build output.
  Inspection must return the derived development application/bundle
  identity, version/build code, version name, label, artifact path, source SHA,
  branch hash, and `mode: dev`.
- Require the artifact path to resolve to a real regular, non-symlink file and
  its basename to equal the allocator's exact configured artifact filename.
  Have the engine compute SHA-256 from those artifact bytes; require the same
  `artifact_sha256` in the receipt and fresh inspection metadata before emitting
  a development receipt containing those exact values plus the contract schema
  version. Never edit canonical version fields, the canonical release ledger,
  or release signing configuration in this phase.

A development artifact or receipt is execution evidence only. It is never an
upload-ready claim and cannot satisfy `land-changeset` or `verify-promotion`
release proof.

### Step 2: Execute tasks (write directly)

At every staged task checkpoint, run `node scripts/classify-change-risk.mjs --staged --json` and compare the actual tier with the plan. Update `.svc/impact-triad/WI-N/task-N.json` with the exact diff hash and WI-484 identity. Upward drift blocks the checkpoint and inserts the missing deterministic coverage or runtime-proof task; never lower the classifier tier to preserve the original route. A new product/security authority surface freezes the plan. It does not create a routine per-task external review.

For `logic`, run the mapped test named by the receipt. For `high`, collect behavioral proof on the affected surface; headless framework work uses a controlled payload/runtime fixture. Bind `independent_review.status: deferred-to-final` to the task graph's exactly one `review-exec` task and current plan digest. Legacy different-family per-task PASS receipts remain N-1 readable but are not the v2 execution path. Any missing coverage becomes an owned task with blockers and a validation command, not a note. The task receipt must be regenerated after every staged-diff change.

**For sequential tasks** (or when running as single agent):

1. **If the task produces implementation code:**
   - Write the test FIRST (unit test for the behavior)
   - Run the test — it MUST FAIL (proves the test is real)
   - Write the minimal implementation to pass the test
   - Run the test — it MUST PASS
   - TDD red-green per task. Not optional for implementation tasks.

2. **Skip TDD for:** type definitions, config files, migrations, scaffolding,
   spec/journey updates.

3. Stage the task's files, run the validation command
4. Checkpoint commit: `checkpoint: task-N-<name>` (with trailers)
5. Move to next task — **no per-task quality review**

**For parallel task groups** (orchestrator mode):

1. Build a nested execution graph with `plan-execution-wave.mjs`.
2. Serialize unknown, overlapping, shared-state, lockfile, migration, and root-config scopes.
3. Persist one generation-bound delegation before creating and launching each child worktree. Before launch, run `node scripts/resolve-child-transport.mjs --state-root <state-root> --delegation <id> --child-principal <principal> --token <one-time-token> --worktree <inner-worktree> --completion-receipt <receipt> --host-manifest <manifest> --receipt .svc/dispatch/<task>.prelaunch.json`. A mutation-bearing `--request` JSON is only a caller assertion and is rejected; a generic `agents: true` flag never authorizes mutation.
4. Have the stable child principal accept its one-time token; it may mutate only the delegated worktree and allowed paths.
5. Each child performs TDD, commits, validates, and emits a completion receipt with the exact diff digest.
6. The controller recomputes every receipt field and merges accepted results sequentially with `validate-execution-merge-back.mjs`.
7. Re-run relevant validation after each merge, then continue to the next wave.

Children never edit the parent lane graph, controller lease, sibling results, or shared `.svc` state. A controller-generation change freezes outstanding results; the new controller must explicitly adopt, wait with a new receipt, revoke, or restart each child.

**Native task-graph execution (WI-388 core — Claude host).** Read-only native children are eligible directly. A mutating native child is eligible only when `resolve-child-transport.mjs` returns `delegated-wrapper`; `controller` means execute in the controller session. Instead of the dead
`dispatch-worker.sh` transport, partition the manifest task graph and run each
independent node as a native `agent(prompt, {isolation:'worktree', schema:
task-node-result})` call — in-session, on subscription. The partition fence is
MANDATORY: `node scripts/partition-task-graph.mjs --graph <task-graph.json>`
computes the file-set per node and **escalates any wave whose task file-sets
overlap to SEQUENTIAL** (the closed-loop `scripts/lib/disjoint-scopes.mjs` primitive,
shared with WI-387); dependencies map onto `pipeline()` stage order, never
`parallel()`; results are schema-forced (no grep-for-SVC_WORKER_SUMMARY). Merge
worktree checkpoints sequentially, then the holistic review runs unchanged.
**Non-Claude hosts keep `dispatch-worker.sh` / the sequential path.** Single-WI
intra-changeset scope only — the multi-WI-wave economics half is WI-374 F-01
(deferred). See `references/task-graph-parallel-exec.md`. Permitted mutating
transport per the S5 policy (recorded 2026-06-09).

**Why no per-task quality review:** The style contract constrains how code
looks. The spec ACs constrain what code does. TDD constrains correctness.
Per-task review catches nothing that these constraints don't already prevent,
and costs 5-10K tokens × N tasks. One holistic review at the end catches
cross-task issues that per-task reviews MISS.

### Verification Cost Class (§4b) — canonical table

Per the proposal's §4b, every verification carries a cost class so cadence is a
lookup, not a judgement. `skills/review-exec/SKILL.md` cites this table rather than
duplicating it.

**Denominator (§3g rule 1):** the figures below were measured on the
**`example-marketplace`** repo the proposal was authored from (appendix frozen at
`fe16fd22`), **not** on svc and not on your repo — svc ships zero `.spec.ts`
files and no `audit-*-contract.mjs`, so neither row 1 nor row 3 has a local
referent. Treat the numbers as the shape of the cadence, and **re-measure per
repo** before citing them as yours.

| Verification | Cost (example-marketplace) | Cost class | Cadence |
|---|---:|---|---|
| Scope/contract checks (self-review, mechanical scripts) | ~0.9s combined (408+458+69ms) | cheap | every stage |
| Scoped e2e (specs mapped to this landable group) | minutes | scoped | once per landable group |
| Full e2e suite (250 specs there) | long | full | once at closure, before promotion |

Zero quality loss: the full suite still runs before closure — what disappears
is running the full suite to validate a single task or stage.

### Step 3: Two-stage holistic review

One review of the FULL diff after all tasks — **Pass 1: spec/AC compliance (BLOCKING — full AC coverage, no orphaned code, distrust checkpoint messages, fix gaps and re-run before proceeding); Pass 2: code quality/cross-file consistency only after Pass 1 passes** — protocol, deviation rules, and loop-back rules (spec/UX/UI/tech defects route back before continuing): `references/process-details.md`.

Before freezing the review surface, re-run the impact guard against the final staged diff. The G5/G6 package must cite the same diff SHA, classifier reasons, completed coverage tasks, and tier-required independent/runtime evidence.

### Step 5: Final G5 surface

`git diff <base>...HEAD` + checkpoint history + validation outputs = the review surface handed to skills/review-exec/G5.

### Branch Index Re-stamp (§3)

If the scope has a genesis index (`docs/specs/relations/<scope>.branches.md`), append this stage's findings to its axis sections and re-stamp `Derived-at` to the final staged-diff sha before handing off — the same append-and-restamp discipline `plan-changeset` applies at its own close. Also re-run `node scripts/branch-index-freshness.mjs --stamp-imports <index-path>` at this point — imports may have changed during execution, and a re-stamp without a matching `--stamp-imports` run leaves the sidecar describing pre-execution code. As at `plan-changeset`, move any row this execution contradicts to a `## Superseded` tail section rather than deleting it (G6).

## Checkpoints

Required naming:

- `checkpoint: task-1-types`
- `checkpoint: task-2-data-model`
- `checkpoint: task-3-tests`
- `checkpoint: task-4-services`
- `checkpoint: task-5-components`
- `checkpoint: task-6-e2e`
- `checkpoint: task-7-spec-updates`
- `checkpoint: task-8-journey-updates`

Use phase checkpoints from earlier phases as rollback anchors when a loop-back crosses phases.

### Commit Protocol

Every checkpoint commit carries structured decision metadata as git trailers:

```
feat(api): add bookmark CRUD endpoints

Implement REST endpoints for create, read, update, delete bookmarks
with tag association and full-text search.

Constraint: SQLite FTS5 for search (local-first, no Elasticsearch)
Constraint: Tags are many-to-many, stored in junction table
Rejected: MongoDB for flexible schema | adds external dependency, violates local-first
Rejected: GraphQL | REST sufficient for this scope, less complexity
Confidence: high
Scope-risk: narrow
Not-tested: Search performance with >10K bookmarks
Directive: FTS5 index rebuilds on every write — monitor if write volume increases
```

**Trailers (include when applicable):**
- `Constraint:` — active constraint that shaped this decision
- `Rejected:` — alternative considered | reason for rejection
- `Directive:` — warning for future modifiers of this code
- `Confidence:` — high | medium | low
- `Scope-risk:` — narrow | moderate | broad
- `Not-tested:` — edge case or scenario not covered by tests

**Why trailers matter:**
Git history becomes the decision log. `git log` shows not just WHAT changed but WHY.
`Rejected:` trailers prevent future developers from re-proposing already-rejected approaches.
`Directive:` trailers are instructions that travel with the code.
`Not-tested:` trailers are honest about coverage gaps.

Skip trailers for trivial commits (typo fixes, formatting). Include for every implementation commit.

## What Not To Do

No code serialized into docs for reapplication; no multi-task staging; no skipping failed validation; no files beyond the manifest list without a deviation note; no partial-suite success claims.

## Handoff

On all tasks checkpointed + final validation green: feature status → `CHANGE-SET-APPROVED`; if the change has a browser-visible surface, capture `track-visuals --mode diff` before G5 review; hand to `review-exec` (G5-enforcing gate) / `review-gate` G5 surface. **Auto-invoke:** new external dependency discovered mid-exec → `research` inline; security-sensitive surface touched → flag for `review-security` at the post-exec review wave. Log insertions as `mechanical` decisions.

## Retrieval-Augmented Reasoning (cutting-edge technique #9)

When you hit uncertainty mid-implementation, do NOT guess:
1. **Pause** the current task's reasoning.
2. **Retrieve** the specific fact — grep the codebase, read the file slice, check the API doc or `references/knowledge/` node.
3. **Incorporate** it, then **continue** the task.

Rules:
- Never guess when you can retrieve — retrieval cost < rework cost (and < a failed review-exec round).
- Retrieve the minimum: grep before read; read the slice, not the whole file.
- Log non-trivial retrievals (what + why) in `.svc/pipeline-decisions.jsonl`.

Formalizes `rules/common/research-before-build.md` as a mid-reasoning loop.

## Pipeline Continuation

Task-graph mode — source of truth: `.svc/lane-tasks-<WI>.json`. Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. Claude mirrors TaskList; Kimi observes /task; for Codex coordination, mirror only the active step in `update_plan` (never the full graph). Treat `Invoke:`/`metadata.skill` as routing; parent-session-only host mirroring (no `SVC_SUBAGENT=1`); subagents never TaskUpdate; mark completed before leaving; evaluate next (runnable → in_progress + load skill; skippable → completed + reason).

### Self-Verify

Before declaring done, verify:

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | All manifest tasks have checkpoint commits | `git log --oneline` shows checkpoint commits for every task in the manifest | |
| 2 | No TODO/FIXME in committed code | `grep -r 'TODO\|FIXME' <changed-files>` returns empty | |
| 3 | Validation commands passed | All task-level and branch-level validation commands exit 0 | |
| 4 | TDD skip justified if applicable | If TDD was skipped for type-defs, configs, or scaffolding: skip reason is logged in lane-tasks JSON and `pipeline-decisions.jsonl` with the specific files/tasks that were exempted and why | |
| 5 | No blocking unresolved consequential decisions | Apply the shared promotion predicate. Inspect TBD/TODO as evidence-gap warnings: block missing required AC/state/dependency evidence or a consequential owner choice; explicitly defer harmless details without manufacturing answers | |
| 6 | Structured evidence target classified | For any task that changes browser-visible behavior, its completion receipt records `target_class: browser-visible`, a non-`V0` `evidence_level`, and runtime `evidence_artifacts` per `references/phase-receipts.md`. | |
| 7 | Old-path-fails / new-path-passes proof attached | If the changeset migrates, swaps, bypasses, or routes through a different code path to fix an observed symptom, attach probe JSON showing the old path fails and the new path passes against the same input. Validate with `node scripts/validate-cross-system-probe-evidence.mjs --evidence <path>`. | |
| 8 | Pre/post validation loop recorded | For corrective or acceptance-critical changes, cite the exact pre-change command/output, post-change rerun, comparison classification, iteration count, and `node scripts/validate-pre-post-validation-evidence.mjs --evidence <path>` result per `references/pre-post-validation-loop.md`; otherwise record why the loop is N/A. | |

If any check FAILs, fix before continuing. If a fix requires upstream changes, stop and report.

### Chaining

`--progressive` + self-verify passed → next per lane task graph (typically `review-exec`, then `audit-implementation`). Otherwise report execution summary + suggest the next skill.

## Post-Compaction Recovery

Lane-tasks file is the sole source of truth: first `in_progress`/unblocked `pending`, `task-graph.mjs load-skill`, re-read this SKILL.md, resume; never ghost-complete (verify `skill_receipt`); checkpoint-file disagreement → trust lane-tasks + re-run `task-graph.mjs checkpoint`.

## External State Lifecycle Cross-Check (WI-121)

Before the final commit at the end of execution, re-verify that the implementation's
writes match the plan's `## External State Lifecycle` declared set.

### Steps

1. Read the plan's External State Lifecycle table (from the WI doc or plan manifest).
2. Build a candidate write set from `git status --short` and the diff.
3. For each path in the candidate set, check whether it falls inside the declared
   environments (taxonomy entries 1-15 in `references/external-state-lifecycle-protocol.md`).
4. If a write touches an environment NOT declared in the plan: emit a HIGH-severity
   `external-state-undeclared` finding. Halt the commit; require either updating the
   plan to declare the environment with explicit lifecycle wiring, or removing the
   undeclared write.

This is the **Exec** stage of the 4-stage external-state gate. See
`references/external-state-lifecycle-protocol.md` for the full protocol.

## Modes (added by WI-SPINE-003)

This skill supports a `--infra` flag for infra lanes (Lanes 8-12).

## Skill Outcome Contract

On new delivery-graph signals, emit `skill_outcome` per `references/skill-outcome-contract.md` before completing the task.

## Chain Receipt Emission (Mandatory Chain)

This skill emits receipt type `exec-record` per `references/chain-receipt-contract.md`: staging at `.svc/receipts/staging/<tree-hash>/exec-record.json` pre-commit; post-commit hook promotes to the SHA mirror + consolidated note on `refs/notes/svc-receipts`. Emit via `scripts/emit-receipt.mjs --type exec-record --wi <WI> --sha <SHA> --body <file>`. Self-verify: receipt exists, passes `schemas/receipts/exec-record.schema.json`, reflected in the consolidated note.
