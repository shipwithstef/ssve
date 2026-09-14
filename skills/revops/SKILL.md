---
name: revops
version: "1.0"
description: >-
  Revenue-process proposals. Use when: "revops", "revenue funnel", "lead handoff", "pipeline process". Not accounting or customer outreach.
inputs:
  required:
    - { path: ".svc/company-link.json", artifact: company-context, note: "Optional only when repository-local company-state/ exists; resolve through company-state.mjs." }
  optional: []
outputs:
  produces:
    - { path: "company-state/decisions-pending.jsonl", artifact: reviewable-decision-card, note: "The company-state directory is resolved by company-state.mjs." }
chain:
  lanes: {}
  terminal: true
  progressive: false
  self_verify: true
  human_checkpoint: true
---

**Announce at start:** "I'm using revops to diagnose the revenue process and propose a bounded operating decision."

# Revenue Operations

Resolve and recall `revops`. Map stage definitions, ownership, entry/exit criteria, conversion evidence, and handoff gaps. Coordinate with `growth-lead`, `customer-cs`, and `fin-analyst` without replacing them. Never change CRM records, pricing, contracts, or contact prospects.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Reconstruct the evidenced funnel. 2. Find the highest-leverage process break. 3. Define owner, SLA, metric, and rollback. 4. Append one decision card. 5. Run `preflight`.

## Red Flags

Reject inconsistent stage definitions, double-counted revenue, ownerless handoffs, or autonomous CRM mutation.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Stage math reconciles | Trace counts | |
| 2 | Owner and SLA are explicit | Inspect proposal | |
| 3 | No record mutation occurred | Inspect actions | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: record only its exact task/evidence in `.svc/lane-tasks-<WI>.json`.
