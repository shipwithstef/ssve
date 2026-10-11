# Bounded plan receipt: a third planning contract

Status: rejected as written by adversarial review (2026-10-11, below); revised direction proposed for the owner. No enforcement code changes until the revision is accepted.
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

## Review (2026-10-11)

Reviewer: the repository's locked `plan-reviewer` agent, in a fresh context.
- It read the design and the code it names.
- It did not run tests.
- The paid external launcher (`scripts/run-external-review.mjs`) could not run here: it needs the owner's `~/.svc/dispatch-policy.json`.

**Verdict: reject as written, not on concept.**

Blockers (all three accepted):
- **B-1: review receipts record no depth.**
  - `review_depth` lives only in graph task metadata (`compile-delivery-graph.mjs`, `validate-delivery-graph.mjs:276-288`).
  - No receipt schema carries it, so rule 2 cannot be enforced.
  - **Disposition:** a prerequisite. Review receipts need a `review_depth` derived from what actually ran, such as lens count or the external launcher's receipt. Until then, a bounded receipt is refused whenever any zone is present, and the full chain applies.
- **B-2: the profile is self-declared.**
  - `delivery_profile` and the graph's `planning.mode` are author input with no anchor.
  - **Disposition:** the profile must come from a committed, repo-owned declaration in the sealed tree (an allowlist of bounded roots such as `prototypes/**`), or from owner policy. The default is contract.
- **B-3: two claims about current code were false.**
  - Exec-record and audit-implementation receipts do not bind a plan digest. Only review-plan's `reviewed_plan_digest` does.
  - `two_box`-style consumer handling verifies against the live checkout, not the commit under test. In a pre-push range check it would check the wrong tree.
  - **Disposition:** bounded must reuse `lightweight`'s committed-candidate machinery (`candidateSha`, `readCommitUtf8`, the special cases at `check-chain-receipts.mjs:964` and `receipt-issuance-epoch.mjs:491-507`).
  - Exec and audit receipts gain a plan digest, or the design stops claiming they bind it.

Majors (accepted, folded into the revision):
- **M-1: path-only zones miss real surfaces.** For example `authz.js`, `oauth`, `main.tf`, workflows, compose files, Prisma schemas, renames out of `auth/`, deleted migrations and generated files. Self-declared `flag:*` zones can't be checked by equality.
  - **Fix:** compute zones over `git diff-tree --no-renames` old and new paths, and extend and unit-test the patterns. Treat any path outside an allowlist of owned roots as a zone.
- **M-2: no single tree binds the brief digest, the index and HEAD.**
  - **Fix:** add `candidate_tree`, as `lightweight` has `eligibility_tree`. Replace re-parsing the Markdown table with a canonical-JSON `done_when` digest. Exec-record `files_touched` must sit inside the scope.
- **M-3: amendment has no mechanism.**
  - **Fix:** a `supersedes` chain on plan bodies, failing on forks. `reviewed_plan_digest` must equal the selected plan. Any amendment that adds a path or zone re-runs review-plan.
- **M-4: the v5 body's required fields were not addressed, so the problem may not be solved.**
  - **Fix:** state which v5 fields bounded drops or derives from the brief. Add the `validatePlanSchema` branch list and `assertV5LiveBindings` to the change list. Drop the unneeded emit-receipt row (`mode: inline` is already exempt from blueprints).
- **M-5: older consumers hard-fail on an unknown kind.**
  - **Fix:** gate the kind in `packageCapabilities` (a `planning_kinds` list) and test old-package rejection and unchanged v4/v5 history.

Minors m-1 to m-3 (owned-path prefix rules, mutual-exclusion tests, reuse of `validation_plan`) are accepted. The reviewer's 16 missing negative tests join the threat-model list.

## Revised direction (for the owner)

The smallest change is not a new trust model. It is **`lightweight` plus a brief**: a kind that reuses `assertLightweight`'s committed-tree replay, staged-tree binding and scope equality, and adds `brief_ref` and a canonical `done_when`.
1. Review-depth receipts (B-1) come first; until they exist, any zone means the full chain.
2. Bounded is allowed only under a committed allowlist of bounded roots (B-2).
3. Zones are computed over old and new paths with tested patterns, and unknown paths count as zones (M-1).

The bounded path stays usable today outside refuse-mode repos. In refuse mode it waits for this revision.
