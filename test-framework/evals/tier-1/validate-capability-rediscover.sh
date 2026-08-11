#!/usr/bin/env bash
# Tier 1 — capability-rediscover (WI-107).
#
# Syntax + scan-on-stale + accept-with-filled-scaffold + reject-scaffold-not-filled.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/capability-rediscover.mjs"
REG_SCRIPT="$REPO_ROOT/scripts/builder-capability-registry.mjs"

PASS=0
FAIL=0
ERRORS=""

[[ -f "$SCRIPT" ]] && PASS=$((PASS+1)) || { ERRORS+="  FAIL: missing\n"; FAIL=$((FAIL+1)); }
node --check "$SCRIPT" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: syntax\n"; FAIL=$((FAIL+1)); }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export SVC_BUILDER_CAPABILITY_REGISTRY="$TMP/registry.json"
export SVC_CAPABILITY_PENDING_DIR="$TMP/pending"
export SVC_REPO_ROOT="$REPO_ROOT"

# Create a registry with one stale entry
cat > "$TMP/registry.json" <<EOF
{
  "schema_version": 1,
  "resources": {
    "fresh": {
      "label": "Fresh tool",
      "tier": "paid",
      "cost_usd_monthly": 10,
      "host_cli": ["fresh-cli"],
      "reset_cadence": "monthly",
      "reset_day_of_period": 1,
      "last_verified": "$(date -u +%Y-%m-%d)",
      "notes": ""
    },
    "ancient": {
      "label": "Ancient tool",
      "tier": "paid",
      "cost_usd_monthly": 50,
      "host_cli": ["ancient-cli"],
      "reset_cadence": "monthly",
      "reset_day_of_period": 1,
      "last_verified": "2025-01-01",
      "notes": ""
    }
  }
}
EOF

# Scan — only 'ancient' should be flagged
SCAN_OUT=$(node "$SCRIPT" scan --stale-days 30)
if echo "$SCAN_OUT" | grep -q '"stale_count": 1'; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: stale_count not 1. got: $SCAN_OUT\n"; FAIL=$((FAIL+1))
fi

if [[ -f "$TMP/pending/ancient.md" ]]; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: proposal file for 'ancient' not written\n"; FAIL=$((FAIL+1))
fi

# Accept without filling → should fail
ACCEPT_OUT=$(node "$SCRIPT" accept ancient 2>&1 || true)
if echo "$ACCEPT_OUT" | grep -qE 'still the scaffold|does not contain'; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: accept on unfilled scaffold did not refuse. got: $ACCEPT_OUT\n"; FAIL=$((FAIL+1))
fi

# Fill in the scaffold with a valid entry block
python3 - <<PY
import re
p = "$TMP/pending/ancient.md"
text = open(p).read()
filled_block = '''{
  "label": "Ancient tool (updated)",
  "tier": "paid",
  "cost_usd_monthly": 99,
  "host_cli": ["ancient-cli"],
  "reset_cadence": "monthly",
  "reset_day_of_period": 1,
  "notes": "re-verified"
}'''
text2 = re.sub(
  r'### Proposed new entry\s*\n\s*\`\`\`json\s*\n<!--[^-]*-->\s*\n\s*\`\`\`',
  '### Proposed new entry\n\n\`\`\`json\n' + filled_block + '\n\`\`\`',
  text, count=1)
if text2 == text: raise SystemExit("failed to substitute scaffold")
open(p, 'w').write(text2)
PY

# Accept → should apply + move to done/
ACCEPT_OK=$(node "$SCRIPT" accept ancient 2>&1)
if echo "$ACCEPT_OK" | grep -q '"verdict": "accepted"'; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: accept did not succeed on filled scaffold. got: $ACCEPT_OK\n"; FAIL=$((FAIL+1))
fi

# Verify registry now reflects the change
NEW_COST=$(node -e "
const r = JSON.parse(require('fs').readFileSync('$TMP/registry.json','utf8'));
console.log(r.resources.ancient.cost_usd_monthly);
")
if [[ "$NEW_COST" == "99" ]]; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: registry not updated, cost=$NEW_COST\n"; FAIL=$((FAIL+1))
fi

# Verify proposal moved to done/
if [[ ! -f "$TMP/pending/ancient.md" ]] && [[ -f "$TMP/pending/done/ancient.md" ]]; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: proposal not moved to done/\n"; FAIL=$((FAIL+1))
fi

echo ""
echo "  capability-rediscover: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
