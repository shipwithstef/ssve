#!/usr/bin/env bash
# Tier-1: the company-fleet COMPOUNDING LOOP + local recall index.
# Proves resolve → record-outcome → recall actually closes the learning loop (the wire that was empty),
# and that company-memory.mjs builds a local, gitignored, searchable index. Static, no LLM, <5s.
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1
CS="scripts/company-state.mjs"; CM="scripts/company-memory.mjs"
pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✓ $1"; }
no(){ fail=$((fail+1)); echo "  ✗ $1"; }

T="$(mktemp -d)/co"
node "$CS" scaffold --state-dir "$T" --name testco >/dev/null 2>&1 || { echo "scaffold failed"; exit 1; }

# 1. propose a grounded card
node "$CS" append-decision --state-dir "$T" --card '{"proposed_by":"growth-lead","title":"cold-email batch","door":"two-way","recommendation":"send 50","cost_of_delay":"high","ask":"approve","confidence":0.7,"evidence":["state.md"]}' >/dev/null 2>&1
ID="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
[ -n "$ID" ] && ok "card filed ($ID)" || no "card not filed"

# 2. resolve moves it out of pending, into the log, and opens a ledger entry
node "$CS" resolve --state-dir "$T" --id "$ID" --verdict approved >/dev/null 2>&1
[ ! -s "$T/decisions-pending.jsonl" ] && ok "resolve trims the live queue" || no "resolve left card in pending"
grep -q "\"$ID\"" "$T/decisions-log.jsonl" 2>/dev/null && ok "resolve writes the durable log" || no "resolve did not write decisions-log"
grep -q "\"decision_id\":\"$ID\"" "$T/growth-lead/ledger.jsonl" 2>/dev/null && ok "resolve opens the brain ledger entry" || no "no ledger entry opened"

# 3. record-outcome closes the loop
node "$CS" record-outcome --state-dir "$T" --id "$ID" --result "3 of 50 replied, 0 paid" --worked partial --metric "reply_rate=6%" >/dev/null 2>&1
grep -q '"type":"outcome"' "$T/decisions-log.jsonl" 2>/dev/null && ok "record-outcome appends an outcome event" || no "no outcome event in log"
grep -q '"outcome":"3 of 50' "$T/growth-lead/ledger.jsonl" 2>/dev/null && ok "outcome fills the brain ledger (the learning signal)" || no "ledger outcome not filled"
grep -q '"reply_rate"' "$T/metrics.jsonl" 2>/dev/null && ok "metric auto-sourced to metrics.jsonl" || no "metric not recorded"

# 4. recall surfaces the brain's own history (compounding read-back)
node "$CS" recall --state-dir "$T" --role growth-lead 2>&1 | grep -q "3 of 50 replied" && ok "recall surfaces past outcome (no rediscovery)" || no "recall did not surface the outcome"

# 5. record-outcome refuses an UNRESOLVED id (must resolve first)
node "$CS" record-outcome --state-dir "$T" --id "D-2099-01-01-001" --result x >/dev/null 2>&1 && no "record-outcome accepted an unresolved id" || ok "record-outcome refuses an unresolved id"

# 6. local index builds + searches + is gitignored
node "$CM" index --state-dir "$T" >/dev/null 2>&1
[ -f "$T/.memory.db" ] && ok "local index .memory.db built" || no "index not built"
node "$CM" search --state-dir "$T" --query "cold email reply" 2>&1 | grep -qi "cold-email\|reply" && ok "search returns ranked recall" || no "search found nothing"
grep -q ".memory.db" "$T/.gitignore" 2>/dev/null && ok ".memory.db is gitignored (regenerable cache)" || no ".memory.db not gitignored"

# 7. idempotency (Codex M3 + r3): a 2nd record-outcome is a SAFE NO-OP (no duplicate log event); --amend adds one
OCB="$(grep -c '"type":"outcome"' "$T/decisions-log.jsonl" 2>/dev/null)"
node "$CS" record-outcome --state-dir "$T" --id "$ID" --result "again" >/dev/null 2>&1
[ "$(grep -c '"type":"outcome"' "$T/decisions-log.jsonl" 2>/dev/null)" = "$OCB" ] && ok "2nd record-outcome is idempotent (no duplicate log event)" || no "2nd record-outcome duplicated the log"
node "$CS" record-outcome --state-dir "$T" --id "$ID" --result "amended" --amend >/dev/null 2>&1
[ "$(grep -c '"type":"outcome"' "$T/decisions-log.jsonl" 2>/dev/null)" -gt "$OCB" ] && ok "--amend adds a deliberate evolved outcome" || no "--amend did not add an outcome"

