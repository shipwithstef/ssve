#!/usr/bin/env bash
#
# Tier-1 validation: worktree.sh create initializes .svc/ directory.
# This is a dry-run check — it doesn't create actual worktrees.
# It verifies the create function CONTAINS the .svc/ initialization code.
#
set -euo pipefail

echo "=== Tier 1: Worktree .svc/ initialization ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKTREE_SCRIPT="$ROOT/scripts/worktree.sh"

# Check that worktree.sh contains .svc/ initialization
if ! grep -q 'wt_svc.*\.svc' "$WORKTREE_SCRIPT"; then
  echo "FAIL: worktree.sh does not contain .svc/ initialization in create" >&2
  exit 1
fi
echo "  worktree.sh contains .svc/ init: PASS"

# Check that it creates claims directory
if ! grep -q 'claims' "$WORKTREE_SCRIPT"; then
  echo "FAIL: worktree.sh does not create claims/ directory" >&2
  exit 1
fi
echo "  worktree.sh creates claims/: PASS"

# Check that it initializes session-contract.jsonl
if ! grep -q 'session-contract.jsonl' "$WORKTREE_SCRIPT"; then
  echo "FAIL: worktree.sh does not initialize session-contract.jsonl" >&2
  exit 1
fi
echo "  worktree.sh creates session-contract: PASS"

# Check that resolve-wi.mjs exists
if [ ! -f "$ROOT/hooks/lib/resolve-wi.mjs" ]; then
  echo "FAIL: hooks/lib/resolve-wi.mjs does not exist" >&2
  exit 1
fi
echo "  resolve-wi.mjs exists: PASS"

# Check that wi-claim.mjs exists
if [ ! -f "$ROOT/hooks/lib/wi-claim.mjs" ]; then
  echo "FAIL: hooks/lib/wi-claim.mjs does not exist" >&2
  exit 1
fi
echo "  wi-claim.mjs exists: PASS"

echo "Worktree .svc/ initialization: passed"
exit 0
