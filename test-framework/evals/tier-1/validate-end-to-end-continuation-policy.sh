#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/validate-end-to-end-continuation.mjs"
ROUTER="$REPO_ROOT/skills/route-workflow/SKILL.md"
REF="$REPO_ROOT/skills/route-workflow/references/end-to-end-continuation.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then ok "$label"; else bad "$label"; fi
}

echo "=== Tier 1: end-to-end continuation policy ==="

node --check "$HELPER" >/dev/null && ok "continuation validator syntax valid" || bad "continuation validator syntax valid"

cat >"$TMP_DIR/lane-tasks.json" <<'JSON'
{
  "wi": "WI-999",
  "lane": "framework",
  "status": "pending",
  "tasks": [{"id": 1, "subject": "verify", "status": "pending"}],
  "mutation_history": [
    {
      "action": "auto_continue",
      "seam_crossed": "verification",
      "requires_continuation_decision": true
    }
  ]
}
JSON

cat >"$TMP_DIR/bad-decisions.jsonl" <<'JSONL'
{"ts":"2026-05-12T00:00:00Z","skill":"route-workflow","wi":"WI-999","decision":"continued"}
JSONL

if node "$HELPER" --decisions "$TMP_DIR/bad-decisions.jsonl" --lane-tasks "$TMP_DIR/lane-tasks.json" >/tmp/svc-e2e-cont-bad.out 2>&1; then
  bad "auto-continuation without decision record fails"
else
  grep -q "requires end_to_end_continuation decision" /tmp/svc-e2e-cont-bad.out && ok "auto-continuation without decision record fails" || bad "auto-continuation failure names missing decision"
fi

cat >"$TMP_DIR/good-decisions.jsonl" <<'JSONL'
{"ts":"2026-05-12T00:00:00Z","skill":"route-workflow","wi":"WI-999","decision":"auto-continue after verification gap","details":{"end_to_end_continuation":{"original_commitment_phrase":"continue until verified","seam_crossed":"verification","gap_classification":"same-lane-follow-up","next_action":"run the newly discovered validator","recursion_depth":1,"recursion_limit":3,"blast_radius":{"destructive_git":false,"paid_spend":false,"schema_or_data_risk":false,"security_escalation":false,"pause_required":false}}}}
JSONL

node "$HELPER" --decisions "$TMP_DIR/good-decisions.jsonl" --lane-tasks "$TMP_DIR/lane-tasks.json" >/dev/null && ok "valid continuation record passes" || bad "valid continuation record passes"

cat >"$TMP_DIR/risky-decisions.jsonl" <<'JSONL'
{"ts":"2026-05-12T00:00:00Z","skill":"route-workflow","wi":"WI-999","decision":"auto-continue risky work","details":{"end_to_end_continuation":{"original_commitment_phrase":"continue until verified","seam_crossed":"verification","gap_classification":"same-lane-follow-up","next_action":"run destructive command","recursion_depth":1,"recursion_limit":3,"blast_radius":{"destructive_git":true,"paid_spend":false,"schema_or_data_risk":false,"security_escalation":false,"pause_required":false}}}}
JSONL

if node "$HELPER" --decisions "$TMP_DIR/risky-decisions.jsonl" >/tmp/svc-e2e-cont-risk.out 2>&1; then
  bad "risky blast radius requires pause"
else
  grep -q "pause_required=true" /tmp/svc-e2e-cont-risk.out && ok "risky blast radius requires pause" || bad "risky blast radius failure explains pause"
fi

contains "$ROUTER" "end_to_end_continuation" "route-workflow requires continuation decision"
contains "$ROUTER" "references/end-to-end-continuation.md" "route-workflow links continuation reference"
contains "$REF" "recursion_limit" "reference defines recursion limit"
contains "$REF" "destructive_git" "reference defines destructive git pause threshold"
contains "$REF" "paid_spend" "reference defines paid spend pause threshold"
contains "$REF" "schema_or_data_risk" "reference defines schema/data pause threshold"
contains "$REF" "security_escalation" "reference defines security escalation pause threshold"

echo
echo "end-to-end continuation policy: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
