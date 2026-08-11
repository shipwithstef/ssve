#!/usr/bin/env bash
# Tier 1 — capability-concierge (WI-106).
#
# Syntax + preconditions-refusal + happy-path (with seeded registry + fresh
# snapshot) + no-hallucinated-resource assertion.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/capability-concierge.mjs"
REG_SCRIPT="$REPO_ROOT/scripts/builder-capability-registry.mjs"
CROSS_SCRIPT="$REPO_ROOT/scripts/cross-project-state.mjs"

PASS=0
FAIL=0
ERRORS=""

[[ -f "$SCRIPT" ]] && PASS=$((PASS+1)) || { ERRORS+="  FAIL: script missing\n"; FAIL=$((FAIL+1)); }
node --check "$SCRIPT" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: syntax\n"; FAIL=$((FAIL+1)); }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export SVC_BUILDER_CAPABILITY_REGISTRY="$TMP/registry.json"
export SVC_STATE_SNAPSHOT="$TMP/snapshot.json"
export SVC_REPO_ROOT="$REPO_ROOT"

# Case A: registry missing → refused (capture first; node exits 1 under pipefail)
OUT_A=$(node "$SCRIPT" --out "$TMP/out.md" 2>&1 || true)
if echo "$OUT_A" | grep -q '"verdict": "refused"'; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: did not refuse on missing registry. got: $OUT_A\n"; FAIL=$((FAIL+1))
fi

# Seed registry
node "$REG_SCRIPT" seed >/dev/null

# Case B: snapshot missing → refused
OUT_B=$(node "$SCRIPT" --out "$TMP/out.md" 2>&1 || true)
if echo "$OUT_B" | grep -q '"verdict": "refused"'; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: did not refuse on missing snapshot. got: $OUT_B\n"; FAIL=$((FAIL+1))
fi

# Create a snapshot via cross-project-state with 3 fake projects
mkdir -p "$TMP/proj-example-marketplace/docs/specs/work-items"
cat > "$TMP/proj-example-marketplace/docs/specs/work-items/INDEX.md" <<EOF
- [WI-001](WI-001.md) — fake — status:backlog
- [WI-002](WI-002.md) — fake2 — status:in-progress
EOF
cat > "$TMP/projects.json" <<EOF
{"projects":[{"id":"example-marketplace","path":"$TMP/proj-example-marketplace"}]}
EOF
HOME="$TMP/home" node "$CROSS_SCRIPT" --out "$SVC_STATE_SNAPSHOT" --projects-file "$TMP/projects.json" >/dev/null

# Case C: happy path → produces exactly 3 recommendations, all validated
OUT_JSON=$(node "$SCRIPT" --out "$TMP/out.md")
if echo "$OUT_JSON" | grep -q '"verdict": "recommendations-written"'; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: happy path did not succeed\n  got: $OUT_JSON\n"; FAIL=$((FAIL+1))
fi

# Verify 3 lenses in output
LENS_COUNT=$(echo "$OUT_JSON" | grep -cE '"lens":')
if [[ $LENS_COUNT -eq 3 ]]; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: expected 3 lenses, got $LENS_COUNT\n"; FAIL=$((FAIL+1))
fi

# Verify report file contains the 3 sections
if [[ -f "$TMP/out.md" ]] && grep -cE '^## Lens:' "$TMP/out.md" | grep -q 3; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: report file missing or does not contain 3 '## Lens:' sections\n"; FAIL=$((FAIL+1))
fi

# Verify no hallucinated resource-id appears in the ship or idle lens output
node -e "
const out = require('fs').readFileSync('$TMP/out.md', 'utf8');
const reg = JSON.parse(require('fs').readFileSync('$SVC_BUILDER_CAPABILITY_REGISTRY', 'utf8'));
const ids = new Set(Object.keys(reg.resources));
const referenced = [...out.matchAll(/Required resource: \\\`([^\\\`]+)\\\`/g)].map(m => m[1]);
const bad = referenced.filter(id => !ids.has(id));
if (bad.length > 0) { console.error('hallucinated ids:', bad); process.exit(1); }
" && PASS=$((PASS+1)) || { ERRORS+="  FAIL: hallucinated resource-id detected\n"; FAIL=$((FAIL+1)); }

echo ""
echo "  capability-concierge: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
