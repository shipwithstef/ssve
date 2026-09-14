# Changeset Manifest — WI-411 craft-prompt (lean: rubric + best-of-2 floor)

**Spec:** `docs/specs/work-items/WI-411.md`
**Branch:** `wi411-craft-prompt` (worktree, off main 6dd54de0)
**Base SHA:** 6dd54de0 (main, has WI-410 seams)
**Status:** DRAFTED → (review-plan) → SIMULATED → APPROVED
**Lane:** framework · **Size:** M · **Archetype:** Bounded feature (cross-cutting note)
**Execution mode:** `inline` (orchestrator executes; §3a blueprints skipped per WI-386)
**Date:** 2026-06-22

## 1. Implementation Summary
Ship `craft-prompt` v1 = authoring rubric (DONE in create-skill) + a **best-of-2 floor** that proves a crafted prompt's OUTPUT never worse than a baseline's. Almost all reuse: `blind-floor-check.mjs` + `emit-receipt.mjs` verbatim; one new adapter; one fork; three clones. WARN/shadow, default OFF, zero hot-path enforcement edits.

**Invariants:** v1 touches NO hot-path enforcement file (`check-chain-receipts.mjs`/`REQUIRED_TYPES_FULL` unchanged). `prompt-element-extract.mjs` is pure (no clock). Floor judges OUTPUTS, cross-family, never self-certifies. Honest-bound: never claim "beats the sheep" as fact.

## 2. Files Planned
| # | Path | Op | Purpose |
|---|------|----|---------|
| F1 | `craft-prompt/SKILL.md` | DONE (create-skill) | gate skill |
| F2 | `craft-prompt/references/authoring-rubric.md` | DONE (create-skill) | the craft rubric |
| F3 | `scripts/prompt-element-extract.mjs` | CREATE | pure adapter: prompt OUTPUT → `{elements:[{key,content}]}` objective-first requirement keys |
| F4 | `scripts/prompt-floor-judge.sh` | CREATE (fork `blind-floor-judge.sh`) | cross-family judge of the OUTPUTS |
| F5 | `scripts/prompt-floor-route.mjs` | CREATE (clone `blind-floor-route.mjs`) | run/skip gate, default OFF |
| F6 | `schemas/receipts/prompt-floor.schema.json` | CREATE (clone `control-plan.schema.json`) | receipt schema |
| F7 | `test-framework/evals/tier-1/validate-prompt-floor.sh` | CREATE (clone `validate-blind-floor.sh`) | tier-1 validator |
| F8 | `test-framework/evals/tier-1/fixtures/prompt-floor/` | CREATE | `kept-all`, `planted-requirement-drop`(must-fail), `judge-unavailable`(blind-adopted) |
| F9 | `skills-manifest.json` | MODIFY | add `craft-prompt` to `includedSkills` |
| F10 | `README.md` | MODIFY | add `craft-prompt` (order matches manifest) |
| F11 | `route-workflow/references/intent-routing.md` | MODIFY | one row: "craft me a prompt / beat this prompt" → craft-prompt |

REUSE verbatim: `scripts/blind-floor-check.mjs`, `scripts/emit-receipt.mjs`, `scripts/resolve-adversarial-reviewer.sh`. *(§3a skipped — inline.)*

## 4. Task Graph
| Task | Title | Files | Deps | AC | Validation |
|------|-------|-------|------|----|-----------|
| T1 | `prompt-floor.schema.json` | F6 | — | AC6 | parses |
| T2 | `prompt-element-extract.mjs` (pure) | F3 | — | AC3,AC6 | run-twice-golden |
| T3 | `prompt-floor-judge.sh` (fork) | F4 | — | AC5 | shellcheck; cross-family |
| T4 | `prompt-floor-route.mjs` (clone) | F5 | — | AC7 | unit over classes |
| T5 | fixtures | F8 | T1,T2 | AC3,AC4 | both must-fail/adopt present |
| T6 | `validate-prompt-floor.sh` + wire | F7 | T2,T5 | AC3,AC4,AC9 | run-all-evals --tier1 |
| T7 | registration (includedSkills+README+intent-routing) | F9,F10,F11 | — | AC9 | lint green |
| T8 | proof-session (cold-email baseline) + receipt | F3,F4,F6 | T6,T7 | AC6 | prompt-floor receipt round-trips |

