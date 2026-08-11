#!/usr/bin/env bash
# Tier 1: task-graph receipt enforcement behaves identically across host labels.
# The helper is host-agnostic, but this validator protects the AP-27 contract
# from host-specific env branching or future adapter drift.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TASK_GRAPH="$REPO_ROOT/scripts/task-graph.mjs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

HOSTS=(claude kimi codex gemini opencode)
PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

write_fixture() {
  local file="$1"
  cat > "$file" <<'JSON'
{
  "wi": "WI-166-FIXTURE",
  "lane": "framework",
  "status": "pending",
  "tasks": [
    {
      "id": 1,
      "skill": "route-workflow",
      "subject": "route the framework task",
      "status": "pending",
      "blocked_by": []
    }
  ]
}
JSON
}

echo "=== Tier 1: task-graph cross-host receipt enforcement ==="

if [[ ! -f "$TASK_GRAPH" ]]; then
  echo "FAIL: scripts/task-graph.mjs missing"
  exit 1
fi

for host in "${HOSTS[@]}"; do
  graph="$TMP_DIR/$host-lane-tasks.json"
  write_fixture "$graph"

  if SVC_HOST="$host" node "$TASK_GRAPH" validate "$graph" >/dev/null; then
    pass "$host: fixture validates"
  else
    fail "$host: fixture failed initial validation"
    continue
  fi

  missing_out="$TMP_DIR/$host-missing.out"
  if SVC_HOST="$host" node "$TASK_GRAPH" set-status "$graph" 1 completed >"$missing_out" 2>&1; then
    fail "$host: set-status completed without receipt unexpectedly passed"
  elif grep -q "cannot be completed without a matching load-skill receipt" "$missing_out"; then
    pass "$host: completed without receipt is blocked"
  else
    fail "$host: missing-receipt block message drifted"
  fi

  if SVC_HOST="$host" node "$TASK_GRAPH" load-skill "$graph" 1 route-workflow --via "$host" >/dev/null; then
    pass "$host: load-skill writes receipt"
  else
    fail "$host: load-skill failed"
    continue
  fi

  if SVC_HOST="$host" node "$TASK_GRAPH" set-status "$graph" 1 completed >/dev/null; then
    pass "$host: completed with matching receipt is accepted"
  else
    fail "$host: completed with matching receipt failed"
  fi

  receipt_skill="$(node -e "const g=require(process.argv[1]); console.log(g.tasks[0].skill_receipt.skill)" "$graph")"
  receipt_via="$(node -e "const g=require(process.argv[1]); console.log(g.tasks[0].skill_receipt.loaded_via)" "$graph")"
  graph_status="$(node -e "const g=require(process.argv[1]); console.log(g.status)" "$graph")"
  if [[ "$receipt_skill" == "route-workflow" && "$receipt_via" == "$host" && "$graph_status" == "completed" ]]; then
    pass "$host: receipt shape and graph status persisted"
  else
    fail "$host: persisted receipt/status mismatch (skill=$receipt_skill via=$receipt_via status=$graph_status)"
  fi

  mismatch="$TMP_DIR/$host-mismatch.json"
  write_fixture "$mismatch"
  mismatch_out="$TMP_DIR/$host-mismatch.out"
  if SVC_HOST="$host" node "$TASK_GRAPH" load-skill "$mismatch" 1 diagnose-bug >"$mismatch_out" 2>&1; then
    fail "$host: wrong skill receipt unexpectedly accepted"
  elif grep -q "expects skill route-workflow, received diagnose-bug" "$mismatch_out"; then
    pass "$host: wrong skill receipt is blocked"
  else
    fail "$host: wrong-skill block message drifted"
  fi
done

echo ""
echo "task-graph cross-host: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