# 8. strict rewrite (Codex H1): a malformed line makes resolve REFUSE rather than silently drop it
T2="$(mktemp -d)/c2"; node "$CS" scaffold --state-dir "$T2" --name t2 >/dev/null 2>&1
node "$CS" append-decision --state-dir "$T2" --card '{"proposed_by":"product-lead","title":"x","door":"two-way","recommendation":"y","cost_of_delay":"low","ask":"fyi","evidence":["state.md"]}' >/dev/null 2>&1
ID2="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T2/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
printf 'THIS IS NOT JSON BUT IMPORTANT\n' >> "$T2/decisions-pending.jsonl"
node "$CS" resolve --state-dir "$T2" --id "$ID2" --verdict approved >/dev/null 2>&1 && no "resolve rewrote past a malformed line" || ok "resolve refuses to rewrite a malformed file"
grep -q "THIS IS NOT JSON BUT IMPORTANT" "$T2/decisions-pending.jsonl" 2>/dev/null && ok "malformed line preserved (not silently dropped)" || no "malformed line was dropped"

# 9. symlink containment (Codex H4): index must NOT follow a symlink out of the brain
OUT="$(mktemp -d)"; printf '# s\nSECRET_OUTSIDE_TOKEN_XYZ\n' > "$OUT/secret.md"; ln -s "$OUT" "$T/linked-outside" 2>/dev/null
node "$CM" index --state-dir "$T" >/dev/null 2>&1
# grep the SOURCE path (not the token — the search echoes the query in its header) — a hit means it indexed the symlinked file
node "$CM" search --state-dir "$T" --query "SECRET_OUTSIDE_TOKEN_XYZ" 2>&1 | grep -q "linked-outside\|secret.md" && no "index followed a symlink out of the brain (leak)" || ok "index does not follow symlinks out of the brain"

# 10. crash recovery (Codex r2 #2): a card left in BOTH pending and log (crash before trim) → resolve converges, no dup
T3="$(mktemp -d)/c3"; node "$CS" scaffold --state-dir "$T3" --name t3 >/dev/null 2>&1
node "$CS" append-decision --state-dir "$T3" --card '{"proposed_by":"product-lead","title":"z","door":"two-way","recommendation":"w","cost_of_delay":"low","ask":"fyi","evidence":["state.md"]}' >/dev/null 2>&1
ID3="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T3/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$T3/decisions-pending.jsonl','utf8').trim());c.status='approved';c.resolved_ts=new Date().toISOString();fs.appendFileSync('$T3/decisions-log.jsonl',JSON.stringify(c)+'\n')"  # simulate crash AFTER log-append, BEFORE trim
node "$CS" resolve --state-dir "$T3" --id "$ID3" --verdict approved >/dev/null 2>&1
[ "$(grep -c "\"$ID3\"" "$T3/decisions-log.jsonl" 2>/dev/null)" = "1" ] && ok "crash-retry resolve does NOT duplicate the log entry" || no "crash-retry duplicated the log"
[ ! -s "$T3/decisions-pending.jsonl" ] && ok "crash-retry resolve completes the move (pending trimmed)" || no "pending not trimmed on recovery"

# 11. record-outcome aborts BEFORE writing the outcome if the ledger is malformed (no partial commit)
printf 'NOT JSON\n' >> "$T3/product-lead/ledger.jsonl"
LB="$(wc -l < "$T3/decisions-log.jsonl")"
node "$CS" record-outcome --state-dir "$T3" --id "$ID3" --result "x" >/dev/null 2>&1 && no "record-outcome committed despite malformed ledger" || ok "record-outcome aborts on a malformed ledger"
[ "$(wc -l < "$T3/decisions-log.jsonl")" = "$LB" ] && ok "no partial outcome written before the abort" || no "partial outcome written before abort"

# 12. crash MID-record (Codex r3): log has the outcome but the ledger entry is still OPEN → retry reconciles, no ghost
T4="$(mktemp -d)/c4"; node "$CS" scaffold --state-dir "$T4" --name t4 >/dev/null 2>&1
node "$CS" append-decision --state-dir "$T4" --card '{"proposed_by":"financial-analyst","title":"q","door":"two-way","recommendation":"r","cost_of_delay":"low","ask":"fyi","evidence":["state.md"]}' >/dev/null 2>&1
ID4="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T4/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
node "$CS" resolve --state-dir "$T4" --id "$ID4" --verdict approved >/dev/null 2>&1
node -e "const fs=require('fs');fs.appendFileSync('$T4/decisions-log.jsonl',JSON.stringify({type:'outcome',decision_id:'$ID4',ts:new Date().toISOString(),result:'crash',worked:'unknown'})+'\n')"  # outcome in log, ledger left OPEN
node "$CS" record-outcome --state-dir "$T4" --id "$ID4" --result "reconciled" >/dev/null 2>&1 && ok "crash-mid-record retry succeeds (reconciles, not blocked)" || no "crash-mid-record retry refused (ghost)"
node "$CS" recall --state-dir "$T4" --role financial-analyst 2>&1 | grep -q "awaiting outcome" && no "ledger still shows a ghost awaiting outcome" || ok "no ghost — ledger reconciled after crash"

