# plan-changeset — Manifest section templates (1-9 payloads)

### 1. Header

- feature spec path
- branch name (convention: `feature-<name>`, `bugfix-<name>`, or `refactor-<name>` — matches the lane)
- **Status:** DRAFTED (lifecycle: DRAFTED → SIMULATED → EXECUTING → CHECKPOINTED → PROMOTED → VERIFIED)
- base branch and base SHA (typically `main` and its current HEAD)
- creation timestamp
- **Risk Flags:** the AC-553-1 flags in effect for this changeset (`runtime_concurrency`, `external_state_writer`, `config_schema_migration`, `lossless_rmw`, `idempotent_rewriter`, `cross_runtime_integration`), comma-separated, or `none`. Any flag named here requires an adjacent `plan-contract.json` declaring the same flags in `risk_flags` (`scripts/verify-plan-mechanical.sh` Check 11) — see `references/plan-contract-risk-sections.md`.

### 2. Implementation Summary

- what this feature changes
- what must remain invariant
- major constraints from spec/UX/UI/tech design

### 3. Files Planned

Table:

| File | Action | Task | Purpose |
|------|--------|------|---------|

Actions:
- `CREATE`
- `MODIFY`
- `DELETE` (rare, must be justified)

### 3a. Changeset Blueprint

For dispatch or absent mode, every planned file must contain its precise code blueprint (inline skips this section):
- For `CREATE` actions, include the full, complete file contents. No placeholders.
- For `MODIFY` actions, include precise context-rich diff blueprints using before/after diff markers:
  ```markdown
  <<<<<<< BEFORE
  [at least 3 lines of original surrounding context]
  =======
  [at least 3 lines of replacement code]
  >>>>>>> AFTER
  ```
This is the dispatch packet requirement. Include applicable original clauses alongside it; inline execution does not transcribe code here.

### 4. Task Graph

Task list with:

- task id
- title
- touched files
- dependencies
- AC coverage
- validation command
- checkpoint name
- parallel group, if any

Suggested baseline tasks:

- `task-1-types`
- `task-2-data-model`
- `task-3-tests-unit`
- `task-4-services`
- `task-5-components`
- `task-6-e2e`
- `task-7-spec-updates`
- `task-8-journey-updates`

For smaller work, collapse tasks. For larger work, split by subsystem.

### 5. AC-to-Task Mapping

Every AC must map to one or more implementation tasks.

### 6. AC-to-Test Mapping

Every AC must map to exactly one of:

- `Unit`
- `E2E`
- `Manual`
- `N/A` (with reason)

### 6a. Prerequisite Alignment Matrix

A matrix table that explicitly maps each planned task or file blueprint to its upstream requirements:
1. The UX transitions & flow charts (`docs/specs/ux/<name>.md`).
2. The UI visual tokens & asset guidelines (`docs/specs/ui/<name>.md`).
3. The Technical Design components (`design-tech` or `review-security` structures).
4. The Style Contract styling patterns (`docs/specs/style-contract.md`).
5. The Persona/Competitor differentiation rules, citing concrete persona IDs or
   paths. Generic entries like `customer`, `admin`, `all users`, `PASS`, or
   `satisfied` are not a valid persona trace.

### 7. Validation Plan

Include:

- task-level validation commands
- final branch-level validation commands

### 7a. Execution Command Sequence

Legacy v1–3 and dispatch use a single, copy-pasteable, non-interactive fenced `bash` block detailing the sequential CLI execution flow:
1. Branch/Worktree creation.
2. Dependency installations.
3. Host-adaptive file patching (using replace/edit tools for native hosts, or fallback heredocs for shell-only).
4. Per-task test execution (`npx vitest run ...`).
5. Checkpoint commits (with exact trailers).
6. Phase receipt emission commands.

Must also include `RECOVERY_IF_FAIL` blocks pre-programming git rollbacks or correction scripts.

### 8. Checkpoint Plan

List:

- required checkpoint names
- expected order
- rollback anchors

