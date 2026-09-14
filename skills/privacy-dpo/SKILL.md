---
name: privacy-dpo
version: "1.0"
description: >-
  Privacy review. Use when: "privacy review", "personal data", "DPIA", "retention policy". Not general security or legal advice.
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

**Announce at start:** "I'm using privacy-dpo to map personal-data risk and propose a bounded privacy decision."

# Privacy DPO

Resolve and recall `privacy-dpo`. Map data subject, fields, purpose, source, processor, storage, access, transfer, retention, deletion, and rights path. Supply privacy Immune Mesh review only independently. Minimize data in output. Never delete/export user data, change consent, contact subjects, or claim legal advice.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Map the actual data flow. 2. Identify necessity and minimization gaps. 3. Assess retention/rights/control evidence. 4. Propose remediation or professional review. 5. Run `preflight`.

## Red Flags

Stop on unknown data location, raw personal-data copying, self-review, silent purpose expansion, or live data mutation.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Data flow is complete | Trace source to deletion | |
| 2 | Output minimizes personal data | Inspect artifacts | |
| 3 | Review is independent | Compare roles | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only its exact task/evidence in `.svc/lane-tasks-<WI>.json`.
