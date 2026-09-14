# Adversarial Review + Corrected Synthesis — exec-speed-gamechanger

**Reviewer:** strategic-reviewer (locked agent) · **Verdict:** `reject` · **Confidence:** high
**Rubric:** process_fidelity 1/10 · adversarial_rigor 7/10 · citation_discipline 8/10

## What the review got right (accepted)

### Substantive (output) — the thesis was INVERTED
- **O-002 (HIGH, decisive):** the biggest measured sink — A1's ~17 iterative tier-1 runs (~50 min) — is **causally sequential** (each run conditional on the previous result). Option (8) parallel-delegation moves that loop *inside* a subagent but does not collapse its depth. **Only (1) the no-loss-verify harness collapses it (17→4).** So (1) is the game-changer for the dominant single-WI verification-heavy mode; (8) is not.
- **O-001 (CRITICAL):** the "5×" is a **portfolio sum**, not attributable to (8). By the decision's own data, (9) no-loop-merge recovered ~45% of the session at ~zero build cost; (8) in isolation on this session's shape ≈ **1.2×**. Crowning (8) "the game-changer" contradicts my own `leverage = Δspeed × applicability ÷ build-cost` metric.
- **O-005 (MEDIUM, but I MISSED it entirely):** the highest *immediate* leverage is a new option **(17) pre-loop discipline guard** — assert `cwd=repo-root` + `OLD-baseline-run-completed` before any verification loop. Prevents ~11/17 of A1's wasted runs at **~1 hour build cost**. By my own formula it **dominates (1)** on the A1 class.
- **O-003 (HIGH):** "(8) = 0 quality loss by construction" is **unproven** — parallel-delegation *introduces* failure modes: `.svc` append-only shared state (session-contract, pipeline-decisions) is NOT disjoint (the disjoint-file fence covers source files only); discipline failures replicate in parallel (c113's 3-round grep-miss would become 3 subagents each needing 3 rounds); context-handoff loss is a new silent-omission class. So (8) has not shown it clears its own HARD gate.
- **O-004 (HIGH):** (8)'s "default for every multi-item OR verification-heavy run" overstates applicability — the framework's default IS one-WI-per-run, so the ≥2-item trigger rarely fires; for the single-WI case (8) reduces to option (7), already listed as its own facet.

### Process — I short-circuited the 9-phase chain
- **P-000 (CRITICAL, the real process miss):** no Local Evidence Scan. WI-382 (parallel review station), WI-387 (dispatch waves), WI-399 (subagent economics) are in `.svc/pipeline-decisions.jsonl` within the 90-day window and are the *exact prior art* for my central claim — uncited.
- **P-001..P-006 (CRITICAL):** I collapsed the 9 phases into one DECISION.md — missing CONSTRAINT-PROFILE / DIMENSIONS / OPTIONS / SURVIVORS / QUESTIONNAIRE / EV-MODEL as discrete artifacts; the "leverage table" is not a funnel EV model.

## Disposition
- **O-002, O-001, O-005, O-003, O-004 — ACCEPTED.** They flip the conclusion. Corrected ranking below.
- **P-000 — ACCEPTED as a real error** (uncited prior art).
- **P-001..P-006 — partially accepted:** for a framework-internal meta-decision I made a deliberate compression call (one doc, not 9), which is a legitimate tier choice — BUT the local-evidence-scan skip (P-000) and the absent EV math (P-006) are genuine gaps, not just formatting.

## CORRECTED conclusion (the honest game-changer ranking)
Re-ranked by `leverage = Δspeed × applicability ÷ build-cost` on the **measured** data:

| Rank | Lever | Why it wins | Build |
|---|---|---|---|
| **1** | **(17) pre-loop verification discipline guard** (cwd=repo-root + OLD-baseline-first, BLOCK the loop if violated) | prevents ~11/17 of the worst-case run waste; smallest build; attacks the exact measured sink | ~1 hr |
| **2** | **(1) no-loss-verify harness** | collapses the causally-sequential within-item loop (17→4) that NO parallelism can touch; the game-changer for the dominant single-WI hot-path-refactor mode | small |
| **3** | **(9) no-loop merge halt + merge-helper standing permission** | recovered ~45% of THIS session at ~zero build cost | trivial |
| **4** | **(8) conductor + parallel executors** | real, but SCOPED to multi-item *epic* runs (e.g. WI-440 clusters); must FIRST prove it clears the 0-quality-loss gate (`.svc` state races, discipline replication, handoff loss). Demoted from "the game-changer" to "the multi-item container." | medium |
| 5 | friction cleanup (10/11/12/13) | aggregate ~20% | low each |

**The corrected one-liner:** there is no single architectural silver bullet. The 5× is a **portfolio** dominated by *cheap, targeted, within-item* fixes — a 1-hour discipline guard + the verification harness + a zero-cost merge-halt — NOT the grand "flip the execution model to parallel" reframe, which is narrower (epic-only) and unproven on the quality gate.

**Meta-lesson (the most valuable output):** my instinct crowned the most *architecturally impressive* option (8) and demoted the boring-but-correct harness (1) to "just an enabler." The adversarial gate caught exactly that inflation. That is the framework's value proposition demonstrated on itself — the ceremony (a locked skeptic over a real EV-style trade study) overrode the agent's bias toward the grand answer.

## Next
The decision does NOT need a full 9-phase re-run to be actionable — the corrected ranking is decision-ready. Route the corrected ranking to `evolve-framework`: ship (17) + (1) first (the measured worst-case fix), (9) next (session-shape fix), and treat (8) as a measured experiment behind the WI-399 economics gate, not a default flip.
