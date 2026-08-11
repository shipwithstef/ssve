#!/usr/bin/env bash
# Tier-1: validate G-1 (svc-lane-tasks-validator.mjs Edit-path eval-gate)
# Verifies the bypass-closure: editing lane-tasks JSON to flip status to
# completed without populated eval_matrix MUST exit 2 (HARD BLOCK).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-lane-tasks-validator.mjs"
TMP_REPO="$(mktemp -d)"
trap 'rm -rf "$TMP_REPO"' EXIT

PASS=0
FAIL=0
ERRORS=""

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+="    ✗ $1\n"; echo "  ✗ $1"; }

# Bootstrap a tiny git repo that mimics svc layout enough for the hook
cd "$TMP_REPO"
G375() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$TMP_REPO" "$@"; }
G375 init -q
G375 config user.email t@t
G375 config user.name t
mkdir -p hooks scripts .svc
cp -r "$REPO_ROOT/hooks/lib" hooks/
cp "$REPO_ROOT/hooks/svc-lane-tasks-validator.mjs" hooks/
cp "$REPO_ROOT/scripts/task-graph.mjs" scripts/
cp "$REPO_ROOT/scripts/state-io.mjs" scripts/

cat > .svc/lane-tasks-WI-G1.json <<JSON
{
  "lane": "framework",
  "wi": "WI-G1",
  "tasks": [
    {
      "id": 1,
      "subject": "smoke",
      "description": "smoke",
      "status": "in_progress",
      "metadata": { "skill": "diagnose-bug" }
    }
  ]
}
JSON
G375 add -A; G375 -c commit.gpgsign=false commit -q -m baseline

# Helper to flip status via python and invoke hook
flip_and_invoke() {
  local extra_python="$1"
  local extra_env="${2:-}"
  python3 -c "
import json
p = '.svc/lane-tasks-WI-G1.json'
d = json.load(open(p))
d['tasks'][0]['status'] = 'completed'
d['tasks'][0]['skill_receipt'] = {
  'skill':'diagnose-bug',
  'loaded_at':'2026-04-25T00:00:00Z',
  'loaded_via':'manual',
  'completed_at':'2026-04-25T00:00:01Z'
}
$extra_python
json.dump(d, open(p, 'w'), indent=2)
"
  local payload='{"tool_name":"Edit","tool_input":{"file_path":".svc/lane-tasks-WI-G1.json"}}'
  if [ -n "$extra_env" ]; then
    echo "$payload" | env $extra_env node hooks/svc-lane-tasks-validator.mjs >/dev/null 2>&1
  else
    echo "$payload" | node hooks/svc-lane-tasks-validator.mjs >/dev/null 2>&1
  fi
  echo $?
}

# T1: missing eval_matrix → BLOCK (exit 2)
EXIT=$(flip_and_invoke "")
[ "$EXIT" = "2" ] && pass "T1 BLOCK: missing eval_matrix returns exit 2" || fail "T1 expected exit 2, got $EXIT"

# T2: empty eval_matrix → BLOCK (exit 2)
EXIT=$(flip_and_invoke "d['tasks'][0]['eval_matrix']=[]")
[ "$EXIT" = "2" ] && pass "T2 BLOCK: empty eval_matrix returns exit 2" || fail "T2 expected exit 2, got $EXIT"

# T3: unfilled pillar → BLOCK (exit 2)
EXIT=$(flip_and_invoke "d['tasks'][0]['eval_matrix']=[{'id':'p1','label':'p1','value':None}]")
[ "$EXIT" = "2" ] && pass "T3 BLOCK: unfilled pillar returns exit 2" || fail "T3 expected exit 2, got $EXIT"

# T4: all pillars filled → PASS (exit 0)
EXIT=$(flip_and_invoke "d['tasks'][0]['eval_matrix']=[{'id':'p1','label':'p1','value':'ok'},{'id':'p2','label':'p2','value':'ok'}]")
[ "$EXIT" = "0" ] && pass "T4 PASS: filled eval_matrix returns exit 0" || fail "T4 expected exit 0, got $EXIT"

# T5: override env var
EXIT=$(flip_and_invoke "d['tasks'][0].pop('eval_matrix', None)" "SVC_LANE_TASKS_ALLOW_RAW_EDIT=1")
[ "$EXIT" = "0" ] && pass "T5 PASS: SVC_LANE_TASKS_ALLOW_RAW_EDIT=1 bypasses guard" || fail "T5 expected exit 0, got $EXIT"

echo ""
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "FAIL"
  printf "$ERRORS"
  exit 1
fi
echo "PASS"
exit 0
