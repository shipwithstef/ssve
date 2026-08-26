Derived-at: 3c79f6a8744d95f7516fac2bd8a7e292dc23685f
Restamped: 2026-08-26 — original Derived-at 01e7021b unreachable (post-squash artifact, absent from object store); all enumerated entry points/callers re-verified present at HEAD; WI-FW-SKILLS-ROUTING-01 added new surfaces (scripts/skill-router*, references/skill-routing-*, schemas/skill-router-decision.schema.json, test-framework skill-router fixtures) without altering any enumerated entry point or caller.
Scope-paths:
  - scripts/**
  - hooks/**
  - skills/**
  - schemas/**
  - references/**
  - provision/**
  - test-framework/**
  - docs/specs/**
  - proposals/**

## Entry points
- IN: `scripts/compile-delivery-graph.mjs:25` — mutable route graph creation.
- IN: `scripts/svc-ensure-worktree.mjs:1` — governed operation-worktree bootstrap and recovery.
- IN: `hooks/codex/svc-codex-pretool-dispatcher.mjs:1` — installed Codex mutation boundary.
- IN: `skills/plan-changeset/SKILL.md:1` — full-plan contract.

## Callers
- IN: `skills/route-workflow/SKILL.md:1` calls graph compilation and activation.
- IN: `skills/execute-changeset/SKILL.md:1` and `skills/dispatch-waves/SKILL.md:1` consume transport decisions.
- IN: `setup:1` installs changed framework surfaces across hosts.

## Auth
- IN: WI-502 controller v2 lease, delegation, containment, and generation rules remain authoritative.
- OUT: no generic host-agent flag grants mutation authority.

## State
- IN: `.svc/lane-tasks-WI-541.json:1`, session contract, authority v2 lease, receipt staging, learning fire/promotion ledgers.

## Currencies & counters
- IN: review rounds, plan streams, learning fires, hot-path p95, unsupported child launches, proposal numerator/denominator counts.

## Promises
- IN: no loss of quality/security, all unique sources dispositioned, no GitHub dependency, locally committed final state.

## Outcomes
- IN: final local SHA, clean full Tier 1, all-host install convergence, exact replay receipts.

## Data
- IN: receipt JSON schemas, reviewer policy, stage registry, learning JSONL, proposal triage JSON.

## Journeys & tests
- IN: focused graph, authority, hook, learning, task-atomicity, schema, triage, plan-safety fixtures plus full Tier 1.

## Time, retry & concurrency
- IN: three-round review cap, generation-bound recovery, crash-forward transitions, atomic task updates, pairwise-disjoint stream ownership.
