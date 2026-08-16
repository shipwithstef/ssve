#!/bin/bash
# Tier-1 validator for WI-301 closeout classification.

set -euo pipefail

# WI-395: pure-classification assertions below are non-write (preview) and therefore
# ungated by design; the closeout-green gate is exercised explicitly at the end with
# a temp MAIN_GREEN_STATUS_FILE (green/red/missing).

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

compile_graph() {
  local name="$1"
  local flags="${2:-}"
  node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
    --wi "WI-$name" \
    --lane framework \
    --change-type framework \
    --intent "fixture $name" \
    --risk-flags "$flags" \
    --out "$TMP/$name.json" \
    --force >/dev/null
}

mutate() {
  local file="$1"
  local code="$2"
  node - "$TMP/$file.json" "$code" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const code = process.argv[3];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
new Function("graph", code)(graph);
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
}

expect_class() {
  local file="$1"
  local expected="$2"
  local label="$3"
  local actual
  actual="$(node "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" "$TMP/$file.json" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).classification))')"
  if [[ "$actual" == "$expected" ]]; then pass "$label"; else echo "expected $expected, got $actual" >&2; fail "$label"; fi
}

complete_graph='graph.status = "completed"; for (const task of graph.tasks) { task.status = "completed"; task.process_receipts = (task.metadata?.required_process_steps || []).map((step) => ({skill:step.skill, ...(step.mode ? {mode:step.mode} : {}), recorded_at:"2026-08-15T00:00:00.000Z", evidence:{type:"command_output",path:"fixture.log",sha256:"a".repeat(64)}})); } for (const key of Object.keys(graph.delivery_graph.evidence_families)) graph.delivery_graph.evidence_families[key] = "satisfied";'

echo "=== Tier 1: Delivery Graph Closeout Classification ==="

node --check "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" >/dev/null
pass "classifier syntax valid"
grep -q "updateJsonAtomic" "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" && pass "classifier write mode uses locked state writer" || fail "classifier write mode uses locked state writer"
grep -q "closeout classification" "$REPO_ROOT/skills/route-workflow/SKILL.md" && pass "route-workflow requires closeout classification" || fail "route-workflow requires closeout classification"
grep -q "closeout classification" "$REPO_ROOT/skills/verify-promotion/SKILL.md" && pass "verify-promotion requires closeout classification" || fail "verify-promotion requires closeout classification"

compile_graph framework-complete
mutate framework-complete "$complete_graph"
expect_class framework-complete framework-complete "complete framework graph classifies framework-complete"

compile_graph missing-evidence
mutate missing-evidence 'graph.status = "completed"; for (const task of graph.tasks) task.status = "completed"; for (const key of Object.keys(graph.delivery_graph.evidence_families)) graph.delivery_graph.evidence_families[key] = "satisfied"; graph.delivery_graph.evidence_families.code_review = "required";'
expect_class missing-evidence runtime-accepted "open evidence prevents framework-complete"

compile_graph corrective-missing "retroactive,concurrency"
mutate corrective-missing "$complete_graph"
expect_class corrective-missing runtime-accepted "corrective graph missing forensic evidence classifies runtime-accepted"

compile_graph corrective-complete "retroactive,concurrency"
mutate corrective-complete "$complete_graph graph.delivery_graph.corrective_evidence = { route_workflow_phase_receipts: true, route_decision_log: true, upstream_skip_ledger: true, post_merge_verification: true, audit_implementation_mode_selection: true };"
expect_class corrective-complete corrective-closure-complete "corrective graph with forensic evidence classifies corrective-closure-complete"

compile_graph blocked
mutate blocked 'graph.status = "blocked";'
expect_class blocked blocked "blocked graph classifies blocked"

compile_graph example-marketplace-wi233 "deploy-affecting,user-facing"
mutate example-marketplace-wi233 'graph.status = "completed"; graph.delivery_graph.evidence_families.runtime = "satisfied"; graph.delivery_graph.evidence_families.deploy = "satisfied";'
expect_class example-marketplace-wi233 runtime-accepted "Example Marketplace WI-233 style production-probe-only closeout classifies runtime-accepted"

