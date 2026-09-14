# Framework improvement: make the compiled graph enforce the mandatory chain

**Archived into:** WI-541

**Status:** ACCEPTED into WI-541
**Date:** 2026-08-15
**Severity:** high
**Category:** routing and evidence integrity

## Evidence

`scripts/compile-delivery-graph.mjs` includes `review-plan` in some lane bases but omits it from `framework`, `bugfix`, and `drift`; it includes no `review-exec` task in any lane base. `scripts/validate-task-graph-lane.mjs` nevertheless reports those graphs valid because the framework mandatory set requires only `plan-changeset`, `execute-changeset`, `review-gate`, `land-changeset`, and `verify-promotion`.

The defect reproduced on WI-541: the compiler emitted a 13-task framework graph that routed `plan-changeset` directly to `execute-changeset` and `review-gate` directly to `audit-implementation`, while lane validation returned PASS. This contradicts the repository's mandatory plan-exec-review contract and makes the validator a false-green.

## Diagnosis

The mandatory chain is declared in prose, receipt policy, and individual skills, but the graph compiler and its lane validator carry older partial copies. This is contract drift, not an optional topology choice. `review-gate` and `review-exec` are distinct: the former is the implementation checkpoint/self-review surface and the latter owns bounded final adversarial review plus its receipt.

## Acceptance criteria

- **AC-01:** Every non-retired product/framework mutation lane compiles `plan-changeset -> review-plan -> execute-changeset -> review-gate -> review-exec -> audit-implementation -> land-changeset -> verify-promotion` in dependency order.
- **AC-02:** The lane validator rejects omission, reordering, or substitution of `review-plan` or `review-exec`; `review-gate` cannot satisfy `review-exec`.
- **AC-03:** Conditional stages remain additive and cannot move security, testing, or session-forensic checks after landing.
- **AC-04:** Tier-1 fixtures cover every lane base plus negative omission/reordering cases.
- **AC-05:** Existing valid task graphs remain parseable; only graphs that violate the already-documented mandatory contract newly fail.

## Likely files

- `scripts/compile-delivery-graph.mjs`
- `scripts/validate-task-graph-lane.mjs`
- lane/mandatory-chain references consumed by both
- focused Tier-1 graph fixtures

## Replay

Recompile WI-541's framework topology and representative bugfix, drift, refactor, greenfield, and brownfield-feature graphs. Each must contain the exact chain once, and deletion or reordering of either review task must fail validation.

## Rollback

Revert the compiler, validator, and fixture changes together. Preserve the WI-541 false-green evidence and any generated graphs; do not weaken receipt gates as rollback.
