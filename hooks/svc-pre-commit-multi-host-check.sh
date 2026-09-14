#!/usr/bin/env bash
# svc-pre-commit-multi-host-check.sh
# Pre-commit hook: ensures framework-wide skills are installed on ALL hosts,
# not just the active session host. Prevents the "just kimi" drift mistake.
#
# Install: ln -s ../../hooks/svc-pre-commit-multi-host-check.sh .git/hooks/pre-commit
#
# Behavior:
#   1. If no skill/ rule/ schema/ script files are staged → pass silently
#   2. In a feature worktree, validate every host against the candidate without
#      mutating live host installs; canonical main may not contain the candidate yet
#   3. In the canonical checkout, run drift and auto-setup for every host
#   4. If validation or setup fails → block commit with error message

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

STAGED=$(git diff --cached --name-only)

# Skip if no framework files are staged
if ! echo "$STAGED" | grep -qE '^(catalog-domain-capabilities/|.*SKILL\.md|references/schemas/|scripts/|hooks/|rules/)'; then
  exit 0
fi

echo "[svc-pre-commit] Framework files staged. Checking multi-host install drift..."

HOSTS="$(find provision/hosts -maxdepth 1 -name '*.json' -printf '%f\n' | sed 's/\.json$//' | sort)"
DRIFT_FOUND=0
FAILED_SETUPS=""

if [[ "$(git rev-parse --show-toplevel)" == *"/.worktrees/"* ]]; then
  echo "[svc-pre-commit] Feature worktree detected. Validating all hosts without changing live installs..."
  for host in $HOSTS; do
    if SVC_SETUP_VALIDATE_ONLY=1 ./setup --host "$host" >/dev/null 2>&1; then
      echo "  ✓ $host: candidate valid"
    else
      echo "  ✗ $host: candidate validation FAILED"
      FAILED_SETUPS="$FAILED_SETUPS $host"
    fi
  done
  if [ -n "$FAILED_SETUPS" ]; then
    echo ""
    echo "[svc-pre-commit] BLOCKED: candidate validation failed for:$FAILED_SETUPS"
    exit 1
  fi
  echo "[svc-pre-commit] Candidate validates for every host; live installs remain on canonical main."
  exit 0
fi

for host in $HOSTS; do
  if bash scripts/check-install-drift.sh --host "$host" --quiet 2>/dev/null; then
    echo "  ✓ $host: no drift"
  else
    echo "  ✗ $host: drift detected — running ./setup --host $host"
    if ./setup --host "$host" >/dev/null 2>&1; then
      echo "    ✓ $host: setup complete"
    else
      echo "    ✗ $host: setup FAILED"
      FAILED_SETUPS="$FAILED_SETUPS $host"
    fi
    DRIFT_FOUND=1
  fi
done

if [ -n "$FAILED_SETUPS" ]; then
  echo ""
  echo "[svc-pre-commit] BLOCKED: setup failed for:$FAILED_SETUPS"
  echo "Fix the errors above, then re-stage and commit."
  exit 1
fi

if [ "$DRIFT_FOUND" -eq 1 ]; then
  echo ""
  echo "[svc-pre-commit] All drift resolved. Continuing with commit."
fi

exit 0
