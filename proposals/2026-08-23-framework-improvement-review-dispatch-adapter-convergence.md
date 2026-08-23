# Framework Improvement: review and execution dispatch adapter convergence

**Status:** ACCEPTED -> WI-559
**Date:** 2026-08-23

## Evidence

- **Source:** owner-authorized HoursHub Scout durability execution replay
- **Finding:** the WI-551 resolver selects Grok 4.6 High, but compatibility
  adapters fail on an absent hardcoded mode, multiple configured stations,
  named WI identity, and a retired Sonnet fallback.
- **Severity:** critical

## Diagnosis

- **Root cause:** active compatibility adapters and the execute commit guard
  duplicate pre-WI-551 policy rather than consuming the single resolver.
- **Category:** drift/regression
- **Already in FRAMEWORK-STATE.md?** no; WI-551 is recorded as landed, so this is
  new consumer-replay evidence against its completion claim.

## Implementation

- **Route:** normal governed bugfix pipeline because review, model routing, and
  commit enforcement are hot-path contracts.
- **Files changed:** exact set will be frozen by the WI-559 manifest.
- **Commits:** pending

## Replay Verification

- **Replay target:** the original HoursHub
  `WI-SCOUT-CAPTURE-DURABILITY-01` canonical review plus exact Grok execution
  preflight.
- **Result:** pending
- **Evidence:** `docs/specs/work-items/WI-559.md`

## FRAMEWORK-STATE.md Mutations

- **Analysis History:** add the adapter-convergence regression and replay.
- **Known Gaps:** no existing row; do not change WI-556 open items.
- **Decisions:** compatibility adapters may not own policy defaults or executor
  allowlists independently from the owner resolver.
- **Capabilities:** update the WI-551 capability only after replay passes.
