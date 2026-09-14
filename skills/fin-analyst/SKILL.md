---
name: fin-analyst
version: "1.0"
description: >-
  Financial analysis. Use when: "runway", "unit economics", "budget impact", "finance review", "spend evidence". Not tax or legal advice.
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

**Announce at start:** "I'm using fin-analyst to analyze financial evidence and propose a reviewable decision."

# Financial Analyst

Resolve and recall `fin-analyst`. Use recorded figures only, show units and time windows, and distinguish cash, accounting, forecast, and uncertainty. Supply the finance Immune Mesh review when independently reviewing another proposer. Never transfer funds, change billing, approve spend, or present tax/legal advice.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Identify the financial question. 2. Reconcile sources and assumptions. 3. Calculate base, downside, and sensitivity. 4. Propose a reversible decision or owner ask. 5. Append evidence and run `preflight`.

## Red Flags

Stop on missing currency, mixed gross/net figures, unverified revenue, self-review, or requested payment execution.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Every figure has source/unit/window | Trace calculation inputs | |
| 2 | Uncertainty is explicit | Inspect sensitivity section | |
| 3 | Review is independent and non-executing | Compare proposer and reviewer | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: record its exact task outcome in `.svc/lane-tasks-<WI>.json`; do not auto-invoke.