# 13. resolve crash AFTER log-append, BEFORE ledger-append → retry recreates the missing ledger entry (Codex r4)
T5="$(mktemp -d)/c5"; node "$CS" scaffold --state-dir "$T5" --name t5 >/dev/null 2>&1
node "$CS" append-decision --state-dir "$T5" --card '{"proposed_by":"growth-lead","title":"k","door":"two-way","recommendation":"m","cost_of_delay":"low","ask":"fyi","evidence":["state.md"]}' >/dev/null 2>&1
ID5="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T5/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$T5/decisions-pending.jsonl','utf8').trim());c.status='approved';c.resolved_ts=new Date().toISOString();fs.appendFileSync('$T5/decisions-log.jsonl',JSON.stringify(c)+'\n')"  # card in log, ledger entry never written
node "$CS" resolve --state-dir "$T5" --id "$ID5" --verdict approved >/dev/null 2>&1
grep -q "\"decision_id\":\"$ID5\"" "$T5/growth-lead/ledger.jsonl" 2>/dev/null && ok "resolve recovers the missing ledger entry on crash-retry (no lost reminder)" || no "ledger reminder lost on crash-retry"

# 14. crash after outcome-log, before metric-append → retry idempotently ensures the metric (Codex r5)
T6="$(mktemp -d)/c6"; node "$CS" scaffold --state-dir "$T6" --name t6 >/dev/null 2>&1
node "$CS" append-decision --state-dir "$T6" --card '{"proposed_by":"growth-lead","title":"p","door":"two-way","recommendation":"q","cost_of_delay":"low","ask":"fyi","evidence":["state.md"]}' >/dev/null 2>&1
ID6="$(node -e "const fs=require('fs');console.log(JSON.parse(fs.readFileSync('$T6/decisions-pending.jsonl','utf8').trim().split('\n')[0]).id)")"
node "$CS" resolve --state-dir "$T6" --id "$ID6" --verdict approved >/dev/null 2>&1
node -e "const fs=require('fs');fs.appendFileSync('$T6/decisions-log.jsonl',JSON.stringify({type:'outcome',decision_id:'$ID6',ts:new Date().toISOString(),result:'x',worked:'partial',metric:'trial_rate=12%'})+'\n')"  # outcome+metric in log, metrics.jsonl never written
node "$CS" record-outcome --state-dir "$T6" --id "$ID6" --result "x" >/dev/null 2>&1   # retry OMITS --metric — must still recover it FROM THE LOG (Codex r6)
grep -q "trial_rate" "$T6/metrics.jsonl" 2>/dev/null && ok "crash-retry recovers the metric from the durable log even when --metric omitted" || no "metric not recovered from log on bare retry"
[ "$(grep -c "trial_rate" "$T6/metrics.jsonl" 2>/dev/null)" = "1" ] && ok "metric not duplicated (idempotent ensure)" || no "metric duplicated on retry"

# 15. .gitignore append is newline-safe when the existing file has NO trailing newline (Codex r7)
T7="$(mktemp -d)/c7"; node "$CS" scaffold --state-dir "$T7" --name t7 >/dev/null 2>&1
printf 'node_modules' > "$T7/.gitignore"   # existing pattern, NO trailing newline
node "$CM" index --state-dir "$T7" >/dev/null 2>&1
grep -qx ".memory.db" "$T7/.gitignore" 2>/dev/null && ok ".memory.db lands on its own line (not glued to an unterminated last line)" || no ".memory.db glued onto the previous line (would not be ignored)"

# 16. actionability triage field (technique upgrade): valid enum accepted, bogus value rejected
node "$CS" append-decision --state-dir "$T" --card '{"proposed_by":"chief-of-staff","title":"trg","door":"two-way","recommendation":"x","cost_of_delay":"low","ask":"fyi","evidence":["state.md"],"actionability":"ready"}' >/dev/null 2>&1 && ok "actionability:ready accepted (first-class schema field)" || no "actionability:ready rejected"
node "$CS" append-decision --state-dir "$T" --card '{"proposed_by":"chief-of-staff","title":"trg2","door":"two-way","recommendation":"x","cost_of_delay":"low","ask":"fyi","evidence":["state.md"],"actionability":"bogus"}' >/dev/null 2>&1 && no "bogus actionability accepted" || ok "bogus actionability rejected (enum-validated)"

echo ""
echo "compounding-loop: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
