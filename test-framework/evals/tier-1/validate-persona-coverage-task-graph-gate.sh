#!/usr/bin/env bash
# Tier-1 validator for the feature-class persona coverage task-graph gate.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TASK_GRAPH="$REPO_ROOT/scripts/task-graph.mjs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() {
  echo "  PASS - $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL - $1"
  FAIL=$((FAIL + 1))
}

expect_pass() {
  local file="$1"
  local label="$2"
  if node "$TASK_GRAPH" validate "$file" >/dev/null 2>&1; then
    pass "$label"
  else
    node "$TASK_GRAPH" validate "$file" || true
    fail "$label"
  fi
}

expect_fail_persona_gate() {
  local file="$1"
  local label="$2"
  local out="$TMP_DIR/out.txt"
  if node "$TASK_GRAPH" validate "$file" >"$out" 2>&1; then
    fail "$label"
  elif grep -q "persona coverage gate" "$out"; then
    pass "$label"
  else
    cat "$out"
    fail "$label"
  fi
}

write_manual_feature_without_persona() {
  local file="$1"
  cat > "$file" <<'JSON'
{
  "wi": "WI-PERSONA-GATE",
  "lane": "brownfield-feature",
  "created": "2026-06-05T12:00:00.000Z",
  "status": "pending",
  "tasks": [
    { "id": 1, "skill": "validate-feature", "subject": "validate feature", "status": "pending", "blocked_by": [] },
    { "id": 2, "skill": "write-spec", "subject": "write spec", "status": "pending", "blocked_by": [1] },
    { "id": 3, "skill": "design-ux", "subject": "design UX", "status": "pending", "blocked_by": [2] }
  ]
}
JSON
}

echo "=== Tier 1: Persona Coverage Task-Graph Gate ==="

node --check "$TASK_GRAPH" >/dev/null && pass "task-graph syntax valid" || fail "task-graph syntax invalid"

write_manual_feature_without_persona "$TMP_DIR/manual-missing.json"
expect_fail_persona_gate "$TMP_DIR/manual-missing.json" "future manual brownfield-feature graph fails without build-personas or persona_coverage"

write_manual_feature_without_persona "$TMP_DIR/manual-build-personas.json"
node - "$TMP_DIR/manual-build-personas.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
graph.tasks.splice(1, 0, {
  id: 4,
  skill: "build-personas",
  subject: "build-personas: map customer/admin personas before spec",
  status: "pending",
  blocked_by: [1]
});
graph.tasks[2].blocked_by = [4];
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
expect_pass "$TMP_DIR/manual-build-personas.json" "manual feature graph passes with build-personas task"

write_manual_feature_without_persona "$TMP_DIR/manual-existing-personas.json"
node - "$TMP_DIR/manual-existing-personas.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
graph.persona_coverage = {
  status: "satisfied",
  artifact: "docs/specs/personas/PERSONA_INDEX.md",
  reason: "Existing customer and admin personas are current and mapped in the feature spec."
};
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
expect_pass "$TMP_DIR/manual-existing-personas.json" "manual feature graph passes with existing-persona artifact decision"

write_manual_feature_without_persona "$TMP_DIR/manual-short-skip.json"
node - "$TMP_DIR/manual-short-skip.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
graph.persona_coverage = { status: "not_required", reason: "N/A" };
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
expect_fail_persona_gate "$TMP_DIR/manual-short-skip.json" "manual feature graph fails with weak persona skip rationale"

write_manual_feature_without_persona "$TMP_DIR/historical.json"
node - "$TMP_DIR/historical.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
graph.created = "2026-06-04T23:59:59.000Z";
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
expect_pass "$TMP_DIR/historical.json" "historical pre-gate feature graph remains accepted"

cat > "$TMP_DIR/delivery-missing.json" <<'JSON'
{
  "wi": "WI-PERSONA-DELIVERY",
  "lane": "brownfield-feature",
  "created": "2026-06-05T12:00:00.000Z",
  "status": "pending",
  "delivery_graph": {
    "change_type": "feature",
    "risk_flags": ["user-facing"]
  },
  "tasks": [
    { "id": 1, "skill": "validate-feature", "subject": "validate feature", "status": "pending", "blocked_by": [] },
    { "id": 2, "skill": "write-spec", "subject": "write spec", "status": "pending", "blocked_by": [1] }
  ]
}
JSON
expect_fail_persona_gate "$TMP_DIR/delivery-missing.json" "delivery-graph feature also fails task-graph validation without persona coverage"

echo "persona coverage task-graph gate: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
