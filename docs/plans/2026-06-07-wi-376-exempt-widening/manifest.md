# WI-376 manifest — exempt-class widening (compressed tier)

**Status:** EXECUTING | Branch: feature-wi-376-exempt-widening | Base: main eef0419a | Tier: compressed (user decision, decision-log 2026-06-07)

## Files Planned
| # | File | Action |
|---|---|---|
| 1 | scripts/quick-fix-eligibility.mjs | MODIFY — +`^docs/plans/` exempt pattern; +isSvcStateFile class (lane-tasks/claims/review-receipts, no append-only constraint); classifier + rowsClean accept state files |
| 2 | test-framework/evals/tier-1/validate-quick-fix-carve-out.sh | MODIFY — +5 cases per WI-376 AC |

## Blueprint
isSvcStateFile(f) = /^\.svc\/lane-tasks-[^/]+\.json$/ ∨ /^\.svc\/claims\/[^/]+\.claim\.json$/ ∨ /^\.svc\/review-receipts\/[^/]+\.json$/
allExempt: isExemptPath ∨ isSvcLedger ∨ isSvcStateFile; rowsClean same; hasLedger stays jsonl-only (append-only unchanged).

## External State
| # | Environment | What | Coupling |
|---|---|---|---|
| — | none | gate logic only; no installs/symlinks/live settings | n/a |
Untouched taxonomy: all 15 walked, none touched (pure script+test change validated by tier-1).

## Validation
validator (both WI-360 ones) + new cases; lint; suite via push gate (compressed: no duplicate manual run).
RECOVERY_IF_FAIL: git revert squash.
