# WI-558 — tier-1 regression repair changeset

Repair 25 failing tier-1 validators: provenance regression, umask-safe
state-home creation, governed-hook fixture staging, honest state/doc
backfills, owner-topology hermetic fixtures. No fail-closed weakening.

## Files Planned

| Task | Action | File(s) | Purpose |
|---|---|---|---|
| T01 | MODIFY | `bin/svc-enforce.mjs`;`setup` | core-enforcement-runtime |
| T02 | MODIFY | `scripts/blind-floor-judge.sh`;`scripts/lib/reviewer-evidence.mjs`;`scripts/prompt-floor-judge.sh`;`scripts/run-external-review.mjs` | external-review-contract |
| T03 | MODIFY | `test-framework/evals/tier-1/lib/stage-governed-hooks.sh`;`test-framework/evals/tier-1/validate-actionable-hook-denial.sh`;`test-framework/evals/tier-1/validate-all-host-install-migration.sh`;`test-framework/evals/tier-1/validate-codex-execution-integrity.sh`;`test-framework/evals/tier-1/validate-company-fleet-integration.sh`;`test-framework/evals/tier-1/validate-enforcement-escape-and-readonly.sh`;`test-framework/evals/tier-1/validate-external-review-launcher.sh`;`test-framework/evals/tier-1/validate-governed-wirer-fail-fast.sh`;`test-framework/evals/tier-1/validate-quick-fix-carve-out.sh`;`test-framework/evals/tier-1/validate-sdkg-router-fail-closed.sh`;`test-framework/evals/tier-1/validate-self-heal-survives-double-dead-pointer.sh`;`test-framework/evals/tier-1/validate-session-contract-freshness.sh`;`test-framework/evals/tier-1/validate-setup-worktree-canonical-resolution.sh`;`test-framework/evals/tier-1/validate-sol-r2-fail-closed.mjs`;`test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh`;`test-framework/evals/tier-1/validate-wi546-grok-live-acceptance.sh` | tier1-fixtures-hooks |
| T04 | MODIFY | `test-framework/evals/tier-1/validate-plan-product-safety.sh` | plan-safety-pointer |
| T05 | MODIFY | `.svc/lane-tasks-WI-552.json`;`.svc/lane-tasks-WI-555.json`;`.svc/lane-tasks-WI-556.json`;`.svc/lane-tasks-WI-558.json`;`.svc/pipeline-decisions.jsonl`;`.svc/session-contract.jsonl` | state-lane-tasks-decisions |
| T06 | MODIFY | `docs/specs/work-items/PROPOSAL-PROMOTION-LEDGER.md`;`docs/specs/work-items/WI-512-residual-map.json`;`docs/specs/work-items/WI-548.md`;`docs/specs/work-items/WI-549.md`;`docs/specs/work-items/WI-550.md`;`docs/specs/work-items/WI-551-residual-map.json`;`docs/specs/work-items/WI-551.md`;`docs/specs/work-items/WI-552-residual-map.json`;`docs/specs/work-items/WI-552.md`;`docs/specs/work-items/WI-553-residual-map.json`;`docs/specs/work-items/WI-553.md`;`docs/specs/work-items/WI-555-residual-map.json`;`docs/specs/work-items/WI-556-residual-map.json`;`docs/specs/work-items/WI-556.md`;`docs/specs/work-items/WI-558.md`;`proposals/2026-07-24-session-019f8cd3-audit-and-svc-framework-fixes.md`;`proposals/2026-08-02-one-lane-framework.md`;`proposals/2026-08-17-framework-improvement-autonomous-restart-boundary-continuation.md`;`proposals/2026-08-17-framework-improvement-native-host-dispatch-policy.md`;`proposals/2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md`;`proposals/2026-08-21-framework-improvement-consumer-retroactive-attestation.md`;`proposals/2026-08-21-framework-improvement-final-sha-mandatory-skill-coverage.md`;`proposals/done/2026-07-24-session-019f8cd3-audit-and-svc-framework-fixes.md`;`proposals/done/2026-08-02-one-lane-framework.md`;`proposals/done/2026-08-17-framework-improvement-autonomous-restart-boundary-continuation.md`;`proposals/done/2026-08-17-framework-improvement-native-host-dispatch-policy.md`;`proposals/done/2026-08-17-framework-improvement-risk-triggered-plan-exec-contracts.md`;`proposals/done/2026-08-21-framework-improvement-consumer-retroactive-attestation.md`;`proposals/done/2026-08-21-framework-improvement-final-sha-mandatory-skill-coverage.md`;`proposals/triage.json` | work-items-proposals-docs |
| T07 | CREATE | `docs/plans/2026-08-23-wi558-tier1-regressions/manifest.md`;`docs/plans/2026-08-23-wi558-tier1-regressions/plan-contract.json` | plan-artifacts |

## Task Graph

```
T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07
```
