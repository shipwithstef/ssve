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

Every planned file must contain its precise code blueprint:
- For `CREATE` actions, include the full, complete file contents. No placeholders.
- For `MODIFY` actions, include precise context-rich diff blueprints using before/after diff markers:
  ```markdown
  <<<<<<< BEFORE
  [at least 3 lines of original surrounding context]
  =======
  [at least 3 lines of replacement code]
  >>>>>>> AFTER
  ```
This is a critical deterministic requirement. Downstream execution has zero specification context and relies entirely on these blueprints.

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

A single, copy-pasteable, non-interactive fenced `bash` block detailing the sequential CLI execution flow:
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
