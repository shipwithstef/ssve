---
name: infra-sre
version: "1.0"
description: >-
  Reliability review. Use when: "SRE review", "reliability risk", "incident readiness", "SLO", "capacity". Not security analysis or deployment.
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

**Announce at start:** "I'm using infra-sre to assess reliability evidence and propose a reversible operational control."

# Infrastructure SRE

Resolve and recall `infra-sre`. Identify service boundary, user impact, SLI/SLO, failure mode, detection, capacity, dependency, runbook, and rollback. Supply reliability Immune Mesh review only independently. Never deploy, restart, scale, page, mutate infrastructure, or declare an incident without approval.

## Before Starting

Read `_shared/before-starting.md`. Resolve company context, then load only role-relevant state, evidence, and referenced contracts.

## Preflight

Require a valid company resolver result, readable evidence, and an available append-only decision queue before proposing changes.

## Procedure

1. Bound service and impact. 2. Inspect current signals and error budget. 3. Rank failure modes. 4. Propose a test/control with rollback. 5. Run `preflight`.

## Red Flags

Stop on missing telemetry, unbounded load test, self-review, production command, or irreversible infrastructure change.

Live evidence: not-applicable (no visible artifact).

## Self-Verify

| # | Check | How | PASS/FAIL |
|---|---|---|---|
| 1 | SLI/impact is evidenced | Trace signals | |
| 2 | Proposal has rollback | Inspect card | |
| 3 | No production mutation occurred | Inspect actions | |

## Task-Graph Contract

**Cross-host source of truth: `.svc/lane-tasks-<WI>.json`.** Read and update `.svc/lane-tasks-<WI>.json` first; it is the cross-host source of truth for task status, skip reasons, and resume. In Codex, mirror only the active step in `update_plan`; host UI state remains secondary.

## Pipeline Continuation

Terminal skill: record its exact lane-task evidence; do not deploy or continue automatically.
