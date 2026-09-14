#!/usr/bin/env bash
# Tier-1: WI-435 (dispatch resolver) + WI-436 (heuristic promotion). resolve maps a stage/domain to the SME
# agent route-workflow should dispatch; promote surfaces a heuristic candidate after >=3 confirmed outcomes.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1
EX="scripts/expertise.mjs"; CS="scripts/company-state.mjs"
pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✓ $1"; }
no(){ fail=$((fail+1)); echo "  ✗ $1"; }

# WI-435: resolve a stage / domain to the right SME agent
node "$EX" resolve --stage company.finance 2>&1 | grep -q "AGENT=financial-analyst" && ok "resolve --stage company.finance → financial-analyst" || no "stage resolve wrong"
node "$EX" resolve --domain appsec-secops 2>&1 | grep -q "AGENT=security-ops" && ok "resolve --domain appsec-secops → security-ops" || no "domain resolve wrong"
node "$EX" resolve --stage no.such.stage >/dev/null 2>&1 && no "unknown stage resolved" || ok "unknown stage → exit nonzero (no false match)"
node "$EX" resolve >/dev/null 2>&1 && no "resolve with no args succeeded" || ok "resolve requires --stage or --domain"

# WI-436: promotion scan
T="$(mktemp -d)/co"; node "$CS" scaffold --state-dir "$T" --name v >/dev/null 2>&1
# < 3 confirmed → no candidate
node "$CS" promote --state-dir "$T" --role growth-lead 2>&1 | grep -q "no promotion candidate yet" && ok "promote: <3 confirmed outcomes → no candidate" || no "promote fired below 3"
# add 3 confirmed (worked:true) outcomes
for i in 1 2 3; do
  node "$CS" append-decision --state-dir "$T" --card "{\"proposed_by\":\"growth-lead\",\"title\":\"batch $i\",\"door\":\"two-way\",\"recommendation\":\"x\",\"cost_of_delay\":\"low\",\"ask\":\"fyi\",\"evidence\":[\"state.md\"]}" >/dev/null 2>&1
  ID="$(node -e "const fs=require('fs');const l=fs.readFileSync('$T/decisions-pending.jsonl','utf8').trim().split('\n');console.log(JSON.parse(l[l.length-1]).id)")"
  node "$CS" resolve --state-dir "$T" --id "$ID" --verdict approved >/dev/null 2>&1
  node "$CS" record-outcome --state-dir "$T" --id "$ID" --result "worked" --worked true >/dev/null 2>&1
done
node "$CS" promote --state-dir "$T" --role growth-lead 2>&1 | grep -q "REVIEW FOR HEURISTICS: 3 confirmed" && ok "promote: ≥3 confirmed → heuristic-review set surfaced (honest, no auto-confidence)" || no "promote did not surface review set at 3"
# --apply appends a stub to playbook.md
node "$CS" promote --state-dir "$T" --role growth-lead --apply >/dev/null 2>&1
grep -q "Heuristic-review candidate" "$T/growth-lead/playbook.md" 2>/dev/null && ok "promote --apply appends a review-candidate stub to playbook.md" || no "--apply did not write playbook stub"
n1="$(grep -c "Heuristic-review candidate" "$T/growth-lead/playbook.md")"; node "$CS" promote --state-dir "$T" --role growth-lead --apply >/dev/null 2>&1
[ "$(grep -c "Heuristic-review candidate" "$T/growth-lead/playbook.md")" = "$n1" ] && ok "promote --apply is idempotent (same ledger → no duplicate candidate)" || no "--apply duplicated the candidate"
# changed ledger (a 4th confirmed outcome) → a NEW candidate (the hash changes), not silently skipped
node "$CS" append-decision --state-dir "$T" --card "{\"proposed_by\":\"growth-lead\",\"title\":\"batch 4\",\"door\":\"two-way\",\"recommendation\":\"x\",\"cost_of_delay\":\"low\",\"ask\":\"fyi\",\"evidence\":[\"state.md\"]}" >/dev/null 2>&1
ID4="$(node -e "const fs=require('fs');const l=fs.readFileSync('$T/decisions-pending.jsonl','utf8').trim().split('\n');console.log(JSON.parse(l[l.length-1]).id)")"
node "$CS" resolve --state-dir "$T" --id "$ID4" --verdict approved >/dev/null 2>&1
node "$CS" record-outcome --state-dir "$T" --id "$ID4" --result "worked" --worked true >/dev/null 2>&1
node "$CS" promote --state-dir "$T" --role growth-lead --apply >/dev/null 2>&1
[ "$(grep -c "Heuristic-review candidate" "$T/growth-lead/playbook.md")" -gt "$n1" ] && ok "a changed ledger (new outcome) yields a NEW candidate (hash, no truncation collision)" || no "changed ledger did not yield a new candidate"
# promote requires a valid role
node "$CS" promote --state-dir "$T" --role not-a-role >/dev/null 2>&1 && no "promote accepted a bad role" || ok "promote requires a valid ROLE"

echo ""
echo "expertise-dispatch-promote: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
