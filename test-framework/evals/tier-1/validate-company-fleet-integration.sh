#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI="$REPO_ROOT/scripts/company-state.mjs"
FIXTURE_ROOT="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_ROOT"' EXIT

pass=0
fail=0
check() { if "$@"; then pass=$((pass + 1)); else echo "FAIL: $*" >&2; fail=$((fail + 1)); fi; }

PARENT="$FIXTURE_ROOT/parent"
PRODUCT="$FIXTURE_ROOT/product"
mkdir -p "$PARENT" "$PRODUCT"
git -C "$PARENT" init -q
git -C "$PRODUCT" init -q
mkdir -p "$PARENT/company-state" "$PARENT/.svc" "$PRODUCT/.svc"
printf '1\n' > "$PARENT/company-state/SCHEMA_VERSION"
printf '# state\n' > "$PARENT/company-state/state.md"
: > "$PARENT/company-state/metrics.jsonl"
: > "$PARENT/company-state/decisions-pending.jsonl"
: > "$PARENT/company-state/decisions-log.jsonl"
: > "$PARENT/company-state/open-items.jsonl"
printf '{"schema_version":"1.0.0","company_repo":"%s","app_id":"product"}\n' "$PARENT" > "$PRODUCT/.svc/company-link.json"
printf '{"schema_version":"1.0.0","company_repo":"%s","app_id":"parent"}\n' "$PARENT" > "$PARENT/.svc/company-link.json"

resolved="$(node "$CLI" resolve --repo "$PRODUCT" --json)"
check grep -q "\"stateDir\": \"$PARENT/company-state\"" <<< "$resolved"
check grep -q '"source": "company-link"' <<< "$resolved"

printf '{"schema_version":"1.0.0","company_repo":"%s","app_id":"product","extra":true}\n' "$PARENT" > "$PRODUCT/.svc/company-link.json"
if node "$CLI" resolve --repo "$PRODUCT" --json >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
printf '{"schema_version":"1.0.0","company_repo":"%s","app_id":"product"}\n' "$PARENT" > "$PRODUCT/.svc/company-link.json"

opened="$(node "$CLI" open-item --state-dir "$PARENT/company-state" --front vendor --owner owner --direction vendor_owes --title 'Await response' --opened 2026-07-22 --sla-days 2 --next-check 2026-07-23 --json)"
item_id="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).id)' "$opened")"
check test "$item_id" = 'OI-20260722-001'
if node "$CLI" open-item --state-dir "$PARENT/company-state" --front vendor --owner owner --direction vendor_owes --title invalid --opened 2026-02-30 --due 2026-03-01 >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
node "$CLI" check-item --state-dir "$PARENT/company-state" --id "$item_id" --note checked --next-check 2026-07-24 >/dev/null
node "$CLI" close-item --state-dir "$PARENT/company-state" --id "$item_id" --outcome done >/dev/null
node "$CLI" close-item --state-dir "$PARENT/company-state" --id "$item_id" --outcome done >/dev/null
if node "$CLI" close-item --state-dir "$PARENT/company-state" --id "$item_id" --outcome different >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
check test "$(wc -l < "$PARENT/company-state/open-items.jsonl")" -eq 3
node "$CLI" open-item --state-dir "$PARENT/company-state" --front vendor --owner alpha --direction vendor_owes --title 'Concurrent alpha' --opened 2026-07-22 > "$FIXTURE_ROOT/open-alpha.json" &
open_alpha_pid=$!
node "$CLI" open-item --state-dir "$PARENT/company-state" --front vendor --owner beta --direction vendor_owes --title 'Concurrent beta' --opened 2026-07-22 > "$FIXTURE_ROOT/open-beta.json" &
open_beta_pid=$!
wait "$open_alpha_pid" "$open_beta_pid"
open_alpha_id="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).id)' "$FIXTURE_ROOT/open-alpha.json")"
open_beta_id="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).id)' "$FIXTURE_ROOT/open-beta.json")"
if test "$open_alpha_id" = "$open_beta_id"; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
check test "$(wc -l < "$PARENT/company-state/open-items.jsonl")" -eq 5

