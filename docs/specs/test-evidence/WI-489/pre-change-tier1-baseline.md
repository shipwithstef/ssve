# WI-489 pre-change Tier-1 baseline

**Captured:** 2026-07-16T02:35:00Z
**Base commit:** `4d230174c0e1bda200c6bb820f18fbe88cc97aac` (`origin/main`, WI-488 promoted verification)
**Checkout state:** isolated WI-489 worktree after governance bootstrap, before executable edits; not a clean-base checkout
**Command:** `bash test-framework/evals/run-all-evals.sh`
**Raw log:** `/tmp/wi489-tier1-baseline.log`
**Result:** `242 scripts passed, 2 failed, 0 timed out`; exit `1`

This is the immutable dirty-worktree before-executable-edit snapshot. No paid model calls were made. It must not be described as a clean-base result.

The two failures are recorded as baseline facts, not as passing checks and not as WI-489 regressions:

1. `validate-no-svc-residue.sh` reported the new untracked `.svc/lane-tasks-WI-489.json`. The graph is a required WI artifact and should cease being residue after its first tracked commit.
2. `validate-proposal-triage-sla.sh` reported pre-existing proposal-triage debt that became actionable on 2026-07-16: one proposal lacks a disposition and the existing WI-486/WI-487/WI-488 proposal metadata uses a bold form the validator parses as malformed.

The previously recorded WI-488 intake failures are not present in this baseline: cross-host concern scanning, shared-content installation, and session-contract freshness all pass at this base.

## Clean-main comparison

The same command was rerun on the clean default checkout at the same commit on 2026-07-16 after the snapshot above. It also reported `242 scripts passed, 2 failed, 0 timed out`, but with a different second failure set:

1. the same pre-existing `validate-proposal-triage-sla.sh` debt;
2. `validate-session-contract-freshness.sh`, because the default checkout's session contract was then 10 hours old.

This clean-main run proves the aggregate landing floor is 242/2 at the base, while also proving that the individual failing checks are state-sensitive. WI-489 landing must satisfy the current suite policy honestly and introduce no regression relative to the exact applicable failures at verification time.
