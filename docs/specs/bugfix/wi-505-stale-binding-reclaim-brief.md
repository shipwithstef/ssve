# WI-505 Bugfix Brief: Automatic Stale Complete-Tuple Reclaim

**Status:** diagnosis complete; ready for technical design
**Domain:** local framework authority-state defect
**Causal class:** action bug — the documented stale-reclaim transition is eligible but unreachable

## Spec and journey anchor

The affected operator is a Codex session resuming an existing governed worktree after its former session has become provably stale. The expected behavior is already defined by J-FW-05:

- S8 preserves complete-tuple identity and user residue.
- S9 permits exactly one generation-bound race winner.
- S10 requires exact session/worktree/WI/branch/claim/generation correlation.
- S11 forbids implicit v1-to-v2 migration.
- S14 transfers authority by compare-and-swap and keeps same-session resume generation-stable.

WI-484 supplies the v1 binding/claim contract, WI-486 supplies complete-tuple bootstrap and stale transfer, WI-501 records that the automatic recovery path remains broken, and WI-502 gives active v2 controller leases priority plus an explicit-only migration contract.

## Reproduction

**Owner-reported trigger:** In Example Marketplace Port, WI-496 has an existing complete v1 tuple at generation 1 owned by stale session `019f7d76-65f3-73d0-9dd8-46379d081e21`. A new Codex session runs:

```bash
node /workspace/seriousvibecoding/scripts/svc-ensure-worktree.mjs \
  --wi WI-496 \
  --branch wi-496-native-splash-transition \
  --from 939f0321d6fa80edbed45f8415f12f408f4644fb \
  --json --print-cd
```

**Expected:** Compare-and-swap generation 1 to 2, record `transfer_from_generation=1`, retire the source binding as authority, and return `created=false`, `resumed=true` without changing the worktree, branch, graph, or user files.

**Actual:** The command exits 2 before transfer:

```text
[svc-ensure-worktree] existing worktree binding conflict
(owned by 019f7d76-65f3-73d0-9dd8-46379d081e21)
```

### Hermetic proof

A temporary bare origin and clone were created, then `svc-ensure-worktree` produced a complete WI-505 tuple for session A at generation 1. The worktree was dirtied with tracked, untracked, and ignored files. Its claim was changed to a same-host, dead-PID stale claim while its binding remained unreleased.

- Automatic A-to-B ensure reproduced the same exit-2 conflict with A's exact owner id.
- Calling `transferClaim()` directly against expected generation 1 succeeded, produced generation 2, and recorded `transfer_from_generation=1`.
- SHA-256 digests of all three dirty files were identical after the failed automatic call.

This is deterministic and hermetic: local Git and Node only, no network, model, manual state deletion, old-session impersonation, or break-glass.

## Targeted reading and classification

| Surface | Classification | Evidence |
|---|---|---|
| `scripts/svc-ensure-worktree.mjs` | drift | The SIB-14/15 comment promises stale complete-tuple reclaim, but `activeBindingOwner()` returns the first unreleased binding and `resumeExisting()` checks it before `transferClaim()`. |
| `hooks/lib/wi-claim.mjs` | partial match | `isClaimStale()` and `transferClaim()` correctly enforce stale/released proof plus generation CAS. Transfer changes only the claim; it neither validates nor retires the corresponding source binding. |
| `hooks/lib/resolve-wi.mjs` | match | Exact-session authority already requires secure claim path, fresh attributable owner, exact worktree, exact generation, valid graph, and compatible active v2 lease. An old generation binding cannot resolve as owned. |
| `hooks/lib/authority-store.mjs` | match | V2 leases have their own active/released state, principal, generation, revision, handover, and recovery rules. V1 migration is explicit, backed up, digest-checked, and reversible. |
| Focused Tier-1 fixtures | gap | Direct claim-transfer CAS and complete-tuple bootstrap are tested separately; no fixture joins them through stale foreign `svc-ensure-worktree`, tests dirty in-worktree bytes, or proves active-v2 priority over stale-looking v1 residue. |

