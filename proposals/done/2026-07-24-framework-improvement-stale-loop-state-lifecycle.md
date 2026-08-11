# Framework Improvement: Bound stale loop-guard session state

**Status:** IMPLEMENTED AND VERIFIED — WI-511

accepted_wi: WI-511

## Evidence

- **Source:** User-supplied quality-preserving optimization proposal, inspected against current `main`.
- **Finding:** `hooks/svc-loop-guard.mjs` creates one gitignored state file per session and never reclaims files from sessions that have been inactive for more than seven days.
- **Severity:** medium
- **Measured baseline:** The hook bounds each file to 40 history rows, so this is a file-count lifecycle leak rather than an unbounded-per-file memory bug.

## Diagnosis

- **Root cause:** WI-399 correctly isolated concurrent sessions by file, but the lifecycle stops at creation/update. No owner cleans expired session-local files.
- **Category:** incomplete external-state lifecycle.
- **Already in `FRAMEWORK-STATE.md`?** No. Existing state records cross-host parity and per-session isolation, not stale-file retirement.

This proposal owns one gap only: reclaiming expired loop-guard state. The other items in the supplied bundle are not part of WI-511 because current evidence classifies them as already implemented, no-op, contract-changing, or quality-reducing.

## Acceptance Boundary

- The loop guard, which creates the files, owns cleanup; `scripts/task-graph.mjs` must not gain unrelated hook-state lifecycle behavior.
- Cleanup considers only regular non-symlink files matching `loop-guard-state*.json` in the resolved repository `.svc` directory.
- The current invocation's state file is never removed.
- A file is eligible only when its filesystem modification time is strictly older than seven days.
- Discovery, metadata, or unlink failures fail open for cleanup and must never disable loop detection for the current call.
- No tracked audit, receipt, task-graph, decision, or checkpoint file is eligible.
- Focused mutation-red fixtures prove exact boundary, active-file preservation, symlink refusal, unrelated-file preservation, malformed-state tolerance, and cleanup-error tolerance.

## Route

`write-spec → design-tech → explore-solutions → plan-changeset → review-plan → execute-changeset → review-gate → review-exec → audit-implementation → test-framework → land-changeset → verify-promotion`

## Rollback

Revert the cleanup helper and its focused tests together. Existing loop-guard state remains readable because the JSON schema and active-file behavior are unchanged.

## Closeout

PR #178 promoted the reviewed implementation as `3ded0052`. Promoted focused
replay, canonical reconcile, and the final 274/274 Tier-1 suite pass. The
quality gate also exposed and corrected an unrelated growing-history fixture
coupling during same-WI governance closeout; dedicated synthetic receipt-range
coverage remains intact.
