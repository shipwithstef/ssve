# Changeset Manifest — WI-410 Blind-Control-Plan Floor

**Spec:** `docs/specs/work-items/WI-410.md`
**Branch:** `wi410-control-plan` (worktree `.worktrees/wi410-control-plan`)
**Base SHA:** 748d4c60 (main)
**Status:** DRAFTED → (review-plan) → SIMULATED → APPROVED → …
**Lane:** framework · **Size:** M · **Archetype:** Bounded feature (cross-cutting note)
**Execution mode:** `inline` (orchestrator executes; §3a blueprints skipped per WI-386)
**Date:** 2026-06-22

## 1. Implementation Summary
Ship the v1 **best-of-2 retention floor** as a NEW, additive framework gate. The framework plan F is checked against an immutable blind plan B; any uncertified silent removal/weakening of a correct B-element forces shipping B verbatim. v1 is **WARN/shadow, default OFF**, invoked manually in a proof session.

**Invariants:**
- v1 touches **zero hot-path enforcement files** (`plan-changeset/SKILL.md`, `check-chain-receipts.mjs`, `REQUIRED_TYPES_FULL` all UNCHANGED). Auto-insertion + BLOCK promotion = v2.
- `blind-floor-check.mjs` is **pure** (same inputs → same JSON + exit; no `Date.now` in the pure path) and **fail-closed** (exit non-zero on any uncertified REMOVE/ALTER).
- svc/orchestrator code **never writes** `certified_strict_improvement`; that field is parsed only from the cross-family judge YAML.
- Judge family != orchestrator family, guaranteed by reusing `resolve-adversarial-reviewer.sh` verbatim.

**Constraints:** new skill added to `includedSkills` + `README.md` only (NOT `corePackForRouting`/`EXTERNAL_ADDONS`/`REPO_MODES` — deferred). `lint-skills-manifest.mjs` + full `run-all-evals.sh --tier1` must stay green.

## 2. Files Planned
| # | Path | Op | Purpose |
|---|------|----|---------|
| F1 | `blind-control-plan/SKILL.md` | CREATE | Gate skill (chain.lanes:{}): P1 generate-blind → P2 deterministic-delta → P3 judge-removals → P4 floor-decision → P5 emit receipt → P6 self-verify |
| F2 | `scripts/blind-floor-check.mjs` | CREATE | Pure deterministic classifier + exit-code gate (`--blind --merged --verdicts`) |
| F3 | `scripts/blind-floor-judge.sh` | CREATE | Fork of `review-plan-codex.sh`; cross-family judge on REMOVE/ALTER rows only; OUTPUT-FIRST, piped context, "longer≠better", tie→reject |
| F4 | `scripts/blind-floor-route.mjs` | CREATE | Pure run/skip decision from WI class + .svc/chain-policy.json (machine-local, gitignored) opt-in + `.svc/dual-track.off` (supports AC7) |
| F5 | `schemas/receipts/control-plan.schema.json` | CREATE | Receipt schema (`receipt_type` const `control-plan`, fail-closed on uncertified rows) |
| F6 | `test-framework/evals/tier-1/validate-blind-floor.sh` | CREATE | Tier-1 validator; runs each fixture twice (golden) |
| F7 | `test-framework/evals/tier-1/fixtures/blind-floor/` | CREATE | Fixtures: `kept-only`, `refine`, `planted-silent-removal`(must-fail), `weakening-as-refinement`(must-fail), `judge-unavailable`(blind-adopted) |
| F8 | `skills-manifest.json` | MODIFY | Add `blind-control-plan` to `includedSkills` (NOT corePack) |
| F9 | `README.md` | MODIFY | Add `blind-control-plan` to skill list (order matches manifest) |

*(§3a Changeset Blueprint skipped — inline mode.)*

