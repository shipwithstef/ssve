#!/usr/bin/env bash
# Tier 1 — builder capability registry (WI-104).
#
# Validates that the seed file parses, schema-checks, and has the required
# minimums per WI-104 ACs. Runs in a temp HOME so it never touches the real
# ~/.svc/capabilities/registry.json.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/builder-capability-registry.mjs"
SEED="$REPO_ROOT/references/capability-registry-seed.json"

PASS=0
FAIL=0
ERRORS=""

# 1. script + seed exist and parse
for f in "$SCRIPT" "$SEED"; do
  if [[ ! -f "$f" ]]; then
    ERRORS+="  FAIL: missing $f\n"; FAIL=$((FAIL+1))
  else
    PASS=$((PASS+1))
  fi
done

node --check "$SCRIPT" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: script syntax\n"; FAIL=$((FAIL+1)); }
node -e "JSON.parse(require('fs').readFileSync('$SEED','utf8'))" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: seed JSON invalid\n"; FAIL=$((FAIL+1)); }

# 2. seed meets minimums: ≥7 resources, ≥1 with sub_budgets
node -e "
const d = JSON.parse(require('fs').readFileSync('$SEED','utf8'));
const count = Object.keys(d.resources || {}).length;
const withSubs = Object.values(d.resources || {}).filter(r => r.sub_budgets && Object.keys(r.sub_budgets).length > 0).length;
if (count < 7) { console.error('only ' + count + ' resources (need ≥7)'); process.exit(1); }
if (withSubs < 1) { console.error('no resources with sub_budgets'); process.exit(1); }
" && PASS=$((PASS+1)) || { ERRORS+="  FAIL: seed does not meet AC-01 minimums\n"; FAIL=$((FAIL+1)); }

# 3. seed-then-validate round-trip in temp HOME
TMP_HOME=$(mktemp -d)
SVC_BUILDER_CAPABILITY_REGISTRY="$TMP_HOME/.svc/capabilities/registry.json" \
  node "$SCRIPT" seed >/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: seed command errored\n"; FAIL=$((FAIL+1)); }

SVC_BUILDER_CAPABILITY_REGISTRY="$TMP_HOME/.svc/capabilities/registry.json" \
  node "$SCRIPT" validate >/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: validate command errored\n"; FAIL=$((FAIL+1)); }

SVC_BUILDER_CAPABILITY_REGISTRY="$TMP_HOME/.svc/capabilities/registry.json" \
  node "$SCRIPT" list | head -3 | grep -q "Capability registry" && PASS=$((PASS+1)) \
  || { ERRORS+="  FAIL: list command output header missing\n"; FAIL=$((FAIL+1)); }

rm -rf "$TMP_HOME"

echo ""
echo "  builder-capability-registry: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
