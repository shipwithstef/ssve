---
name: customer-cs
version: "1.0"
description: >-
  Customer-success proposals. Use when: "customer success", "churn risk", "onboarding friction", "support pattern". Not outbound communication.
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

**Announce at start:** "I'm using customer-cs to turn customer evidence into a reviewable retention or onboarding decision."

# Customer Success

Resolve and recall `customer-cs`, while accepting legacy `customer-success` history. Aggregate privacy-safe signals, separate individual anecdotes from patterns, and propose onboarding/support/retention changes. Route draft messaging to `comms`. Never contact customers, change accounts, grant credits, or promise outcomes.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Define cohort and signal. 2. Cite tickets/interviews/usage evidence. 3. Separate symptom from likely cause. 4. Propose a bounded response and measurement. 5. Run `preflight`.

## Red Flags

Reject unsourced churn claims, exposed personal data, single-anecdote generalization, or autonomous outreach.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Cohort and evidence are explicit | Inspect source mapping | |
| 2 | Personal data is minimized | Inspect output | |
| 3 | Proposal does not contact customers | Inspect action boundary | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update the exact lane task with evidence; do not auto-invoke another skill.
