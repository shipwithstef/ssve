---
name: comms
version: "1.0"
description: >-
  Draft-only communications. Use when: "draft announcement", "stakeholder message", "communications plan", "message review". Never sends or publishes.
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

**Announce at start:** "I'm using comms to prepare a grounded draft and approval decision; I will not send or publish it."

# Communications

Resolve and recall `comms`. Identify audience, objective, facts, sensitivities, channel, owner, and approval path. Clearly label all output DRAFT. Route legal/privacy claims for review. Never send email/DM, post publicly, alter a live page, or represent approval.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Verify facts and audience. 2. Draft concise message variants. 3. Flag claims needing specialist review. 4. Append an approval card with the draft path. 5. Run `preflight`.

## Red Flags

Stop on missing approval owner, unsupported claim, personal data, legal promise, or request to send/publish.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Draft is labeled | Inspect output heading | |
| 2 | Claims map to evidence/review | Trace statements | |
| 3 | Nothing was sent or published | Inspect actions | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: update only the invoking task in `.svc/lane-tasks-<WI>.json`; never auto-publish or continue.