node "$CLI" register-app --state-dir "$PARENT/company-state" --id parent --repo-path "$PARENT" --owner local --contracts '[{"name":"company-state","path":"company-state/SCHEMA_VERSION"}]' >/dev/null
node "$CLI" register-app --state-dir "$PARENT/company-state" --id product --repo-path "$PRODUCT" --owner local --contracts '[]' >/dev/null
check node "$CLI" validate-apps --state-dir "$PARENT/company-state"
apps="$(node "$CLI" list-apps --state-dir "$PARENT/company-state" --json)"
check grep -q '"id": "parent"' <<< "$apps"
check grep -q '"id": "product"' <<< "$apps"

printf 'evidence\n' > "$PARENT/company-state/evidence.txt"
legacy='{"ts":"2026-07-22T00:00:00Z","proposed_by":"financial-analyst","title":"Legacy","door":"two-way","recommendation":"Keep","cost_of_delay":"low","ask":"fyi","status":"pending","evidence":["evidence.txt"]}'
check node "$CLI" append-decision --state-dir "$PARENT/company-state" --card "$legacy"
mesh='{"ts":"2026-07-22T00:00:00Z","proposed_by":"product-lead","title":"Spend","door":"one-way","recommendation":"Approve","cost_of_delay":"high","ask":"approve","status":"pending","confidence":0.8,"evidence":["evidence.txt"],"risk_domains":["finance"],"peer_reviews":[{"reviewer":"fin-analyst","verdict":"pass","evidence":["evidence.txt"]}]}'
check node "$CLI" append-decision --state-dir "$PARENT/company-state" --card "$mesh"
blocked='{"ts":"2026-07-22T00:00:00Z","proposed_by":"product-lead","title":"Spend blocked","door":"one-way","recommendation":"Approve","cost_of_delay":"high","ask":"approve","status":"pending","confidence":0.8,"evidence":["evidence.txt"],"risk_domains":["finance"],"peer_reviews":[]}'
if node "$CLI" append-decision --state-dir "$PARENT/company-state" --card "$blocked" >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
ungrounded_mesh='{"ts":"2026-07-22T00:00:00Z","proposed_by":"product-lead","title":"Ungrounded peer","door":"one-way","recommendation":"Approve","cost_of_delay":"high","ask":"approve","status":"pending","confidence":0.8,"evidence":["evidence.txt"],"risk_domains":["finance"],"peer_reviews":[{"reviewer":"fin-analyst","verdict":"pass","evidence":["missing-peer-evidence.txt"]}]}'
if node "$CLI" append-decision --state-dir "$PARENT/company-state" --card "$ungrounded_mesh" >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi

# Existing installations lazily gain canonical role directories on first write.
decision_id="$(node -e 'const fs=require("fs"); const rows=fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse); process.stdout.write(rows.find(r=>r.proposed_by==="product-lead").id)' "$PARENT/company-state/decisions-pending.jsonl")"
node "$CLI" resolve --state-dir "$PARENT/company-state" --id "$decision_id" --verdict approved >/dev/null
check test -f "$PARENT/company-state/product-lead/ledger.jsonl"

briefing="$(node "$CLI" briefing --repo "$PRODUCT" --today 2026-07-22)"
check grep -q "company briefing @ $PARENT/company-state" <<< "$briefing"
dashboard="$(node "$CLI" dashboard --repo "$PRODUCT" --today 2026-07-22 --json)"
check grep -q '"registry_health": "healthy"' <<< "$dashboard"
check grep -q '"mesh_health"' <<< "$dashboard"

# Task 3: topology and contract diagnostics are read-only over registered repos.
for repo in "$PARENT" "$PRODUCT"; do
  git -C "$repo" config user.name fixture
  git -C "$repo" config user.email fixture@example.invalid
  git -C "$repo" add -A
  git -C "$repo" commit -qm fixture
