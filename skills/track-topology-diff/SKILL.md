---
name: track-topology-diff
version: "1.0"
description: >
  Post-apply structural-state snapshot + diff. Captures `terraform state list`
  / `kubectl get all -A -o json` after each apply and structurally diffs
  against the prior baseline. Outputs a snapshot JSON + a diff markdown.
  Replaces track-visuals for infra lanes (track-visuals does image-diffing,
  this does JSON-graph diffing — different domains). Use when: any infra-*
  lane reaches phase 15 (after verify-promotion); user mentions "topology
  drift", "state diff", "what changed", "what's the cluster state". Source:
  proposals/done/2026-04-30-infra-project-support.md § 6.3.
inputs:
  required: []
  optional:
    - { path: "docs/specs/stack-profile.md", artifact: stack-profile }
    - { path: "docs/specs/topology-snapshots/", artifact: prior-snapshots }
outputs:
  produces:
    - { path: "docs/specs/topology-snapshots/", artifact: snapshot }
phases:
  - { id: P1-StackProfileAndToolResolution, required_for_completion: true, evidence: "stack profile read and snapshot commands resolved for declared IaC providers" }
  - { id: P2-LiveSnapshotCapture, required_for_completion: true, evidence: "live provider snapshot commands run or authentication/tooling blocker recorded" }
  - { id: P3-SnapshotNormalizeAndWrite, required_for_completion: true, evidence: "normalized structural state.json and summary.md written" }
  - { id: P4-PriorBaselineSelection, required_for_completion: true, evidence: "prior topology baseline selected or first-baseline condition recorded" }
  - { id: P5-StructuralDiffAndDriftFlagging, required_for_completion: true, evidence: "structural diff written and drift resources flagged when present" }
  - { id: P6-DecisionLogAndContinuation, required_for_completion: true, evidence: "drift decision log entry and task/host mirrors updated" }
  - { id: P7-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verification passed and continuation decision recorded" }
chain:
  lanes:
    framework: { position: 15 }
  progressive: false
  self_verify: true
  human_checkpoint: false
requires_topics: [stack.iac-tool, stack.observability]
produces_topics: [snapshot.topology]
recall_depth: layer-1
idempotent: true
---

# Track Topology Diff — Structural State Snapshot

Snapshots the live infra resource graph after apply and structurally diffs against the prior baseline. Catches:
- Resources created out-of-band (not in IaC)
- Resources expected but missing (failed apply, manual deletion)
- Drift between the plan and the actual post-apply state

**Announce at start:** "Snapshotting topology and diffing against last baseline."

## What It Captures

Per stack-profile, runs the equivalent of:

| IaC tool | Snapshot command |
|---|---|
| Terraform | `terraform state list` + `terraform state show` for each |
| Pulumi | `pulumi stack export` |
| Kubernetes | `kubectl get all -A -o json` + `kubectl get pv,pvc,configmap,secret -A -o json` |
| Helm | `helm list -A -o json` + `helm get all <release> -o json` |

## Output Layout

```
docs/specs/topology-snapshots/
  <iso-ts>/
    state.json        — full structural snapshot
    summary.md        — resource counts by type
  diff-<from-ts>-<to-ts>.md   — structural diff vs prior snapshot
```

## Diff Format

```markdown
# Topology Diff — <from> → <to>

## Added
- aws_lb.api (count: 1)
- aws_target_group.api-tg (count: 1)

## Removed
(none)

## Mutated (in-place)
- aws_db_instance.main: instance_class 'db.t3.medium' → 'db.t3.large'
- kubernetes_deployment.api: replicas 3 → 5

## Drift detected (in live but NOT in IaC)
- aws_security_group_rule.manual-ssh (UNTRACKED — investigate before next apply)
```

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Snapshot tool detected | Stack-profile declares IaC tool; snapshot command resolved | |
| 2 | Snapshot written | `state.json` exists and is valid JSON | |
| 3 | Diff produced | If prior baseline exists, `diff-*.md` is non-empty for any change | |
| 4 | Drift flagged | Resources in live state but absent from IaC are listed under "Drift detected" | |
| 5 | Snapshot is structural | Diff compares object trees, not byte-for-byte (timestamps, ARNs ignored where appropriate) | |

## Phase Receipt Contract

When running with `.svc/lane-tasks-<WI>.json`, emit one phase receipt after
each required phase:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-StackProfileAndToolResolution --evidence file:docs/specs/stack-profile.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-LiveSnapshotCapture --evidence command_output:.svc/track-topology-diff-snapshot-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SnapshotNormalizeAndWrite --evidence file:docs/specs/topology-snapshots/<iso-ts>/state.json --evidence file:docs/specs/topology-snapshots/<iso-ts>/summary.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-PriorBaselineSelection --evidence command_output:.svc/track-topology-diff-baseline-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-StructuralDiffAndDriftFlagging --evidence file:docs/specs/topology-snapshots/diff-<from-ts>-<to-ts>.md
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-DecisionLogAndContinuation --evidence file:.svc/pipeline-decisions.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-SelfVerifyContinuation --evidence command_output:.svc/track-topology-diff-self-verify-<WI>.log
```

If local tools are missing or unauthenticated, record
`P2-LiveSnapshotCapture` with the command output and leave the task blocked or
skipped per the lane's verification policy. For the first topology snapshot,
record `P4-PriorBaselineSelection` with a first-baseline note and still write
`summary.md`; only omit `diff-*.md` when no prior baseline exists.

## Pipeline Continuation

### Task-graph mode (when a task graph exists — source of truth: `.svc/lane-tasks-<WI>.json`; Claude mirror: `TaskList`; Kimi observation: `/task` + `TaskList`/`TaskOutput`; Codex mirror: `update_plan`)

- Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume — Claude mirrors with `TaskList` / `TaskUpdate`; Kimi observes via `/task` + `TaskList`/`TaskOutput`; Codex and other hosts without native task-mutation APIs mirror only the active step in `update_plan`.
- Mark this skill's task `completed` in lane-tasks.json after writing the snapshot.
- If drift is detected (resources in live but not in IaC), append a `taste` entry to `.svc/pipeline-decisions.jsonl` flagging the drift for next-session attention; do NOT auto-block the lane (drift may be intentional).
- Update host-specific mirror.

## Limitations

- Snapshot tools must be locally available and authenticated (e.g., `aws` CLI for terraform, `kubectl` for k8s).
- Cross-cloud snapshots (e.g., AWS + GCP in one repo) require running snapshot per cloud; this skill iterates the providers declared in stack-profile.
