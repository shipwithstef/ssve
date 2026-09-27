Derived-at: 1a0822e6b9deb5a6caaed7cabe4645b9f1ca1cea
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
- IN: `hooks/codex/svc-codex-pretool-dispatcher.mjs:1` — installed Codex PreToolUse dispatcher; managed decisions follow hook mode.
- IN: `skills/plan-changeset/SKILL.md:1` — full-plan contract.

## Callers
- IN: `scripts/run-external-review.mjs:1` — governed review launcher.
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

## Current navigation revalidation
At 59d4428889de58b256868ae39dc1c6adb7cf1286, `scripts/svc-ensure-worktree.mjs:1` still owns governed bootstrap and recovery, using shared authority, binding, and task-graph validation. `hooks/codex/svc-codex-pretool-dispatcher.mjs:1` remains the installed Codex dispatcher; managed hook findings follow the selected hook mode, advisory by default. `scripts/compile-delivery-graph.mjs:1` remains the route-graph compiler, and `skills/route-workflow/SKILL.md:1` remains its workflow entry.

`scripts/run-external-review.mjs:1` is the governed review launcher. Its current direct dependencies include frozen request inputs, review inputs, and launch preflight. The launcher citation is explicit so its import shape is recorded rather than implied by prose.

## Historical WI-541 scope
The Promises, Outcomes, counters, and original program constraints above describe WI-541’s planned or recorded scope. They do not assert that this later WI has completed a phase chain, that the current candidate has review receipts, or that a current full-suite result follows from this index. Current release evidence belongs to the active WI and exact candidate.
