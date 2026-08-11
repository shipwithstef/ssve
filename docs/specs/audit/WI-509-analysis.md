# Systems Analysis: WI-509 bounded receipt-range workers

**Date:** 2026-07-23
**Branch:** `framework-WI-509-reconcile-range-timeout`
**Spec:** `docs/specs/work-items/WI-509.md`
**Manifest:** `docs/plans/2026-07-23-WI-509-reconcile-range-workers/manifest.md`
**Mode:** full

## Headline

- Critical findings: 0
- High findings: 0
- Medium findings discovered by audit and static replay: 5
- Medium findings fixed before landing: 4
- Medium residuals accepted with explicit bounds: 1
- Concern scanner matches: 0
- New database, auth, secret, customer-data, or network surface: none

## Verification Contract

| AC | What the implementation must do | Verified? | Evidence |
|---|---|---|---|
| RX-01 | Validate the exact 166-commit interval in less than 15 seconds | Confirmed | Latest audited replay: 166/166, zero failures, 5.877 seconds |
| RX-02 | Cap concurrency and worker time; reject or clamp unsafe overrides | Confirmed | Resolver assertions cover default, zero capacity, 1..16 concurrency, 1s..10s timeout, clamp diagnostics, and invalid strings |
| RX-03 | Preserve Git-log input order independent of worker completion order | Confirmed | Delayed two-worker fixture plus exact ordered integration result |
| RX-04 | Attribute every invalid, missing, contradictory, timed-out, or unparsable result to the exact SHA and fail closed | Confirmed after audit repair | Strict child parser and exact aggregate coverage fixtures; F-1 and F-2 |
| RX-05 | Preserve direct `--sha` behavior and output shape | Confirmed | Direct and symlink invocations parse as legacy JSON and omit the range-only infrastructure field |
| RX-06 | Complete canonical reconcile under 20 seconds and advance the checkpoint only after clean promoted validation | Pending promoted proof | Consumer is fail-closed locally; checkpoint was intentionally not mutated. `verify-promotion` owns the promoted-main replay |
| RX-07 | Pass focused validators with no new aggregate Tier-1 regression | Confirmed locally | Focused range, bounded reconcile, golden projection, retroactive attestation, tier, baton, and quick-fix validators pass; aggregate baseline debt remains separately classified |
| RX-08 | Use no checkpoint edit, waiver, override, or receipt weakening | Confirmed | Scoped diff and residue scan show none; receipt validation is stricter |
| RX-09 | Keep the WI-498 skip-integrity correction separate | Confirmed | No WI-498 implementation path changed; WI-510 is registered as the separate follow-up |

## Scope Drift

The implementation files match the manifest. Review logs, pre/post evidence,
this audit report, `.svc/session-contract.jsonl`, and task-graph phase receipts
are justified mandatory-chain artifacts. The proposal move to
`proposals/done/` is intentionally deferred to the improvement closeout after
verification. No unrelated product or customer-data file is present.

## Coverage Ledger

| Subsystem | Entrypoint | Risk | Status | Findings |
|---|---|---|---|---|
| Range policy and scheduler | `main()` / `checkShasWithPool()` | High | done | none |
| Worker process and parser | `checkShaInWorker()` / `interpretWorkerOutput()` | High | done | F-1 fixed, F-3 residual |
| Receipt aggregate consumer | `checkReceipts()` / coverage and child-result validators | High | done | F-2, F-4, and F-5 fixed |
| Reconcile checkpoint gate | `reconcileResponsibilityA()` / `main()` | High | locally done; promotion pending | none |
| Mirror regeneration | `getReceiptsForSha()` / `regenerateMirror()` | Medium | done | no WI-509 regression |
| Focused regression fixture | `validate-chain-receipts-range-workers.sh` | High | done | none |
| Doctrine and framework memory | receipt contract, state, capabilities | Medium | done; accurately marked pending promotion | none |

## Hypotheses

| ID | Falsifiable hypothesis | Result |
|---|---|---|
| H-1 | Concurrent completion can reorder result rows | Falsified: indexed writes preserve input order |
| H-2 | A worker timeout or malformed output can disappear from aggregate failure | Falsified after strict exact-SHA parser coverage |
| H-3 | A coherent-looking but incomplete aggregate can advance the checkpoint | Confirmed, then fixed by F-2 |
| H-4 | A contradictory exit code and row status can be accepted as success | Confirmed, then fixed by F-1 |
| H-5 | Direct SHA mode can inherit range-only configuration or output fields | Falsified by direct and symlink fixtures |
| H-6 | Parallel mirror creation can leave partial files or change bytes on replay | Falsified by cold 16-commit fixture, parse sweep, residue scan, and byte/hash rerun |
| H-7 | Success JSON printed before an abnormal child exit can advance the checkpoint | Confirmed, then fixed by F-4 |
| H-8 | Internal infrastructure fields can change the locked legacy JSON bytes | Confirmed by full Tier-1, then fixed by F-5 |

