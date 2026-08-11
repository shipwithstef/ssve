# Feature: Feature Validation Closeout Ledger

**Status:** BASELINED
**Type:** Framework Evidence Contract
**Consumers:** route-workflow, validate-feature, write-spec, audit-ac, write-journeys, write-e2e, test-journeys, track-visuals, review-gate, verify-promotion
**Priority:** High
**Created:** 2026-05-12
**WI:** WI-305
**Source:** `docs/specs/work-items/WI-305.md`

---

## Problem Statement

Feature closeout evidence was scattered across persona checks, AC audits,
journeys, runtime tests, visual receipts, and promotion notes. A feature could be
summarized as done while at least one acceptance criterion lacked persona,
journey, runtime, E2E/manual, visual, or saved-state proof.

The framework needs one durable ledger that ties each user-facing or
admin-facing feature AC to complete closeout evidence.

## Contract

The delivery graph evidence family is `feature_validation_closeout`.

For user-facing or admin-facing feature work, the compiler marks that family
`required` unless the graph records an explicit non-user-facing rationale. A
completed graph cannot classify as framework-complete until the family is
`satisfied` or `n/a`.

The canonical artifact is:

`docs/specs/features/test-evidence/<run>/FEATURE_VALIDATION_LEDGER.md`

The canonical template is:

`docs/specs/features/test-evidence/FEATURE_VALIDATION_LEDGER.template.md`

## Acceptance Criteria

| AC | Description | Required Proof |
|---|---|---|
| FVCL-01 | Delivery graphs classify user-facing and admin-facing feature work with `feature_validation_closeout: required`. | `scripts/compile-delivery-graph.mjs` fixture and `validate-delivery-graph-compiler.sh` |
| FVCL-02 | The ledger contains every feature AC exactly once. | `scripts/validate-feature-closeout-ledger.mjs` |
| FVCL-03 | Each ledger row includes persona, journey/scenario, runtime, E2E/manual, evidence path, and final result. | `scripts/validate-feature-closeout-ledger.mjs` |
| FVCL-04 | `review-gate` blocks feature PASS decisions when required ledger evidence is missing or invalid. | `review-gate/SKILL.md` gate contract and tier-1 validator |
| FVCL-05 | `verify-promotion` blocks framework-complete closeout when required ledger evidence is missing or invalid. | `verify-promotion/SKILL.md` gate contract and closeout classification validator |
| FVCL-06 | Non-user-facing work can skip the ledger only with a recorded rationale. | Delivery graph evidence state `n/a` plus rationale in the graph or decision log |

## Required Files

| File | Role |
|---|---|
| `scripts/compile-delivery-graph.mjs` | Assigns evidence-family requirements and inserts validation tasks. |
| `scripts/validate-delivery-graph.mjs` | Rejects invalid or unsatisfied evidence-family states. |
| `scripts/classify-delivery-graph-closeout.mjs` | Prevents framework-complete classification while required evidence is open. |
| `scripts/validate-feature-closeout-ledger.mjs` | Validates the ledger artifact. |
| `test-framework/evals/tier-1/validate-feature-closeout-ledger.sh` | Replay coverage for missing and partial ledger evidence. |
| `concerns/feature-validation-closeout.md` | Intent-time concern routing for feature closeout evidence. |

## Out Of Scope

- Replacing journey, E2E, visual, or runtime validators.
- Requiring full visual/runtime evidence for non-user-facing infrastructure.
- Treating a screenshot or API probe as sufficient by itself.

## Industry Grounding

**Source:** Framework-internal evidence-contract improvement; no external
product market applies.

**Landscape state:** inapplicable

**Gate verdict:** SKIP

**Branch taken:** inapplicable

### What the industry does

Release and QA systems commonly require traceability from requirements to test
evidence, but svc's artifact shape is framework-specific: skills, delivery
graphs, task receipts, and local evidence files.

### What we're doing

The framework uses a local `FEATURE_VALIDATION_LEDGER.md` to tie each AC to
persona, journey, runtime, E2E/manual, evidence path, and final result.

### Why we differ or align

This aligns with traceability practice while staying local-first and
mock-by-default. It avoids adding a hosted test-management dependency to the
framework.

### Reversibility

Two-way door. The ledger columns and validator can evolve as long as the AC to
evidence mapping remains mechanically validated.

## Verification

Run:

```bash
bash test-framework/evals/tier-1/validate-feature-closeout-ledger.sh
bash test-framework/evals/tier-1/validate-delivery-graph-compiler.sh
bash test-framework/evals/tier-1/validate-delivery-graph.sh
bash test-framework/evals/tier-1/validate-delivery-graph-closeout-classification.sh
```
