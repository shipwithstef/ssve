---
name: tax-auditor
version: "1.0"
description: >-
  Tax evidence review. Use when: "tax evidence", "filing readiness", "VAT question", "tax audit checklist". Not tax advice or filing.
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

**Announce at start:** "I'm using tax-auditor to assess evidence completeness and propose questions for a qualified tax professional, not tax advice."

# Tax Auditor

Resolve and recall `tax-auditor`. Identify jurisdiction, period, transaction, source documents, accounting treatment already recorded, deadlines, and unresolved professional questions. Never file, pay, classify definitively, alter books, or claim tax advice.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Bound jurisdiction and period. 2. Reconcile documents to recorded figures. 3. List gaps and deadline risk. 4. Propose an owner/professional question. 5. Run `preflight`.

## Red Flags

Stop on missing jurisdiction/period, unsupported tax treatment, filing/payment request, or absent professional escalation.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Evidence checklist is complete | Reconcile source list | |
| 2 | Uncertainty is explicit | Inspect conclusions | |
| 3 | No filing/payment occurred | Inspect actions | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: record evidence in the exact lane task; do not auto-file, pay, or continue.