done
STALE_WORKTREE="$FIXTURE_ROOT/stale-worktree"
git -C "$PARENT" worktree add -q -b fixture-stale "$STALE_WORKTREE"
mv "$STALE_WORKTREE" "$FIXTURE_ROOT/stale-worktree-moved"
SVC_STATE_HOME="$FIXTURE_ROOT/shared-state" node "$REPO_ROOT/scripts/worktree-topology.mjs" refresh --apps "$PARENT/company-state/apps.json" >/dev/null
topology="$(SVC_STATE_HOME="$FIXTURE_ROOT/shared-state" node "$REPO_ROOT/scripts/worktree-topology.mjs" show)"
check grep -q '"schema_version": 1' <<< "$topology"
check grep -q '"app_id": "product"' <<< "$topology"
check grep -q '"exists": false' <<< "$topology"
check grep -q '"prunable": true' <<< "$topology"
topology_hash="$(sha256sum "$FIXTURE_ROOT/shared-state/worktree-topology.db" | cut -d' ' -f1)"
printf '{"schema_version":"1.0.0","apps":[{"id":"broken","repo_path":"/missing","owner":"local","status":"active","contracts":[]}]}\n' > "$FIXTURE_ROOT/invalid-apps.json"
if SVC_STATE_HOME="$FIXTURE_ROOT/shared-state" node "$REPO_ROOT/scripts/worktree-topology.mjs" refresh --apps "$FIXTURE_ROOT/invalid-apps.json" >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
check test "$(sha256sum "$FIXTURE_ROOT/shared-state/worktree-topology.db" | cut -d' ' -f1)" = "$topology_hash"

printf 'v1\n' > "$PARENT/contract.txt"
printf 'v1\n' > "$PRODUCT/contract.txt"
printf '{"schema_version":"1.0.0","apps":[{"id":"parent","repo_path":"%s","owner":"local","status":"active","contracts":[{"name":"shared","path":"contract.txt"}]},{"id":"product","repo_path":"%s","owner":"local","status":"active","contracts":[{"name":"shared","path":"contract.txt"}]}]}\n' "$PARENT" "$PRODUCT" > "$FIXTURE_ROOT/contracts.json"
contracts_hash="$(sha256sum "$FIXTURE_ROOT/contracts.json" | cut -d' ' -f1)"
check node "$REPO_ROOT/scripts/cross-app-contract-guard.mjs" check --apps "$FIXTURE_ROOT/contracts.json"
check test "$(sha256sum "$FIXTURE_ROOT/contracts.json" | cut -d' ' -f1)" = "$contracts_hash"
printf 'v2\n' > "$PRODUCT/contract.txt"
if node "$REPO_ROOT/scripts/cross-app-contract-guard.mjs" check --apps "$FIXTURE_ROOT/contracts.json" >/dev/null; then fail=$((fail + 1)); else pass=$((pass + 1)); fi

printf 'locator("Save") timeout while clicking\n' > "$FIXTURE_ROOT/trace.txt"
trace_hash_before="$(sha256sum "$FIXTURE_ROOT/trace.txt" | cut -d' ' -f1)"
healer="$(node "$REPO_ROOT/scripts/auto-healer.mjs" diagnose --trace "$FIXTURE_ROOT/trace.txt")"
check grep -q '"classification": "code_regression"' <<< "$healer"
check grep -q '"mutated": false' <<< "$healer"
check test "$(sha256sum "$FIXTURE_ROOT/trace.txt" | cut -d' ' -f1)" = "$trace_hash_before"
printf 'locator("Save") timeout while clicking; favicon net::ERR_CONNECTION_REFUSED\n' > "$FIXTURE_ROOT/trace-mixed.txt"
mixed_healer="$(node "$REPO_ROOT/scripts/auto-healer.mjs" diagnose --trace "$FIXTURE_ROOT/trace-mixed.txt")"
check grep -q '"classification": "environment"' <<< "$mixed_healer"

