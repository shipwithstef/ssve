#!/usr/bin/env bash
# Tier 1: Verify docs/specs/stack-profile.md is not stale.
# Threshold: 90 days (per stack-profile template + proposal §12 risk).
# Skipped if file doesn't exist (project hasn't run mine-builder --mode=stack-profile yet).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROFILE="$REPO_ROOT/docs/specs/stack-profile.md"
THRESHOLD_DAYS="${SVC_STACK_PROFILE_MAX_DAYS:-90}"

if [[ ! -f "$PROFILE" ]]; then
  echo "validate-stack-profile-freshness: stack-profile.md absent — OK (run mine-builder --mode=stack-profile to populate)"
  exit 0
fi

# Use file mtime — simple and portable
profile_mtime=$(stat -c %Y "$PROFILE" 2>/dev/null || stat -f %m "$PROFILE" 2>/dev/null)
now=$(date +%s)
age_days=$(( (now - profile_mtime) / 86400 ))

if (( age_days > THRESHOLD_DAYS )); then
  echo "WARN: stack-profile.md is $age_days days old (threshold $THRESHOLD_DAYS). Run: mine-builder --mode=stack-profile (refresh)"
  # Phase A: warn only. Will become error in WI-SPINE-005.
  exit 0
fi
echo "validate-stack-profile-freshness: $age_days days old (within threshold $THRESHOLD_DAYS) — OK"
exit 0
