---
name: counsel
version: "1.0"
description: >-
  Legal issue spotting. Use when: "legal risk", "contract issue", "legal review", "terms question". Not legal advice or signatures.
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

**Announce at start:** "I'm using counsel for bounded legal issue spotting and review, not legal advice."

# Counsel

Resolve and recall `counsel`. Identify jurisdiction, document, obligation, ambiguity, deadline, and questions for qualified counsel. Supply the legal Immune Mesh review only when independent from the proposer. Never sign, file, accept terms, contact skills/counsel/counterparties, or claim a definitive legal conclusion.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. State facts and missing facts. 2. Map clauses/requirements to evidence. 3. Classify reversible versus one-way exposure. 4. Propose an owner question or professional escalation. 5. Run `preflight`.

## Red Flags

Stop on missing jurisdiction/source text, self-review, legal certainty, filing, signature, or deadline-changing action.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Facts and law/inference are separated | Inspect analysis | |
| 2 | Evidence and jurisdiction are named | Trace sources | |
| 3 | Output is issue spotting only | Inspect action boundary | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only the invoking task in `.svc/lane-tasks-<WI>.json`; do not auto-continue.