# Promotion memory accepts only a clean, origin/main-promoted SHA with passing G7 note.
BARE="$FIXTURE_ROOT/remote.git"
PROMO="$FIXTURE_ROOT/promo"
mkdir -p "$BARE" "$PROMO"
git -C "$BARE" init -q --bare
git -C "$PROMO" init -q
git -C "$PROMO" config user.name fixture
git -C "$PROMO" config user.email fixture@example.invalid
printf 'promoted\n' > "$PROMO/value.txt"
git -C "$PROMO" add value.txt
git -C "$PROMO" commit -qm promoted
git -C "$PROMO" branch -M main
git -C "$PROMO" remote add origin "$BARE"
git -C "$PROMO" push -q -u origin main
promo_sha="$(git -C "$PROMO" rev-parse HEAD)"
if SVC_STATE_HOME="$FIXTURE_ROOT/promotion-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" index --repo "$PROMO" --wi WI-507 --sha "$promo_sha" --summary 'unverified fixture' >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
note="{\"verify-promotion\":{\"receipt_type\":\"verify-promotion\",\"schema_version\":1,\"wi\":\"WI-507\",\"passes\":{\"p1_promotion_evidence\":\"pass\",\"p2_spec_ac_verification\":\"pass\",\"p3_runtime_validation\":\"pass\",\"p4_state_closeout\":\"pass\"},\"p3_target_type\":\"install-validation\",\"p3_outcome\":\"pass\",\"verdict\":\"pass\",\"sha\":\"$promo_sha\",\"timestamp\":\"2026-07-22T00:00:00.000Z\"}}"
git -C "$PROMO" notes --ref=svc-receipts add -m "$note" "$promo_sha"
printf 'dirty\n' >> "$PROMO/value.txt"
if SVC_STATE_HOME="$FIXTURE_ROOT/promotion-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" index --repo "$PROMO" --wi WI-507 --sha "$promo_sha" --summary 'dirty fixture' >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
printf 'promoted\n' > "$PROMO/value.txt"
indexed="$(SVC_STATE_HOME="$FIXTURE_ROOT/promotion-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" index --repo "$PROMO" --wi WI-507 --sha "$promo_sha" --summary 'verified fixture')"
check grep -q '"status":"indexed"' <<< "$indexed"
duplicate="$(SVC_STATE_HOME="$FIXTURE_ROOT/promotion-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" index --repo "$PROMO" --wi WI-507 --sha "$promo_sha" --summary 'verified fixture')"
check grep -q '"status":"already-indexed"' <<< "$duplicate"
query="$(SVC_STATE_HOME="$FIXTURE_ROOT/promotion-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" query --repo "$PROMO" --wi WI-507)"
check grep -q '"wi": "WI-507"' <<< "$query"

# A malformed row may fail inside the lock, but it must never strand the lock.
cp "$FIXTURE_ROOT/promotion-state/wi-promotion-index.jsonl" "$FIXTURE_ROOT/promotion-index.saved"
printf '{broken\n' >> "$FIXTURE_ROOT/promotion-state/wi-promotion-index.jsonl"
if SVC_STATE_HOME="$FIXTURE_ROOT/promotion-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" index --repo "$PROMO" --wi WI-507 --sha "$promo_sha" --summary 'lock release fixture' >/dev/null 2>&1; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
check test ! -e "$FIXTURE_ROOT/promotion-state/wi-promotion-index.jsonl.lock"
cp "$FIXTURE_ROOT/promotion-index.saved" "$FIXTURE_ROOT/promotion-state/wi-promotion-index.jsonl"

# Development mirror fallback is NOT authority (WI-546): with the note removed,
# indexing must FAIL CLOSED even when a gitignored .svc/receipts/<sha>/ mirror
# exists. The old contract asserted successful mirror indexing — that reopened
# the "mirrors as receipts" hole the note-sourced rule closed.
git -C "$PROMO" notes --ref=svc-receipts remove "$promo_sha" >/dev/null
printf '.svc/\n' >> "$PROMO/.git/info/exclude"
(cd "$PROMO" && printf '%s\n' "$(node -e 'const n=JSON.parse(process.argv[1]); process.stdout.write(JSON.stringify(n["verify-promotion"]))' "$note")" | node "$REPO_ROOT/scripts/emit-receipt.mjs" --type verify-promotion --wi WI-507 --sha "$promo_sha" --no-note >/dev/null)
check test -f "$PROMO/.svc/receipts/${promo_sha:0:7}/verify-promotion.json"
if SVC_STATE_HOME="$FIXTURE_ROOT/promotion-mirror-state" node "$REPO_ROOT/scripts/svc-wi-promotion-indexer.mjs" index --repo "$PROMO" --wi WI-507 --sha "$promo_sha" --summary 'mirror fixture' >/dev/null 2>&1; then
  fail=$((fail + 1)); echo "FAIL: mirror-only envelope was indexed (must be refused)" >&2
else
  pass=$((pass + 1))
fi

