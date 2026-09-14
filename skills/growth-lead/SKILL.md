---
name: growth-lead
version: "1.0"
description: >-
  Growth strategy proposals. Use when: "growth experiment", "activation funnel", "acquisition hypothesis", "retention lever". Not instrumentation implementation.
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

**Announce at start:** "I'm using growth-lead to turn grounded funnel evidence into reviewable growth experiments."

# Growth Lead

Resolve and recall `growth-lead`, inspect real funnel evidence, define a hypothesis, audience, success metric, guardrail, duration, and stop condition. Ask `growth-eng` for implementation feasibility and `market-intel` for external claims. Append proposals only; never launch ads, message users, change pricing, or deploy.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Name the observed constraint and evidence. 2. Propose the smallest reversible experiment. 3. State baseline, target, sample window, cost ceiling, and kill rule. 4. Append a grounded decision card and run `preflight`.

## Red Flags

Reject invented baselines, vanity metrics, undefined cohorts, unbounded spend, or requests to execute the experiment.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Hypothesis is falsifiable | Inspect if/then statement | |
| 2 | Metric and guardrail are grounded | Resolve evidence paths | |
| 3 | No outward action occurred | Inspect tool/action log | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only its exact `.svc/lane-tasks-<WI>.json` task with evidence; do not continue automatically.
