#!/usr/bin/env bash
# Tier 1: Validate runtime behavior of framework helper scripts.
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TASK_GRAPH="$REPO_ROOT/scripts/task-graph.mjs"
PIPELINE_LOG="$REPO_ROOT/scripts/pipeline-log.mjs"
HOOK="$REPO_ROOT/hooks/svc-task-completion-guard.sh"

PASS=0
FAIL=0
ERRORS=""

pass() {
  PASS=$((PASS + 1))
}

fail() {
  ERRORS+="  FAIL: $1\n"
  FAIL=$((FAIL + 1))
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

GRAPH_NEXT="$TMP_DIR/graph-next.json"
cat > "$GRAPH_NEXT" <<'EOF'
{
  "wi": "WI-helper-next",
  "lane": "framework",
  "tasks": [
    { "id": 1, "subject": "blocked task", "status": "pending", "blocked_by": [2] },
    { "id": 2, "subject": "ready task", "status": "pending" }
  ]
}
EOF

NEXT_OUTPUT="$(node "$TASK_GRAPH" next "$GRAPH_NEXT" 2>&1 || true)"
if echo "$NEXT_OUTPUT" | grep -Fq '"id": 2'; then
  pass
else
  fail "task-graph next should skip blocked pending tasks and return the runnable one"
fi

GRAPH_DUP="$TMP_DIR/graph-dup.json"
cat > "$GRAPH_DUP" <<'EOF'
{
  "tasks": [
    { "id": 1, "subject": "a", "status": "pending" },
    { "id": 1, "subject": "b", "status": "pending" }
  ]
}
EOF

if node "$TASK_GRAPH" validate "$GRAPH_DUP" >/dev/null 2>&1; then
  fail "task-graph validate should reject duplicate task ids"
else
  pass
fi

GRAPH_MISSING="$TMP_DIR/graph-missing.json"
cat > "$GRAPH_MISSING" <<'EOF'
{
  "tasks": [
    { "id": 1, "subject": "a", "status": "pending", "blocked_by": [99] }
  ]
}
EOF

if node "$TASK_GRAPH" validate "$GRAPH_MISSING" >/dev/null 2>&1; then
  fail "task-graph validate should reject missing blocker references"
else
  pass
fi

GRAPH_CYCLE="$TMP_DIR/graph-cycle.json"
cat > "$GRAPH_CYCLE" <<'EOF'
{
  "tasks": [
    { "id": 1, "subject": "a", "status": "pending", "blocked_by": [2] },
    { "id": 2, "subject": "b", "status": "pending", "blocked_by": [1] }
  ]
}
EOF

if node "$TASK_GRAPH" validate "$GRAPH_CYCLE" >/dev/null 2>&1; then
  fail "task-graph validate should reject dependency cycles"
else
  pass
fi

GRAPH_STATUS="$TMP_DIR/graph-status.json"
cat > "$GRAPH_STATUS" <<'EOF'
{
  "tasks": [
    {
      "id": 1,
      "subject": "done task",
      "status": "completed",
      "completed_at": "2026-04-09T10:00:00.000Z",
      "skip_reason": "previous skip"
    }
  ]
}
EOF

node "$TASK_GRAPH" set-status "$GRAPH_STATUS" 1 blocked >/dev/null
STATUS_CONTENT="$(cat "$GRAPH_STATUS")"
if echo "$STATUS_CONTENT" | grep -Fq 'completed_at'; then
  fail "task-graph set-status should clear completed_at when leaving completed"
else
  pass
fi

if echo "$STATUS_CONTENT" | grep -Fq 'skip_reason'; then
  fail "task-graph set-status should clear skip_reason when leaving completed"
else
  pass
fi

if node "$TASK_GRAPH" set-status "$GRAPH_STATUS" 1 blocked --skip-reason "not allowed" >/dev/null 2>&1; then
  fail "task-graph set-status should reject skip_reason outside completed status"
else
  pass
fi

GRAPH_CHRONO="$TMP_DIR/graph-chrono.json"
node "$TASK_GRAPH" init "$GRAPH_CHRONO" --wi WI-helper-chrono --lane framework >/dev/null
node -e '
  const fs = require("fs");
  const path = process.argv[1];
  const graph = JSON.parse(fs.readFileSync(path, "utf8"));
  graph.tasks = [{ id: 1, subject: "chronology task", status: "pending", blocked_by: [] }];
  fs.writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`);
' "$GRAPH_CHRONO"
sleep 0.05

LOG_CHRONO="$TMP_DIR/pipeline-chrono.jsonl"
node "$PIPELINE_LOG" append \
  --path "$LOG_CHRONO" \
  --run-id helper-chrono \
  --skill improve-framework \
  --phase 1 \
  --type mechanical \
  --decision "chronology replay" \
  --reasoning "ensure helper timestamps align with decision log chronology" \
  --decided-by P0 >/dev/null
sleep 0.05
node "$TASK_GRAPH" set-status "$GRAPH_CHRONO" 1 completed >/dev/null

if node -e '
  const fs = require("fs");
  const graph = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const event = JSON.parse(fs.readFileSync(process.argv[2], "utf8").trim().split("\n")[0]);
  const created = Date.parse(graph.created);
  const logged = Date.parse(event.timestamp);
  const completed = Date.parse(graph.tasks[0].completed_at);
  if (![created, logged, completed].every(Number.isFinite)) process.exit(1);
  if (!(created <= logged && logged <= completed)) process.exit(2);
' "$GRAPH_CHRONO" "$LOG_CHRONO"; then
  pass
else
  fail "helper-produced task-graph timestamps and decision-log timestamps should form a coherent chronology"
fi

LOG_PATH="$TMP_DIR/pipeline-decisions.jsonl"
if node "$PIPELINE_LOG" append \
  --path "$LOG_PATH" \
  --run-id helper-test \
  --skill improve-framework \
  --phase 1 \
  --type invalid-type \
  --decision test \
  --reasoning test \
  --decided-by P0 >/dev/null 2>&1; then
  fail "pipeline-log should reject unknown event types"
else
  pass
fi

if node "$PIPELINE_LOG" append \
  --path "$LOG_PATH" \
  --run-id helper-test \
  --skill improve-framework \
  --phase 1 \
  --type mechanical \
  --decision test \
  --reasoning test \
  --decided-by invalid-actor >/dev/null 2>&1; then
  fail "pipeline-log should reject unknown decided_by values"
else
  pass
fi

if node "$PIPELINE_LOG" append \
  --path "$LOG_PATH" \
  --run-id helper-test \
  --skill improve-framework \
  --phase 1 \
  --type mechanical \
  --decision test \
  --reasoning test \
  --decided-by P0 >/dev/null 2>&1 && [[ -s "$LOG_PATH" ]]; then
  pass
else
  fail "pipeline-log should append valid decision events"
fi

HOOK_REPO="$TMP_DIR/hook-repo"
mkdir -p "$HOOK_REPO/.svc"
printf '{broken json' > "$HOOK_REPO/.svc/lane-tasks.json"

pushd "$HOOK_REPO" >/dev/null
HOOK_OUTPUT="$(printf '{}' | bash "$HOOK" 2>/dev/null || true)"
if echo "$HOOK_OUTPUT" | grep -Fq '"decision":"block"'; then
  pass
else
  fail "completion guard should fail closed on malformed lane-tasks.json by default"
fi

HOOK_FAIL_OPEN_OUTPUT="$(printf '{}' | SVC_COMPLETION_FAIL_OPEN=true bash "$HOOK" 2>/dev/null || true)"
if [[ -z "$HOOK_FAIL_OPEN_OUTPUT" ]]; then
  pass
else
  fail "completion guard should allow malformed lane-tasks.json when fail-open is explicitly enabled"
fi

HOOK_BAD_INPUT_OUTPUT="$(printf '{bad input' | bash "$HOOK" 2>/dev/null || true)"
if echo "$HOOK_BAD_INPUT_OUTPUT" | grep -Fq '"decision":"block"'; then
  pass
else
  fail "completion guard should fail closed on malformed hook payloads by default"
fi
popd >/dev/null

echo "=== Tier 1: Framework Helper Behavior Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — helper runtime behavior matches framework contract"
  exit 0
fi