## 5. AC-to-Task
AC1,AC2→F1/F2(done) · AC3→T2,T5,T6 · AC4→T5,T6 · AC5→T3 · AC6→T1,T2,T8 · AC7→T4 · AC8→(no REQUIRED_TYPES edit) · AC9→T6,T7 · AC10→spec

## 6. AC-to-Test
AC1/AC2 → fixture grep on a crafted prompt (5 elements present; no prefill/CRITICAL/budget_tokens). AC3 → `planted-requirement-drop` exits non-zero. AC4 → `judge-unavailable` → blind-adopted exit 0. AC5 → self-cert(anthropic) + stale sha rejected. AC6 → proof receipt. AC7 → route unit. AC8 → static grep REQUIRED_TYPES_FULL ∌ prompt-floor. AC9 → lint + tier-1 green. AC10 → spec review.

## Prerequisite Alignment Matrix
| Prerequisite | Trace | Status |
|---|---|---|
| UX / UI / style / persona | framework-internal gate, no end-user surface | N/A — `persona_coverage: not_required` |
| design-ux/ui/tech/explore-solutions | no product architecture | skipped-with-reason in `.svc/lane-tasks-WI-411.json` |
| Tech foundations | `blind-floor-check.mjs`, `emit-receipt.mjs`, `resolve-adversarial-reviewer.sh`, `blind-floor-judge.sh`, `control-plan.schema.json`, `validate-blind-floor.sh` | reused from WI-410 (verified on main) |

## External State
| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|-----------|----------|------------------|
| 1 | Git notes `refs/notes/svc-receipts` | the `prompt-floor` receipt | coupled | `emit-receipt.mjs --type prompt-floor`; post-commit promote (same path as all receipts) |
| 2 | .svc/chain-policy.json (machine-local) | read-only opt-in flag | coupled | `prompt-floor-route.mjs` reads-the-file; absent → gate OFF |
| 3 | `.svc/prompt-craft.off` sentinel | read-only kill-switch | coupled | route returns skip if present |
| 4 | External CLI (Codex/Gemini judge) | spawned read-only | coupled | `resolve-adversarial-reviewer.sh`; exit 1 → blind-adopted |

Untouched (taxonomy walked): DB/ORM, cloud, deploy, browser, payment, email, auth, uploads, caches, queues, cron — none (pure local prompt-craft + a floor receipt).

## Execution Command Sequence
```bash
WT=/workspace/seriousvibecoding/.worktrees/wi411-craft-prompt
cd "$WT"
FX=test-framework/evals/tier-1/fixtures/prompt-floor
node -e 'JSON.parse(require("fs").readFileSync("schemas/receipts/prompt-floor.schema.json","utf8")); console.log("schema parses")'
node scripts/prompt-element-extract.mjs --output "$FX/kept-all/F-output.txt" --requirements "$FX/kept-all/requirements.json"   # objective coverage
bash test-framework/evals/tier-1/validate-prompt-floor.sh                 # negatives must fail; golden
node scripts/prompt-floor-route.mjs --task generic --size M               # run/skip (default OFF)
node scripts/lint-skills-manifest.mjs                                     # includedSkills<->README
bash test-framework/evals/run-all-evals.sh --tier1                        # green incl. new validator
```
RECOVERY_IF_FAIL: all additive; revert = delete new files + 2-line includedSkills/README/intent-routing revert. No hot-path enforcement file touched.

## 8. Checkpoint Plan
CP1 after T2 (extract pure + golden). CP2 after T6 (tier-1 green incl. negatives). CP3 after T7 (lint green). CP4 after T8 (receipt round-trip).

## 9. Promotion Readiness
- [ ] All ACs covered (matrix). No hot-path enforcement file modified. `run-all-evals --tier1` green incl. negatives. `lint-skills-manifest` green. Receipt round-trips. WARN/shadow + default OFF (prompt-floor NOT in REQUIRED_TYPES_FULL).

## Simulation Report (Dry Run)
- **CREATE targets absent (PASS):** F3-F8 don't exist yet (will verify with `ls` at execute).
- **MODIFY/reused present (PASS):** skills-manifest.json, README.md, intent-routing.md, blind-floor-check.mjs, emit-receipt.mjs, control-plan.schema.json, validate-blind-floor.sh, blind-floor-judge.sh, blind-floor-route.mjs — all on main.
- **Lane-compliance (PASS):** upstream_completed + upstream_skipped_with_justification present; design phases skipped-with-reason.
- **No banned scope-reduction phrases.** Schema-migration: N/A.
All-PASS — ready for review-plan.
