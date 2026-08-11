# Framework Improvement: Automatic Stale Complete-Tuple Reclaim

**Status:** ACCEPTED
**Accepted WI:** WI-505
**Date:** 2026-07-21
**Owner session:** `019f8308-97bf-75e1-b71e-a496dbeea02c`

## Evidence

- **Source:** Owner report with a real Example Marketplace WI-496 failure and current source trace.
- **Finding:** A complete v1 tuple owned by stale session `019f7d76-65f3-73d0-9dd8-46379d081e21` remains unreleased. `resumeExisting()` calls `activeBindingOwner()` before `transferClaim()`, so `svc-ensure-worktree` exits 2 with `existing worktree binding conflict` even though the generation-bound claim transfer is independently eligible.
- **Original replay:** Run `scripts/svc-ensure-worktree.mjs --wi WI-496 --branch wi-496-native-splash-transition --from 939f0321d6fa80edbed45f8415f12f408f4644fb --json --print-cd` from `/home/svc-user/app-workspaces/example-marketplace` with the promoted installed framework.
- **Severity:** High. The canonical automatic bootstrap/recovery path is unreachable for stale foreign complete tuples, forcing unsafe manual deletion, impersonation, or break-glass workarounds.

## Diagnosis

- **Root cause:** `activeBindingOwner(worktree)` treats the first unreleased binding JSON as live authority without correlating it to the matching claim, generation, path, freshness, or v2 controller lease. `resumeExisting()` evaluates that coarse binding result before the existing compare-and-swap stale claim transfer. The earlier fail-closed binding check therefore shadows the authoritative transfer decision.
- **Category:** Fragility in authority-state ordering and duplicated liveness interpretation.
- **Already in FRAMEWORK-STATE.md?** Partially. WI-484 and WI-486 established the binding/claim tuple and transfer mechanism; WI-501 explicitly records that automatic bootstrap recovery remains broken; WI-502 added v2 durable authority and forbids implicit v1-to-v2 migration. No existing item closes this exact unreachable-transfer gap.

### Duplicate filter

| Prior WI | Existing responsibility | Why WI-505 is not a duplicate |
|---|---|---|
| WI-484 | v1 session/worktree/WI binding, freshness, and generation-bound claim transfer | Transfer exists, but `svc-ensure-worktree` cannot reach it for an unreleased stale binding. |
| WI-486 | Atomic complete-tuple bootstrap/resume and same-WI conflict handling | Complete stale tuples still fail before transfer ordering is reached. |
| WI-501 | Break-glass and read-only command recovery | Explicitly leaves the automatic documented bootstrap recovery broken; break-glass is not proof for WI-505. |
| WI-502 | v2 controller lease, handover/recovery, delegation, explicit v1 migration | WI-505 must preserve active v2 priority and must not silently migrate v1 state. |

## Acceptance Criteria

- A fresh foreign complete v1 tuple blocks with actionable owner evidence.
- A stale foreign complete v1 tuple resumes in place with `created=false` and `resumed=true`; no worktree, branch, graph, tracked, untracked, or ignored user content is deleted.
- Transfer compare-and-swaps the exact existing claim generation, increments generation exactly once, and records `transfer_from_generation`.
- Old-session bindings are retired or made non-authoritative atomically enough that they cannot reassert ownership or block a repeated same-session resume.
- Concurrent B/C reclaim attempts produce one winner; the loser fails cleanly after observing the changed generation/state.
- Same-session resume is idempotent and does not increment generation.
- Malformed, mismatched, ambiguous, symlinked, or foreign-owned authority state remains fail-closed.
- An active v2 controller lease cannot be preempted by stale-looking adjacent v1 state.
- V1 authority remains v1 unless WI-502's explicit migration contract is invoked.
- No break-glass path, manual binding/claim deletion, or old-session impersonation is used as proof.

## Implementation

- **Route:** Normal full framework pipeline: `diagnose-bug` → `design-tech` → `plan-changeset` → `review-plan` → `execute-changeset` → `review-gate` → `review-exec` → `review-security` → `audit-implementation` → `test-framework` → `land-changeset` → `verify-promotion`.
- **Candidate correction:** Select the smallest design with one authoritative freshness/generation decision shared by resume and transfer. Diagnosis must compare: claim-aware `activeBindingOwner`, atomic stale-binding retirement during transfer, or a shared authority helper. No implementation choice is locked by this proposal.
- **Expected files:** `scripts/svc-ensure-worktree.mjs`; `hooks/lib/wi-claim.mjs` only if a shared atomic transfer/retirement primitive is required; `hooks/lib/resolve-wi.mjs` only if authority resolution is inconsistent; focused Tier-1 fixtures; WI/design/plan/review/state/capability records.
- **Commits:** Pending.

## Rollback

Revert the implementation commit and its focused fixture additions as one unit. Do not rewrite or delete existing v1 claims/bindings or v2 controller leases during rollback. Because the correction must reuse current schema-compatible CAS transfer semantics, rollback restores the prior refusal behavior without an authority-state migration.

## Replay Verification

- **Replay target:** Hermetic complete-tuple fixture plus the original promoted Example Marketplace WI-496 command.
- **Required local proof:** stale A→B success; fresh A→B denial; B/C one-winner race; generation/path mismatch denial; repeat B resume without bump; active v2 non-preemption; tracked/untracked/ignored content preservation; all owner-named focused validators; full Tier-1.
- **Required promoted proof:** Exit 0 with `wi=WI-496`, current Codex owner, generation 1→2 exactly once, `created=false`, `resumed=true`; old owner never authoritative; graph/files unchanged except sanctioned ownership metadata; second ensure idempotent.
- **Result:** PENDING.
- **Evidence:** To be written by WI-505 test-framework and verify-promotion tasks.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** Add the unreachable stale-complete-tuple transfer ordering defect and its correction after promoted replay.
- **Known Gaps:** Close WI-501's automatic-bootstrap-recovery remainder without closing unrelated break-glass/read-only work.
- **Decisions:** Record one authoritative v1 freshness/generation decision and explicit v2 precedence.
- **Capabilities:** Update `references/knowledge/svc/CAPABILITIES.md` to state automatic stale complete-tuple reclaim only after installed replay passes.

## Scope Boundary

This proposal contains one gap only: automatic safe reclaim of a stale foreign complete v1 binding/claim tuple through the existing generation-bound bootstrap path. It does not change host payloads, add a new authority backend, migrate v1 to v2, alter delegation, or absorb WI-504 residue reconciliation.
