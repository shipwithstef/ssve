#!/bin/bash
# Tier-1 validator for WI-302 delivery graph replay and autorun proof.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

compile() {
  local name="$1"
  shift
  node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" "$@" --out "$TMP/$name.json" --force >/dev/null
}

mutate() {
  local name="$1"
  local code="$2"
  node - "$TMP/$name.json" "$code" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const code = process.argv[3];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
new Function("graph", code)(graph);
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
}

assert_node() {
  local label="$1"
  local file="$2"
  local code="$3"
  if node - "$TMP/$file.json" "$code" <<'NODE'; then
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const fn = new Function("graph", `return (${process.argv[3]});`);
if (!fn(graph)) process.exit(1);
NODE
    pass "$label"
  else
    fail "$label"
  fi
}

class_is() {
  local file="$1"
  local expected="$2"
  local label="$3"
  local actual
  actual="$(node "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" "$TMP/$file.json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).classification))')"
  if [[ "$actual" == "$expected" ]]; then pass "$label"; else echo "expected $expected got $actual" >&2; fail "$label"; fi
}

complete='graph.status = "completed"; for (const task of graph.tasks) task.status = "completed"; for (const key of Object.keys(graph.delivery_graph.evidence_families)) graph.delivery_graph.evidence_families[key] = "satisfied";'

echo "=== Tier 1: Delivery Graph Replay And Autorun Proof ==="

compile example-marketplace-wi233 --wi WI-HH233 --lane bugfix --change-type bugfix --intent "Example Marketplace WI-233 partial corrective graph" --risk-flags deploy-affecting,user-facing
mutate example-marketplace-wi233 'graph.status = "completed"; graph.delivery_graph.evidence_families.runtime = "satisfied"; graph.delivery_graph.evidence_families.deploy = "satisfied";'
class_is example-marketplace-wi233 runtime-accepted "Example Marketplace WI-233 partial corrective graph remains runtime-accepted"

compile css-browser --wi WI-CSS --lane refactor --change-type refactor --intent "CSS-only browser-visible chore" --risk-flags browser-visible
assert_node "CSS/browser-visible chore inserts track-visuals" css-browser 'graph.tasks.some((task) => task.metadata.skill === "track-visuals") && graph.delivery_graph.evidence_families.visual === "required"'
assert_node "CSS/browser-visible graph records baseline and diff modes" css-browser '["baseline","diff"].every((mode) => graph.tasks.some((task) => task.metadata.skill === "track-visuals" && task.metadata.mode === mode))'

compile user-bugfix --wi WI-BUG --lane bugfix --change-type bugfix --intent "User-facing bugfix" --risk-flags user-facing
assert_node "user-facing bugfix inserts test-journeys" user-bugfix 'graph.tasks.some((task) => task.metadata.skill === "test-journeys") && graph.delivery_graph.evidence_families.runtime === "required"'

compile backend-base44 --input "$REPO_ROOT/test-framework/evals/tier-1/fixtures/delivery-graph-compiler/backend-base44-change.json"
assert_node "backend Base44 function inserts base44-environment" backend-base44 'graph.tasks.some((task) => task.metadata.skill === "base44-environment") && graph.delivery_graph.evidence_families.deploy === "required"'

compile docs-only --input "$REPO_ROOT/test-framework/evals/tier-1/fixtures/delivery-graph-compiler/docs-only-change.json"
node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/docs-only.json" >/dev/null && pass "docs-only graph validates with N/A ledger" || fail "docs-only graph validates with N/A ledger"

compile challenged --input "$REPO_ROOT/test-framework/evals/tier-1/fixtures/delivery-graph-compiler/retroactive-corrective-closure.json"
assert_node "user-challenged/retroactive graph inserts audit-session-execution" challenged 'graph.tasks.some((task) => task.metadata.skill === "audit-session-execution") && graph.delivery_graph.evidence_families.session_forensics === "required"'

bash "$REPO_ROOT/test-framework/evals/tier-1/validate-skill-outcome-mutation.sh" >/dev/null && pass "mutation replay includes insert_task and return_to_prior_gate" || fail "mutation replay includes insert_task and return_to_prior_gate"

for lane in greenfield bugfix framework; do
  case "$lane" in
    greenfield) compile "autorun-$lane" --wi WI-AUTO-G --lane greenfield --change-type feature --intent "Autorun greenfield skeleton" --risk-flags browser-visible,user-facing ;;
    bugfix) compile "autorun-$lane" --wi WI-AUTO-B --lane bugfix --change-type bugfix --intent "Autorun brownfield bugfix skeleton" --risk-flags user-facing ;;
    framework) compile "autorun-$lane" --wi WI-AUTO-F --lane framework --change-type framework --intent "Autorun framework-evolution skeleton" --risk-flags concurrency ;;
  esac
  assert_node "autorun $lane compiles delivery graph and task list" "autorun-$lane" 'graph.delivery_graph && graph.tasks.length > 0'
done

grep -qi "Human Checkpoint Behavior in Autorun" "$REPO_ROOT/skills/route-workflow/references/autorun-orchestrator.md" && pass "autorun human-checkpoint behavior documented" || fail "autorun human-checkpoint behavior documented"
grep -qi "closeout classification" "$REPO_ROOT/skills/route-workflow/SKILL.md" && pass "autorun terminal closeout classification required" || fail "autorun terminal closeout classification required"
grep -qi "WI-302" "$REPO_ROOT/docs/specs/work-items/WI-194.md" && pass "WI-194 cross-linked to WI-302 replay coverage" || fail "WI-194 cross-linked to WI-302 replay coverage"

echo
echo "delivery-graph replay autorun: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
