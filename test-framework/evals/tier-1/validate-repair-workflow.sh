#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
node --test "$repo_root/test-framework/tests/review-report-recovery.test.mjs" "$repo_root/test-framework/tests/delivery-plan-contract.test.mjs" "$repo_root/test-framework/tests/pr-review-receipt.test.mjs" "$repo_root/test-framework/tests/receipt-publication-recovery.test.mjs"
