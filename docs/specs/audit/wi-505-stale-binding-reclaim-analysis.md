# Systems Analysis: WI-505 stale binding reclaim

**Date:** 2026-07-21
**Branch:** `framework-WI-505-stale-binding-reclaim`
**Mode:** full — concurrency and mutation-authority hot path, more than 200 changed lines
**Spec:** `docs/specs/features/wi-505-stale-binding-reclaim.md`
**Manifest:** `docs/plans/2026-07-21-wi505-stale-binding-reclaim/manifest.md`

## Headline

The final staged implementation satisfies SR-01 through SR-14 in hermetic code/runtime evidence. SR-15 remains deliberately unverified until the change is merged, installed, and replayed against the real Example Marketplace WI-496 tuple. The audit found one High crash/provenance defect, one Medium authority-ambiguity defect, one Medium race-harness hang risk, and one Medium manifest-deviation gap in the earlier diff. All four were corrected; fresh G5 and the renewed cross-family review report 0 Critical, 0 High, and 0 Medium on the corrected freeze.

Concern coverage is complete: `auth-surface`/`session-management` are covered by the final security report; `security-cross-family-review` is covered by the canonical Claude Opus corrected-freeze review. Keyword-only OAuth, DNS, pricing, provider, i18n, and browser concern matches are inapplicable to the local filesystem/Git authority path.

## Scope drift

The production surface matches the reviewed design: `hooks/lib/wi-claim.mjs` and `scripts/svc-ensure-worktree.mjs`. The focused public fixture remains `validate-default-checkout-isolation.sh`. Two isolated-copy fixtures also copy `authority-store.mjs` because `wi-claim.mjs` now statically imports it; those dependency-closure edits are explicitly recorded in the manifest and do not change assertions or production behavior.

Planning, proposal, WI/index, decision, review, security, audit, state/capability, and `.svc` ledger files are required pipeline artifacts rather than product/runtime scope. `resolve-wi.mjs` and `authority-store.mjs` remain unchanged runtime dependencies. No unrelated production file, package manifest, lockfile, UI surface, migration schema, deletion path, or external integration changed.

## Verification contract

| Requirement | What the implementation must do | Evidence and status |
|---|---|---|
| SR-01 | Fresh foreign complete tuple denies with owner, generation, and worktree evidence | `resumeExisting()` emits all three at `scripts/svc-ensure-worktree.mjs:602`; fixture checks exact values at `validate-default-checkout-isolation.sh:563`. **Confirmed.** |
| SR-02 | Stale foreign complete tuple resumes the existing registered worktree with `created=false`, `resumed=true` | Shared classification/transfer at `svc-ensure-worktree.mjs:598-637`; public fixture result assertions at lines 533-536. **Confirmed.** |
| SR-03 | Transfer is CAS-bound to the exact observed generation and records current provenance | Locked reinspection/expected-generation checks at `wi-claim.mjs:668-705`; in-memory winner and first durable provenance write at lines 706-722. **Confirmed.** |
| SR-04 | Generation advances once and old source is retired without being able to regain authority | Source retirement is inside the claim lock after CAS; fixture asserts gen2, `transfer_from_generation=1`, source release, and old resolver denial at lines 538-548. **Confirmed.** |
| SR-05 | Old/lower-generation bindings never become authoritative or block repeated winner resume | Inspector selects only current generation and denies same-generation foreign owners; fixture checks old owner non-authority and repeated B resume with no gen3. **Confirmed.** |
| SR-06 | Concurrent reclaim attempts have one winner and a clean changed-state loser | Claim-path lock plus expected generation; bounded two-child barrier asserts one success/one loser at fixture lines 688-748 and preserves race user bytes. **Confirmed.** |
| SR-07 | Same-session resume does not increment generation | Existing resolver fast path at `svc-ensure-worktree.mjs:579-591`; repeated B result remains generation 2. **Confirmed.** |
| SR-08 | Malformed, ambiguous, symlinked, foreign-owned, and insecure state denies before mutation | Secure directory/file checks at `wi-claim.mjs:351-399`; negative fixture matrix at lines 624-680 plus malformed-v2 case. **Confirmed.** |
| SR-09 | Claim/binding WI, repo, worktree, branch, path, owner, and generation must match | Exact inspector comparisons at `wi-claim.mjs:447-507`; fixture mutates every coordinate and adds a valid-hash same-generation foreign binding. **Confirmed.** |
| SR-10 | Any canonical v2 record or uncertain v2 evidence excludes v1 acquisition | v2 decision before classification and transfer at `wi-claim.mjs:406-420,458-459,672-675`; active, malformed, and symlinked v2 fixtures preserve all bytes. **Confirmed.** |
| SR-11 | Standard v1 acquisition never silently migrates to v2 | Public fixture asserts absent v2 root; no migration helper is called; explicit v2 lifecycle files/schemas are unchanged. **Confirmed.** |
| SR-12 | Reclaim preserves tracked, untracked, ignored, graph, branch, HEAD, and worktree registration | Pre/post SHA and Git identity assertions at fixture lines 515-561; race-specific user hashes at lines 688-748. **Confirmed.** |
| SR-13 | No break-glass, impersonation, graph/worktree/file deletion is used as proof | Production diff contains metadata atomic writes only; fixture invokes the normal public ensure path and proves user/Git identities unchanged. **Confirmed.** |
| SR-14 | Full planned authority/review/test/land/verify chain remains mandatory | Lane graph contains the full sequence; review/security/audit receipts exist. Focused/full testing, landing, installation, and replay remain distinct downstream tasks. **Confirmed through current gate.** |
| SR-15 | Promoted installed framework reclaims real Example Marketplace WI-496 gen1→gen2 once and repeats idempotently | Intentionally pending `verify-promotion`; hermetic evidence cannot substitute for the real promoted replay. **Not yet verified.** |

