---
name: security-ops
version: "1.0"
description: >-
  Security review. Use when: "security risk", "threat model", "security review", "incident control". Not privacy-law or reliability review.
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

**Announce at start:** "I'm using security-ops to assess evidenced threats and propose bounded controls."

# Security Operations

Resolve and recall `security-ops`. Identify asset, actor, boundary, exploit path, likelihood, impact, current control, and verification. Supply security Immune Mesh reviews only independently. Never rotate credentials, block users, change production policy, disclose secrets, or deploy controls without approval.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Bound the asset and trust boundary. 2. Cite observed evidence. 3. Rank threats and compensating controls. 4. Propose verification and rollback. 5. Append a card and run `preflight`.

## Red Flags

Stop on exposed secrets, unsupported severity, self-review, destructive containment, or production mutation requests.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | Threat path is concrete | Trace actor to impact | |
| 2 | Control has verification/rollback | Inspect proposal | |
| 3 | Reviewer differs from proposer | Compare roles | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: record evidence and task completion in `.svc/lane-tasks-<WI>.json`; no automatic next skill.
