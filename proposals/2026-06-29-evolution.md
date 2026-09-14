# Framework Evolution — 2026-06-29 — execution-speed (5×, zero quality loss)

## Method
Survey derived from a real run, not vibes: `audit-session-execution` over this session's WI-440 audit cluster → `docs/analysis/2026-06-29-session-speed-audit.md` (granular ledger), then `strategic-decision` → `docs/specs/decisions/exec-speed-gamechanger/{DECISION,REVIEW}.md` (adversarial verdict REJECT → corrected ranking). FRAMEWORK-STATE.md read first: WI-380/382/383/387/399 are VERIFIED prior art and are BUILT ON, not re-proposed. Per the audit-deliverable-as-parent-WI convention, the actionable backlog is filed as epic **WI-461** + children WI-462..469; this proposal is the survey.

## Findings (by priority) — categories: Inefficiency unless noted

### P0 — Fix now (the measured worst case)
- **(17) No pre-loop verification discipline guard.** [Gap] `docs/analysis/2026-06-29-session-speed-audit.md:67-79`: ~11 of 17 A1 tier-1 runs were pure discipline failures (wrong cwd ×2, baseline-not-first ×3, full-suite-for-3-validator-hypothesis ×3, env-red/race conflation ×3). The LOCKED principle "mechanical enforcement over agent discipline" (`FRAMEWORK-STATE.md:293`) demands a guard, not "be careful." → WI-462.
- **(1) No no-loss-verify harness.** [Inefficiency] Same evidence: the causally-sequential within-item verification loop is the dominant sink and is NOT parallelizable (`docs/specs/decisions/exec-speed-gamechanger/REVIEW.md` O-002). A harness collapses ~17→4. → WI-463.

### P1 — Fix soon
- **(9) Stop-hook/`/goal` loops infinitely on auto-mode-blocked merges.** [Fragility] This session: ~13 Stop-hook fires + ~6 blocked merge attempts on an unsatisfiable-without-user condition; recovered ~45% of wall-clock once unblocked (`session-speed-audit.md:19`). Needs a `blocked-on-user` terminal state + a documented merge-helper standing permission. → WI-464.

### P2 — Improve when possible (friction taxes, ~20% aggregate)
- **(10)** destructive-preamble guard is markdown-intolerant + per-op (not batchable) → ~10 round-trips (`hooks/svc-workflow-guard.mjs`). → WI-465.
- **(11)** `hooks/svc-pre-commit-multi-host-check.sh` runs 8-host `./setup` per commit → >2min → SIGTERM at the 2-min default. Wrong cadence (belongs at push). → WI-466.
- **(12)** `hooks/svc-session-contract-freshness.mjs` HARD-blocks writes on staleness (blocked ~3 writes this session incl. the audit) instead of auto-refreshing. → WI-467.
- **(13)** no envelope generator; the 5-receipt chain is hand-authored when not run via stage skills (≈10 JSONs/run + a fabrication near-miss this session). → WI-468.

### P3 — Track (experiment, not actionable as default yet)
- **(8) Conductor + parallel executors as a default.** [Opportunity] Real but DOWNGRADED by adversarial review from "the game-changer" to a multi-item-epic-only experiment: it cannot touch the causally-sequential single-WI sink, and its 0-quality-loss claim is unproven (`.svc` append-only state races, discipline replication, handoff loss — REVIEW.md O-003). Build on WI-380/382 transport, gate behind WI-383 + WI-399 economics, **implement via subagent dispatch (Agent/Task) NOT shell `-P`** (subagent surface is the one expected to get rapid; `-P` over a shared repo races `.svc`). → WI-469 (opt-in until non-regression proven).

## Comparison delta
No new external-framework capability gap surfaced; the levers are svc-internal (the parallel/subagent primitives already exist via WI-380/382/387/399 — the gap is making them the *default for the right mode* + the missing verification harness/guard). 

## Stale proposal audit
This proposal is promoted immediately to tracked epic **WI-461** (children WI-462..469). No per-leaf fix briefs embedded here (those are `improve-framework` artifacts, one per child when executed).
