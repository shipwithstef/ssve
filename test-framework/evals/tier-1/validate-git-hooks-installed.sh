#!/usr/bin/env bash
# Tier-1: required hook .d/ slot scripts exist and are executable.
# Promotion note: L2 enforcement integrity — missing hooks = chain bypass.

set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

if [[ ! -d hooks/git/pre-commit.d ]]; then
  echo "SKIP: hook slot directories not present (pre-Phase A)"
  exit 0
fi

REQUIRED=(
  hooks/git/pre-commit.d/10-default-checkout-isolation
  hooks/git/pre-commit.d/20-quick-fix-eligibility
  hooks/git/pre-commit.d/30-plan-receipt-lineage-check
  hooks/git/post-commit.d/10-receipt-promote
  hooks/git/pre-push.d/10-receipts-complete
  hooks/git/pre-push.d/20-push-notes-ref
)
FAIL=0
for f in "${REQUIRED[@]}"; do
  if [[ ! -x "$f" ]]; then
    echo "FAIL: $f missing or not executable"
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo "PASS: required hook slots present + executable"
  exit 0
fi
exit 1
