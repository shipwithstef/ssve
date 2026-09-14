#!/bin/bash
# Tier-1 validator for WI-318 blocking discovery halt protocol.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

assert_file_contains() {
  local label="$1"
  local file="$2"
  local pattern="$3"
  if grep -q "$pattern" "$REPO_ROOT/$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_node_graph() {
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

echo "=== Tier 1: Blocking Discovery Halt Protocol ==="

node --check "$REPO_ROOT/scripts/validate-blocking-discovery.mjs" >/dev/null \
  && pass "validate-blocking-discovery syntax valid" \
  || fail "validate-blocking-discovery syntax valid"

node --check "$REPO_ROOT/scripts/apply-skill-outcome.mjs" >/dev/null \
  && pass "apply-skill-outcome syntax valid" \
  || fail "apply-skill-outcome syntax valid"

cat > "$TMP/blocking-discovery-WI-053.json" <<'JSON'
{
  "schema": 1,
  "signal": "BLOCKING_DISCOVERY",
  "parent_wi": "WI-053",
  "source_skill": "write-e2e",
  "discovered_during": "self-verify",
  "blocker_summary": "Real backend returns 401 during employee creation.",
  "evidence_artifacts": [
    {
      "type": "command_output",
      "path": ".svc/write-e2e-test-run.log",
      "summary": "atomicEmployeeCreate returned 401"
    }
  ],
  "routing": {
    "recommended_skill": "diagnose-bug",
    "reason": "Runtime defect blocks verification of the parent WI.",
    "no_prelocked_fix": true
  },
  "parent_state": "BLOCKED_ON_DISCOVERY: WI-054",
  "follow_up_wi": "WI-054"
}
JSON

if node "$REPO_ROOT/scripts/validate-blocking-discovery.mjs" --artifact "$TMP/blocking-discovery-WI-053.json" >/dev/null; then
  pass "valid blocking discovery artifact passes"
else
  fail "valid blocking discovery artifact passes"
fi

node - "$TMP/blocking-discovery-WI-053.json" "$TMP/invalid.json" <<'NODE'
const fs = require("node:fs");
const valid = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
delete valid.evidence_artifacts;
fs.writeFileSync(process.argv[3], JSON.stringify(valid, null, 2) + "\n");
NODE

if node "$REPO_ROOT/scripts/validate-blocking-discovery.mjs" --artifact "$TMP/invalid.json" >/dev/null 2>&1; then
  fail "invalid artifact without evidence fails"
else
  pass "invalid artifact without evidence fails"
fi

node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
  --wi WI-053 \
  --lane bugfix \
  --change-type bugfix \
  --intent "fixture blocking discovery" \
  --out "$TMP/lane-tasks-WI-053.json" \
  --force >/dev/null

cat > "$TMP/outcome.json" <<'JSON'
{
  "skill_outcome": {
    "skill": "write-e2e",
    "status": "blocked",
    "signals_added": ["BLOCKING_DISCOVERY"],
    "artifacts_produced": [".svc/blocking-discovery-WI-053.json"],
    "validator_proof": "blocking-discovery validator PASS",
    "graph_mutations_requested": [
      {
        "action": "block_on_discovery",
        "target": "diagnose-bug",
        "signal": "BLOCKING_DISCOVERY",
        "artifact": ".svc/blocking-discovery-WI-053.json",
        "follow_up_wi": "WI-054",
        "reason": "Runtime defect blocks honest parent verification.",
        "validator_proof": "fixture blocking discovery"
      }
    ],
    "closeout_impact": "blocked"
  }
}
JSON

node "$REPO_ROOT/scripts/apply-skill-outcome.mjs" \
  --graph "$TMP/lane-tasks-WI-053.json" \
  --outcome "$TMP/outcome.json" >/dev/null

assert_node_graph "block_on_discovery blocks graph" "$TMP/lane-tasks-WI-053.json" 'graph.status === "blocked"'
assert_node_graph "block_on_discovery inserts follow-up skill" "$TMP/lane-tasks-WI-053.json" 'graph.tasks.some((task) => task.metadata && task.metadata.skill === "diagnose-bug")'
assert_node_graph "blocking discovery metadata is durable" "$TMP/lane-tasks-WI-053.json" 'graph.delivery_graph.blocking_discovery && graph.delivery_graph.blocking_discovery.follow_up_wi === "WI-054" && graph.delivery_graph.closeout_blockers.includes("BLOCKING_DISCOVERY")'
assert_node_graph "mutation history records blocking discovery" "$TMP/lane-tasks-WI-053.json" 'graph.delivery_graph.mutation_history.some((entry) => entry.action === "block_on_discovery" && entry.signal_discovered === "BLOCKING_DISCOVERY")'

assert_file_contains "reference defines BLOCKING_DISCOVERY" "references/blocking-discovery-format.md" "BLOCKING_DISCOVERY"
assert_file_contains "WI state lexicon defines BLOCKED_ON_DISCOVERY" "references/wi-state-lexicon.md" "BLOCKED_ON_DISCOVERY"
assert_file_contains "route-workflow links blocking discovery protocol" "skills/route-workflow/SKILL.md" "blocking-discovery-format.md"
assert_file_contains "skill outcome schema supports block_on_discovery" "references/schemas/skill-outcome.schema.json" "block_on_discovery"
assert_file_contains "skill outcome contract documents block_on_discovery" "references/skill-outcome-contract.md" "block_on_discovery"

for skill in write-e2e test-journeys verify-promotion audit-implementation review-security; do
  assert_file_contains "$skill references blocking discovery protocol" "skills/$skill/SKILL.md" "references/blocking-discovery-format.md"
done

echo
echo "blocking-discovery halt: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