## Findings

### F-1: Contradictory exit-1 success row was accepted

**Severity:** Medium
**Confidence:** Confirmed and fixed
**Type:** Fail-closed invariant
**Location:** `scripts/check-chain-receipts.mjs` (`interpretWorkerOutput`)
**AC Impact:** RX-04

**Observed:** An exit-code 1 callback with one matching row whose `ok` value was
`true` returned that row, so the aggregate could pass an internally
contradictory child result.

**Expected:** Exit 0 must carry a coherent success; exit 1 may preserve only a
coherent failed receipt result. Any envelope/row/exit disagreement is
infrastructure failure for the requested SHA.

**Evidence:** The testing specialist reproduced the pass. After repair, the same
probe returns `{ok:false,type:"worker-error",infrastructure:true}`.

**Fix:** Require boolean and mutually coherent envelope/row status plus
exit/status agreement. Added exit-1/success-row and envelope/row mismatch
fixtures.

### F-2: Incomplete aggregate JSON could omit expected SHAs

**Severity:** Medium
**Confidence:** Confirmed and fixed
**Type:** Checkpoint fail-closed invariant
**Location:** `scripts/lib/reconcile-core.mjs`, `scripts/svc-reconcile.mjs`
**AC Impact:** RX-04, RX-06

**Observed:** Any syntactically valid JSON reached `missingFromReceiptResult()`.
An expected two-SHA interval with one successful row projected zero missing
rows and could advance the checkpoint.

**Expected:** Reconcile may consume a receipt aggregate only when its row count,
order, exact SHAs, boolean row statuses, and aggregate status match the
discovered interval.

**Evidence:** The security specialist reproduced `projected_missing: 0`.
Post-fix fixtures reject omitted, duplicate, reordered, and top-level
inconsistent rows and synthesize infrastructure failures for every expected
SHA.

**Fix:** Added `validateReceiptResultCoverage()` and applied it before
reconcile's missing/debt projection.

### F-4: Success JSON was not bound to the child exit classification

**Severity:** Medium
**Confidence:** Confirmed and fixed
**Type:** Checkpoint fail-closed invariant
**Location:** `scripts/lib/reconcile-core.mjs`, `scripts/svc-reconcile.mjs`
**AC Impact:** RX-04, RX-06

**Observed:** A child could print coherent all-success JSON and then time out,
receive a signal, or exit abnormally. Coverage validation alone accepted the
JSON, projected zero unaccounted rows, and could advance the checkpoint.

**Expected:** Only exit 0 may carry an all-success aggregate. Only exit 1 may
carry coherent semantic receipt debt. Timeout, spawn error, signal, other exit
codes, or exit/output disagreement must become infrastructure failure.

**Evidence:** The security recheck identified the output-before-exit race.
Post-fix unit fixtures cover success, semantic exit 1, timeout, spawn error,
exit 2, and both success/debt status mismatches.

**Fix:** Added `validateReceiptChildResult()` and made reconcile bind exact
coverage to the bounded subprocess classification and status before projection.

### F-5: Internal classification fields leaked into legacy JSON

**Severity:** Medium
**Confidence:** Confirmed and fixed
**Type:** Compatibility regression
**Location:** `scripts/lib/reconcile-core.mjs` (`legacyReportProjection`)
**AC Impact:** RX-05, RX-07

**Observed:** The first complete Tier-1 run failed the frozen legacy-binary
fixture because `infrastructure` and `classification` fields from the internal
row model appeared inside `unaccounted_commits`.

**Expected:** Internal reconcile logic may retain richer failure
classification, while the locked legacy stdout projection remains byte
compatible.

**Evidence:** `validate-svc-reconcile-legacy-binary.sh` showed the exact
old/new byte delta for the unaccounted-warn state.

**Fix:** `legacyReportProjection()` now projects each row to only `sha` and
`missing`. The frozen five-state binary fixture, golden fixture, bounded
fixture, and focused range fixture all pass after the repair.

### F-3: Outer SIGKILL can leave direct-SHA grandchildren briefly alive

**Severity:** Medium
**Confidence:** Likely
**Type:** Process lifecycle
**Location:** `scripts/check-chain-receipts.mjs` (`checkShaInWorker`),
`scripts/lib/reconcile-core.mjs` (`runBounded`)
**AC Impact:** RX-02, RX-06

**Observed:** Reconcile kills the range parent with SIGKILL at its aggregate
bound. The parent owns each `execFile` timeout, so an already-spawned direct-SHA
grandchild is not guaranteed to receive that timer after the parent dies.

