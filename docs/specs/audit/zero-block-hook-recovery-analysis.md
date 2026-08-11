# Systems Analysis: zero-block hook recovery

**Date:** 2026-08-11
**Branch:** `framework-WI-531-zero-block-hook-recovery`
**Base:** `ac42091bc0015f87f9cdae50251570021d7c17fb`
**Audited implementation:** post-`43994852` audit-remediation candidate (exact commit recorded after re-review)
**Spec:** `docs/specs/features/zero-block-hook-recovery.md`
**Mode:** full

## Scope and concern audit

The actual diff is covered by the manifest's grouped file sets. The proposal
moves, state-ledger rows, residual maps, and review/audit artifacts are governed
closure evidence rather than unrelated product changes. No product code,
database schema, provider API, or production environment is modified.

Concern scanning matched one path-based CRITICAL (`auth-surface`) and five HIGH
routes. `docs/specs/security/zero-block-hook-recovery-review.md` satisfies the
required security lens and explains why the session-contract row is SVC routing
metadata, not product authentication. `review-cross-model`, `write-spec`,
`review-gate`, and the pending `verify-promotion` task satisfy the remaining
required handlers. The pricing/provider matches are path-only documentation
matches and introduce no price or provider integration.

## Verification contract

| AC | Required behavior | Audit result |
|---|---|---|
| AC-531-1 | Proven reads need no WI/lease/override | CONFIRMED: 35 allow/deny/performance checks and zero authority residue. |
| AC-531-2 | Canonical loader activates exactly the first runnable task | CONFIRMED: activation, hostile shadow, crash/retry, and linked-worktree fixtures pass. |
| AC-531-3 | Exact controller-v2 bootstrap is idempotent | CONFIRMED by repeated exact same-principal bootstrap fixtures and the live same-session resume used during this audit. |
| AC-531-4 | Preserved same-owner lineage repairs safely; ambiguity fails closed | CONFIRMED by branch-lineage, symlink, duplicate-registration, foreign-owner, partial-write, rollback, and containment fixtures inherited and replayed from WI-529/WI-530. |
| AC-531-5 | Routine continuation needs no owner-recovery command | IMPLEMENTED; installed-state proof remains G7. The old disabled hook reproduced the former deadlock before audit activation. |
| AC-531-6 | Runtime targets canonicalize without poisoning authority | CONFIRMED: operation-scope target matrix PASS. |
| AC-531-7 | At most one automatic repair/retry; no denial loop | CONFIRMED by bounded dispatcher/recovery fixtures; installed consumer replay remains G7. |
| AC-531-8 | Host hook topology is manifest exact and preserves unrelated config | CONFIRMED by all-host, Codex, Kimi, AGY, and governed-routing validators. |
| AC-531-9 | Default setup is digest-incremental; `--full` rebuilds | CONFIRMED: byte-stable no-op and source-byte invalidation PASS. |
| AC-531-10 | Eight hosts, locks, bounded concurrency, performance budgets | CONFIRMED: all eight provision; latest isolated all-host no-op 2923ms; single-host p95 1246ms; missing `flock` fails closed. |
| AC-531-11 | Read-hook p95 <=100ms without weakened proof | CONFIRMED by executable native process benchmark: latest isolated p95 60ms; mutation negatives and receipt/containment suites remain green. |
| AC-531-12 | Scout, Lightning, and unbound-session canaries | PARTIAL BY DESIGN: synthetic/unbound proof passes; preserved product-session canaries are post-install G7 obligations. |
| AC-531-13 | WI-532..WI-536 close the full denominator | CONFIRMED: uninterrupted 308 passed, 0 failed, 0 timed out. |
| AC-531-14 | Self, Sol, and AGY leave no unresolved Critical/High | CONFIRMED: final exact Sol re-entry PASS 0/0/0/0; AGY implementation pass rubric 10 with zero findings; its later evidence-only timeout remains transparently classified. |
| AC-531-15 | Merge, install, drift, live canaries, final receipts | NOT YET CLAIMED: this is the next land/verify boundary. |

## Coverage ledger

| Subsystem | Entrypoints | Risk | Evidence | Status |
|---|---|---|---|---|
| Read-first dispatcher | `svc-codex-pretool-dispatcher.mjs` | High | argv-aware classifier, 35-case corpus, native p95 | done |
| Atomic task activation | `codex-load-skill.mjs`, `task-graph.mjs activate-skill` | High | exact loader, hostile shadow, partial-write retry | done |
| Operation/worktree authority | `operation-scope.mjs`, existing controller-v2 stack | High | canonical target matrix and WI-529/WI-530 recovery replay | done |
| Host provisioning | `setup`, `check-install-drift.sh` | High | eight-host concurrency, locks, byte stability, timing | done |
| Review/receipt topology | owner policy, `review-plan-codex.sh`, `review-exec` | High | 33 contract checks, 161 launcher checks, AGY/Sol receipts | done |
| Tier-1 scheduling | `run-all-evals.sh` | Medium | 308/0/0 uninterrupted final-candidate run | done |

## Hypotheses tested

1. A shell spelling could launder a write through the read fast path. Falsified
   for the covered Git, redirection, `sort`, `uniq`, `file`, `sed`, `jq`, `rg`,
   and compound-command forms; unknown or mixed commands remain governed.
2. First-task activation could mutate an arbitrary graph or a non-first task.
   Falsified by canonical realpath anchoring, shape validation, hostile-shadow,
   non-first-task, symlink, and crash-before/after fixtures.
3. Incremental setup could report a false no-op, follow an escaped target, leave
   partial state, or race shared post-install work. The audit reproduced all
   four boundaries; remediation adds infra-link drift checks, no-follow target
   validation, exact host-surface rollback, and a shared fail-fast post-install
   lock with executable negative fixtures.
4. Reviewer configuration could relabel a same-family opinion as independent.
   Falsified by external owner policy resolution and mechanical cognitive-family
   derivation in the receipt chain.
5. The zero-baseline claim could hide an intermittent timeout. Falsified by the
   uninterrupted final run: 308 passed, 0 failed, 0 timed out.

## Pre/post classification

The baseline artifact records 22 then 21 failures and zero timeouts before the
partitioned repair. The final uninterrupted command ran the same Tier-1
denominator and produced 308/0/0. The changed outcomes are classified as
fixed-by-change across WI-532..WI-536; no acceptance-critical non-pass is waived
or excluded.

## Residue and unverified surfaces

- No executable TODO/FIXME, credential, or temporary feature flag attributable
  to WI-531 was found.
- The third AGY evidence-binding attempt timed out after 1200 seconds. Its
  classified receipt is preserved; no fourth adversarial round was started.
- Installed Codex hooks were disabled by the owner during this audit. Candidate
  behavior is therefore locally verified but not yet installed/live-proven.
- Canonical-main all-host setup, drift readback, repeat bootstrap, fresh-session
  safe-read activation, and Scout/Lightning preserved-session canaries remain
  mandatory after merge.

## Findings

Successive adversarial passes found containment, classifier, reviewer-authority,
transaction, shared-post-install, source-digest, and retry boundaries. Every
finding has code-level remediation and an executable regression. The exact
candidate passed the final independent re-entry with 0 Critical, 0 High,
0 Medium, and 0 Low findings, and the full 308/0/0 denominator is green.

## Verdict

- [x] READY TO LAND
- [ ] BLOCKED
- [ ] CONDITIONAL

This verdict authorizes governed landing only. It does not claim installed,
released, or live verification; those states require task 9/G7 evidence.
