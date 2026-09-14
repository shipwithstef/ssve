#!/bin/bash
# Serious Vibe Coding Framework Test - Full Automated Runner
# Usage: bash run-all.sh [--static-only] [--include-live] [--runs N] [--project PATH]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
SVC_DIR="$(dirname "$SKILL_DIR")"
STATIC_ONLY=false
INCLUDE_LIVE=false
RUNS=1
PROJECT="${SVC_DIR}/examples/todo-api"
SERVER_PID=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --static-only) STATIC_ONLY=true; shift ;;
    --include-live) INCLUDE_LIVE=true; shift ;;
    --runs) RUNS="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

RESULTS_DIR="${SVC_DIR}/test-framework/results/$(date +%Y-%m-%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null
    echo "Server stopped (PID $SERVER_PID)"
  fi
}
trap cleanup EXIT

echo "============================================="
echo "  Serious Vibe Coding Framework Test — Full Runner"
echo "  $(date)"
echo "  Project: $PROJECT"
echo "  Runs: $RUNS"
echo "  Static only: $STATIC_ONLY"
echo "  Include live: $INCLUDE_LIVE"
echo "============================================="
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0

# ─── PHASE 1: STATIC TESTS ───
echo ">>> PHASE 1: Static Tests"
echo ""

if bash "$SKILL_DIR/scripts/validate-pipeline-integrity.sh" "$PROJECT" > "$RESULTS_DIR/suite-1-integrity.txt" 2>&1; then
  echo "  PASS  Suite 1: Pipeline Integrity"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  echo "  FAIL  Suite 1: Pipeline Integrity"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# Cache measurements (static, no LLM)
echo ""
echo ">>> PHASE 1b: Cache Measurements"

# Spec-as-index
if [ -d "$PROJECT/docs/specs/features" ]; then
  total_lines=$(find "$PROJECT/docs" -name "*.md" -exec cat {} + 2>/dev/null | wc -l)
  spec_lines=0
  for f in "$PROJECT/docs/specs/features/"*.md; do
    [ -f "$f" ] && spec_lines=$((spec_lines + $(wc -l < "$f")))
  done
  ratio=$((spec_lines * 100 / total_lines))

  cat > "$RESULTS_DIR/suite-6a-spec-index.json" <<EOF
{"test":"spec-as-index","total_lines":$total_lines,"spec_lines":$spec_lines,"ratio":$ratio,"pass":$([ "$ratio" -lt 60 ] && echo true || echo false)}
EOF

  if [ "$ratio" -lt 60 ]; then
    echo "  PASS  Spec-as-index: ${ratio}% (specs are ${ratio}% of total docs)"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo "  FAIL  Spec-as-index: ${ratio}%"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
fi

# Cross-feature sharing
if [ -d "$PROJECT/docs/specs" ]; then
  layer1=$(cat "$PROJECT/docs/specs/vision.md" "$PROJECT/docs/specs/personas/"*.md "$PROJECT/docs/specs/design-system.md" 2>/dev/null | wc -l)
  first_feature=$(ls "$PROJECT/docs/specs/features/"*.md 2>/dev/null | head -1)
  if [ -n "$first_feature" ]; then
    fname=$(basename "$first_feature" .md)
    layer2=$(cat "$first_feature" \
      "$PROJECT/docs/specs/ux/$fname.md" \
      "$PROJECT/docs/specs/ui/$fname.md" 2>/dev/null | wc -l)
    total=$((layer1 + layer2))
    [ "$total" -gt 0 ] && share=$((layer1 * 100 / total)) || share=0

    cat > "$RESULTS_DIR/suite-6b-cache-sharing.json" <<EOF
{"test":"cache-sharing","layer1":$layer1,"layer2":$layer2,"share_pct":$share,"pass":$([ "$share" -gt 25 ] && echo true || echo false)}
EOF

    if [ "$share" -gt 25 ]; then
      echo "  PASS  Cache sharing: ${share}%"
      TOTAL_PASS=$((TOTAL_PASS + 1))
    else
      echo "  FAIL  Cache sharing: ${share}%"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  fi
fi

# Skill pack consistency
SKILL_DIRS=$(find "$SVC_DIR" -name "SKILL.md" -not -path "*/examples/*" -not -path "*/.git/*" | wc -l)
MANIFEST_SKILLS=$(python3 -c "import json; d=json.load(open('$SVC_DIR/skills-manifest.json')); print(len(d['includedSkills']))" 2>/dev/null || echo 0)
if [ "$SKILL_DIRS" -eq "$MANIFEST_SKILLS" ]; then
  echo "  PASS  Skill consistency: $SKILL_DIRS dirs = $MANIFEST_SKILLS manifest"
  TOTAL_PASS=$((TOTAL_PASS + 1))
else
  echo "  FAIL  Skill consistency: $SKILL_DIRS dirs vs $MANIFEST_SKILLS manifest"
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
fi

