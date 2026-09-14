#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/check-journey-refresh-trigger.mjs"
VERIFY="$REPO_ROOT/skills/verify-promotion/SKILL.md"
WRITE="$REPO_ROOT/skills/write-journeys/SKILL.md"
TEST="$REPO_ROOT/skills/test-journeys/SKILL.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

echo "=== Tier 1: journey refresh trigger ==="

node --check "$HELPER" >/dev/null && ok "refresh trigger helper syntax valid" || bad "refresh trigger helper syntax valid"

cat >"$TMP_DIR/trigger.json" <<'JSON'
{"milestone_complete":true,"active_wi_count":0,"journeys_exist":true,"shipped_behavior_changed":true,"next_skill":"assess-market-readiness"}
JSON
cat >"$TMP_DIR/no-trigger.json" <<'JSON'
{"milestone_complete":true,"active_wi_count":2,"journeys_exist":true,"shipped_behavior_changed":true,"next_skill":"assess-market-readiness"}
JSON

node "$HELPER" --state "$TMP_DIR/trigger.json" | grep -q '"refresh_required": true' && ok "milestone boundary requires refresh" || bad "milestone boundary requires refresh"
node "$HELPER" --state "$TMP_DIR/no-trigger.json" | grep -q '"refresh_required": false' && ok "active WI suppresses refresh" || bad "active WI suppresses refresh"

if grep -q "write-journeys --refresh --all" "$VERIFY" && grep -q "roadmap/readiness handoff" "$VERIFY"; then
  ok "verify-promotion documents refresh before roadmap/readiness handoff"
else
  bad "verify-promotion documents refresh before roadmap/readiness handoff"
fi

if grep -q "references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup" "$WRITE" \
  && grep -q "references/phase-receipts.md supersedes duplicate task-graph boilerplate cleanup" "$TEST"; then
  ok "journey skills document boilerplate cleanup rationale"
else
  bad "journey skills document boilerplate cleanup rationale"
fi

echo
echo "journey refresh trigger: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