## Coverage ledger

| Subsystem | Entrypoint | Risk | Status | Open findings |
|---|---|---|---|---|
| Exact v1/v2 classification | `inspectV1AuthorityTuple()` | Critical authority | audited and independently reviewed | none |
| Generation CAS and retirement | `transferClaim()` | Critical concurrency/data integrity | audited, corrected, crash-tested | none |
| Winner crash recovery | `finalizeTransferredClaim()` | High idempotence | audited, failpoint-tested | none |
| Public bootstrap resume | `resumeExisting()` | High authority/orchestration | end-to-end fixture green | none |
| Hermetic authority matrix | default-checkout isolation fixture | High proof quality | bounded and green 14/14 | none |
| Isolated dependency-copy fixtures | Codex integrity/task-state compatibility | Medium regression closure | manifest-justified; pending final focused sweep | none |
| Documentation/state | WI/spec/state/capability/reviews | Medium truthfulness | distinguishes implemented, tested, promoted, and live-proven states | none |

## Hypotheses and outcomes

1. **A generation winner can become durable before current provenance.** Confirmed in the earlier diff: `claimWIUnlocked()` wrote before `transferClaim()` added current provenance. Fixed by `defer_write`; the transfer now performs one first durable winner write. The public failpoint reproduces the exact post-CAS/pre-retirement state and recovery.
2. **A different-session binding at the claim generation can be ignored.** Confirmed in the earlier diff. Fixed by rejecting `conflictingCurrentOwners` before freshness/transfer; the exact hashed-binding fixture proves no bytes change.
3. **Two reclaimers can both win generation N+1.** Falsified. Both children pre-read N, the claim lock serializes reinspection, and the loser reports generation/state change.
4. **Malformed v2 evidence can be mistaken for absence.** Falsified from unchanged dependency source and runtime proof. `readJson()` returns null only for absence and throws for present corrupt/insecure evidence; `assertLease()` rejects invalid records; the new malformed-v2 fixture preserves all bytes.
5. **Crash recovery can increment generation twice or revive A.** Falsified on corrected code. The failpoint leaves B/N+1 with exact provenance and A/N unreleased; retry retires A, binds B at N+1, and the idempotent finalizer loser returns success without another write.
6. **Authority reclaim can damage worktree/user content.** Falsified by tracked, untracked, ignored, graph, HEAD, branch, registration, and race-specific byte oracles.

## Findings convergence

### AUD-1 — first durable claim write lacked current provenance

