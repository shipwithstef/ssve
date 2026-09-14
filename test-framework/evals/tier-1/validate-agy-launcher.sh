#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LAUNCHER="$ROOT/skills/research/scripts/dispatch-agy.mjs"
LIVE_CANARY="$ROOT/scripts/run-live-model-canary.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/log" "$TMP/out"

PASS=0
FAIL=0
ok() { printf '  ✓ %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  ✗ %s\n' "$1"; FAIL=$((FAIL + 1)); }
expect() { local label="$1"; shift; if "$@"; then ok "$label"; else bad "$label"; fi; }

printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' '
printf "%s\n" "$*" > "$AGY_FAKE_LOG/argv"
if [[ "${AGY_FAKE_FAIL:-}" == auth ]]; then printf "%s\n" "OAuth authentication expired" >&2; exit 1; fi
if [[ "${AGY_FAKE_REPEAT:-}" == identical ]]; then printf "%s\n%s\n%s\n" "{\"ok\":true}" "{\"ok\":true}" "{\"ok\":true}"; exit 0; fi
if [[ "${AGY_FAKE_REPEAT:-}" == conflicting ]]; then printf "%s\n%s\n" "{\"ok\":true}" "{\"ok\":false}"; exit 0; fi
instruction="" add_dir=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --print) instruction="$2"; shift 2 ;;
    --add-dir) add_dir="$2"; shift 2 ;;
    *) shift ;;
  esac
done
package="$(printf "%s" "$instruction" | sed -E "s#^Read ([^ ]+) completely.*#\\1#")"
printf "%s\n" "$package" > "$AGY_FAKE_LOG/package-path"
test "$add_dir" = "$(dirname "$package")"
test -r "$package"
cat "$package"
' > "$TMP/bin/agy"
chmod 700 "$TMP/bin/agy"

export PATH="$TMP/bin:$PATH"
export AGY_FAKE_LOG="$TMP/log"

echo "=== Tier 1: canonical AGY research launcher ==="
expect "AGY launcher parses" node --check "$LAUNCHER"

node -e 'process.stdout.write("x".repeat(200000))' |
  node "$LAUNCHER" --stdin --model 'Gemini 3.5 Flash (High)' --timeout-seconds 5 --artifacts-dir "$TMP/out/success" > "$TMP/result"
expect "large package crosses wrapper stdin without entering AGY argv" bash -c "test \"\$(wc -c < '$TMP/result')\" -eq 200000 && test \"\$(wc -c < '$TMP/log/argv')\" -lt 2000 && ! grep -q 'xxxxxxxxxx' '$TMP/log/argv'"
expect "AGY invocation is sandboxed plan-mode exact-model and permission bypass is absent" bash -c "grep -q -- '--sandbox --mode plan --model Gemini 3.5 Flash (High).*--add-dir .*--print-timeout 5s --print' '$TMP/log/argv' && ! grep -q -- '--dangerously-skip-permissions\|--yolo' '$TMP/log/argv'"
expect "private package is removed after invocation" bash -c "test ! -e \"\$(cat '$TMP/log/package-path')\""
expect "success receipt proves bounded private-file bridge and requested model acceptance" node -e 'const r=require(process.argv[1]);if(r.status!=="success"||r.classification!=="success"||r.requested_model!=="Gemini 3.5 Flash (High)"||r.transport!=="stdin_to_private_mode_0600_file"||r.mode!=="plan"||!r.sandbox||r.timeout_seconds!==5||r.model_attestation?.level!=="requested_accepted")process.exit(1)' "$TMP/out/success/receipt.json"

printf '{"type":"object"}\n' > "$TMP/schema.json"
printf repeated | AGY_FAKE_REPEAT=identical node "$LAUNCHER" --stdin --model 'Gemini 3.5 Flash (High)' --timeout-seconds 5 --artifacts-dir "$TMP/out/repeated" > "$TMP/repeated.out"
expect "identical AGY structured documents collapse to one fail-closed parseable result" node -e 'const fs=require("fs");const out=fs.readFileSync(process.argv[1],"utf8");const receipt=require(process.argv[2]);if(JSON.parse(out).ok!==true||receipt.identical_json_repetitions_collapsed!==3)process.exit(1)' "$TMP/repeated.out" "$TMP/out/repeated/receipt.json"
printf conflicting | AGY_FAKE_REPEAT=conflicting node "$LAUNCHER" --stdin --model 'Gemini 3.5 Flash (High)' --timeout-seconds 5 --artifacts-dir "$TMP/out/conflicting" > "$TMP/conflicting.out"
expect "conflicting AGY documents are never collapsed into accepted evidence" bash -c "! node -e 'JSON.parse(require(\"fs\").readFileSync(process.argv[1],\"utf8\"))' '$TMP/conflicting.out' >/dev/null 2>&1"

set +e
printf auth-test | AGY_FAKE_FAIL=auth node "$LAUNCHER" --stdin --model 'Gemini 3.5 Flash (High)' --timeout-seconds 5 --artifacts-dir "$TMP/out/auth" > "$TMP/auth.out" 2> "$TMP/auth.err"
AUTH_RC=$?
set -e
expect "authentication failure is actionable and receipted" bash -c "test '$AUTH_RC' -ne 0 && grep -q 'dispatch-agy: authentication' '$TMP/auth.err' && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/auth/receipt.json')\" = authentication"
expect "private package is removed after provider failure" bash -c "test ! -e \"\$(cat '$TMP/log/package-path')\""

expect "research consumers use only the canonical AGY launcher" bash -c "rg -q 'dispatch-agy.mjs' '$ROOT/skills/research/scripts/synthesize-meaning.mjs' '$ROOT/scripts/spine-research.mjs' && ! rg -n '(spawnSync|spawn)\\([^)]*(agy|gemini)|--dangerously-skip-permissions|--yolo' '$ROOT/skills/research/scripts/synthesize-meaning.mjs' '$ROOT/scripts/spine-research.mjs'"
expect "Gemini remains installable as a host without being an active inference route" bash -c "test -f '$ROOT/provision/hosts/gemini.json' && rg -q '^[[:space:]]*gemini\\)' '$ROOT/setup'"
expect "live canary parses and remains explicitly paid-opt-in" bash -c "node --check '$LIVE_CANARY' && ! node '$LIVE_CANARY' --route codex > '$TMP/live-disabled.out' 2> '$TMP/live-disabled.err' && grep -q 'paid calls are disabled' '$TMP/live-disabled.err'"
expect "live Fable canary exercises the supported safety setting and inherited-model scrub" bash -c "rg -q 'switchModelsOnFlag' '$LIVE_CANARY' && rg -q 'CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK' '$LIVE_CANARY' && rg -q 'cli_version' '$LIVE_CANARY'"
expect "short hello-world canary is separated from the 1200-second production review timeout" bash -c "rg -q 'timeoutSeconds: 120' '$LIVE_CANARY' && rg -q 'production_review_timeout_seconds: 1200' '$LIVE_CANARY'"

printf '\n  %s failed, %s passed\n' "$FAIL" "$PASS"
exit "$FAIL"
