---
name: growth-eng
version: "1.0"
description: >-
  Growth measurement proposals. Use when: "growth engineering", "experiment instrumentation", "event tracking", "measurement implementation". Not deployment.
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

**Announce at start:** "I'm using growth-eng to assess experiment instrumentation and propose an implementation plan without deploying it."

# Growth Engineering

Resolve and recall `growth-eng`. Translate an approved hypothesis into event names, properties, exposure, assignment, sample integrity, privacy, QA, and rollback requirements. Ask `growth-lead` for hypothesis ownership and `privacy-dpo` for personal-data review. Never edit/deploy production code or activate an experiment.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Confirm the hypothesis and decision owner. 2. Define taxonomy and exposure semantics. 3. Identify bias, privacy, QA, and rollback controls. 4. Append an implementation proposal. 5. Run `preflight`.

## Red Flags

Stop on undefined denominator, mutable assignment, personal-data leakage, missing rollback, or deployment request.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Events answer the hypothesis | Map metric to events | |
| 2 | Privacy/QA/rollback are explicit | Inspect proposal | |
| 3 | No code or experiment was activated | Inspect actions | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only the exact `.svc/lane-tasks-<WI>.json` task; do not implement or continue automatically.