## 4. Task Graph
| Task | Title | Files | Deps | AC | Validation | Checkpoint |
|------|-------|-------|------|----|-----------| -----------|
| T1 | `control-plan.schema.json` | F5 | — | AC5 | `node -e` ajv-validate a sample receipt | schema parses |
| T2 | `blind-floor-check.mjs` pure classifier + exit gate | F2 | T1 | AC1,AC3,AC4 | run-twice-golden on fixtures | deterministic + fail-closed |
| T3 | `blind-floor-judge.sh` cross-family judge | F3 | — | AC6 | shellcheck; dry `--help`; resolver call mocked | forks codex shape; no Claude-judges-Claude |
| T4 | `blind-floor-route.mjs` run/skip gating | F4 | — | AC7 | unit over sample WI classes | skips quick-fix/exempt; runs infra+M+ |
| T5 | fixtures (5 cases) | F7 | T1 | AC1,AC2 | — | both negatives present |
| T6 | `validate-blind-floor.sh` + wire into run-all-evals | F6 | T2,T5 | AC1,AC2,AC9 | `run-all-evals.sh --tier1` | negatives exit non-zero; green overall |
| T7 | `blind-control-plan/SKILL.md` gate (WARN/shadow, default OFF) | F1 | T2,T3,T4 | AC8,AC10 | `validate-skill-structure.sh`, `validate-self-verify-sections.sh` | structure+self-verify pass |
| T8 | manifest registration (includedSkills + README) | F8,F9 | T7 | — | `node scripts/lint-skills-manifest.mjs` | linter green |
| T9 | proof session — run gate on one real infra/M+ plan, emit receipt | F2,F3,F5 | T6,T7,T8 | AC1,AC5,AC6 | emit + read-back from git note | floor_verdict recorded |

## 5. AC-to-Task
AC1→T2,T5,T6 · AC2→T5,T6 · AC3→T2 · AC4→T2,T6 · AC5→T1,T9 · AC6→T3,T9 · AC7→T4 · AC8→T7 · AC9→T6 · AC10→T7 (+ spec)

## 6. AC-to-Test
| AC | Test type |
|----|-----------|
| AC1 | Unit (fixture `planted-silent-removal`, `weakening-as-refinement` → exit≠0) |
| AC2 | Unit (fixture `judge-unavailable` → blind-adopted, exit 0) |
| AC3 | Static (grep assertion: no `certified_strict_improvement` write in check/route) |
| AC4 | Unit (run-twice-golden diff) |
| AC5 | Manual+cmd (emit receipt, read back from `refs/notes/svc-receipts`) |
| AC6 | Unit (resolver → family≠anthropic assertion) |
| AC7 | Unit (routing table over WI classes) |
| AC8 | Static (grep `REQUIRED_TYPES_FULL` in `check-chain-receipts.mjs` does NOT include `control-plan` → confirms WARN/shadow, not block-mode; v2 wires the enforcement test) |
| AC9 | Cmd (`run-all-evals.sh --tier1` green incl. negatives) |
| AC10 | Doc review (spec states the honest bound) |

## Prerequisite Alignment Matrix
| Prerequisite | Trace | Status |
|---|---|---|
| UX / UI / style / persona | framework-internal gate — no end-user surface | N/A — `persona_coverage: not_required` (logged) |
| design-ux / design-ui / design-tech / explore-solutions | no product architecture or UX flow | skipped-with-reason in `.svc/lane-tasks-WI-410.json` |
| Tech foundations | `resolve-adversarial-reviewer.sh`, `review-plan-codex.sh`, `emit-receipt.mjs`, `mine-receipts.mjs` purity pattern | reused (verified in research overlap-map) |

## External State
| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|-----------|----------|------------------|
| 1 | Git notes ref `refs/notes/svc-receipts` | the `control-plan` receipt | coupled | emitted via `scripts/emit-receipt.mjs --type control-plan`; post-commit hook promotes staging→SHA mirror+note (same path as all 5 chain receipts) |
| 2 | .svc/chain-policy.json (machine-local, gitignored) (machine-local, gitignored) | read-only: dual-track opt-in flag | coupled | `blind-floor-route.mjs` reads-the-file-never-assumes; absent flag → gate is OFF (no-op) |
| 3 | `.svc/dual-track.off` sentinel | read-only kill-switch | coupled | `blind-floor-route.mjs` returns skip if present |
| 4 | External CLI subprocess (Codex/Gemini judge) | spawned read-only, `--sandbox read-only` | coupled | selected by `resolve-adversarial-reviewer.sh`; exit 1 (no judge) → kill-switch to blind-adopted |

Untouched (taxonomy walked): DB/ORM, cloud infra, deploy targets, browser/runtime, payment, email, auth surface, file uploads, caches, queues, cron — none touched (pure local plan-stage analysis emitting a receipt).

