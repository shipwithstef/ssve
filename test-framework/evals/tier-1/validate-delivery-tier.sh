#!/usr/bin/env bash
# Tier-1 validator for WI-320 explicit delivery tier declaration.

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

compile_feature() {
  local out="$1"
  shift
  node "$REPO_ROOT/scripts/compile-delivery-graph.mjs" \
    --wi WI-TIER \
    --intent "build user-facing feature" \
    --repo-mode convert \
    --change-type feature \
    --lane brownfield-feature \
    --risk-flags user-facing,browser-visible \
    "$@" > "$out"
}

echo "=== Tier 1: Delivery Tier Declaration ==="

if node --check "$REPO_ROOT/scripts/compile-delivery-graph.mjs" >/dev/null &&
   node --check "$REPO_ROOT/scripts/validate-delivery-graph.mjs" >/dev/null &&
   node --check "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" >/dev/null; then
  pass "delivery graph scripts parse"
else
  fail "delivery graph scripts parse"
fi

compile_feature "$TMP/full.json"
if node - "$TMP/full.json" <<'NODE'
const fs = require("node:fs");
const graph = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tier = graph.delivery_graph.delivery_tier;
const required = new Set(tier.validation_policy.mandatory_skills);
if (tier.mode !== "full") process.exit(1);
for (const skill of ["validate-feature", "audit-ac", "write-journeys", "write-e2e", "test-journeys", "track-visuals", "verify-promotion"]) {
  if (!required.has(skill)) process.exit(1);
}
NODE
then
  pass "feature graph defaults to full tier with mandatory validation skills"
else
  fail "feature graph defaults to full tier with mandatory validation skills"
fi

if node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/full.json" >/tmp/svc-tier-full.out 2>&1; then
  pass "full tier feature graph validates"
else
  cat /tmp/svc-tier-full.out
  fail "full tier feature graph validates"
fi

cp "$TMP/full.json" "$TMP/missing-tier.json"
node - "$TMP/missing-tier.json" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const graph = JSON.parse(fs.readFileSync(file, "utf8"));
delete graph.delivery_graph.delivery_tier;
fs.writeFileSync(file, JSON.stringify(graph, null, 2) + "\n");
NODE
if node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/missing-tier.json" >/tmp/svc-tier-missing.err 2>&1; then
  fail "validator rejects missing delivery_tier"
else
  if grep -q "delivery_tier" /tmp/svc-tier-missing.err; then
    pass "validator rejects missing delivery_tier"
  else
    cat /tmp/svc-tier-missing.err
    fail "validator rejects missing delivery_tier"
  fi
fi

compile_feature "$TMP/compressed-missing.json" --delivery-tier compressed
if node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/compressed-missing.json" >/tmp/svc-tier-compressed-missing.err 2>&1; then
  fail "validator rejects silent compressed tier"
else
  if grep -q "compressed delivery tier requires" /tmp/svc-tier-compressed-missing.err; then
    pass "validator rejects silent compressed tier"
  else
    cat /tmp/svc-tier-compressed-missing.err
    fail "validator rejects silent compressed tier"
  fi
fi

compile_feature "$TMP/compressed-good.json" \
  --delivery-tier compressed \
  --delivery-tier-rationale "User explicitly requested rush scope; visual/runtime validation remain blocked behind override." \
  --delivery-tier-decision ".svc/pipeline-decisions.jsonl:WI-TIER"
if node "$REPO_ROOT/scripts/validate-delivery-graph.mjs" "$TMP/compressed-good.json" >/tmp/svc-tier-compressed-good.out 2>&1; then
  pass "validator accepts compressed tier with rationale and decision log"
else
  cat /tmp/svc-tier-compressed-good.out
  fail "validator accepts compressed tier with rationale and decision log"
fi

if node "$REPO_ROOT/scripts/classify-delivery-graph-closeout.mjs" "$TMP/compressed-good.json" > "$TMP/classification.json" &&
   node - "$TMP/classification.json" <<'NODE'
const fs = require("node:fs");
const result = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (result.delivery_tier !== "compressed") process.exit(1);
if (!result.reasons.some((reason) => reason.includes("delivery_tier=compressed"))) process.exit(1);
NODE
then
  pass "closeout classifier reports delivery tier"
else
  fail "closeout classifier reports delivery tier"
fi

if grep -q "delivery_tier.mode" "$REPO_ROOT/skills/verify-promotion/SKILL.md" &&
   grep -q "compressed/rush closeouts" "$REPO_ROOT/skills/verify-promotion/SKILL.md" &&
   grep -q "delivery_tier" "$REPO_ROOT/skills/route-workflow/references/task-graph-protocol.md"; then
  pass "route-workflow and verify-promotion document delivery tier closeout"
else
  fail "route-workflow and verify-promotion document delivery tier closeout"
fi

echo "delivery tier declaration: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