# Task 4: SessionStart hooks are bounded, cached, fail-open, and removable.
CACHE_ROOT="$FIXTURE_ROOT/cache"
HOOK_PAYLOAD="{\"cwd\":\"$PRODUCT\"}"
briefing_first="$(printf '%s' "$HOOK_PAYLOAD" | XDG_CACHE_HOME="$CACHE_ROOT" SVC_HOOK_TEST=1 SVC_NOW_MS=1000 node "$REPO_ROOT/hooks/cos-briefing.mjs")"
check grep -q "company briefing @ $PARENT/company-state" <<< "$briefing_first"
cache_file="$(find "$CACHE_ROOT/svc/cos-briefing" -type f -name '*.json' -print -quit)"
check test -n "$cache_file"
check test "$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).created_at_ms))' "$cache_file")" = 1000
briefing_hit="$(printf '%s' "$HOOK_PAYLOAD" | XDG_CACHE_HOME="$CACHE_ROOT" SVC_HOOK_TEST=1 SVC_NOW_MS=2000 node "$REPO_ROOT/hooks/cos-briefing.mjs")"
check test "$briefing_hit" = "$briefing_first"
check test "$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).created_at_ms))' "$cache_file")" = 1000
printf '%s' "$HOOK_PAYLOAD" | XDG_CACHE_HOME="$CACHE_ROOT" SVC_HOOK_TEST=1 SVC_NOW_MS=31000 node "$REPO_ROOT/hooks/cos-briefing.mjs" >/dev/null
check test "$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).created_at_ms))' "$cache_file")" = 31000
printf '%s' "$HOOK_PAYLOAD" | XDG_CACHE_HOME="$CACHE_ROOT" SVC_HOOK_TEST=1 SVC_NOW_MS=30000 node "$REPO_ROOT/hooks/cos-briefing.mjs" >/dev/null
check test "$(node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).created_at_ms))' "$cache_file")" = 30000
malformed_output="$(printf '[' | XDG_CACHE_HOME="$CACHE_ROOT" node "$REPO_ROOT/hooks/cos-briefing.mjs")"
check test -z "$malformed_output"

DELTA_STATE="$FIXTURE_ROOT/delta-state"
mkdir -p "$DELTA_STATE"
for n in 1 2 3 4; do
  printf '{"schema_version":1,"wi":"WI-%s","repo_path":"%s","promoted_sha":"%040d","summary":"summary %s"}\n' "$n" "$PRODUCT" "$n" "$n" >> "$DELTA_STATE/wi-promotion-index.jsonl"
done
printf '{"schema_version":1,"wi":"WI-HH-12","repo_path":"%s","promoted_sha":"%040d","summary":"named work item"}\n' "$PRODUCT" 5 >> "$DELTA_STATE/wi-promotion-index.jsonl"
printf '{"schema_version":1,"wi":"bad","repo_path":"%s","promoted_sha":"%040d","summary":"bad row"}\n' "$PRODUCT" 6 >> "$DELTA_STATE/wi-promotion-index.jsonl"
delta="$(printf '%s' "$HOOK_PAYLOAD" | SVC_STATE_HOME="$DELTA_STATE" node "$REPO_ROOT/hooks/svc-delta-preload.mjs")"
check test "$(wc -l <<< "$delta")" -eq 3
check grep -q 'WI-HH-12' <<< "$delta"
if grep -q 'WI-1' <<< "$delta"; then fail=$((fail + 1)); else pass=$((pass + 1)); fi
malformed_delta="$(printf '[' | SVC_STATE_HOME="$DELTA_STATE" node "$REPO_ROOT/hooks/svc-delta-preload.mjs")"
check test -z "$malformed_delta"
gemini_briefing="$(printf '%s' "$HOOK_PAYLOAD" | XDG_CACHE_HOME="$CACHE_ROOT" node "$REPO_ROOT/hooks/cos-briefing.mjs" --format gemini)"
check node -e 'const d=JSON.parse(process.argv[1]); process.exit(d.hookSpecificOutput?.hookEventName==="SessionStart"&&d.hookSpecificOutput?.additionalContext?0:1)' "$gemini_briefing"
gemini_delta="$(printf '%s' "$HOOK_PAYLOAD" | SVC_STATE_HOME="$DELTA_STATE" node "$REPO_ROOT/hooks/svc-delta-preload.mjs" --format gemini)"
check node -e 'const d=JSON.parse(process.argv[1]); process.exit(d.hookSpecificOutput?.hookEventName==="SessionStart"?0:1)' "$gemini_delta"

