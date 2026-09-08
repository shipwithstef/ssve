#!/usr/bin/env bash
# Promotion: WI-FW-DELIVERY-TRADEOFFS-01. Failure class: lossy requirement handoff,
# leftover inline graders and misleading cycle accounting. Budget: <5s, local only.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
node --test "$ROOT/test-framework/tests/delivery-plan-contract.test.mjs" "$ROOT/test-framework/tests/delivery-cycle-accounting.test.mjs" "$ROOT/test-framework/tests/review-report-recovery.test.mjs"
