#!/usr/bin/env bash
# validator_path: test-framework/evals/tier-1/validate-plan-test-value.sh
# failure_class: plan reviewer request silently drops the test-value rubric
# promotion_signal: reviewer prompts are assembled by review-plan-codex.sh, not the prose contract alone
# expected_runtime_budget: under 5 seconds; local Git fixture and launcher stub, no network or paid model
# why_tier_2_or_targeted_is_insufficient: every plan reviewer launch should retain this bound prompt contract
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
node --test "$ROOT/test-framework/tests/plan-test-value.test.mjs"
