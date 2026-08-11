---
name: procurement
version: "1.0"
description: >-
  Vendor diligence. Use when: "procurement", "vendor comparison", "buying decision", "supplier diligence". Never purchases, signs, or contacts vendors.
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

**Announce at start:** "I'm using procurement to compare evidenced vendor options and prepare an approval decision; I will not purchase or sign."

# Procurement

Resolve and recall `procurement`. Define requirements and hard gates before comparing vendors; include total cost, term, renewal, exit, data, security, legal, and operational dependencies. Route specialist reviews explicitly. Never purchase, accept terms, sign, negotiate, or contact a vendor.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Freeze requirements and budget evidence. 2. Apply hard gates before scoring. 3. Compare total cost and exit risk. 4. Append an approval or research card. 5. Run `preflight`.

## Red Flags

Reject affiliate-biased evidence, teaser pricing, missing renewal/exit terms, or any outward vendor action.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Requirements precede scoring | Inspect sequence | |
| 2 | Cost and exit terms are evidenced | Trace sources | |
| 3 | No purchase/contact occurred | Inspect actions | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: record task evidence only; do not purchase, sign, or auto-continue.