## Fault isolation

Current state transition:

```text
complete v1 tuple A/gen1
  -> read A binding as merely "unreleased"
  -> classify A as liveOwner
  -> conflict/exit 2
  X  read authoritative claim freshness + exact generation
  X  transferClaim(A/gen1 -> B/gen2)
  X  bind B/gen2 and verify complete tuple
```

The direct primitive follows the intended path:

```text
read claim A/gen1 -> prove stale -> CAS expected gen1
  -> write B/gen2 + transfer_from_generation=1
```

The ordering defect therefore shadows a working transfer primitive. Reordering alone is still insufficient: it leaves A's unreleased binding as residue, duplicates tuple classification, and would mutate v1 before discovering an adjacent active v2 lease during final verification.

## Root cause

**Immediate cause:** `activeBindingOwner()` equates `released_at` absence with live authority and runs before the claim's canonical stale/generation decision.

**Enabling condition:** resume, transfer, and resolution do not share one exact v1 binding/claim classifier. `transferClaim()` compare-and-swaps only the claim, so the bootstrap caller has no primitive that both validates the source complete tuple and retires the source binding after the claim generation changes.

**Systemic cause:** bindings were treated as independent liveness records in several conservative consumers even though WI-484/WI-486 authority is a correlated tuple and WI-502 may supersede v1 with a controller lease. The tests prove isolated pieces but not the joined recovery state machine.

**Prevention:** Every authority mutation must consume one exact, secure, generation-aware tuple classification and test the complete public transition, including adjacent authority versions and crash/race residue.

## Correction options

| Option | Decision | Reason |
|---|---|---|
| A. Make `activeBindingOwner()` claim- and generation-aware | Reject alone | It could reach transfer, but duplicates transfer validation, does not retire the source binding, and does not protect active v2 before mutation. |
| B. Retire stale bindings inside transfer | Reject alone | Correct post-CAS cleanup, but the current pre-transfer binding conflict remains unreachable and source tuple ambiguity/mismatch needs a shared decision. |
| C. Shared exact authority helper used by resume and transfer | Select | One classifier can validate security, identity, path, owner, freshness, and generation; the locked transfer can CAS the exact claim then retire the exact source binding. Resume can ignore only provably obsolete generations and fail closed on malformed, mismatched, or ambiguous state. |

The selected correction incorporates B inside C: under the claim lock, validate the exact source tuple and expected generation, deny any active v2 controller lease before v1 mutation, write the generation+1 claim, then mark the exact old binding released/obsolete. The claim CAS is the authority linearization point: after it commits, the old generation binding cannot resolve as authoritative even if a crash occurs before its retirement write. A subsequent resume can forward-complete the new owner's binding without another generation bump.

## Required behavioral contract

- Fresh foreign complete tuple: deny with owner, generation, and worktree evidence.
- Stale foreign complete tuple: resume in place with `created=false`, `resumed=true`.
- Transfer: compare-and-swap the exact claim generation; increment once; record `transfer_from_generation`.
- Old binding: never authoritative after the claim CAS and never blocks later valid resumes.
- Race: B/C with the same observed generation produces one winner; loser reports changed generation/state and performs no file deletion.
- Same-session replay: verify the current tuple and keep generation unchanged.
- Corrupt state: malformed JSON, insecure/symlink/foreign-owned paths, identity mismatch, generation mismatch, wrong claim path, wrong worktree/repository/branch/WI, or multiple current candidates deny before mutation.
- V2: any active controller lease for the repository/WI denies v1 reclaim before the claim changes; standard ensure never creates or migrates v2.
- Data: worktree, branch, graph, tracked, untracked, and ignored user bytes remain untouched; only sanctioned claim/binding metadata changes.
- Recovery proof: no break-glass, manual state deletion, or old-session impersonation.

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|---|---|---|
| 1 | Product fit | unchanged | Deterministic isolated recovery remains the framework goal; the fix restores documented bootstrap behavior. |
| 2 | Journey | affected | J-FW-05 already contains the relevant contention/recovery states; map WI-505 to S8/S9/S10/S11/S14 without adding a browser journey. |
| 3 | Acceptance criteria | affected | Add the full stale/fresh/race/mismatch/idempotence/v2/data-preservation matrix above to WI-505 and its plan. |
| 4 | UX | affected | CLI denial must retain actionable owner/generation evidence; successful JSON fields remain stable. No visual UX applies. |
| 5 | UI | N/A | No browser, component, asset, viewport, or visual state exists. |
| 6 | Tech architecture | affected | Shared tuple classification, transfer linearization, binding retirement, v2 precedence, crash ordering, and rollback require `design-tech`. |
| 7 | Cost model | unchanged | Local file/Git checks only; no paid or remote hot-path call is introduced. |
| 8 | Operations & ownership | affected | Installed refresh, old-owner classification, repeat resume, review receipts, and live WI-496 replay are mandatory operational proof. |

