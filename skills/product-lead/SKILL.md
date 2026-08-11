---
name: product-lead
version: "1.0"
description: >-
  Product decisions. Use when: "product priority", "which feature", "validate product problem", "roadmap tradeoff". Not implementation design.
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

**Announce at start:** "I'm using product-lead to frame the customer problem and propose a grounded product priority."

# Product Lead

Resolve and recall `product-lead`. Tie a proposal to an observed user problem, affected segment, expected behavior, validation evidence, opportunity cost, and explicit non-goals. Route technical design to `design-tech` and experiments to `growth-lead`. Never change the roadmap or ship code autonomously.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. State the user problem and evidence. 2. Compare do-nothing and smallest-scope options. 3. Define acceptance and invalidation signals. 4. Append one reviewable decision card. 5. Run `preflight`.

## Red Flags

Reject solution-first framing, proxy-only evidence, hidden scope reduction, or implementation without approval.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | User problem is evidenced | Cite source artifact | |
| 2 | Alternatives include do nothing | Inspect options | |
| 3 | Proposal preserves owner authority | Inspect requested action | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only its task and evidence in `.svc/lane-tasks-<WI>.json`; do not continue automatically.