## 7. Validation Plan
1. `node scripts/blind-floor-check.mjs` run-twice-golden over all 5 fixtures.
2. `bash test-framework/evals/tier-1/validate-blind-floor.sh` (negatives must fail).
3. `bash test-framework/evals/run-all-evals.sh --tier1` (full suite green — per g5-review-must-run-all-tier1).
4. `node scripts/lint-skills-manifest.mjs` green (includedSkills↔README sync).
5. Proof session: emit a control-plan receipt and read it back from the git note.

## Execution Command Sequence
```bash
WT=/workspace/seriousvibecoding/.worktrees/wi410-control-plan
cd "$WT"
FX=test-framework/evals/tier-1/fixtures/blind-floor
# T1 schema -> T2 pure check -> T5 fixtures -> T6 validator (the invariant core)
node -e 'JSON.parse(require("fs").readFileSync("schemas/receipts/control-plan.schema.json","utf8")); console.log("schema parses")'  # ESM-safe
node scripts/blind-floor-check.mjs --blind "$FX/kept-only/B.json" --merged "$FX/kept-only/F.json"   # exit 0 (pass)
node scripts/blind-floor-check.mjs --blind "$FX/planted-silent-removal/B.json" --merged "$FX/planted-silent-removal/F.json" --verdicts "$FX/planted-silent-removal/verdicts.json"  # exit 1 (caught)
bash test-framework/evals/tier-1/validate-blind-floor.sh                   # negatives exit non-zero; run-twice golden
# T3 judge -> T4 route -> T7 gate skill -> T8 registration
shellcheck scripts/blind-floor-judge.sh || true
node scripts/blind-floor-route.mjs --wi WI-410 --class infra --size M      # run/skip decision
bash test-framework/evals/tier-1/validate-skill-structure.sh
node scripts/lint-skills-manifest.mjs                                      # includedSkills<->README sync
# Full suite + proof
bash test-framework/evals/run-all-evals.sh --tier1                         # green incl. new negatives
node scripts/emit-receipt.mjs --type control-plan --wi WI-410 --body /tmp/control-plan.json  # round-trip
```
RECOVERY_IF_FAIL: any tier-1 red -> fix the offending new file (all additive); no hot-path enforcement file is touched, so revert = delete new files + 2-line includedSkills/README revert.

## 8. Checkpoint Plan
CP1 after T2 (pure check deterministic + fail-closed). CP2 after T6 (tier-1 green incl. negatives). CP3 after T8 (linter green). CP4 after T9 (receipt round-trip). Each → `git diff --staged` review + checkpoint trailer.

## 9. Promotion Readiness Checklist
- [ ] All 10 ACs covered by a task (matrix above).
- [ ] No hot-path enforcement file modified (diff scoped to new files + manifest/README).
- [ ] `run-all-evals.sh --tier1` green incl. the two must-fail negatives.
- [ ] `lint-skills-manifest.mjs` green.
- [ ] No ORM/schema files touched → no migration task needed (N/A).
- [ ] Receipt round-trips through `refs/notes/svc-receipts`.
- [ ] WARN/shadow + default OFF verified (control-plan NOT in REQUIRED_TYPES_FULL).

## Simulation Report (Dry Run)
Walked the task graph in dependency order against disk + planned layers:
- **CREATE targets absent (PASS):** `blind-control-plan/SKILL.md`, `scripts/blind-floor-check.mjs`, `scripts/blind-floor-judge.sh`, `scripts/blind-floor-route.mjs`, `schemas/receipts/control-plan.schema.json`, `test-framework/evals/tier-1/validate-blind-floor.sh`, `fixtures/blind-floor/` — none exist yet (verified `ls`).
- **MODIFY/reused targets present (PASS):** `skills-manifest.json`, `README.md`, `scripts/resolve-adversarial-reviewer.sh`, `scripts/review-plan-codex.sh`, `scripts/emit-receipt.mjs`, `schemas/receipts/` (7 sibling schemas) — all present.
- **Lane-model validation (PASS):** `validate-task-graph-lane.mjs` → `pass:true`, statusConsistency consistent.
- **Deprecated-foundation scan (PASS):** "No deprecated foundations detected."
- **Lane-compliance (PASS):** `upstream_completed` + `upstream_skipped_with_justification` present; design-ux/ui/tech/explore-solutions skipped-with-reason (framework-internal gate).
- **Schema-migration (N/A):** no ORM/schema-ORM files touched.
- **No banned scope-reduction phrases** in task graph.

All checks PASS — no unresolved FAIL. Manifest ready for review-plan.