**Original severity:** High
**Type:** crash consistency / required-invariant violation
**Disposition:** fixed and independently certified

The earlier `transferClaim()` called a writing `claimWIUnlocked()` and only afterward added the current source generation/session. A kill between writes could strand an unprovenanced winner or retain stale older provenance. `claimWIUnlocked()` now supports a private deferred write; transfer constructs exact provenance in memory and its first durable CAS write is complete. The failpoint-driven public test proves forward completion at the same generation.

### AUD-2 — same-generation foreign owner binding was ignored

**Original severity:** Medium
**Type:** fail-closed authority ambiguity
**Disposition:** fixed and independently certified

The earlier inspector filtered current candidates to the claim owner before checking ambiguity. It now denies any current-generation mutating binding whose session differs from the claim owner. The fixture creates a correctly hash-named, exact-coordinate foreign binding and requires claim/binding byte identity after denial.

### AUD-3 — race harness could wait indefinitely

**Original severity:** Medium
**Type:** test reliability
**Disposition:** fixed

The parent readiness wait is bounded, detects early child exit, terminates surviving children on failure, and handles children that exit before the final listener is attached.

### AUD-4 — dependency-copy fixture edits absent from manifest table

**Original severity:** Medium
**Type:** plan/scope evidence
**Disposition:** fixed

The two static-import dependency-closure fixture edits are now declared with their non-behavioral justification.

No Critical, High, or Medium finding remains open.

## Residual Low and compatibility notes

- Independent v1/v2 locks permit a benign v1 generation metadata write if an explicit v2 migration races after the precheck. Final resolution re-reads v2 and denies public v1 success; v2 remains authoritative. A cross-store transaction redesign is outside WI-505/WI-502's explicit migration contract.
- A legacy noncanonical symlink spelling of equivalent coordinates can false-deny because stored comparisons use `path.resolve` after the inspector canonicalizes its own roots. This cannot grant authority.
- A process killed inside the old pre-WI-505 transfer window can leave incomplete legacy provenance that the new recovery path denies. Complete legacy tuples remain compatible; uncertain incomplete authority stays fail closed.
- Direct legacy `transferClaim()` without `complete_tuple` remains compatible but does not retire the source binding. The public automatic path always uses the complete-tuple contract.
- Binding inspection is synchronous and linear in one worktree's retained binding files. This is acceptable for a local CLI bootstrap; 1,000+ retained bindings remains the documented scaling trigger.

## Pre/post and validation evidence

- Pre-change hermetic public stale transfer: `/tmp/wi505-red.log`, exit 1 with the reproduced foreign owner conflict at base `d2243795a73a2792e56675afdba5fb61eb15bdd5`.
- Structured pre/post evidence: `.svc/review-artifacts/WI-505/pre-post-validation.json`; `validate-pre-post-validation-evidence.mjs` returns PASS.
- Corrected focused public fixture: `validate-default-checkout-isolation.sh`, 14 passed / 0 failed after the audit fixes and again after malformed-v2 coverage.
- Fresh G5 Agent B: PASS, 0 Critical / 0 High / 0 Medium.
- Renewed canonical corrected-freeze review: round 2 rubric 9, 0 Critical / 0 High / 0 Medium / 1 accepted Low.
- Full owner-named focused sweep and full Tier-1 are intentionally the next task, not claimed by this audit.

## Residue and unverified surfaces

No `TODO`, `FIXME`, temporary flag, dead import, dependency, schema migration, browser surface, or deletion path remains in the changed runtime files. The deliberate `SVC_ENSURE_FAILPOINT=after-claim-transfer-cas` hook is exact-value gated, complete-tuple-only, and required to prove the real crash ordering.

The only acceptance surface not yet verified is promoted/live SR-15. Remote PR checks, receipt attachment, merge, host installation, and the real Example Marketplace tuple are external to this pre-landing audit.

## Verdict

- [x] READY FOR MANDATORY TEST-FRAMEWORK GATE — no unresolved Critical/High/Medium finding.
- [ ] READY TO LAND — not until focused and full Tier-1 complete and receipts bind the final commit.
- [ ] BLOCKED

This verdict does not call WI-505 fixed. Promotion and the original WI-496 command remain mandatory proof.
