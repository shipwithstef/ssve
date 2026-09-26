#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
# Tier 1 runs the process-boundary, intake, create-recovery, and G7 closure canaries.
# Full transport, sanitizer, installed-root, and conflict suite:
# node --test test-framework/tests/issue-tracker.test.mjs
node --test --test-name-pattern='^critical:' test-framework/tests/issue-tracker.test.mjs
