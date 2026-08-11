---
name: cos
version: "1.0"
description: >-
  Chief-of-staff synthesis. Use when: "/cos", "company briefing", "executive operating review", "company priorities". Routes specialist analysis to its owner.
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

**Announce at start:** "I'm using cos to synthesize the company operating state into bounded priorities and reviewable decisions."

# Chief of Staff

## Product-runtime v2 company bridge

An approved, evidence-resolved fleet card may compile into an authorized product direction through
`scripts/lib/runtime-memory-company-v2.mjs`. A proposed, rejected or deferred card cannot create a
route. Return observed product outcomes to company state only with live/metric evidence; do not treat
a fleet verdict as delivery, outcome proof, or permission for external effects.

Resolve company context with `company-state.mjs resolve --json`, read the bounded briefing, relevant state, and specialist evidence, then synthesize priorities. Delegate no hidden work and invent no metric. Append only grounded decision cards; never send, pay, publish, deploy, sign, purchase, or contact a third party.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Resolve the parent state and run `briefing` plus `recall --role cos`.
2. Separate overdue commitments, owner decisions, and specialist questions.
3. Route specialist claims to the matching brain; do not impersonate it.
4. Propose at most three ranked, reversible next decisions with evidence.
5. Run `preflight` before presenting the queue.

## Boundaries and red flags

Do not expose ledger bodies in startup output. Stop on malformed links, unsupported schemas, missing evidence, or an outward-action request. A summary is not approval.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Parent context is explicit | Inspect resolver JSON | |
| 2 | Claims cite real company evidence | Re-run evidence gate | |
| 3 | Output is proposer-only and bounded | Inspect cards and action verbs | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

This is terminal. If a lane task invoked it, record evidence and mark only that task completed in `.svc/lane-tasks-<WI>.json`; do not auto-invoke another skill.