# Doctrine sections
for section in "The Science" "The Core Principle" "Cache-Optimized Execution" "The Complete Pipeline" "Checkpoints"; do
  if grep -q "$section" "$SVC_DIR/DOCTRINE.md" 2>/dev/null; then
    echo "  PASS  Doctrine: '$section'"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo "  FAIL  Doctrine: '$section' missing"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
done

if [ "$STATIC_ONLY" = true ]; then
  echo ""
  echo "============================================="
  echo "  STATIC RESULTS: $TOTAL_PASS passed, $TOTAL_FAIL failed"
  echo "  Output: $RESULTS_DIR/"
  echo "============================================="
  cat > "$RESULTS_DIR/summary.json" <<EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","mode":"static","passed":$TOTAL_PASS,"failed":$TOTAL_FAIL}
EOF
  [ "$TOTAL_FAIL" -eq 0 ] && exit 0 || exit 1
fi

# ─── PHASE 2: LIVE SERVER TESTS ───
if [ "$INCLUDE_LIVE" = true ]; then
  echo ""
  echo ">>> PHASE 2: Live Server Tests"

  # Find or create server
  SERVER_DIR=""
  for candidate in /tmp/svc-test-raw /tmp/svc-test-svc /tmp/svc-test-server; do
    if [ -f "$candidate/src/index.js" ] || [ -f "$candidate/src/server.js" ]; then
      SERVER_DIR="$candidate"
      break
    fi
  done

  if [ -z "$SERVER_DIR" ]; then
    echo "  SKIP  No test server found (run comparison test first)"
  else
    echo "  Starting server from $SERVER_DIR..."
    cd "$SERVER_DIR"
    node src/index.js > /dev/null 2>&1 &
    SERVER_PID=$!
    cd "$SVC_DIR"

    # Wait for ready
    for i in $(seq 1 10); do
      curl -s http://localhost:3000/todos > /dev/null 2>&1 && break
      sleep 1
    done

    if curl -s http://localhost:3000/todos > /dev/null 2>&1; then
      echo "  Server ready on :3000"

      # Smoke test: create, read, update
      CREATE=$(curl -s -X POST http://localhost:3000/todos -H "Content-Type: application/json" -d '{"title":"Framework test todo","dueDate":"2025-01-01T00:00:00Z"}')
      TODO_ID=$(echo "$CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

      if [ -n "$TODO_ID" ]; then
        echo "  PASS  POST /todos creates todo (id: $TODO_ID)"
        TOTAL_PASS=$((TOTAL_PASS + 1))
      else
        echo "  FAIL  POST /todos"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
      fi

      LIST=$(curl -s http://localhost:3000/todos)
      if echo "$LIST" | python3 -c "import sys,json; items=json.load(sys.stdin); assert len(items)>0" 2>/dev/null; then
        echo "  PASS  GET /todos returns items"
        TOTAL_PASS=$((TOTAL_PASS + 1))
      else
        echo "  FAIL  GET /todos"
        TOTAL_FAIL=$((TOTAL_FAIL + 1))
      fi

      if [ -n "$TODO_ID" ]; then
        PATCH=$(curl -s -X PATCH "http://localhost:3000/todos/$TODO_ID" -H "Content-Type: application/json" -d '{"status":"done"}')
        STATUS=$(echo "$PATCH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
        if [ "$STATUS" = "done" ]; then
          echo "  PASS  PATCH /todos/:id updates status"
          TOTAL_PASS=$((TOTAL_PASS + 1))
        else
          echo "  FAIL  PATCH /todos/:id"
          TOTAL_FAIL=$((TOTAL_FAIL + 1))
        fi
      fi

      # Overdue check
      curl -s -X POST http://localhost:3000/notifications/check-overdue > /dev/null 2>&1
      NOTIFS=$(curl -s http://localhost:3000/notifications 2>/dev/null)
      if [ -n "$NOTIFS" ]; then
        echo "  PASS  Notification system responds"
        TOTAL_PASS=$((TOTAL_PASS + 1))
      else
        echo "  SKIP  Notification endpoints not available"
      fi

      cat > "$RESULTS_DIR/suite-live.json" <<EOF
{"test":"live-server","server":"$SERVER_DIR","todo_created":$([ -n "$TODO_ID" ] && echo true || echo false),"status_updated":$([ "$STATUS" = "done" ] && echo true || echo false)}
EOF
    else
      echo "  FAIL  Server didn't start"
      TOTAL_FAIL=$((TOTAL_FAIL + 1))
    fi
  fi
fi

# ─── SUMMARY ───
echo ""
echo "============================================="
echo "  RESULTS: $TOTAL_PASS passed, $TOTAL_FAIL failed"
echo "  Output: $RESULTS_DIR/"
echo "============================================="

cat > "$RESULTS_DIR/summary.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mode": "$([ "$INCLUDE_LIVE" = true ] && echo 'full' || echo 'static')",
  "passed": $TOTAL_PASS,
  "failed": $TOTAL_FAIL,
  "total": $((TOTAL_PASS + TOTAL_FAIL)),
  "project": "$PROJECT",
  "runs": $RUNS
}
EOF

[ "$TOTAL_FAIL" -eq 0 ] && exit 0 || exit 1
