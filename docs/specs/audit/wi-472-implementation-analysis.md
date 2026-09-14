# Systems Analysis: WI-472 Deterministic Bounded Reconcile

**Date:** 2026-07-21
**Branch:** `framework-WI-472-deterministic-bounded-reconcile`
**Spec:** `docs/specs/work-items/WI-472.md`
**Mode:** full

## Headline

READY TO LAND. The initial G6 design was rejected and the first notes apply was rolled back after audit exposed fail-open attestation validation. The corrected implementation completed the hard three-round review cap with zero unresolved Critical/High findings and 78/78 final row certifications. The final notes apply is portable, zero-waiver, and checker-valid in both the canonical checkout and a fresh mirror-empty worktree.

Concern scan: no registered concern matched. Specialist coverage: runtime/performance, attestation/security, and testing. The specialists produced three Critical/High classes; all are fixed and regression-tested below.

## Scope Drift

| Surface | Classification | Evidence |
|---|---|---|
| `scripts/check-chain-receipts.mjs` + attestation schema | JUSTIFIED G6 correction | Replaces rejected fabricated phase envelopes with a distinct fail-closed attestation class. |
| tracked round-3 launcher artifacts | JUSTIFIED audit correction | Makes independent-review evidence portable and re-verifiable after landing. |
| `.gitignore` reconcile-drive entry | JUSTIFIED runtime classification | Drive locks/outcomes/apply receipt are machine-local; durable authority is Git notes plus tracked review evidence. |
| additional focused validators | JUSTIFIED audit correction | Prove the exact forgery, timeout, generation-race, and terminal-outcome regressions found during audit. |

No unrelated product/framework source was changed. The dirty default checkout and WI-504 worktree remained untouched.

## Verification Contract

| AC | Required behavior | Result |
|---|---|---|
| RC-01 | Every reconcile child bounded at ≤20s; timeout/spawn error is degraded evidence | CONFIRMED — bounded adapter tests timeout and spawn-error; git-log timeout integration blocks checkpoint advance. |
| RC-02 | Existing checkpoint uses one range call; live batch/per-SHA sets equal | CONFIRMED — frozen 78-row comparison reports identical sets. |
| RC-03 | Pre-push validates one range per branch ref and preserves notes/deletion handling | CONFIRMED — hook owns enumeration once per input ref; notes and deletion branches remain explicit. |
| RC-04 | Detached atomic per-SHA drive with duplicate suppression and durable outcome | CONFIRMED — O_EXCL descriptor is written/fsynced before close; UUID generation prevents stale-owner finalization. |
| RC-05 | Watcher advances only for GitHub availability plus verified/terminal-success coverage | CONFIRMED — state matrix, hung-GitHub path, malformed outcome rejection, and terminal-success main-flow test pass. |
| RC-06 | Five locked legacy states remain equal outside additive metadata | CONFIRMED — frozen base binary and new binary match canonical locked output and exit status for all five states. |
| RC-07 | Five live preflights p95 <10s; hung GitHub <20s without watcher advance | CONFIRMED — live walls 2036/1727/1790/1796/971ms, nearest-rank p95 2036ms; simulated hang returns under 2s and preserves cutoff. |
| RC-08 | Timeout and watcher validators prove mutation-red before green | CONFIRMED — both focused validators pass their red/green contracts. |
| RC-09 | All 78 portable gaps reach honest notes authority with zero waivers | CONFIRMED — final G6 request `0851780c-2053-4c96-9bd3-af4b68e67a65` certified 78/78; checker recomputes tracked row/Git evidence; applied notes OID `0784e69b00f8911f5bc0bf9790fe186fc1bce448`; zero waiver paths/tokens. |
| RC-10 | Canonical and fresh worktree return the same zero-unaccounted set | CONFIRMED — both report 156 total, 0 failed, 78 `retroactive-attestation`; fresh worktree began without `.svc/receipts`. |

## Coverage Ledger

