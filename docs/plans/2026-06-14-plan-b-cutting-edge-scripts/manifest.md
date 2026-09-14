# Changeset Manifest — Plan B cutting-edge techniques (script batch 1)

**Status:** DRAFTED
**Lane:** framework (svc-on-svc) · **Archetype:** Bounded feature · **Execution mode:** inline (orchestrator applies with context loaded → §3a Changeset Blueprint skipped per WI-386)
**Design basis (spec):** `plans/2026-06-11-cutting-edge-techniques-deep-dive.md` (reviewed + enriched; technique definitions = ACs). Upstream design phases skipped-with-reason in `.svc/lane-tasks-WI-MIMO-B1.json` (trivial CLI scripts, no UX/UI/arch).
**Branch:** plans/mimo-review-enrichment · **Base SHA:** 343351ff39efab387384cde2c9d6f899fb7c0229 · **Date:** 2026-06-14
**WI:** WI-MIMO-B1 · **Scope this batch:** local commits only (push/land deferred — needs full envelope + cross-model review, user-gated)

## Implementation Summary
Add 5 standalone, host-agnostic, additive CLI scripts implementing the genuinely-functional, no-subagent, no-external-spend cutting-edge techniques. Each reads existing `.svc/*` logs or static templates and writes a derived/append artifact. No skill/hook wiring in this batch (follow-on). Invariants: append-only logs respected; new `.svc/*` outputs gitignored; node builtins only; lint + tier-1 stay green.

## Files Planned
| # | File | Op | Technique |
|---|------|----|-----------|
| 1 | scripts/write-auto-grade.mjs | CREATE (written) | PR1/PR2 auto-grades writer |
| 2 | scripts/mine-trajectory-patterns.mjs | CREATE (written) | T2 experience replay |
| 3 | scripts/assess-temperature.mjs | CREATE | T10 adaptive temperature (pre-flight) |
| 4 | scripts/self-play.mjs | CREATE | T7 concern-mapped edge cases |
| 5 | scripts/htn-decompose.mjs | CREATE | T3 hierarchical decomposition |

## Task Graph
- task-1: write-auto-grade.mjs — smoke run appends valid grade; rejects bad enum. (done)
- task-2: mine-trajectory-patterns.mjs — mines existing logs → trajectory-patterns.json. (done)
- task-3: assess-temperature.mjs — reads auto-grades + decisions, outputs explore/exploit recommendation.
- task-4: self-play.mjs — maps concern domains → edge-case templates for a feature path.
- task-5: htn-decompose.mjs — phase tree + precondition/postcondition validation.
- task-6: validation — smoke-run each + `lint-skills-manifest.mjs` + full tier-1 GREEN.

## AC-to-Task (ACs = technique definitions)
AC-T-PR→task-1 · AC-T2→task-2 · AC-T10→task-3 · AC-T7→task-4 · AC-T3→task-5 · all→task-6.

## AC-to-Test
Each AC: **Manual/smoke** (node CLI run, assert output shape) + **tier-1** (lint + suite green). No unit harness for one-off scripts; smoke + tier-1 is the floor.

## External State
| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | local `.svc/` files | derived outputs `.svc/auto-grades.jsonl`, `.svc/trajectory-patterns.json` | coupled | gitignored in this batch; regenerable; no remote/shared state |

Untouched (walked taxonomy): no network, DB, deploy target, host config, credentials, remote, CI, package registry — pure local read/append scripts.

## Validation Plan
1. `node scripts/<each>.mjs <args>` → valid JSON / expected shape (smoke).
2. `node scripts/lint-skills-manifest.mjs` → PASS.
3. `rm -f .svc/loop-guard-state*.json && bash test-framework/evals/run-all-evals.sh --tier1` → 223/0.

## Risk / Rollback
LOW — additive new files, no existing-file edits, no chain/hook behavior change. Rollback = `git rm` each script (every commit revertible).

## Simulation Report
task-1/2 CREATE targets exist on disk (written + smoke-tested), no collision. task-3/4/5 targets do not exist (verified). Imports = node builtins only. No package.json deps. No route conflicts (CLI). All-PASS.