node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
  --wi WI-FEATURE-CLOSEOUT \
  --lane brownfield-feature \
  --change-type feature \
  --intent "fixture user-facing feature closeout" \
  --risk-flags browser-visible,user-facing \
  --out "$TMP/feature-closeout-missing.json" \
  --force >/dev/null
mutate feature-closeout-missing 'graph.status = "completed"; for (const task of graph.tasks) task.status = "completed"; for (const key of Object.keys(graph.delivery_graph.evidence_families)) graph.delivery_graph.evidence_families[key] = "satisfied"; graph.delivery_graph.evidence_families.feature_validation_closeout = "required";'
expect_class feature-closeout-missing runtime-accepted "user-facing feature cannot classify framework-complete without feature closeout ledger"

node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
  --wi WI-PROVIDER-FIDELITY \
  --lane brownfield-feature \
  --change-type feature \
  --intent "fixture provider-backed generated output" \
  --risk-flags browser-visible,user-facing,provider-backed,generated-content,saved-outcome \
  --out "$TMP/provider-fidelity-missing.json" \
  --force >/dev/null
mutate provider-fidelity-missing 'graph.status = "completed"; for (const task of graph.tasks) task.status = "completed"; for (const key of Object.keys(graph.delivery_graph.evidence_families)) graph.delivery_graph.evidence_families[key] = "satisfied"; graph.delivery_graph.evidence_families.provider_fidelity = "required";'
expect_class provider-fidelity-missing runtime-accepted "provider-backed generated feature cannot classify framework-complete without provider fidelity evidence"

# WI-395 closeout-green gate: --write records *complete* ONLY when the main-green
# verdict is green for the current HEAD + working tree (codex G6: HIGH-4, MED-1).
GATE_STATUS="$TMP/mg-status.json"
GATE_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
GATE_DIRTY="$(git -C "$REPO_ROOT" diff HEAD | sha256sum | cut -d' ' -f1)"
seed_status() { printf '{"status":"%s","head_sha":"%s","dirty_sha":"%s","ts":"test","failing":[]}\n' "$1" "$GATE_HEAD" "$GATE_DIRTY" > "$GATE_STATUS"; }
write_class() { MAIN_GREEN_STATUS_FILE="$GATE_STATUS" node "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" "$1" --write >/dev/null 2>&1; node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")).delivery_graph.closeout_classification)' "$1"; }

cp "$TMP/framework-complete.json" "$TMP/gate-green.json"; seed_status green
[ "$(write_class "$TMP/gate-green.json")" = "framework-complete" ] \
  && pass "closeout-green gate: green verdict records framework-complete" \
  || fail "closeout-green gate: green verdict records framework-complete"
if node -e 'const g=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8"));process.exit(g.delivery_graph.mutation_history.some(e=>e.source==="classify-delivery-graph-closeout")?0:1)' "$TMP/gate-green.json"; then
  pass "write mode records closeout classification and mutation history"
else
  fail "write mode records closeout classification and mutation history"
fi
cp "$TMP/framework-complete.json" "$TMP/gate-red.json"; seed_status red
[ "$(write_class "$TMP/gate-red.json")" = "runtime-accepted" ] \
  && pass "closeout-green gate: red verdict blocks complete (downgrades to runtime-accepted)" \
  || fail "closeout-green gate: red verdict blocks complete"
cp "$TMP/framework-complete.json" "$TMP/gate-missing.json"; rm -f "$GATE_STATUS"
[ "$(write_class "$TMP/gate-missing.json")" = "runtime-accepted" ] \
  && pass "closeout-green gate: missing verdict blocks complete (downgrades to runtime-accepted)" \
  || fail "closeout-green gate: missing verdict blocks complete"

echo
echo "delivery-graph closeout classification: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
