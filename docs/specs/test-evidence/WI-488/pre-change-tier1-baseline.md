# WI-488 pre-change Tier-1 baseline

**Captured:** 2026-07-15T12:09:46Z
**Base:** `67e325fd3ee0bddb4504a783fe0b8d227a46deff` (`origin/main`, PR #142 squash merge)
**Command:** `bash test-framework/evals/run-all-evals.sh`
**Result:** `240 scripts passed, 3 failed, 0 timed out`; exit `1`

This is the immutable before-edit baseline. The three failures were already recorded by the accepted intake and are not WI-488 regressions:

1. `validate-concern-registry-cross-host.sh`: seven configured non-Claude host installs lacked the shared concern scanner. `PASS: 0, FAIL: 7, SKIPPED: 1`.
2. `validate-shared-content-symlinks.sh`: the same seven installed hosts lacked `_shared`. `Hosts detected: 7 | Files checked per host: 8 | Misses: 7`.
3. `validate-session-contract-freshness.sh`: the latest contract was the eight-hour-old WI-481 entry from `2026-07-15T03:16:00Z`.

The first two failures belong to WI-487 installation migration. The third was preflight routing residue and is cleared only by the required WI-488 session-contract refresh; it is not implementation credit for WI-488.

No paid model calls were made by this baseline.
