#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

expect_pass() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "$label"; else "$@" || true; fail "$label"; fi
}

expect_fail() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then fail "$label"; else pass "$label"; fi
}

echo "=== Tier 1: Base44 Verification Pack ==="

node --check "$REPO_ROOT/scripts/audit-base44-entity-rls.mjs" >/dev/null && pass "entity RLS audit helper syntax valid" || fail "entity RLS audit helper syntax valid"
node --check "$REPO_ROOT/scripts/classify-persistence-bisect.mjs" >/dev/null && pass "persistence bisect helper syntax valid" || fail "persistence bisect helper syntax valid"
node --check "$REPO_ROOT/scripts/validate-security-rule-probe-evidence.mjs" >/dev/null && pass "security probe evidence validator syntax valid" || fail "security probe evidence validator syntax valid"

mkdir -p "$TMP/repo/base44/entities" "$TMP/repo/src/pages" "$TMP/repo/base44/functions/auditLog"

cat > "$TMP/repo/base44/entities/AuditLog.json" <<'JSON'
{
  "properties": {
    "actor_user_id": { "type": "string" },
    "message": { "type": "string" }
  }
}
JSON

cat > "$TMP/repo/base44/entities/Location.json" <<'JSON'
{
  "properties": {
    "owner_id": { "type": "string" },
    "name": { "type": "string" }
  },
  "rls": {
    "create": { "user_condition": { "role": "user" } },
    "read": {},
    "update": {
      "owner_id": "{{user.id}}",
      "$or": [{ "user_condition": { "role": "admin" } }]
    },
    "delete": { "user_condition": { "role": "admin" } }
  }
}
JSON

cat > "$TMP/repo/base44/entities/Exception.json" <<'JSON'
{
  "properties": {
    "location_id": { "type": "string" },
    "date": { "type": "string" }
  },
  "rls": {
    "create": { "user_condition": { "user_type": "owner" } },
    "read": { "user_condition": { "user_type": "owner" } },
    "update": { "user_condition": { "user_type": "owner" } },
    "delete": { "user_condition": { "user_type": "owner" } }
  }
}
JSON

cat > "$TMP/repo/src/pages/Locations.jsx" <<'JS'
base44.entities.Location.list();
base44.entities.Location.update(id, data);
JS

cat > "$TMP/repo/base44/functions/auditLog/entry.ts" <<'TS'
await base44.asServiceRole.entities.AuditLog.create({ message: "ok" });
TS

expect_pass "entity RLS audit fixture runs" node "$REPO_ROOT/scripts/audit-base44-entity-rls.mjs" --root "$TMP/repo" --out-json "$TMP/repo/docs/specs/audit/entity-rls-audit.json" --out-md "$TMP/repo/docs/specs/audit/entity-rls-audit.md"

