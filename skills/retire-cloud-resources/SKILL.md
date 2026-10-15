---
name: retire-cloud-resources
version: "1.1"
created: "2026-10-15"
description: >-
  Permanently delete old cloud resources after a cutover has soaked, and only
  through an exact allow-list that fails closed. Use when: "delete the old
  resources", "clean up after migration", "decommission the old stack", or the
  new stack has soaked and the old estate must go. Not for: routine scaling or
  resources still serving (infra-sre), threat review (security-ops), cost and
  provider choice (manage-finops), classifying a plan before apply
  (plan-blast-radius), proving a merged branch matches its spec
  (verify-promotion), a codebase rename or token sweep (plan-changeset), or
  adopting a repo (onboard-repo).
phases:
  - { id: P1-ContextAndAllowList, required_for_completion: true, evidence: "restricted allow-list loaded; committed copy is alias and sha256 only" }
  - { id: P2-ProtectedBaseline, required_for_completion: true, evidence: "protected values hashed before any deletion" }
  - { id: P3-SoakWindow, required_for_completion: true, evidence: "Phase 5 soak consumed; anchored intervals, probe matrix, and drain passed" }
  - { id: P4-ReferenceScan, required_for_completion: true, evidence: "reference reads succeeded and any hit aborted the run" }
  - { id: P5-DryRunAndAdversarial, required_for_completion: true, evidence: "live dry run and deletion-gate.py adversarial cases failed closed" }
  - { id: P6-ApprovalBackupSchedule, required_for_completion: true, evidence: "human approval digest matched the current allow-list before schedule" }
  - { id: P7-DeleteVerifySmoke, required_for_completion: true, evidence: "targets proven gone for the exact id, protected hashes unchanged, new stack smoked" }
  - { id: P8-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify passed and decommission-receipt.md links the sanitized report" }
inputs:
  required:
    - { path: "docs/plans/", artifact: cutover-plan }
  optional:
    - { path: "docs/specs/features/", artifact: blast-radius-report }
    - { path: "docs/specs/stack-profile.md", artifact: stack-profile }
outputs:
  produces:
    - { path: "docs/plans/<cutover>/retirement-report.json", artifact: retirement-report }
    - { path: "docs/plans/<cutover>/deferred-deletions.md", artifact: deferred-deletions }
    - { path: "docs/specs/migrations/<slug>/decommission-receipt.md", artifact: decommission-receipt }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---

**Announce at start:** "I'm using retire-cloud-resources to gate permanent deletion of old cloud resources."

# Retire Cloud Resources

Executor for Lane 10 Phase 20+ in `skills/route-workflow/references/lane-model.md` and Phase 6 of `skills/design-ui/templates/infra-cutover-runbook.md`. This skill does not define a second migration workflow.

Consume Phase 5 soak evidence from that cutover template. Additional deletion guards, and only those, are in `references/runbook.md`. Control flow for the guards is `references/deletion-gate.py`. Provider calls stay outside that file.

Live evidence: not-applicable (no visible artifact).

The agent does not approve, spend, contact people, publish, or apply. Apply waits for a recorded human approval.

## Before Starting

Build a bounded context plan:

- Start from the user request, the active WI, and `docs/plans/` for this cutover.
- Query with `scripts/query-spec-index.mjs --wi <WI>` or `--surface <term>` for the cutover plan, the blast-radius report when `plan-blast-radius` already classified the destroy, and the stack profile when it names the provider.
- Load the allow-list, the protected list, and the Phase 5 soak log. Stop when the next file is an unrelated spec.

Skip when the request belongs to another skill named in the description above.

## Procedure

Work `references/runbook.md` in order. Record each phase below before leaving it.

1. Load the restricted allow-list and hash the protected list.
2. Consume the Phase 5 soak record. Run the additional probe, metric, and drain guards.
3. Scan references. Dry-run live inventory, then run `python3 skills/retire-cloud-resources/references/deletion-gate.py` and require exit 0.
4. Compare the approval digest with the current allow-list before scheduling, and again before apply. Export the backup first.
5. After the recorded approval, prove each target gone, re-check protected hashes, and smoke the new stack.
6. Write the sanitized `retirement-report.json` on every exit. Write `docs/specs/migrations/<slug>/decommission-receipt.md` linking that report. Exact ids stay in the mode-0600 artifact outside git.

## Rationalization

| Thought | Reality |
|---|---|
| "The list call failed, so nothing references this." | A failed read is an unknown. Unknown means keep, and the run aborts. |
| "The last interval is inside a window we already checked." | Anchored intervals include the final elapsed probe slot and the final metric interval. |
| "The old app is healthy, so it is idle." | Healthy and still serving is not drained. Unknown metric coverage blocks deletion. |
| "The CLI returned non-zero, so the resource is gone." | Gone requires a structured error whose not-found code is bound to that exact resource id. Standalone text, and dependency or account errors, are not gone. |
| "A failed soak gate can be ignored if `errors` was empty." | Every required gate for the mode must pass, or the exit is non-zero. |
| "We can schedule it and approve in the morning." | The approver, the human approval, and a matching digest are recorded before the timer exists. Apply recomputes the digest. |
| "Commit the resource ids so the receipt is auditable." | Committed artifacts store aliases, hashes, and gate outcomes. |

## Red Flags

- An allow-list entry committed to git is a full resource id → stop. Keep the exact id in the restricted artifact.
- Apply is combined with `--ignore-window` → refuse. Window skips are dry-run only.
- `gates` marks a required gate failed or omits it, and the process exits 0 → treat the run as failed.
- The report path was not written, or a timestamp crashed serialization → the exit stays non-zero. Fix that before any provider call.
- A blocker is used as a reason to mark the task completed → leave the task blocked or incomplete.

## Overlap

Do not restate these skills. Route there instead: `plan-blast-radius`, `plan-changeset`, `onboard-repo`, `infra-sre`, `security-ops`, `manage-finops`, `verify-promotion`.

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Committed allow-list and receipt have aliases and hashes only | Read the committed files and confirm no provider resource id | |
| 2 | Phase 5 soak was consumed and the extra guards passed | Report shows anchored intervals, a non-empty probe matrix, and drain evidence | |
| 3 | Not-found is a structured code for the exact id | The error object binds ResourceNotFound, NotFound, or 404 to that resource id. Standalone text and dependency or account errors are rejects. Required gates passed. | |
| 4 | Approval digest matched before schedule and again before apply | Compare `allowListSha256` with the digest of the current allow-list at both points | |
| 5 | Adversarial template fails closed | `python3 skills/retire-cloud-resources/references/deletion-gate.py` exits 0 | |
| 6 | Receipt links the sanitized report | `docs/specs/migrations/<slug>/decommission-receipt.md` names the report path and Self-Verify is PASS | |

## Phase Receipt Contract

When `.svc/lane-tasks-<WI>.json` has this task, record each phase before completion:

```bash
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P1-ContextAndAllowList --evidence file:docs/plans/<cutover>/allow-list.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P2-ProtectedBaseline --evidence command_output:.svc/retire-cloud-resources-protected-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P3-SoakWindow --evidence file:docs/plans/<cutover>/soak.jsonl
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P4-ReferenceScan --evidence command_output:.svc/retire-cloud-resources-refs-<WI>.log
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P5-DryRunAndAdversarial --evidence file:docs/plans/<cutover>/retirement-report.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P6-ApprovalBackupSchedule --evidence file:docs/plans/<cutover>/approval.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P7-DeleteVerifySmoke --evidence file:docs/plans/<cutover>/retirement-report.json
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence file:docs/specs/migrations/<slug>/decommission-receipt.md
```

A failed gate still records the phase that blocked, with the report path, and leaves the task incomplete. Do not mark later phases complete.

## Pipeline Continuation

This skill is terminal. It executes Lane 10 Phase 20+ and cutover Phase 6. It does not auto-invoke a next skill.

Mark this task completed only after every mandatory phase has a receipt and Self-Verify is PASS. A blocker stays with the task blocked or incomplete. Deferred targets stay open in `deferred-deletions.md` until a later explicit run of this same skill.

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`.
