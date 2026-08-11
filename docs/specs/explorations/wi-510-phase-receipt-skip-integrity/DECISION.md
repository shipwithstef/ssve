# Decision: WI-510 Phase-Receipt Skip Integrity

## Selected approach

**B1 — shared pure Node classifier with thin validator consumers.**

The classifier returns one of `executed`, `authorized-skip`, `legacy-compatible`, or `invalid` with task-local diagnostics. It introduces no persisted cache and does not rewrite graphs.

## Confidence

High. Seven repository-primary authorities, the real promoted WI-498 graph, its durable Git-note attestation, and mutation inversions all support the state split.

## Evidence chain

- Problem framing: `PROBLEM_BRIEF.md`
- Alternatives: `SOLUTION_MAP.md` — 4 paradigms, 8 approaches
- AC analysis: `ANALYSIS.md`
- Real-state comparison: `COMPARISON.md`
- Research: `docs/specs/research-log.md` 2026-07-23 entry

## Why this approach

- Passes PSR-01/02/16 without inventing a skip authorization for executed WI-498 tasks.
- Fails closed for PSR-03–06 and PSR-11–13.
- Preserves PSR-14/15 by consuming canonical existing compatibility boundaries.
- Satisfies PSR-20 with one semantic implementation.
- Adds no database, network, dependency, cache, migration, or retained state.

## Why not the alternatives

- **Any phase array:** turns malformed/fabricated receipts into execution proof.
- **Independent patches:** preserves the drift that caused WI-510.
- **Compose whole-graph validators:** cannot isolate the WI-498 task verdict from its independent missing-delivery-graph finding.
- **Broad validator refactor:** useful future work but too large for this correction.
- **History rewrite or allowlist:** explicitly prohibited.

## Runner-up

**C2 — refactor existing validators into reusable libraries.** Choose it only if a later scoped WI needs structured per-task results from the full delivery-graph and receipt-shape validators.

## Impact on technical design

- [x] Design-tech must specify the B1 module/CLI boundary, evidence-reference rules, legacy delegation, diagnostics, and consumer wiring.
- [ ] No data/schema/provider design is needed.
