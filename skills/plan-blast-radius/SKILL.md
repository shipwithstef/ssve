---
name: plan-blast-radius
version: "1.0"
description: >
  Pre-apply impact classifier for infra changes. Reads `terraform plan` JSON
  / `helm diff` output, classifies each change by destruction risk + cross-
  resource dependency depth into SEV-1 (destructive) / SEV-2 (in-place
  mutation of stateful) / SEV-3 (in-place stateless) / SEV-4 (additive).
  SEV-1 and SEV-2 force `human_checkpoint: true` regardless of autorun.
  Use when: any infra-* lane reaches phase 8 (between plan-changeset and
  review-plan); user mentions "blast radius", "what could break", "is this
  safe to apply", "SEV tier classification". Source:
  proposals/done/2026-04-30-infra-project-support.md § 6.2.
inputs:
  required:
    - { path: "docs/specs/features/", artifact: feature-spec }
  optional:
    - { path: "docs/specs/stack-profile.md", artifact: stack-profile }
    - { path: ".svc/lane-tasks-WI-SPINE-001.json", artifact: lane-tasks }
outputs:
  produces:
    - { path: "docs/specs/features/", artifact: blast-radius-report }
phases:
  - { id: P1-PlanArtifactAndContextLoad, required_for_completion: true, evidence: "plan/diff artifact plus stack profile and feature context loaded" }
  - { id: P2-PlanParseAndChangeInventory, required_for_completion: true, evidence: "all plan changes parsed into a resource inventory" }
  - { id: P3-SevClassification, required_for_completion: true, evidence: "each change classified into SEV-1 through SEV-4 with reason" }
  - { id: P4-DependencyDepthEscalation, required_for_completion: true, evidence: "cross-resource dependency depth checked and escalations applied" }
  - { id: P5-BlastRadiusReportWrite, required_for_completion: true, evidence: "blast-radius report written with summary, verdict, and per-change table" }
  - { id: P6-GateVerdictAndTaskBlock, required_for_completion: true, evidence: "human-checkpoint/blocking decision persisted to lane task graph when required" }
  - { id: P7-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verification passed and host/task mirrors updated" }
chain:
  lanes:
    framework: { position: 8 }
  progressive: false
  self_verify: true
  human_checkpoint: true
requires_topics: [stack.iac-tool, stack.criticality-tier]
produces_topics: [decision.blast-radius]
recall_depth: layer-2
idempotent: true
---

# Plan Blast-Radius — SEV-Tier Gate

Classifies infra plan changes by destruction risk so SEV-1/2 forces explicit human approval before execute-changeset proceeds.

**Announce at start:** "Classifying blast radius from the plan output."

## Inputs

- `terraform plan -json` output, OR
- `helm diff upgrade --json` output, OR
- `kubectl diff -f` output, OR
- Equivalent IaC tool plan artifact

## SEV Tiers

| Tier | Definition | Examples | Gate behavior |
|---|---|---|---|
| **SEV-1** | Destructive — resource deletion or replacement of stateful resource | drop database, replace RDS, delete persistent volume | **HUMAN CHECKPOINT REQUIRED** regardless of autorun mode |
| **SEV-2** | In-place mutation of a stateful resource | DB version upgrade, IAM trust policy change | **HUMAN CHECKPOINT REQUIRED** |
| **SEV-3** | In-place mutation of stateless resource | ASG instance type change, ALB rule update | warn, proceed |
| **SEV-4** | Additive only | new resource, new IAM role, new tag | proceed silently |

## Cross-resource dependency depth

A SEV-3 change becomes SEV-2 if its blast radius spans ≥3 downstream resources. Example: changing a security group attached to one EC2 = SEV-3; changing one attached to a shared RDS read by 5 services = SEV-2.

## Output

Writes `docs/specs/features/<feature>/blast-radius.md` with:

```markdown
# Blast Radius — <feature>

**Generated:** <iso-ts>
**Plan source:** <terraform plan / helm diff / kubectl diff path>

## Summary
- SEV-1: 0 changes
- SEV-2: 1 change → IAM cross-account trust modification
- SEV-3: 3 changes
- SEV-4: 12 changes

## Gate verdict: HUMAN CHECKPOINT REQUIRED (SEV-2 present)

## Per-change details
[table of resource | tier | reason]
```

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Plan artifact parsed | `terraform plan -json` or equivalent successfully read | |
| 2 | All changes classified | Every change in plan has a SEV tier assigned | |
| 3 | Cross-resource depth checked | SEV-3 changes with ≥3 dependent resources elevated to SEV-2 | |
| 4 | Gate verdict emitted | Output file contains exactly one of: "PROCEED" / "HUMAN CHECKPOINT REQUIRED" / "BLOCKED" | |
| 5 | Human-checkpoint enforced | If SEV-1 or SEV-2 present, lane-tasks.json next-task is set to `blocked` until human approval | |

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-PlanArtifactAndContextLoad --evidence file:docs/specs/features/<feature>/plan-artifact.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-PlanParseAndChangeInventory --evidence command_output:.svc/plan-blast-radius-inventory-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SevClassification --evidence file:docs/specs/features/<feature>/blast-radius.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-DependencyDepthEscalation --evidence command_output:.svc/plan-blast-radius-dependencies-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-BlastRadiusReportWrite --evidence file:docs/specs/features/<feature>/blast-radius.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-GateVerdictAndTaskBlock --evidence file:.svc/lane-tasks-<WI>.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/plan-blast-radius-self-verify-<WI>.log
```

If the plan artifact is missing or unparsable, record
`P1-PlanArtifactAndContextLoad` or `P2-PlanParseAndChangeInventory` with the
blocker output and leave the task blocked instead of fabricating a SEV verdict.
If SEV-1/SEV-2 is present, `P6-GateVerdictAndTaskBlock` must show the next
task's blocked state or the explicit approval artifact that unblocked it.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)

- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume — Claude mirrors with `TaskList` / `TaskUpdate`; Kimi observes via `/task` + `TaskList`/`TaskOutput`; Codex and other hosts without native task-mutation APIs mirror only the active step in `update_plan`.
- After classification, if verdict is "HUMAN CHECKPOINT REQUIRED" set the NEXT task to `blocked` with reason "awaiting human SEV-1/2 approval"; require explicit user reply to unblock.
- Mark this skill's task `completed` in lane-tasks.json once the report is written, regardless of verdict.
- Update host-specific mirror (TaskList/update_plan).

## Limitations

- Tooling-dependent: only as accurate as the plan artifact provided. A `terraform plan` against drifted state may misclassify because it doesn't see the drift.
- Cross-resource dependency analysis is best-effort: requires the plan tool to export dependency graphs (terraform 1.5+, helm 3.13+).
