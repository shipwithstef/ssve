---
name: retire-cloud-resources
version: "1.0"
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
  - { id: P1-ContextAndAllowList, required_for_completion: true, evidence: "exact allow-list and ownership proof loaded" }
  - { id: P2-ProtectedBaseline, required_for_completion: true, evidence: "protected values hashed before any deletion" }
  - { id: P3-SoakWindow, required_for_completion: true, evidence: "every soak slot including the final slot passed and every old app has each metric hour" }
  - { id: P4-ReferenceScan, required_for_completion: true, evidence: "reference reads succeeded and any hit aborted the run" }
  - { id: P5-DryRunAndAdversarial, required_for_completion: true, evidence: "live dry run and four doctored fail-closed cases recorded" }
  - { id: P6-ApprovalBackupSchedule, required_for_completion: true, evidence: "human approval and config backup recorded before any timer" }
  - { id: P7-DeleteVerifySmoke, required_for_completion: true, evidence: "targets proven gone protected hashes unchanged and new stack smoked" }
  - { id: P8-SelfVerifyContinuation, required_for_completion: true, evidence: "self-verify recorded and the report written" }
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
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---

**Announce at start:** "I'm using retire-cloud-resources to gate permanent deletion of old cloud resources."

# Retire Cloud Resources

Fail-closed gate for deleting an old cloud estate after the new one has soaked. Default is dry run. Apply deletes only exact allow-list ids, and only after the gates in `references/runbook.md` pass.

Live evidence: not-applicable (no visible artifact).

The gate skeleton is `references/deletion-gate.py`. Adapt the provider calls. Keep the control flow.

## Before Starting

Build a bounded context plan:

- Start from the user request, the active WI, and `docs/plans/` for this cutover.
- Query with `scripts/query-spec-index.mjs --wi <WI>` or `--surface <term>` for the cutover plan, the blast-radius report when `plan-blast-radius` already classified the destroy, and the stack profile when it names the provider.
- Load the allow-list, the protected list, and the soak log. Stop when the next file is an unrelated spec.

Skip if: the old resources are still serving, or the user is choosing a provider, estimating cost, or asking whether a plan is safe to apply. Those are `infra-sre`, `manage-finops`, and `plan-blast-radius`.

## Preflight

Stop before any delete call unless all of these are true:

- The cutover plan names the new stack and the old estate.
- The allow-list is non-empty, each entry has an exact resource id and an ownership proof, and it does not intersect the protected list.
- Protected values were hashed into a mode-0600 file outside the worktree.
- The soak window has ended, or this invocation is a dry run that records `--ignore-window` and refuses apply.
- A frozen pre-cutover inventory, when the cutover plan has one, still matches a fresh read. Drift aborts.
- Cloud credentials are for this project. A failed `account show` or equivalent aborts.

## Procedure

Work the phases in order. Details, the report schema, and neutral Azure and Cloudflare examples are in `references/runbook.md`.

1. **Inventory, default deny.** Build the delete set from the allow-list only. Ids that are neither allow-listed nor protected are `keep_unknown`. Unknown means keep.
2. **Hash the protected list** before any mutation. Publish equality and changed names later, not values.
3. **Soak.** Every probe slot whose interval has elapsed must pass, including the final slot. Every old app needs a passing metric sample each hour. One quiet app does not cover another.
4. **Reference scan.** Read app settings, container apps, function apps, key-vault references, DNS, CI secrets, and IaC. A non-zero read, a null payload, or an auth or throttle error aborts. Null is not an empty list. A parent group is empty only when that list succeeded and is empty. Repeat the scan before each delete.
5. **Dry run, then adversarial cases.** Dry-run against live data. Then run the template's doctored cases (final-slot gap, missing metric hour, errored reference read, ambiguous lookup) and keep the log.
6. **Approval, backup, timer.** Record human approval (who, when, allow-list sha256) and export configuration and templates before scheduling. The job runs under a lock with an append-only log.
7. **Delete and prove.** Delete allow-list ids in dependency order. Gone means an explicit not-found signal. Lingering managed or child groups are errors. Smoke the new stack. Re-hash protected values. A smoke failure still runs the protected comparison, then exits non-zero.
8. **Report and deferrals.** Write `retirement-report.json` on every exit, including failures. Commit it when it is free of secret values. Track delayed targets, such as old staging auth for about 30 days or a redirect host that dependents still use, in `deferred-deletions.md`.

