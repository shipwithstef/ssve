#!/usr/bin/env bash
# Tier 1: route-workflow must close mutating framework work with publish state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local needle="$1"
  local label="$2"
  if grep -Fq "$needle" "$SKILL"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: route-workflow publication-state closeout ==="

require_fixed "## Publication-State Closeout" "publication-state section exists"
require_fixed "git status --short --branch" "status command required"
require_fixed "git fetch --prune origin" "fetch/prune command required"
require_fixed "origin/main...HEAD" "origin divergence comparison required"
require_fixed "git push origin main" "push command required when publishing main"
require_fixed "remote: Repository not found" "auth failure classified before surrender"
require_fixed "improve-framework" "publication closeout references improve-framework auth recovery"
require_fixed "gh auth switch --user <owner>" "deterministic gh auth switch required"
require_fixed "restore" "previous GitHub account restoration required"
require_fixed "Never create new auth" "interactive/new auth forbidden"
require_fixed 'Final closeout must say whether local `HEAD` and `origin/main` match.' "HEAD/origin parity required in closeout"
require_fixed "Publication state closed" "self-verify covers publication state"

echo ""
echo "route-workflow publication-state closeout: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
