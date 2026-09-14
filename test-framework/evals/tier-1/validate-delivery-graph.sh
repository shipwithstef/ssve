#!/bin/bash
# Tier-1 validator for WI-299 delivery graph evidence/skip completeness.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

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

compile() {
  local name="$1"
  local fixture="$2"
  node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
    --input "$REPO_ROOT/test-framework/evals/tier-1/fixtures/delivery-graph-compiler/$fixture" \
    > "$TMP/$name.json"
}

mutate() {
  local file="$1"
  local expression="$2"
  node - "$TMP/$file.json" "$expression" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const expression = process.argv[3];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
const fn = new Function("graph", expression);
fn(graph);
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
}

expect_pass() {
  local file="$1"
  local label="$2"
  if node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/$file.json" >/dev/null 2>&1; then
    pass "$label"
  else
    node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/$file.json" || true
    fail "$label"
  fi
}

expect_fail() {
  local file="$1"
  local label="$2"
  if node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/$file.json" >/dev/null 2>&1; then
    fail "$label"
  else
    pass "$label"
  fi
}

mark_all_satisfied='graph.status = "completed"; for (const key of Object.keys(graph.delivery_graph.evidence_families)) { if (graph.delivery_graph.evidence_families[key] === "required") graph.delivery_graph.evidence_families[key] = "satisfied"; }'

echo "=== Tier 1: Delivery Graph Completeness ==="

node --check "$REPO_ROOT/scripts/validate-delivery-graph.mjs" >/dev/null
pass "validate-delivery-graph.mjs syntax valid"

compile visual browser-visible-product-change.json
mutate visual "$mark_all_satisfied"
expect_pass visual "visual/browser-visible graph passes with visual and runtime evidence satisfied"

compile visual-missing browser-visible-product-change.json
mutate visual-missing 'graph.status = "completed"; graph.delivery_graph.evidence_families.runtime = "satisfied"; graph.delivery_graph.evidence_families.feature_validation_closeout = "satisfied";'
expect_fail visual-missing "browser-visible graph fails while visual evidence remains required"

compile runtime-missing browser-visible-product-change.json
mutate runtime-missing 'graph.status = "completed"; graph.delivery_graph.evidence_families.visual = "satisfied"; graph.delivery_graph.evidence_families.feature_validation_closeout = "satisfied";'
expect_fail runtime-missing "user-facing graph fails while runtime evidence remains required"

compile closeout-missing browser-visible-product-change.json
mutate closeout-missing 'graph.status = "completed"; graph.delivery_graph.evidence_families.visual = "satisfied"; graph.delivery_graph.evidence_families.runtime = "satisfied";'
expect_fail closeout-missing "user-facing feature graph fails while feature closeout ledger evidence remains required"

compile provider provider-backed-generation.json
mutate provider "$mark_all_satisfied"
expect_pass provider "provider-backed generated graph passes with provider fidelity evidence satisfied"

compile provider-missing provider-backed-generation.json
mutate provider-missing 'graph.status = "completed"; for (const key of Object.keys(graph.delivery_graph.evidence_families)) { if (graph.delivery_graph.evidence_families[key] === "required") graph.delivery_graph.evidence_families[key] = "satisfied"; } graph.delivery_graph.evidence_families.provider_fidelity = "required";'
expect_fail provider-missing "provider-backed generated graph fails while provider fidelity remains required"

compile base44 backend-base44-change.json
mutate base44 "$mark_all_satisfied"
expect_pass base44 "backend/Base44 graph passes with audit and deploy evidence satisfied"

compile base44-missing backend-base44-change.json
mutate base44-missing 'graph.status = "completed"; graph.tasks = graph.tasks.filter((task) => task.metadata.skill !== "base44-environment"); graph.delivery_graph.evidence_families.deploy = "satisfied"; graph.delivery_graph.evidence_families.implementation_audit = "satisfied";'
expect_fail base44-missing "Base44 graph fails when base44-environment is omitted without skip evidence"

compile docs docs-only-change.json
mutate docs "$mark_all_satisfied"
expect_pass docs "docs-only graph passes with registered visual/runtime N/A skip ledger"

compile docs-bad-skip docs-only-change.json
mutate docs-bad-skip 'graph.delivery_graph.skipped_skills[0].skip_condition_id = "not-registered";'
expect_fail docs-bad-skip "docs-only graph fails with unregistered graph-level skip id"

compile challenged retroactive-corrective-closure.json
mutate challenged "$mark_all_satisfied"
mutate challenged 'graph.delivery_graph.skipped_skills.push({ skill: "review-plan", skip_condition_id: "review-plan:trivial-or-prior-reviewed", reason: "Retroactive corrective replay already has upstream review evidence.", evidence: "corrective replay fixture" });'
expect_pass challenged "challenged/retroactive graph passes with session forensics satisfied"

compile challenged-missing retroactive-corrective-closure.json
mutate challenged-missing 'graph.status = "completed"; graph.delivery_graph.evidence_families.session_forensics = "required";'
expect_fail challenged-missing "challenged closeout fails while session forensics remains required"

cp "$TMP/docs.json" "$TMP/omitted-step.json"
mutate omitted-step 'graph.tasks = graph.tasks.filter((task) => task.metadata.skill !== "review-plan"); graph.delivery_graph.skipped_skills = graph.delivery_graph.skipped_skills.filter((entry) => entry.skill !== "review-plan");'
expect_fail omitted-step "omitted required lane step fails without registry-backed skipped_skills evidence"

cat > "$TMP/legacy-pre-wi.json" <<'JSON'
{
  "wi": "WI-LEGACY",
  "lane": "framework",
  "created": "2026-05-10T23:00:00.000Z",
  "status": "completed",
  "tasks": []
}
JSON
expect_pass legacy-pre-wi "historical pre-WI-299 graph without delivery_graph is accepted"

cat > "$TMP/legacy-unmarked.json" <<'JSON'
{
  "wi": "WI-NEW",
  "lane": "framework",
  "created": "2026-05-11T12:00:00.000Z",
  "status": "completed",
  "tasks": []
}
JSON
expect_fail legacy-unmarked "new graph without delivery_graph fails unless explicitly legacy"

echo
echo "delivery-graph completeness: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