## Rationalization

| Thought | Reality |
|---|---|
| "The list call failed, so nothing references this." | A failed read is an unknown. Unknown means keep, and the run aborts. |
| "The last ten minutes are inside the window we already checked." | The final slot is a real slot. Skipping it is how a gap hides. |
| "App A had zero traffic, so the old estate is idle." | Every old app needs its own hour. One quiet app proves nothing about the other. |
| "The CLI returned non-zero, so the resource is gone." | Gone requires `ResourceNotFound` or `could not be found`. Auth, throttle, and null are not gone. |
| "The managed group will disappear later." | A child group still present after the wait is an error. Exit non-zero. |
| "Dry run passed yesterday." | Re-run the dry run and the four doctored cases on this allow-list before apply. |
| "We can schedule it and approve in the morning." | Approval is recorded before the timer exists. No approval, no schedule. |
| "The redirect host is unused if the new site works." | A redirect host stays until dependents have moved. That delete is its own decision. |

## Red Flags

- An allow-list entry is a name, a prefix, or a whole subscription → replace it with exact ids that have ownership proof.
- A protected hash is missing, or a protected value was printed → stop, hash again, and keep values out of the report.
- Apply is combined with `--ignore-window` → refuse. Window skips are dry-run only.
- The process exits without a report file → the trap failed. Fix that before any provider call.
- The report's `errors` is non-empty and the exit code is 0 → treat the run as failed.
- A deferred target was deleted in the main pass → restore from the backup if possible, and record the miss.
- Secret values, tokens, or private hostnames landed in the committed report → remove them and rotate anything that was exposed.

## Overlap

| Skill | What it owns |
|---|---|
| `plan-blast-radius` | SEV class of a plan before apply. A SEV-1 destroy is an input here when an IaC plan exists. |
| `plan-changeset` | Migration / sweep owns a codebase rename or token sweep. This gate does not grep or rewrite source. |
| `onboard-repo` | Adopts an existing repo into svc. It does not delete cloud resources. |
| `infra-sre` | SLO, capacity, and incident readiness. It stops before production mutation. |
| `security-ops` | Threats and controls. It does not delete estates. |
| `manage-finops` | Cost and provider choice. |
| `verify-promotion` | Promoted code matches its spec and journeys (G7). |
| `retire-cloud-resources` | Permanent deletion of the old cloud estate after soak. |

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|-------|-----|-----------|
| 1 | Delete set is the allow-list, and unknowns were kept | Compare the report plan with the allow-list and `keep_unknown` | |
| 2 | Protected hashes exist from before the run and match afterward | Diff the mode-0600 hash file with the report `protected` object | |
| 3 | Soak includes the final slot and every old app's hours | Read `slotsChecked`, `missing`, and `metricHours` against the window | |
| 4 | Failed reads and ambiguous lookups aborted | Confirm errored reference scans and non-not-found lookups are in `errors` | |
| 5 | Dry run and four adversarial cases failed closed where they should | `python3 skills/retire-cloud-resources/references/deletion-gate.py` exits 0, and the live dry-run report has `mode: dry-run` | |
| 6 | Approval, backup, smoke, and deferred list are recorded before the task closes | Report contains approval sha256, backup path, smoke result, and deferred review dates | |

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
node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> P8-SelfVerifyContinuation --evidence command_output:.svc/retire-cloud-resources-self-verify-<WI>.log
```

A failed gate still records the phase that blocked, with the report path, and leaves the task incomplete. Do not mark later phases complete.

## Pipeline Continuation

This skill is terminal. It does not sit in a lane and it does not auto-invoke a next skill.

`plan-blast-radius` feeds it when the retirement was an IaC destroy: consume that SEV-1 or SEV-2 checkpoint, then run this gate after the new stack has soaked. A cutover that was not an IaC plan still starts here once the operator asks to delete the old estate. A codebase rename or token sweep stays in `plan-changeset` Migration / sweep. `onboard-repo` maps a repo. Neither deletes cloud resources.

When `.svc/lane-tasks-<WI>.json` exists, mark this task completed only after the report is written and Self-Verify has a real PASS or a recorded blocker. Deferred targets stay open in `deferred-deletions.md` and need a later explicit run of this same skill. `verify-promotion` remains the G7 check that promoted code matches its spec. It does not prove cloud resources are gone.

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`.
