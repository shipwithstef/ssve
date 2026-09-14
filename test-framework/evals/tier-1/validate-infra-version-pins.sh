#!/usr/bin/env bash
# Tier 1: Verify infra-class repos pin provider/module/chart versions exactly.
# Looks for top-level *.tf, Chart.yaml, terragrunt.hcl. Skipped if not infra repo.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PASS=0
FAIL=0
WARNINGS=""

# Detect infra repo
infra_files=$(find "$REPO_ROOT" -maxdepth 3 \( -name "*.tf" -o -name "Chart.yaml" -o -name "terragrunt.hcl" -o -name "pulumi.yaml" \) 2>/dev/null | head -1)
if [[ -z "$infra_files" ]]; then
  echo "validate-infra-version-pins: no infra files at top level — OK (not an infra repo)"
  exit 0
fi

# For *.tf — check provider blocks have version pins
while IFS= read -r tf; do
  # Look for provider blocks without version =
  if grep -qE 'required_providers' "$tf" 2>/dev/null; then
    if ! grep -qE 'version\s*=' "$tf"; then
      WARNINGS+="  WARN: ${tf#$REPO_ROOT/} — required_providers block without version pin\n"
      FAIL=$((FAIL+1))
    else
      PASS=$((PASS+1))
    fi
  fi
done < <(find "$REPO_ROOT" -name "*.tf" -not -path "*/.terraform/*" -not -path "*/.worktrees/*" 2>/dev/null)

# For Chart.yaml — check dependencies have version field
while IFS= read -r chart; do
  if grep -qE '^dependencies:' "$chart" 2>/dev/null; then
    if ! grep -qE '^\s+version:' "$chart"; then
      WARNINGS+="  WARN: ${chart#$REPO_ROOT/} — Chart.yaml has dependencies without version pins\n"
      FAIL=$((FAIL+1))
    else
      PASS=$((PASS+1))
    fi
  fi
done < <(find "$REPO_ROOT" -name "Chart.yaml" -not -path "*/.worktrees/*" 2>/dev/null)

echo "validate-infra-version-pins: $PASS pass, $FAIL warn"
if [[ -n "$WARNINGS" ]]; then
  printf "%b" "$WARNINGS"
  # Phase A: warn-only (exit 0). Will flip to exit 1 in WI-SPINE-005.
fi
exit 0