No pillar remains unknown.

## Pattern Scan

Repository-wide active-source scanning found every consumer that reads binding `released_at`:

| Consumer | Classification | WI-505 action |
|---|---|---|
| `scripts/svc-ensure-worktree.mjs::activeBindingOwner` | unsafe authority blocker | Replace with shared exact tuple classification. |
| `hooks/lib/resolve-wi.mjs::readBinding` | safe selector | It selects only the current session's candidate, then `bindingDecision()` enforces freshness, owner, path, generation, graph, and v2 compatibility. No change required. |
| `hooks/lib/wi-claim.mjs::conflictingBindingInSibling` | conservative session-uniqueness blocker | It may over-block obsolete residue but does not grant authority. Keep out of the minimum bootstrap correction; the new transfer retires its exact source binding. |
| `scripts/worktree.sh::_binding_status_rows` | safe diagnostic | It correlates claim freshness and generation before reporting `fresh`. |
| `scripts/worktree.sh` remove guard | conservative deletion blocker | It correlates claim freshness but not generation; false blocking is fail-closed and outside automatic resume. No authority grant or deletion occurs. |
| `scripts/svc-migrate-task-state.mjs::foreignFreshOwner` | conservative migration blocker | It treats an unreleased binding as a block, but only prevents a privileged state migration/restore. Changing that destructive boundary is a separate risk and is not required for WI-505. |
| `hooks/svc-task-completion-guard.sh` | safe delegated resolver | Binding-file presence opts into strict mode, but actual authority is decided by shared `authorityJson`; foreign/stale/malformed tuples are advisory and never select a graph. |

No second fail-open authority grant was found. The conservative deletion/migration/session-uniqueness blockers remain intentionally fail-closed and do not prevent the canonical WI-505 bootstrap once the exact source binding is retired.

## Register Discoveries

**Corrections found:** one cohesive gap — the automatic stale complete-tuple transition lacks a shared exact tuple decision and locked source-binding retirement.

**Decomposition:** keep one WI. The v1 classifier, CAS ordering, v2 precedence, race behavior, and residue proof are inseparable parts of one public bootstrap transition. WI-504 state, WI-501 break-glass/read-only behavior, WI-502 v2 migration/handover, and conservative migration/removal policies remain outside scope.

## Implementation-ready surface

- `hooks/lib/wi-claim.mjs`: shared secure v1 binding/claim classification and a generation-bound transfer mode/primitive that retires the exact source binding after the claim CAS.
- `scripts/svc-ensure-worktree.mjs`: remove coarse `activeBindingOwner`; enumerate/classify the complete tuple, deny active v2 before v1 mutation, invoke the shared transfer path, bind the winner, and verify through `authorityJson`.
- `hooks/lib/authority-store.mjs`: read-only canonical v2 lease query only if the existing export is insufficient; no lease schema or migration change.
- `hooks/lib/resolve-wi.mjs`: no behavior change expected; use as the postcondition oracle and change only if design finds duplicated inconsistency.
- `test-framework/evals/tier-1/validate-default-checkout-isolation.sh` or a narrowly named authority fixture: add the complete required stale/fresh/race/mismatch/idempotence/v2/dirty-file matrix.
- WI-505, technical design, plan/reviews, `FRAMEWORK-STATE.md`, and `references/knowledge/svc/CAPABILITIES.md`.

