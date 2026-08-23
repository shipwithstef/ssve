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
  hooks/git/post-commit.d/10-receipt-promote
  hooks/git/pre-push.d/10-receipts-complete
  hooks/git/pre-push.d/20-push-notes-ref
)
# WI-557-v2: pre-commit.d/25-impact-triad and pre-commit.d/30-plan-receipt-lineage-check
# were DELETED — mid-execution receipt gates moved to boundaries (pre-push L2,
# finalizer, reconcile L3). The underlying modules (hooks/svc-impact-triad-guard.mjs,
# task-graph boundary checks) remain; only the git slot wrappers are gone.
REMOVED=(
  hooks/git/pre-commit.d/25-impact-triad
  hooks/git/pre-commit.d/30-plan-receipt-lineage-check
)
FAIL=0
for f in "${REQUIRED[@]}"; do
  if [[ ! -x "$f" ]]; then
    echo "FAIL: $f missing or not executable"
    FAIL=1
  fi
done
for f in "${REMOVED[@]}"; do
  if [[ -e "$f" ]]; then
    echo "FAIL: $f still exists — mid-execution slot was retired by WI-557 and must stay removed"
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo "PASS: required hook slots present + executable"
  exit 0
fi
exit 1
