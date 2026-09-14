# Autorun Contract

This document defines the contract that route-workflow's autorun mode must satisfy. It is the single source of truth referenced by `validate-autorun-skeleton.sh` (tier-1 static check) and the future tier-1.5 fixture replay.

## Principles

1. **Artifact identity.** An autorun must produce identical artifacts (lane-tasks JSON, plan manifest, decision log entries, WI doc) to an interactive run for the same input — modulo human-checkpoint pauses.
2. **Human-checkpoint observability.** Every skipped human checkpoint must be logged in `.svc/pipeline-decisions.jsonl` with `autorun:true` and `human_checkpoint_skipped:<reason>`.
3. **Decision-log autorun tagging.** Every decision-log entry produced during an autorun MUST carry `autorun:true`. Interactive runs MUST NOT carry this field. This is the audit boundary.
4. **Same evaluation gates.** Autorun does not bypass eval-gate, lane-tasks-validator, skill-artifact-authenticity, or any other tier-1 hook. Autorun = same gates, no human pauses.

## Required behaviors in route-workflow

The orchestrator implementation in `route-workflow/SKILL.md` and `route-workflow/references/autorun-orchestrator.md` must document:

- **Lane selection** based on repo state, change type, and existing artifacts
- **Lane-tasks file creation** at `.svc/lane-tasks-<WI>.json`
- **Human-checkpoint policy** — when to pause vs auto-advance
- **Decision-log autorun:true tagging** — emitted on every autorun decision

## Tier-1.5 fixture replay (deferred)

A future WI will add a tier-1.5 fixture-replay test that:
1. Captures a real interactive run as a fixture (input prompt + expected artifact set)
2. Replays the same input via `SVC_AUTORUN=1` mode
3. Asserts artifact equivalence (excluding `autorun` field) and that all decision entries during replay carry `autorun:true`

Until tier-1.5 lands, the static validator `validate-autorun-skeleton.sh` enforces the contract by grepping route-workflow docs for the required mentions. This catches doc drift but does not catch behavioral drift.

## Why this matters

Autorun is a separate execution surface. If it diverges from interactive behavior silently, the determinism property of the framework breaks. Catching divergence at doc time (this contract) is cheap; catching it at runtime (fixture replay) is the rigorous check.
