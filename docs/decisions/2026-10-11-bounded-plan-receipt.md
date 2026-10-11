# Bounded plan receipt: a third planning contract

Status: proposed, for owner review. No enforcement code changes until this design is accepted.
Ledger row 61. Context: `docs/decisions/2026-10-10-bounded-delivery.md`.

## Problem
Prototype and MVP work plans with a one-page brief that grows (bounded planning). The mandatory chain still runs: plan-manifest, review-plan, exec-record, review-exec, audit-implementation.

But a v5 plan-manifest receipt accepts only two planning contracts:
- `two_box`: the full sealed changeset;
- `lightweight`: small changes that a live classifier proves eligible.

A bounded brief fits neither. In repos whose chain policy is refuse mode, bounded work therefore cannot produce a plan receipt, and the bounded path is unusable there. The only workaround is to write the full v5 body, which defeats the point.

## Proposal: `planning_contract.kind: "bounded"`
A third kind, issued and validated beside the other two.

| Where | Today | Change |
|---|---|---|
| `scripts/lib/receipt-issuance-epoch.mjs` `assertCurrentPlan` | dispatches `lightweight` and `two_box`, rejects anything else | adds `assertBounded` |
| `scripts/lib/plan-manifest-contract.mjs` `validatePlanBody` | validates the two kinds | validates the bounded fields |
| `scripts/check-chain-receipts.mjs` consumer path | special-cases `lightweight` | treats `bounded` like `two_box` for current-execution checks |
| `scripts/emit-receipt.mjs` required fields | `changeset_blueprints` unless `mode: inline` | bounded bodies need the brief fields instead of blueprints |
| `schemas/` plan-manifest schema | two kinds | third kind with its fields |

### Fields
| Field | Meaning | How it is checked |
|---|---|---|
| `brief_ref` | Object ref and sha256 of `brief.md` | `getByRef` resolves it; the digest matches the committed file in the sealed candidate tree |
| `original_requirements_ref` | Object ref of the request | Same check as `two_box` and `lightweight` |
| `done_when` | Check ids, each with the sha256 of its command | Recomputed from the brief's section 1 table; every original requirement id maps to at least one check |
| `owned_paths` | The brief's section 2 owned paths | `scope.included` must sit inside them; the staged diff's files must sit inside `scope.included` |
| `irreversible_zones` | Zones the diff touches | Recomputed with `compile-delivery-graph.mjs irreversibleZones()` over the staged files; must be equal |
| `delivery_profile` | `prototype` or `mvp` | Anything else is refused |
| `graph_ref` | The delivery graph the plan belongs to | Its `planning.mode` must be `bounded`, and its lane must not be `framework` |

### Rules
1. **Profiles:** bounded is never valid for `production`, nor for the framework lane. A contract graph cannot carry a bounded receipt (no downgrade).
2. **Irreversible zones:** a non-empty `irreversible_zones` requires the review-plan, review-exec and audit-implementation receipts at full depth. The consumer checks the depth recorded in each review receipt, the same rule `validate-delivery-graph.mjs` applies to the graph.
3. **Growth:** the brief may grow. An amended brief has a new digest, so a new plan-manifest receipt is issued, recorded as a `mutation_history` entry with the old and new digests.
   - Exec and review receipts bind the plan digest they ran against, so work done under an older brief is visibly older.
   - A gate never accepts it as current.
4. **Seal:** the same `verifySeal` as the other kinds, over the candidate tree that contains `brief.md`.
5. **Forbidden fields:** the `two_box` control fields and the `lightweight` eligibility fields, the same mutual exclusion the existing kinds use.

## Threat model
| Threat | Check that stops it | Negative test |
|---|---|---|
| Forged brief digest | `brief_ref` digest recomputed from the sealed tree | Edit `brief.md` after sealing; issuance refuses |
| Scope drift: the diff writes outside the brief's owned paths | Staged files inside `scope.included`, which sits inside `owned_paths` | Stage a file outside the owned paths; refused |
| Zone omission: auth or payments touched, zones list empty | Zones recomputed from staged files must equal the field | Stage `src/auth.js` with `irreversible_zones: []`; refused |
| Depth downgrade: zones present, single-pass reviews | Consumer requires full-depth review receipts when zones exist | Single-pass review receipts with a zone; chain check fails |
| Profile downgrade to escape the full chain | `delivery_profile` limited to prototype or MVP; graph mode must be bounded; framework lane refused | Production graph with a bounded receipt; refused |
| Requirements dropped | Every original requirement id maps to a done-when check | Remove the check for one requirement; refused |
| Stale brief accepted as current | Receipts bind plan digests; amendment issues a new plan receipt | Exec receipt against an old digest after an amendment; consumer refuses |

Each row becomes a tier-1 negative test, next to the existing receipt validators.

## What does not change
- The 5-receipt envelope, refuse mode, the pre-push range check, and the reviewer allowlist all stay as they are.
- `two_box` and `lightweight` behave exactly as before.
- Production keeps the full changeset.

## Rollout
1. Write the schema and validators behind the new kind, with every threat-model test failing first, then passing.
2. Run the receipt validators' full tier-1 set and a dry-run issuance on a bounded fixture graph.
3. Issue a live bounded receipt in a scratch repository in refuse mode.
4. Only then let route-workflow issue bounded receipts.

## Review
See the review section below: findings and dispositions are recorded there before any code.