## Affected artifacts

- **Specs and journeys:** WI-505, this brief, J-FW-05 scenario mapping, and the forthcoming technical design.
- **Acceptance criteria:** SR-01 through SR-15 in `docs/specs/work-items/WI-505.md`.
- **Runtime code:** bootstrap resume orchestration and the v1 claim/binding store; the v2 store is read-only unless design proves a narrow helper is required.
- **Fixtures:** complete-tuple bootstrap, binding/claim authority, v2 lease, operation-scope, Codex activation, focused replay, and full Tier-1.
- **Framework knowledge:** `FRAMEWORK-STATE.md` and `references/knowledge/svc/CAPABILITIES.md` only after promoted behavior is proven.
- **Operational evidence:** plan and execution reviews, security and implementation audits, review/merge receipts, installed-framework validation, and the live Example Marketplace Port WI-496 replay.
- **N/A:** browser E2E, visual artifacts, product UI journeys, database migrations, provider contracts, and external research.

## Proof of fix

1. Red/green hermetic stale complete v1 tuple A to B automatic reclaim.
2. Fresh A to B denial with actionable evidence.
3. Simultaneous B/C automatic reclaim with one successful generation-2 winner and one clean loser.
4. Claim/binding generation or path mismatch denial before mutation.
5. Repeated winner resume with no generation-3 bump.
6. Active v2 lease plus stale-looking v1 residue denies v1 mutation; v1 state does not become v2.
7. Tracked, untracked, ignored, graph, branch, and worktree identity remain unchanged.
8. Owner-named focused validators, syntax checks, then full Tier-1.
9. Sanctioned PR/review-receipt landing, installed framework refresh, and promoted Tier-1 replay.
10. Original Example Marketplace Port WI-496 command returns exit 0 with generation 1 to 2 exactly once, current owner, `created=false`, `resumed=true`; old owner is never authoritative and the second ensure is idempotent.

## Learnings

An unreleased binding is an index entry, not independent proof of live authority. Authority exists only when the binding and claim form one secure, fresh, exact-generation tuple and no higher-version controller lease supersedes it. Recovery tests must exercise the public state transition, not certify its isolated primitives separately.

## Causal Chain Summary

```yaml
symptom: "svc-ensure-worktree rejects a stale foreign complete tuple as a live binding conflict"
proximate_cause: "activeBindingOwner returns the first unreleased binding before claim transfer runs"
root_cause: "resume and transfer do not share one secure freshness and generation-aware tuple classifier"
systemic_cause: "binding residue was treated as independent liveness evidence and isolated fixtures never joined bootstrap to CAS transfer"
prevention: "linearize recovery on exact claim generation, retire the exact source binding, honor active v2 first, and test the public transition"
```

## Pillars Coverage Matrix

| # | Pillar | State | Artifact / note |
|---|---|---|---|
| 1 | Product fit | [UNCHANGED — VERIFIED] | WI-484/WI-486 deterministic isolation contract |
| 2 | Journey | [UPDATED] | WI-505 maps J-FW-05 S8/S9/S10/S11/S14 |
| 3 | Acceptance criteria | [UPDATED] | WI-505 stale/fresh/race/mismatch/idempotence/v2/data matrix |
| 4 | UX | [UPDATED] | Actionable CLI conflict evidence; stable JSON success fields |
| 5 | UI | [N/A — justified] | Headless local CLI, no visual surface |
| 6 | Tech architecture | [UPDATED] | Mandatory WI-505 technical design |
| 7 | Cost model | [UNCHANGED — VERIFIED] | Local-only bounded file/Git work |
| 8 | Operations & ownership | [UPDATED] | Installed promotion and live WI-496 replay |

**Next:** `design-tech` must define the exact classifier contract, lock order, v2 precondition, crash states, race loser, and rollback before implementation.
