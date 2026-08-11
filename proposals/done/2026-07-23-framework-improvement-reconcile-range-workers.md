# Framework Improvement: Bound receipt-range validation

**Status:** IMPLEMENTED (2026-07-23, `bea541bc4751429e91e79512a7986978546b72f3`)
**Accepted WI:** WI-509

## Evidence

- **Source:** Canonical `svc-reconcile` replay after WI-508 promotion.
- **Finding:** The receipt child times out at its 20-second bound and projects
  166 valid commits as missing. The same exact range passes 166/166 when allowed
  to finish serially in roughly 90 seconds. Read-only eight- and twelve-worker
  probes complete in 8.18 and 7.22 seconds.
- **Severity:** high

## Diagnosis

- **Root cause:** `scripts/check-chain-receipts.mjs` validates range SHAs with
  serial `shas.map(checkSha)`, so wall time grows linearly with repository
  history behind a fixed bounded parent.
- **Category:** inefficiency with fail-closed governance impact
- **Already in FRAMEWORK-STATE.md?** No. WI-472 records bounded reconcile but
  does not record the real-denominator range-validator latency gap.

## Implementation

- **Route:** normal full framework pipeline in the isolated WI-509 worktree
- **Files changed:** `scripts/check-chain-receipts.mjs`,
  `scripts/lib/reconcile-core.mjs`, `scripts/svc-reconcile.mjs`, the focused
  Tier-1 worker-pool validator, receipt doctrine/state, and WI/plan/audit
  evidence
- **Commits:** implementation `bea541bc4751429e91e79512a7986978546b72f3`
- **Pull request:** https://github.com/s7an-it/seriousvibecoding/pull/173
- **Safety contract:** bounded concurrency; deterministic input order; exact-SHA
  fail-closed worker errors; direct `--sha` compatibility; no waiver or
  checkpoint edit

## Replay Verification

- **Replay target:** exact checkpoint range through
  `scripts/check-chain-receipts.mjs --range`, followed by canonical
  `scripts/svc-reconcile.mjs`
- **Result:** PASS for the original exact-range failure; promoted-main
  reconcile remains the mandatory G7 proof
- **Evidence:** 166/166 with zero failures and zero infrastructure failures in
  audited 4.092–5.877 second replays, versus roughly 90 seconds before the
  change. Focused range/reconcile/legacy validators pass. Final complete Tier-1
  is 270 pass / 2 fail / 0 timeout; both red scripts are separately classified
  pre-existing receipt-cache and WI-498/WI-510 skip-integrity debt.

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** record the growing-denominator timeout and promoted fix
- **Known Gaps:** no pre-existing row to move
- **Decisions:** lock bounded ordered per-SHA workers behind range mode
- **Capabilities:** update deterministic bounded receipt reconcile after
  promoted replay

## Rollback

Revert the worker-pool implementation and validator together. Direct SHA mode
remains the compatibility boundary throughout; rollback must not edit
checkpoint state, receipt notes, or historical decision rows.
