# WI-531 Tier-1 baseline

**Base SHA:** `ac42091bc0015f87f9cdae50251570021d7c17fb`

Run 1: 283 passed, 22 failed, 0 timed out.

Run 2: 284 passed, 21 failed, 0 timed out. The one-result variance is itself assigned to WI-536 until isolated; no failure is waived.

## Run-2 exact non-pass partition

| Child | Validator |
|---|---|
| WI-532 | `validate-capability-blocker-inertia.sh` |
| WI-532 | `validate-feature-competitive-cross-reference.sh` |
| WI-532 | `validate-route-workflow-hot-path-size.sh` |
| WI-532 | `validate-route-workflow-prompt-composer.sh` |
| WI-532 | `validate-skill-before-starting.sh` |
| WI-533 | `validate-chain-receipts-range-workers.sh` |
| WI-533 | `validate-phase-receipt-migration.sh` |
| WI-533 | `validate-pipeline-decisions-recent.sh` |
| WI-533 | `validate-skill-receipt-shape.sh` |
| WI-533 | `validate-stop-hook-phase-enforcement.sh` |
| WI-534 | `validate-framework-self-management.sh` |
| WI-534 | `validate-no-svc-residue.sh` |
| WI-534 | `validate-preflight-coverage.sh` |
| WI-534 | `validate-proposal-triage-sla.sh` |
| WI-534 | `validate-quick-fix-carve-out.sh` |
| WI-534 | `validate-work-item-metadata.sh` |
| WI-535 | `validate-actionable-hook-denial.sh` |
| WI-535 | `validate-delegated-execution-authority.sh` |
| WI-535 | `validate-hook-host-residuals.sh` |
| WI-535 | `validate-operation-scope-authority.sh` |
| WI-535 | `validate-session-contract-freshness.sh` |
| WI-536 | run-to-run non-pass set variance |

Ownership uses the first failing authoritative assertion. A validator may become green as a dependency side effect, but only its assigned child closes it and records the proof.

## Closure replay

- Intermediate: 297 passed, 10 failed, 0 timed out. The failures exposed compact-router obligation loss, incomplete proposal promotion, active completed graphs, and one contended performance measurement.
- Intermediate: 306 passed, 1 failed, 0 timed out. The remaining failure exposed the live SessionStart dangling-link scan losing evidence through `find | head` SIGPIPE.
- Intermediate: 306 passed, 0 assertion failures, 1 timed out. `validate-codex-execution-integrity.sh` passed standalone at 174/0 in 81.87 seconds and was correctly classified as a host-machine-state sequential validator.
- Final: **307 passed, 0 failed, 0 timed out**. No baseline failure or timeout was waived.
- G5 post-fix replay: **308 passed, 0 failed, 0 timed out**. The new validator is `validate-pipeline-integrity-modes.sh`; it proves the framework/consumer mode split that closed G5-001.
- G5 Sol-fix replay: 307 passed, 0 assertion failures, 1 contention timeout. `validate-skill-receipt-shape.sh` then passed standalone with all 46 graphs processed in 79.31 seconds, so it joins the sequential host-state set; no assertion was waived.
- G5 final replay: **308 passed, 0 failed, 0 timed out**. The owner-configured review adapter is additionally proven by `validate-external-review-launcher.sh` at 161/161 and `validate-persistent-review-contract-v2.mjs` at 29/29; plan candidate digest and private review package are bound to the same SHA-256. The all-host setup fixture is 11/11, including fail-closed behavior when the mandatory per-host lock executable is unavailable.