node - "$TMP/repo/docs/specs/audit/entity-rls-audit.json" <<'NODE'
const fs = require("fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const byEntity = Object.fromEntries(report.rows.map((row) => [row.entity, row]));
function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert(byEntity.AuditLog.issues.includes("missing_rls"), "AuditLog missing_rls not detected");
assert(byEntity.AuditLog.service_role_only === true, "AuditLog service-role-only signal missing");
assert(byEntity.Location.issues.includes("malformed_and_rule"), "Location malformed AND rule not detected");
assert(byEntity.Location.frontend_callers >= 2, "Location frontend caller count not detected");
assert(byEntity.Exception.issues.includes("derived_ownership"), "Exception derived ownership not detected");
assert(byEntity.Exception.recommended_action.includes("derived ownership decision"), "derived ownership recommendation missing");
assert(report.deployment_order[0] === "AuditLog", "deployment order should prefer zero-caller service-role-only entity");
NODE
if [[ "$?" -eq 0 ]]; then pass "entity audit detects missing RLS, malformed rules, callers, derived ownership, deployment order"; else fail "entity audit detects missing RLS, malformed rules, callers, derived ownership, deployment order"; fi

cat > "$TMP/empty-records.json" <<'JSON'
{"records":[]}
JSON
cat > "$TMP/nonempty-records.json" <<'JSON'
{"records":[{"id":"rec-1"}]}
JSON
if node "$REPO_ROOT/scripts/classify-persistence-bisect.mjs" --records "$TMP/empty-records.json" > "$TMP/class-a.out" 2>/dev/null; then
  fail "empty persistence probe exits non-zero Class A"
elif grep -q "CLASS_A_NOT_PERSISTED" "$TMP/class-a.out"; then
  pass "empty persistence probe classifies Class A"
else
  fail "empty persistence probe classifies Class A"
fi
node "$REPO_ROOT/scripts/classify-persistence-bisect.mjs" --records "$TMP/nonempty-records.json" > "$TMP/class-b.out" && grep -q "CLASS_B_PERSISTED_UI_SCOPE" "$TMP/class-b.out" && pass "nonempty persistence probe classifies Class B" || fail "nonempty persistence probe classifies Class B"

cat > "$TMP/good-probe.json" <<'JSON'
{
  "rule_target": "AuditLog.create",
  "non_privileged_actor": "customer@example.test",
  "probe_command": "node e2e/probes/auditlog-probe.mjs",
  "before": { "status": "exploitable", "output_excerpt": "created forged audit row" },
  "after": { "status": "blocked", "output_excerpt": "403 forbidden" },
  "regression_test": "e2e/specs/security/auditlog-rls.spec.ts"
}
JSON
cat > "$TMP/bad-probe.json" <<'JSON'
{
  "rule_target": "AuditLog.create",
  "before": { "status": "scanner-found" },
  "after": { "status": "unknown" }
}
JSON
expect_pass "security probe evidence accepts before/after exploit proof" node "$REPO_ROOT/scripts/validate-security-rule-probe-evidence.mjs" --evidence "$TMP/good-probe.json"
expect_fail "security probe evidence rejects scanner-only proof" node "$REPO_ROOT/scripts/validate-security-rule-probe-evidence.mjs" --evidence "$TMP/bad-probe.json"

grep -q "classify-persistence-bisect.mjs" "$REPO_ROOT/skills/diagnose-bug/SKILL.md" && pass "diagnose-bug requires persistence bisect helper" || fail "diagnose-bug requires persistence bisect helper"
grep -q "audit-base44-entity-rls.mjs" "$REPO_ROOT/skills/base44-environment/SKILL.md" && pass "base44-environment documents entity RLS audit mode" || fail "base44-environment documents entity RLS audit mode"
grep -q "validate-security-rule-probe-evidence.mjs" "$REPO_ROOT/skills/review-security/SKILL.md" && pass "review-security requires security rule probe evidence" || fail "review-security requires security rule probe evidence"
grep -q "Security Rule Probe Gate" "$REPO_ROOT/skills/review-gate/SKILL.md" && pass "review-gate documents security rule probe gate" || fail "review-gate documents security rule probe gate"
grep -q "Base44 brownfield schema truth rule" "$REPO_ROOT/skills/write-spec/SKILL.md" && pass "write-spec requires Base44 brownfield schema grounding" || fail "write-spec requires Base44 brownfield schema grounding"
grep -q "Base44/backend ground truth checked" "$REPO_ROOT/skills/plan-changeset/SKILL.md" && pass "plan-changeset requires Base44 backend ground truth" || fail "plan-changeset requires Base44 backend ground truth"
test -f "$REPO_ROOT/_shared/backend-query-gotchas.md" && grep -q '\$gte' "$REPO_ROOT/_shared/backend-query-gotchas.md" && pass "backend query gotchas shared reference exists" || fail "backend query gotchas shared reference exists"
grep -q "Derived ownership" "$REPO_ROOT/references/knowledge/domains/base44/CAPABILITIES.md" && pass "Base44 knowledge documents derived ownership pattern" || fail "Base44 knowledge documents derived ownership pattern"

echo
echo "base44 verification pack: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