| Subsystem | Risk | Evidence | Status |
|---|---|---|---|
| Bounded reconcile/runtime | High | bounded + watcher + old-binary validators; five live preflights | done |
| Drive lock/outcome concurrency | High | generation-owner finalizer and terminal-success integration | done |
| Historical attestation trust | Critical | tracked authority recomputation; four forgery negatives; shell-injection negative | done |
| Review materialization/apply | Critical | missing-review and tampered-package negatives; canonical certification rebinding; CAS rollback | done |
| Pre-push range batching | Medium | code trace and golden structural invariant | done |
| Documentation/state | Low | manifest linter, persistence check, markdown/frontmatter validators | done |

## Hypotheses and Findings

### A-1: A forged attestation may bypass the mandatory chain

**Severity:** Critical, resolved. **AC:** RC-09/RC-10.

Observed in the first audit: hash-shaped arbitrary values and declared cross-family strings were accepted. Fixed by loading tracked ledger/bundle/review authority, recomputing ledger/bundle/basis and Git commit/patch/tree evidence, enforcing the exact 78-SHA allowlist/range/property set, re-deriving reviewer families, and opening the tracked launcher artifacts. The validator now accepts the reviewed row and rejects wrong-tree, same-family, wrong-basis, extra-waiver-property, and shell-injection fixtures.

### A-2: Commit-discovery timeout may look like an empty interval

**Severity:** High, resolved. **AC:** RC-01/RC-05.

The original bounded wrapper collapsed failed Git output to an empty string. Fixed by carrying the child classification into `discovery-failed`, inserting a blocking unaccounted row, and preserving the checkpoint. A 100ms timed-out Git-log integration exits refuse mode nonzero and proves the SHA does not advance.

### A-3: A stale drive may clobber or unlink its replacement

**Severity:** High, resolved. **AC:** RC-04/RC-05.

Fixed with UUID generation ownership written through the exclusive lock descriptor. Only the current generation may publish/unlink. The deterministic stale-generation test proves the old owner cannot change the new running outcome or remove its lock. A valid terminal success is reused without rescheduling and advances the watcher in the main flow.

### A-4: Review/apply may trust substituted or absent artifacts

**Severity:** High, resolved. **AC:** RC-09.

Review is mandatory for normal validate/apply. Materialization binds launcher kind/status, base package hash, receipt-to-findings path, effective tuple, and all 78 family/key/basis certifications. Apply re-reads the tracked launcher artifacts and re-binds every row. Tampered-package and absent-review fixtures fail.

### A-5: Residual final-round observations

**Severity:** Low/Info, accepted. The generation finalizer has a theoretical same-path external-actor TOCTOU outside the cooperative lock contract; normalized patch evidence assumes the supported Git runtime; one canonical reviewer invocation covered code and all explicitly listed rows. None violates an AC or leaves a Critical/High risk.

## Pre/Post Evidence

`docs/specs/test-evidence/WI-472/pre-post-validation.json` passes `validate-pre-post-validation-evidence.mjs`. It records four correction iterations, the final six-validator command, five live timings, batch/per-SHA equality, both portability checks, and the final notes transaction OIDs.

Full Tier-1 before audit cleanup reported 263 pass / 3 fail. Two branch-introduced failures were fixed: bare mutating Git in a fixture and uncovered reconcile runtime residue. The remaining skip-registry failure is pre-existing in untouched `.svc/lane-tasks-WI-498.json` tasks 5/6; WI-472's own skip-integrity now passes.

## Residue and Unverified Surfaces

- No TODO/FIXME or temporary feature flag was introduced.
- `.svc/reconcile-drive/` is explicitly machine-local and ignored; the notes backup ref remains as rollback evidence through promotion verification.
- Production behavior is a local CLI/framework gate; no remote deploy target or visual journey exists.
- The unrelated WI-498 skip-integrity debt is not modified by WI-472.

## Verdict

- [x] READY TO LAND — no unresolved Critical or High finding.
- [ ] BLOCKED.
- [ ] CONDITIONAL.
