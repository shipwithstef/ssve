> **⚠ SUPERSEDED by REVIEW.md (adversarial verdict: REJECT).** The thesis below — "(8) conductor+parallel is THE game-changer" — was DOWNGRADED: the biggest measured sink (A1's 17 causally-sequential tier-1 runs) cannot be parallelized; (1) the no-loss-verify harness + a new (17) pre-loop discipline guard are the real worst-case levers. See REVIEW.md for the corrected ranking.

# Strategic Decision: the game-changing execution-speed lever for svc (5×+, zero quality loss)

**Date:** 2026-06-29
**Constraint profile:** Solo framework-leverage builder; quality floor ABSOLUTE (0 loss); speed-maximizing; token-cost-tolerant; purpose = raise the agent's capability ceiling.
**Evidence base:** `docs/analysis/2026-06-29-session-speed-audit.md` (granular ledger: 22 full tier-1 runs, 9 Codex rounds, the merge-loop, 5 serial WI cycles; ~10% of wall-clock was irreducible work).

## Dimensions (HARD = elimination gate, SOFT = scoring)
| Dimension | H/S | Unit | Why |
|---|---|---|---|
| Zero quality loss | **HARD** | pass/fail | the floor; any lever that drops a gate is eliminated |
| Δ wall-clock per change | SOFT | × speedup | the objective |
| Applicability frequency | SOFT | % of changes it helps | a lever that helps 5% of changes ≠ game-changer |
| Build cost / risk | SOFT | days × blast-radius | a hot-path rewrite to save minutes is a bad trade |
| Compounding | SOFT | yes/no | does it improve as it runs (context hygiene, caching)? |
| Bounded by subagent economics (WI-399) | **HARD** | pass/fail | must not 100×-cost trivial changes via needless dispatch |

## Options enumerated (16)
**Verification-cost:** (1) no-loss-verify harness (OLD-baseline + suspect-loop); (2) diff-scoped tier-1 (only validators touching changed paths); (3) memoized tier-1 (cache by input tree-hash); (4) tier-1 daemon (kill 234× node cold-start).
**Concurrency:** (5) parallel disjoint-file WI wave; (6) parallel review station as default (WI-382); (7) stage-isolated subagents as default (WI-380).
**Structural:** (8) **orchestrator-as-pure-conductor** — heavy work (build+verify+review+envelope) ALWAYS in ephemeral parallel subagents; main context never bloats, never blocks on tier-1, never hand-rolls envelopes.
**Friction:** (9) no-loop merge guard + merge-helper standing permission; (10) markdown-tolerant + batchable destructive-preamble; (11) pre-commit drift-check → push cadence; (12) contract-freshness auto-refresh (non-blocking).
**Ceremony-automation:** (13) emit-envelope generator; (14) measured ceremony-tiering ON (WI-383); (15) cluster-execute (one epic → one parallel run).
**Escape hatch:** (16) "verify less / drop gates."

## Escape-hatch analysis
(16) "verify less" is the obvious 10× — and it is **ELIMINATED by the HARD 0-quality-loss gate.** That elimination is the spine: every surviving lever must change *where/when/how* verification runs, never *whether*.

## Elimination gates applied
- ELIMINATED — (16) verify-less — Quality — drops gates; violates the absolute floor.
- ELIMINATED-as-game-changer — (14) measured-tiering — Applicability — its AC4 fence refuses infra/hooks/scripts/migration, i.e. exactly the hot-path changes that dominate framework work (A1/A2/B1 are all hot-path). Tail-only; keep as minor.
- ELIMINATED-as-game-changer — (2)(3)(4) tier-1 micro-opts — Build-cost/risk — modifying the eval harness internals is itself hot-path + risky; (1) captures most of the win with no harness-internals risk. Keep (2) as a follow-on.
- SURVIVORS (game-changer candidates): **(1) no-loss-verify harness**, **(8) conductor + parallel executors**; (5)(6)(7) are concurrency facets of (8); (9)–(13) are friction cleanup.

## Leverage model (leverage = Δspeed × applicability ÷ build-cost, under 0-loss)
| Lever | Δspeed | applies to | build cost | compounding | leverage |
|---|---|---|---|---|---|
| (8) conductor + parallel executors | attacks ALL serial sinks at once (22 tier-1 + 9 Codex + 5 builds run concurrently OFF the main thread) + small orchestrator context → less degradation → fewer redos | every multi-item OR verification-heavy run | medium (primitives exist: dispatch-worker, stage-segment, parallel-review-station, disjoint-scopes — change the DEFAULT) | **YES** | **HIGHEST** |
| (1) no-loss-verify harness | ~17→4 tier-1 runs on a hot-path refactor (~4× on the biggest block) | verification-heavy changes | small (one script) | no | **HIGH (point)** |
| (5)/(6)/(7) parallel wave/review/stages | 3–4× on multi-item build | multi-item runs | low (exist) | partial | HIGH — but these ARE (8)'s facets |
| (9) no-loop merge + permission | recovered ~45% of THIS session | sessions ending in self-merge | trivial | no | HIGH (situational) |
| (13)/(10)/(11)/(12) friction | ~20% aggregate | every session | low each | no | MEDIUM |

## Decision — the game-changer (deeper than my first answer)
My first answer (harness + wave + no-loop) was three point-fixes. The strategic reframe: they are facets of ONE structural game-changer:

> **Flip the DEFAULT execution model from "one orchestrator does everything serially in a bloating context" to "the orchestrator CONDUCTS; ephemeral parallel subagents run the FULL gate (build + no-loss-verify + adversarial review + envelope) concurrently and return only verified results + receipts" — bounded by the WI-399 subagent-economics gate, with the no-loss-verify harness (1) as the cheap per-item verification primitive.**

Why this is the game-changer, not a point-fix:
1. **Attacks every sink simultaneously.** This session's 22 serial tier-1 runs, 9 serial Codex rounds, and 5 serial build cycles all ran in the one orchestrator thread, blocking. Under (8) they run concurrently in ephemeral executors, off the conductor's critical path.
2. **0 quality loss by construction.** Nothing is skipped — each executor runs the SAME no-loss-verify + adversarial review + 5-receipt envelope. Only *where* (subagent) and *when* (concurrent) change.
3. **Compounds.** Small orchestrator context → sharp attention → fewer silent-omission/redo cycles (the exact degradation behind A1's env-red re-conflation and c113's 3-round whack-a-mole). Point-fixes don't compound; a clean conductor does.
4. **Pieces already exist.** dispatch-worker, stage-segment, parallel-review-station, disjoint-scopes, dispatch-waves. The change is making parallel-delegation the **default for multi-item / verification-heavy work**, not an opt-in the orchestrator forgets. This session proves the gap: I had every primitive and still ran serial.

**Bound (honest limit):** (8) is WRONG for a single trivial change — subagent dispatch copies ~130K ctx (rules/tool-selection.md). So it is **risk/size-gated**: conduct-and-parallelize when ≥2 independent substantial items OR a verification-heavy hot-path item; do trivial single edits inline. WI-399 measure-then-promote (≤1.5× tokens, quality non-regression) is the existing fence.

## Why NOT the runners-up (as the *game-changer*)
- (1) harness alone — highest *point* leverage but only helps verification-heavy changes; it's the enabler INSIDE (8), not the structural flip.
- (9) no-loop merge — recovered ~45% of *this* session, but that was a session-shape accident (ended in a self-merge batch); not every run hits it. Ship it; not the game-changer.
- (14) measured-tiering — its fence excludes the hot-path changes that dominate. Tail-only.

## Confidence
Medium-High. Leverage ranking grounded in this session's hard ledger. Main risk = execution: default-parallel-delegation must be tightly size/risk-gated or it backfires on trivial work. Adversarial review (Phase 6) targets: "is (8) really deeper than (1), or is parallelism being dressed up as profundity?"

## Revisit triggers
- A future audited session shows the orchestrator context staying SMALL but wall-clock still dominated by non-serial-heavy-work → (8) was wrong lever; re-open.
- Subagent dispatch overhead measured >1.5× tokens for a typical 2–4 item wave → economics gate kills (8) at that size; fall back to serial + harness.
- Annually, or when host subagent primitives change.

## Downstream
Next: `evolve-framework` — make parallel-delegation the default-for-multi-item routing rule + ship no-loss-verify as its verification primitive. Then `improve-framework` for (1)(9)(13).