**Expected:** Work after an aggregate timeout should remain bounded and must not
corrupt authoritative state.

**Evidence:** Static process-tree analysis; no live outer-timeout orphan was
observed. Each child performs local read-only Git/receipt validation plus
atomic regenerable mirror writes and normally finishes far below five seconds.

**Disposition:** Accepted with justification. The current denominator completes
in 5.877 seconds against a 20-second outer bound. There are no persistent
services, locks, receipt-note writes, or checkpoint writes in children. Future
hardening may add process-group termination or a worker-owned deadline if the
measured denominator approaches the aggregate bound.

## Pre-existing Hardening Observations

These surfaces existed before WI-509 and are not caused by the worker pool:

- Invalid or zero `SVC_RECONCILE_CHILD_TIMEOUT_MS` values are not normalized as
  strictly as the new range-worker variables.
- Authoritative note envelope keys are not allowlisted before mirror filename
  construction.
- Legacy mirrors use seven-character SHA directories and may be consulted when
  no authoritative note is available.
- An unavailable receipt schema currently makes the minimal schema validator
  return valid.

They do not invalidate the canonical WI-509 replay, but should be handled as
separate receipt-hardening work rather than silently expanded into this
changeset.

## Security and Data Isolation

- Git, Node, and GitHub commands use argv arrays; no new shell interpolation.
- Worker SHAs are exact-bound on return.
- Range overrides accept decimal integers only and are clamped.
- No Supabase, customer database, credential, auth, or paid-service access.
- No new network call; existing reconcile responsibility B continues to use
  captured `gh` subprocess output.
- Git notes stay authoritative. Workers write only regenerable atomic mirrors.

## Performance and Maintainability

- Scheduler work is O(n), with at most 16 live workers and indexed O(n) result
  storage.
- Current exact denominator: 166 SHAs in 5.877 seconds at concurrency 8.
- Per-child output is capped at 4 MiB and worker time at 10 seconds maximum.
- The scheduler delegates receipt semantics to the existing direct-SHA path;
  it does not duplicate receipt validation logic.
- Range-only helpers are exported for deterministic unit fixtures.

## Validation Evidence

| Command / proof | Result |
|---|---|
| Node and Bash syntax | PASS |
| `validate-chain-receipts-range-workers.sh` | PASS after both audit repairs |
| Exact 166-SHA range, concurrency 8 | PASS, 166/166, 0 failures, 0 infrastructure failures, 5.877s |
| `validate-pre-post-validation-evidence.mjs` | PASS; delta classified fixed-by-change |
| `validate-svc-reconcile-bounded.sh` | PASS |
| `validate-svc-reconcile-golden.sh` | PASS |
| `validate-svc-reconcile-legacy-binary.sh` | PASS after F-5 repair |
| Retroactive attestation, receipt tier, baton binding, quick-fix carve-out | PASS |
| Concern scan | PASS, no matches |
| Complete Tier-1 rerun | 270 pass, 2 fail, 0 timeout; both failures are separately classified pre-existing debt |

## Residue

No new TODO, FIXME, temporary flag, debugger, waiver, override, or checkpoint
mutation was found. Review artifacts and task receipts are intentional
mandatory-chain evidence. The active proposal and pending promotion wording are
intentional until closeout.

## External State

The diff declares Git branch/PR/receipt notes, regenerable receipt mirrors, and
downstream framework doctrine. No customer or provider state exists. The
post-merge audit obligation is the original canonical reconcile replay plus
final-SHA receipt-note validation. A failed replay must preserve the prior
checkpoint and return to a corrective commit.

## Unverified Surfaces

- Promoted-main reconcile duration and checkpoint advancement are deliberately
  deferred to `verify-promotion`; local evidence cannot substitute for that
  proof.
- Full Tier-1 is baseline-red from separately classified legacy receipt-cache
  schema debt and WI-498 skip-integrity debt. It must not be reported as
  aggregate green.
- Forced OS-level process orphan behavior and a real max-buffer child were not
  reproduced; their parser classifications are covered deterministically.

## Verdict

- [x] READY TO LAND — no Critical or High findings; audit-discovered
  fail-closed gaps are fixed and revalidated.
- [ ] BLOCKED
- [ ] CONDITIONAL

Promotion is not yet verified. Landing must be followed by final-SHA receipt
validation and the exact canonical `svc-reconcile` replay under 20 seconds.

## Self-Verify

| # | Check | Result |
|---|---|---|
| 1 | Analysis report exists | PASS |
| 2 | Every RX acceptance criterion has a verification row | PASS, 9/9 |
| 3 | No unresolved Critical or High finding | PASS |
| 4 | Verdict section present | PASS |
| 5 | Pre/post evidence audited and validator run | PASS |
