---
name: rename-product
version: "1.0"
created: "2026-10-15"
description: >-
  Run a Lane 10 infra migration that renames a live product across copy,
  identifiers, cloud resources, domains, docs, local folders, and agent memory.
  Use when: "rename the product", "rebrand", "move everything to the new name",
  after the new name is chosen and its domain and trademark are checked.
  A code-only rename stays a plan-changeset Migration / sweep.
phases:
  - { id: P1-NameResearch, trigger: always, reads: ["chosen name", "domain check", "trademark check"], writes: ["docs/plans/<date>-<newname>-migration/evidence/R-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P2-Inventory, trigger: always, reads: ["Phase 5a source-state.md", "Migration/sweep inventory"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P0-inventory.md"], evidence_kind: file, required_for_completion: true }
  - { id: P3-UserVisibleCopy, trigger: always, reads: ["P0 inventory"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P1-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P4-StageInfrastructure, trigger: always, reads: ["spending approval", "reviewed SHA"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P2-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P5-ProductionNewName, trigger: always, reads: ["spending approval", "stage receipt"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P3-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P6-Cutover, trigger: always, reads: ["traffic approval", "production reconciliation"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P4-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P7-HoldAndSoak, trigger: always, reads: ["probe matrix"], writes: ["docs/plans/<date>-<newname>-migration/evidence/H-probes.jsonl"], evidence_kind: command_output, required_for_completion: true }
  - { id: P8-RetireOldResources, trigger: always, reads: ["soak receipt"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P5-receipt.md"], evidence_kind: file, required_for_completion: false }
  - { id: P9-Domain, trigger: always, reads: ["production receipt", "domain registration"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P6-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P10-Docs, trigger: always, reads: ["landed name"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P7-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P11-LocalAndMemory, trigger: always, reads: ["closed agent session"], writes: ["docs/plans/<date>-<newname>-migration/evidence/P8-receipt.md"], evidence_kind: file, required_for_completion: true }
  - { id: P12-Retrospective, trigger: always, reads: ["phase receipts", "review-cross-model receipts"], writes: ["docs/plans/<date>-<newname>-migration/evidence/retrospective.md"], evidence_kind: file, required_for_completion: true }
inputs:
  required:
    - { path: "docs/specs/project-state.md", artifact: project-state, note: "Which product is live. If the file is absent, the user-named product is the scope and the plan records that." }
  optional:
    - { path: "docs/specs/domain-profile.md", artifact: domain-profile }
    - { path: ".svc/lane-tasks-<WI>.json", artifact: lane-tasks }
outputs:
  produces:
    - { path: "docs/plans/<date>-<newname>-migration/PLAN.md", artifact: rename-plan }
    - { path: "docs/plans/<date>-<newname>-migration/evidence/", artifact: rename-evidence }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---

# Rename Product

**Announce at start:** "I'm using rename-product to run this rename as a Lane 10 infra migration. I will not provision, stop production, rotate credentials, switch traffic, deploy, or move local folders without the recorded approval and the phase receipt."

This skill adds the rename-specific gates to Lane 10. It does not define a second migration lifecycle, and it does not authorise spending, contact, publication, or a deploy.

Use Lane 10 "Infra Migration" in `skills/route-workflow/references/lane-model.md`: Phase 5a source assessment, Phase 5b target design, Phase 5c cutover plan, phases 8–19, and Phase 20+ decommission. The cutover shape is `skills/design-ui/templates/infra-cutover-runbook.md`. Deletion is only Phase 20+. Rollback before that follows the runbook. The exact stopped-source rule is in `references/phase-gates.md`.

## Before Starting

Build a bounded context plan. Read `_shared/before-starting.md`. Start from `.svc/session-contract.jsonl`, the active WI, or the product the user named. Query `.svc/spec-index.json` with `scripts/query-spec-index.mjs` (do not raw-read the index) and `docs/specs/work-items/INDEX.md` for specs, domains, and validators the old name still governs. Read only the artifacts that can change an inventory class or the cutover order.

Skip the rest of this skill if the user is only asking which skill to run. Do not skip once a rename has started.

## Preflight

Stop before any edit unless all of these are true:

1. The new name is already chosen. This skill does not pick a name.
2. Domain availability and trademark checks exist as dated evidence. Delegate missing lookups to `research`. A trademark note is evidence, not a legal opinion. A legal question goes to `counsel`.
3. Each old token is at least 4 characters, or the plan records a reviewed shorter pattern. Unbounded scans of tiny tokens create false leftovers.
4. The cloud account, repo, and public origin in scope are named, and so are neighbouring products that share the account.
5. No deploy is in flight from an unreviewed tree.

Write the plan from `references/plan-template.md` before mutating anything. Rename-specific gates are in `references/phase-gates.md`. Occurrence classes are in `references/inventory-classes.md`. Local moves are in `references/local-moves-checklist.md`.

## Lane 10 map

Record task-graph phases with the ids in frontmatter. The labels are receipts on top of Lane 10, not a parallel lifecycle.

| Receipt | Lane 10 home | Rename-specific only |
|---|---|---|
| R | Identity input to Phase 5b | Chosen name, dated domain check, trademark note. |
| P0 | Phase 5a source assessment | Occurrence classes overlaid on that assessment and on the Migration / sweep inventory. Do not build a second source list. |
| P1 | Phases 8–19 source release | User-visible copy ships in that reviewed release. |
| P2 | Runbook phases 1–2 | Spending approval before each new stage resource. Stage copy stays. Rollback does not delete. |
| P3 | Runbook phase 3, before the flip | Spending approval before each new production resource. Production data migration and reconciliation. Approval before stopping production or rotating credentials. |
| P4 | Runbook phase 4 | Approval before switching traffic. Rollback before Phase 20+ follows the runbook and does not delete the new estate. Old production is not restarted after decommission. |
| H | Runbook phase 5 soak | Probe matrix in `references/phase-gates.md`. `infra-sre` designs the window and does not deploy. |
| P5 | Phase 20+ decommission | `retire-cloud-resources` is the executor. If that skill is not in the framework manifest, write outcome `deferred`, leave the frozen resources in place, and do not claim retirement succeeded. |
| P6 | After production exists, still Phase 5c | Owner registers the domain. Not blocked by a deferred P5. |
| P7 | After the name is committed, phases 8–19 | Docs describe the landed name. Historical records stay. Not blocked by a deferred P5. |
| P8 | After every session using the old folder has closed | Operator checklist for the local checkout, worktrees, and agent-memory directories. |
| Retrospective | After those receipts | Observations from `review-cross-model` findings and receipts. |

P6 and P7 proceed while P5 is `deferred`. P8 does not start while a session's working directory is the folder being renamed.

`live-evidence: not-applicable (no visible artifact)`. A marketing-page redesign still goes through `benchmark-landing`.

## Approvals

`human_checkpoint: true` does not approve spend or cutover. `plan-blast-radius` can classify an additive resource as SEV-4 and proceed without a person. This programme still stops until the owner has recorded approval of the resource plan and the incremental cost, in the phase evidence, before each new stage resource and again before each new production resource. A separate recorded approval is required before stopping production, before rotating credentials, and before switching traffic. One approval does not cover the next step. A review receipt is not spending approval, contact, or permission to deploy.

The owner supplies the cost figure from their own source. This skill does not estimate it. Field shape: `references/phase-gates.md`.

## Inventory classes

The external inventory is Lane 10 Phase 5a source assessment. Overlay only the rename occurrence classes. Source-tree hits come from the Migration / sweep inventory. The settings-manifest columns and the dual-read rule are in `references/inventory-classes.md`.

| Class | Action |
|---|---|
| User-visible | Rename in the source release. |
| Internal identifier | Code-only. Ships through `plan-changeset` → `execute-changeset` → `review-gate` / `review-cross-model` → `audit-implementation` → `land-changeset` → `verify-promotion`. |
| Immutable cloud name | Recreate and migrate. Do not assume a rename API. |
| Production-read key | Dual-read first. Env vars, storage keys, cookie names, and key-purpose strings are never a hard rename in the same release that switches writers. |
| Historical record | Keep. |
| Third-party | The owner changes the other party's console. This skill does not contact them. |

A hit that is not classified does not get edited "while you are here" and is not marked Historical to clear it.

## Order of operations

Each source release is `plan-changeset` → `execute-changeset` → `review-gate` / `review-cross-model` → `audit-implementation` → `land-changeset` → `verify-promotion`. Name that chain in the release receipt. Do not abbreviate it. Consume each skill's receipt. Deploy only after those receipts exist and the owner has recorded approval to deploy. Do not redeploy an old SHA with local edits.

Before P4, the P3 receipt must contain the production migration evidence in `references/phase-gates.md`: a reviewed migration, one consistent snapshot or replication checkpoint, destination reconciliation, and application-level read and write verification.

Before any infra apply, run `plan-blast-radius`. SEV-1 and SEV-2 still wait for a person. SEV-4 does not replace the spending approval above.

Rollback before Phase 20+ follows the runbook (unfreeze the source, return traffic). It does not delete the new estate. Old production is not restarted after decommission; before that, rollback follows the runbook. Freeze proof, probes, and secret handling are in `references/phase-gates.md`.

## Local moves

P8 is the operator checklist in `references/local-moves-checklist.md`. It runs after the agent session has ended. The agent does not move the checkout, a worktree, or an agent-memory directory while this session is open.

The checklist canonicalises paths, checks that no process has its working directory under the old checkout, inventories hidden entries, lists memory directories per host, dry-runs, then applies. The old folder stays until the new path opens and that verification passes.

## Red Flags

- A new resource was created, production was stopped, a credential was rotated, or traffic was switched without that step's recorded approval → stop.
- P4 started without the production reconciliation fields → stop.
- Rollback deleted the new estate, or old production was restarted after decommission → stop. Before decommission, a rollback that does not follow the runbook → stop.
- P5 says retirement succeeded although `retire-cloud-resources` did not run → correct the receipt to `deferred` and leave the resources frozen.
- An env var, storage key, cookie, or key-purpose string was renamed in one step → put the dual-read back before any further phase.
- The folder of the running session was renamed → stop. P8 waits until that session is closed.
- An unclassified hit was marked Historical to clear it → remove that class unless the plan states why the hit must stay.
- Soak probes followed redirects, or a missing sample was ignored → re-run the matrix.
- Secret values appear in a receipt, plan, or log → remove them from the artifact and rotate the exposed secret before continuing.

## Rationalization

| Thought | Reality |
|---|---|
| "SEV-4 is additive, so I can create the estate." | Additive resources can still cost money. Record the owner's approval of the plan and the incremental cost before each new resource. |
| "The review finished, so deploy and switch traffic." | The review is not spending, stop, rotate, or traffic approval. |
| "Restarting the old app is the fastest rollback." | Old production is not restarted after decommission; before that, rollback follows the runbook. Do not delete the new estate. |
| "It is just an environment variable." | Production-read keys need the dual-read rule in `references/inventory-classes.md`. |
| "The sibling retirement skill is missing, so I will delete the resource group myself." | Write `deferred`, keep the frozen resources, and continue domain and docs. Do not claim retirement succeeded. |
| "I will move the repo folder at the end of this session." | The session is using that folder. The operator follows `references/local-moves-checklist.md` after the session is closed. |
| "No rows, so no inventory file." | Link Phase 5a source assessment and the Migration / sweep inventory. The overlay is the occurrence class of each hit. |
| "I will score the programme from 1 to 5." | Use the `review-cross-model` findings and receipts. Do not add a second rating. |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every receipt names its Lane 10 home and does not replace the runbook | Read `PLAN.md` against the map in this file and `references/phase-gates.md` | |
| 2 | P0 links Phase 5a source assessment and the Migration / sweep inventory, and every hit has one occurrence class | Read the P0 links and the class column. No second list of resources, configs, integrations, traffic, or dependencies | |
| 3 | Each new resource, production stop, credential rotation, and traffic switch has its own recorded approval | Read the approval blocks in the P2, P3, and P4 receipts | |
| 4 | P3 has a reviewed production migration, one checkpoint, destination reconciliation, and application read/write verification before P4 | Read the P3 receipt fields in `references/phase-gates.md` | |
| 5 | Rollback before Phase 20+ follows the runbook and does not delete the new estate; old production is not restarted after decommission | Read the P2, P3, and P4 receipts against `skills/design-ui/templates/infra-cutover-runbook.md` and `references/phase-gates.md` | |
| 6 | P5 is either the `retire-cloud-resources` outcome or `deferred`, and domain and docs were not blocked on `deferred` | Read the P5, P6, and P7 outcomes | |
| 7 | P8 ran only after the session closed, and the old folder was kept until the new path opened | Read the P8 receipt against `references/local-moves-checklist.md` | |
| 8 | The retrospective cites `review-cross-model` finding and receipt paths and lists missing receipts | Read `evidence/retrospective.md` against `references/retrospective.md` | |

## Phase Receipt Contract

When a lane task exists, record each frontmatter phase after its evidence file exists. P8-RetireOldResources is still recorded when retirement is `deferred`. That outcome does not block P9-Domain or P10-Docs, and it is not success.

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-NameResearch --evidence file:docs/plans/<date>-<newname>-migration/evidence/R-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-Inventory --evidence file:docs/plans/<date>-<newname>-migration/evidence/P0-inventory.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-UserVisibleCopy --evidence file:docs/plans/<date>-<newname>-migration/evidence/P1-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-StageInfrastructure --evidence file:docs/plans/<date>-<newname>-migration/evidence/P2-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-ProductionNewName --evidence file:docs/plans/<date>-<newname>-migration/evidence/P3-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-Cutover --evidence file:docs/plans/<date>-<newname>-migration/evidence/P4-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-HoldAndSoak --evidence command_output:docs/plans/<date>-<newname>-migration/evidence/H-probes.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-RetireOldResources --evidence file:docs/plans/<date>-<newname>-migration/evidence/P5-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P9-Domain --evidence file:docs/plans/<date>-<newname>-migration/evidence/P6-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P10-Docs --evidence file:docs/plans/<date>-<newname>-migration/evidence/P7-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P11-LocalAndMemory --evidence file:docs/plans/<date>-<newname>-migration/evidence/P8-receipt.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P12-Retrospective --evidence file:docs/plans/<date>-<newname>-migration/evidence/retrospective.md
```

A deferred phase still gets a receipt. The outcome says why. The retrospective lists it. Silent omission is not a skip.

## Pipeline Continuation

Terminal programme. Do not auto-start a product lane when the retrospective is done. **Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`.

Inside the programme, hand work to the sibling skill and wait for its artifact:

| Need | Skill | This skill still owns |
|---|---|---|
| Unchecked domain or trademark fact | `research` | Whether the evidence is enough to leave R |
| A legal question about the mark | `counsel` | The dated note is not a legal opinion |
| Source hits | `plan-changeset` Migration / sweep | The occurrence class of each linked hit |
| Source release | `plan-changeset` → `execute-changeset` → `review-gate` / `review-cross-model` → `audit-implementation` → `land-changeset` → `verify-promotion` | Which rename receipt that release belongs to. Consume each skill's receipt. |
| Destruction class of one infra plan | `plan-blast-radius` | Spending approval before each new resource, including SEV-4 |
| Soak and rollback design | `infra-sre` | The probe matrix and the decision to cut over |
| Phase 20+ deletion | `retire-cloud-resources` | `deferred` when that skill is absent; domain and docs continue |
| Review of a release in this programme | `review-cross-model` | Quoting those findings and receipts in the retrospective |

Mark this task complete only after Self-Verify passes and every `required_for_completion` receipt is recorded. P5 must still have a receipt, and `deferred` satisfies it without counting as retirement. The operator runs `references/local-moves-checklist.md` after this session closes. That checklist is not another skill.

## Key Principles

- Lane 10 and the cutover runbook own the migration phases. This skill owns occurrence classes, dual-read, local and memory moves, and the retrospective.
- A person approves each new resource's cost, and approves stopping production, rotating credentials, and switching traffic.
- Production data is copied and reconciled before cutover. Rollback before Phase 20+ follows the runbook and does not delete the new estate. Old production is not restarted after decommission.
- The local folder moves last, after the session has ended, by the operator checklist.
