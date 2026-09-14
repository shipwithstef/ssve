#!/usr/bin/env bash
# Tier-1 validator: audit-session-execution must distinguish audit report
# completion from implementation landing state. Origin: WI-220.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

SKILL="skills/audit-session-execution/SKILL.md"
PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local pattern="$1"
  local label="$2"
  if grep -Fq "$pattern" "$SKILL"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: audit-session landing-state closeout ==="

require_fixed "## Landing-State Closeout Gate" "landing-state closeout section exists"
require_fixed "## Landing-State Verification" "report section name is mandated"
require_fixed "git status --short --branch" "git status evidence required"
require_fixed "git branch --show-current" "current branch evidence required"
require_fixed "gh pr view <number> --json state,mergedAt,mergeCommit,url" "PR state evidence required when a PR exists"
require_fixed "merge commit SHA" "merge evidence required"
require_fixed "Post-merge validation" "post-merge validation evidence required"
require_fixed "implementation-not-landed" "dirty or unmerged work cannot be closed"
require_fixed "implementation-landed-verified" "landed verified verdict is named"
require_fixed "do-not-land-approved" "user-approved no-land escape is explicit"
require_fixed "commit the changes, open a PR, merge/squash-merge" "recovery path names commit, PR, and merge"
require_fixed "Landing-state gate applied when repo files changed" "self-verify includes landing-state row"

echo
echo "audit-session landing-state closeout: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