CLAUDE_SETTINGS="$FIXTURE_ROOT/claude-settings.json"
GEMINI_SETTINGS="$FIXTURE_ROOT/gemini-settings.json"
printf '{"hooks":{"SessionStart":[{"matcher":"*","hooks":[{"type":"command","command":"node /tmp/user-hook.mjs"}]}]}}\n' > "$CLAUDE_SETTINGS"
printf '{"hooks":{"SessionStart":[{"matcher":".*","hooks":[{"name":"user-hook","type":"command","command":"node /tmp/user-hook.mjs","timeout":1000}]}]}}\n' > "$GEMINI_SETTINGS"
node "$REPO_ROOT/scripts/wire-hooks.mjs" --skills-path "$REPO_ROOT" --settings "$CLAUDE_SETTINGS" >/dev/null
node "$REPO_ROOT/scripts/wire-hooks.mjs" --skills-path "$REPO_ROOT" --settings "$CLAUDE_SETTINGS" >/dev/null
node "$REPO_ROOT/scripts/wire-gemini-hooks.mjs" --skills-path "$REPO_ROOT" --settings "$GEMINI_SETTINGS" >/dev/null
node "$REPO_ROOT/scripts/wire-gemini-hooks.mjs" --skills-path "$REPO_ROOT" --settings "$GEMINI_SETTINGS" >/dev/null
check node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1])); const c=JSON.stringify(d); process.exit((c.match(/cos-briefing\.mjs/g)||[]).length===1&&(c.match(/svc-delta-preload\.mjs/g)||[]).length===1&&c.includes("user-hook.mjs")?0:1)' "$CLAUDE_SETTINGS"
check node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1])); const c=JSON.stringify(d); process.exit((c.match(/cos-briefing\.mjs/g)||[]).length===1&&(c.match(/svc-delta-preload\.mjs/g)||[]).length===1&&c.includes("user-hook.mjs")?0:1)' "$GEMINI_SETTINGS"
node "$REPO_ROOT/scripts/wire-hooks.mjs" --skills-path "$REPO_ROOT" --settings "$CLAUDE_SETTINGS" --remove-company-session-hooks >/dev/null
node "$REPO_ROOT/scripts/wire-gemini-hooks.mjs" --skills-path "$REPO_ROOT" --settings "$GEMINI_SETTINGS" --remove-company-session-hooks >/dev/null
check node -e 'const c=require("fs").readFileSync(process.argv[1],"utf8"); process.exit(!c.includes("cos-briefing.mjs")&&!c.includes("svc-delta-preload.mjs")&&c.includes("user-hook.mjs")?0:1)' "$CLAUDE_SETTINGS"
check node -e 'const c=require("fs").readFileSync(process.argv[1],"utf8"); process.exit(!c.includes("cos-briefing.mjs")&&!c.includes("svc-delta-preload.mjs")&&c.includes("user-hook.mjs")?0:1)' "$GEMINI_SETTINGS"

ABSENT_SKILLS="$FIXTURE_ROOT/absent-skills"
mkdir -p "$ABSENT_SKILLS/hooks"
printf '{"hooks":{"SessionStart":[{"matcher":"*","hooks":[{"type":"command","command":"node %s/hooks/cos-briefing.mjs"}]},{"matcher":"*","hooks":[{"type":"command","command":"node /tmp/cos-briefing.mjs"},{"type":"command","command":"node /tmp/user-hook.mjs"}]}]}}\n' "$ABSENT_SKILLS" > "$CLAUDE_SETTINGS"
node "$REPO_ROOT/scripts/wire-hooks.mjs" --skills-path "$ABSENT_SKILLS" --settings "$CLAUDE_SETTINGS" >/dev/null
check node -e 'const c=require("fs").readFileSync(process.argv[1],"utf8"); process.exit(!c.includes(process.argv[2]+"/hooks/cos-briefing.mjs")&&c.includes("/tmp/cos-briefing.mjs")&&c.includes("user-hook.mjs")?0:1)' "$CLAUDE_SETTINGS" "$ABSENT_SKILLS"

echo "company fleet integration: $pass passed, $fail failed"
test "$fail" -eq 0
