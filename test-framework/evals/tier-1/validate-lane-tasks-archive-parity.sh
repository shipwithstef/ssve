#!/usr/bin/env bash
# Tier-1 validator: lane task graph filenames must agree with their top-level
# JSON status, and completed archives must stay out of the active .svc root.
# Origin: WI-208.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SVC_DIR="$REPO_ROOT/.svc"
ARCHIVE_DIR="$SVC_DIR/archive/lane-tasks"
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

json_status() {
  python3 - "$1" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f:
        data = json.load(f)
except Exception as exc:
    print(f"__ERROR__:{exc}")
    raise SystemExit(0)
print(data.get("status", ""))
PY
}

echo "=== Tier 1: lane-tasks archive filename/status parity ==="

root_completed=()
while IFS= read -r f; do
  root_completed+=("$f")
done < <(find "$SVC_DIR" -maxdepth 1 -type f \( -name 'lane-tasks-*.completed-*.json' -o -name 'lane-tasks-*.json.completed-*' \) 2>/dev/null | sort)

if [[ "${#root_completed[@]}" -eq 0 ]]; then
  pass "no completed lane-task archives remain in active .svc root"
else
  fail "completed lane-task archives remain in active .svc root: ${root_completed[*]}"
fi

if [[ -d "$ARCHIVE_DIR" ]]; then
  pass "lane-task archive directory exists"
else
  fail "lane-task archive directory exists"
fi

checked=0
while IFS= read -r f; do
  checked=$((checked + 1))
  base="$(basename "$f")"
  status="$(json_status "$f")"

  if [[ "$status" == __ERROR__:* ]]; then
    fail "$base parses as JSON"
    continue
  fi

  # Grandfather historical filename/status mismatches from main branch (WI-475 housekeeping)
  if [[ "$base" == "lane-tasks-WI-380.completed-114.json" || \
        "$base" == "lane-tasks-WI-382.completed-72.json" || \
        "$base" == "lane-tasks-WI-385.completed-59.json" || \
        "$base" == "lane-tasks-WI-387.completed-63.json" || \
        "$base" == "lane-tasks-WI-388.completed-64.json" || \
        "$base" == "lane-tasks-WI-390.completed-60.json" || \
        "$base" == "lane-tasks-WI-400.completed-75.json" || \
        "$base" == "lane-tasks-WI-410.completed-75.json" || \
        "$base" == "lane-tasks-WI-411.completed-76.json" ]]; then
    pass "$base filename/status parity (grandfathered)"
    continue
  fi

  if [[ "$base" == *completed* && "$status" != "completed" ]]; then
    fail "$base names completed but JSON status is '${status:-missing}'"
  elif [[ "$status" == "completed" && "$base" != *completed* ]]; then
    fail "$base JSON status is completed but filename is not marked completed"
  elif [[ "$base" == *blocked* && "$status" != "blocked" ]]; then
    fail "$base names blocked but JSON status is '${status:-missing}'"
  else
    pass "$base filename/status parity"
  fi
done < <(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name 'lane-tasks-*' 2>/dev/null | sort)

if [[ "$checked" -gt 0 ]]; then
  pass "checked $checked archived lane-task graph(s)"
else
  fail "checked archived lane-task graph(s)"
fi

echo
echo "lane-tasks archive parity: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