### 9. Promotion Readiness Checklist

Checklist should confirm:

- all planned files accounted for
- all tasks have validation
- all ACs mapped
- all checkpoints named
- final diff should contain only manifest-listed files

**Schema drift check:** If any task in the manifest modifies an ORM schema file (Prisma, Drizzle, TypeORM, Sequelize) but no migration task exists in the manifest, flag as a pre-flight blocker. Migration strategy is a design decision — do not auto-generate.


## Phase receipt commands

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ArchetypeClassification --evidence command_output:.svc/plan-changeset-archetype.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-InputCompressionAndScopeExtraction --evidence command_output:.svc/plan-changeset-scope.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-ManifestTaskGraphMapping --evidence file:docs/plans/<date>-<name>/manifest.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ExternalStateAndSimulationReport --evidence file:docs/plans/<date>-<name>/manifest.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-AdversarialReviewAndLaneValidation --evidence command_output:.svc/plan-changeset-review.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-HandoffSelfVerify --evidence command_output:.svc/plan-changeset-self-verify.log
```

## Explicit inline v4 body and generated views

Use one complete plan-manifest receipt body between these exact markers, with one fenced json block:

    <!-- SVC_PLAN_BODY -->
    ```json
    { complete authored receipt body }
    ```
    <!-- /SVC_PLAN_BODY -->

The placeholder above describes placement, not a valid plan. Author receipt_type=plan-manifest, schema_version=4, mode=inline, wi, a fixed authoring timestamp, scope, dependencies, decision_trace, task_graph, validation_plan, risk_rollback, execution_command_sequence and ac_digests. `schemas/receipts/plan-manifest.schema.json` is the shape contract.

- task_graph: unique string id, exact files, blocked_by IDs, ac_ids, validation_ids, context_refs. Every AC has an implementing task and linked validation.
- validation_plan: id, ac_ids, observation_kind (source/unit/browser/device/hosted/performance), executable command, expected_outcome and why that observation is sufficient.
- context_refs: path, start_line, end_line, excerpt_sha256 over the exact newline-joined slice. These are ONLY immutable reviewed excerpts. Read prerequisite-produced code normally during execution; never put an invented future hash here.
- execution_command_sequence: increasing step integers and either command + expected_outcome, or producer={artifact,field,command}, verifier={command,expected_outcome}, consumer_skill=land-changeset|verify-promotion, expected_outcome. Existing release adapters produce and verify actual identities. No task-ID mapping, producer scheduling or shell interpolation of artifact fields is introduced.
- ac_digests: canonical spec_path, normalized AC hash from scripts/lib/normalize-ac-table.mjs and the exact AC entry set. Digest prose only routes attention. The original AC section accompanies handoff.

Run `node scripts/prepare-plan-handoff.mjs --capabilities` before issuance. Run `node scripts/prepare-plan-handoff.mjs --manifest <path> --write --out .svc/external-review-artifacts/plan-handoff/body.json` before review: it generates the bounded SVC_PLAN_VIEWS section and the emitter input, preserving other prose. Do not author AC/task/test views independently. `--check` verifies generated bytes and source/context bindings without writes; `--task <id>` emits original context. A changed binding requires explicit correction and affected review, never silent regeneration.

Keep the existing file/action scope table and Prerequisite Alignment Matrix. C7 validates the v4 body instead of demanding a future branch-to-merge shell transcript; all existing C9/authority/receipt requirements remain. Stage the reviewed manifest, authoritative spec and immutable context inputs before emission: the emitter validates the frozen Git index, so unstaged source bytes cannot certify it. Pass the generated body to emit-receipt; it remains the only canonical receipt writer. Old v3 inline plans and complete dispatch packets remain valid.

Capability identity is the framework source/install package reported by --capabilities. The product Git candidate supplies its own spec and context bytes; it need not vendor the framework's five helper/schema files. Validate package compatibility at its canonical source_root and requirements at the product's frozen candidate, keeping these separate identities explicit.
