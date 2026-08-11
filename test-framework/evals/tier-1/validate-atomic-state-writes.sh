#!/usr/bin/env bash
# Tier-1: hard-block direct fs.writeFileSync/fs.writeFile calls targeting
# literal .svc/ JSON or JSONL paths outside scripts/state-io.mjs.
# Origin: WI-196. Broader dynamic-path and concurrency enforcement remains
# tracked by WI-195.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
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

scan_offenders() {
  grep -rn -E "fs\.(writeFileSync|writeFile|appendFileSync|appendFile)\(.*\.svc/.*\.(json|jsonl)" \
    --include="*.mjs" --include="*.js" \
    "$@" 2>/dev/null \
    | grep -v "scripts/state-io.mjs" \
    || true
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat > "$TMP_DIR/bad.mjs" <<'EOF'
import fs from "node:fs";
fs.writeFileSync(".svc/lane-tasks-WI-999.json", "{}\n");
EOF

cat > "$TMP_DIR/good.mjs" <<'EOF'
import { writeJsonAtomic } from "./scripts/state-io.mjs";
await writeJsonAtomic(".svc/lane-tasks-WI-999.json", {});
EOF

BAD_FINDINGS="$(scan_offenders "$TMP_DIR/bad.mjs")"
GOOD_FINDINGS="$(scan_offenders "$TMP_DIR/good.mjs")"

if [ -n "$BAD_FINDINGS" ]; then
  pass "self-test detects direct literal .svc JSON write"
else
  fail "self-test detects direct literal .svc JSON write"
fi

if [ -z "$GOOD_FINDINGS" ]; then
  pass "self-test allows state-io mediated write"
else
  fail "self-test allows state-io mediated write"
fi

OFFENDERS="$(scan_offenders "$REPO_ROOT/scripts" "$REPO_ROOT/hooks")"

if [ -z "$OFFENDERS" ]; then
  pass "no direct literal fs writes to .svc JSON/JSONL outside state-io.mjs"
else
  fail "direct literal fs writes to .svc JSON/JSONL found"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "    $line"
  done <<< "$OFFENDERS"
fi

echo "validate-atomic-state-writes: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
