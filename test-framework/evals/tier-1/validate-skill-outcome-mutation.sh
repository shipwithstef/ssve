#!/bin/bash
# Tier-1 validator for WI-300 skill_outcome graph mutation.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

assert_node() {
  local label="$1"
  local graph="$2"
  local code="$3"
  if node - "$graph" "$code" <<'NODE'; then
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const code = process.argv[3];
const fn = new Function("graph", `return (${code});`);
if (!fn(graph)) process.exit(1);
NODE
    pass "$label"
  else
    fail "$label"
  fi
}

compile_graph() {
  local name="$1"
  node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
    --wi "WI-$name" \
    --lane bugfix \
    --change-type bugfix \
    --intent "fixture $name" \
    --out "$TMP/$name.json" \
    --force >/dev/null
}

apply_outcome() {
  local graph="$1"
  local outcome="$2"
  node "$REPO_ROOT/scripts/apply-skill-outcome.mjs" --graph "$TMP/$graph.json" --outcome "$TMP/$outcome.json" >/dev/null
}

echo "=== Tier 1: Skill Outcome Graph Mutation ==="

node --check "$REPO_ROOT/scripts/apply-skill-outcome.mjs" >/dev/null
pass "apply-skill-outcome.mjs syntax valid"

grep -q "updateJsonAtomic" "$REPO_ROOT/scripts/apply-skill-outcome.mjs" && pass "mutation helper uses locked state writer" || fail "mutation helper uses locked state writer"

compile_graph browser-visible
cat > "$TMP/browser-outcome.json" <<'JSON'
{
  "skill_outcome": {
    "skill": "diagnose-bug",
    "status": "partial",
    "signals_added": ["browser-visible"],
    "artifacts_produced": ["docs/specs/bugfix/browser-brief.md"],
    "graph_mutations_requested": [
      {
        "action": "insert_task",
        "target": "track-visuals",
        "signal": "browser-visible",
        "reason": "Bug changes browser-visible behavior.",
        "affected_evidence_families": ["visual"],
        "validator_proof": "fixture browser-visible reproduction"
      }
    ],
    "closeout_impact": "blocked"
  }
}
JSON
apply_outcome browser-visible browser-outcome
assert_node "browser-visible outcome inserts track-visuals" "$TMP/browser-visible.json" 'graph.tasks.some((task) => task.metadata && task.metadata.skill === "track-visuals")'
assert_node "browser-visible signal is recorded" "$TMP/browser-visible.json" 'graph.delivery_graph.risk_flags.includes("browser-visible")'
assert_node "browser-visible mutation history records source and proof" "$TMP/browser-visible.json" 'graph.delivery_graph.mutation_history.some((entry) => entry.source_skill === "diagnose-bug" && entry.validator_proof === "fixture browser-visible reproduction")'

compile_graph graph-mismatch
cat > "$TMP/mismatch-outcome.json" <<'JSON'
{
  "skill_outcome": {
    "skill": "review-gate",
    "status": "blocked",
    "signals_added": ["graph-mismatch"],
    "graph_mutations_requested": [
      {
        "action": "insert_task",
        "target": "audit-session-execution",
        "signal": "graph-mismatch",
        "reason": "Review found graph/evidence mismatch.",
        "affected_evidence_families": ["session_forensics"],
        "validator_proof": "fixture review-gate finding"
      }
    ],
    "closeout_impact": "blocked"
  }
}
JSON
apply_outcome graph-mismatch mismatch-outcome
assert_node "graph mismatch inserts audit-session-execution" "$TMP/graph-mismatch.json" 'graph.tasks.some((task) => task.metadata && task.metadata.skill === "audit-session-execution")'
assert_node "graph mismatch mutation appends history" "$TMP/graph-mismatch.json" 'graph.delivery_graph.mutation_history.some((entry) => entry.action === "insert_task" && entry.signal_discovered === "graph-mismatch")'

compile_graph contradiction
node - "$TMP/contradiction.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
for (const task of graph.tasks) task.status = "completed";
graph.status = "completed";
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
cat > "$TMP/contradiction-outcome.json" <<'JSON'
{
  "skill_outcome": {
    "skill": "audit-implementation",
    "status": "fail",
    "signals_added": ["contradiction"],
    "graph_mutations_requested": [
      {
        "action": "return_to_prior_gate",
        "target": "review-gate",
        "signal": "contradiction",
        "reason": "Implementation contradicts approved review assumptions.",
        "affected_evidence_families": ["code_review", "implementation_audit"],
        "validator_proof": "fixture audit finding"
      }
    ],
    "closeout_impact": "blocked"
  }
}
JSON
apply_outcome contradiction contradiction-outcome
assert_node "contradiction reopens review-gate and downstream tasks" "$TMP/contradiction.json" 'graph.status === "in_progress" && graph.tasks.some((task) => task.metadata.skill === "review-gate" && task.status === "pending")'
assert_node "return-to-prior-gate records affected tasks" "$TMP/contradiction.json" 'graph.delivery_graph.mutation_history.some((entry) => entry.action === "return_to_prior_gate" && entry.affected_tasks.length > 0)'

for skill in diagnose-bug validate-feature write-spec design-tech plan-changeset execute-changeset review-plan review-gate audit-implementation test-journeys write-e2e verify-promotion audit-session-execution; do
  if grep -q "references/skill-outcome-contract.md" "$REPO_ROOT/skills/$skill/SKILL.md"; then
    pass "$skill references skill outcome contract"
  else
    fail "$skill references skill outcome contract"
  fi
done

echo
echo "skill-outcome mutation: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
