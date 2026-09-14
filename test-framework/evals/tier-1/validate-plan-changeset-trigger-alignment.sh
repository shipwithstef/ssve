#!/usr/bin/env bash
# Tier-1 validator: improve-framework must follow the current risk-based
# plan-changeset trigger rule, not the superseded size-only trigger.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

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

require_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

require_not_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    fail "$label"
  else
    pass "$label"
  fi
}

echo "=== Tier 1: plan-changeset trigger alignment ==="

require_contains "rules/plan-changeset-trigger.md" \
  "Supersedes** the earlier size-based trigger" \
  "canonical rule supersedes size-only trigger"

require_contains "skills/improve-framework/SKILL.md" \
  "Apply \`rules/plan-changeset-trigger.md\` before implementation." \
  "improve-framework references canonical trigger rule"

require_contains "skills/improve-framework/SKILL.md" \
  "size is an audit signal, not a mandatory trigger" \
  "improve-framework treats size as audit signal"

require_contains "skills/improve-framework/SKILL.md" \
  "Risk signal in \`rules/plan-changeset-trigger.md\`" \
  "risk signal routes to normal pipeline"

require_contains "skills/improve-framework/SKILL.md" \
  "Explicit exemption in \`rules/plan-changeset-trigger.md\`" \
  "explicit exemptions allow direct edit"

require_not_contains "skills/improve-framework/SKILL.md" \
  "If the implementation touches **> 2 files** or **> 50 lines of change**, it MUST" \
  "obsolete size-only MUST trigger removed"

echo
echo "plan-changeset trigger alignment: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
