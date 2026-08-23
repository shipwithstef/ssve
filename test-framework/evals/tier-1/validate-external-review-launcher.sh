#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
LAUNCHER="$ROOT/scripts/run-external-review.mjs"
RUNTIME_ONLY=false
[[ "${1:-}" == "--runtime-only" ]] && RUNTIME_ONLY=true

TMP="$(mktemp -d)"
if [[ "${SVC_KEEP_TMP:-0}" != 1 ]]; then trap 'rm -rf "$TMP"' EXIT; else printf '  fixture tmp: %s\n' "$TMP"; fi
mkdir -p "$TMP/bin" "$TMP/cache" "$TMP/out"
chmod 700 "$TMP" "$TMP/bin" "$TMP/cache" "$TMP/out"

PASS=0
FAIL=0
ok() { printf '  ✓ %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  ✗ %s\n' "$1"; FAIL=$((FAIL + 1)); }
expect() { local label="$1"; shift; if "$@"; then ok "$label"; else bad "$label"; fi; }

printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' '
if [[ "${1:-}" == "exec" && "${2:-}" == "--help" ]]; then
  if [[ "${SVC_FAKE_CAPABILITY_MISSING:-0}" == 1 ]]; then printf "%s\n" "--model"; exit 0; fi
  printf "%s\n" "stdin --config --strict-config --model --sandbox read-only --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules --output-schema --json --output-last-message --color"
  exit 0
fi
for arg in "$@"; do if [[ "$arg" == "--version" ]]; then printf "%s\n" "codex-cli-exec 0.144.4"; exit 0; fi; done
mkdir -p "$SVC_FAKE_LOG"
printf "%s\n" "$$" > "$SVC_FAKE_LOG/codex.pid"
printf "%s\n" "$*" >> "$SVC_FAKE_LOG/codex.argv"
printf "%s\n" "${CODEX_HOME:-}" >> "$SVC_FAKE_LOG/codex.home"
package="$(cat)"
printf "%s" "$package" > "$SVC_FAKE_LOG/codex.stdin"
printf "%s\n" "codex" >> "$SVC_FAKE_LOG/calls"
if [[ "${SVC_FAKE_MODE:-success}" == "sleep" ]]; then sleep 5; fi
if [[ -n "${SVC_FAKE_DELAY_SECONDS:-}" ]]; then sleep "$SVC_FAKE_DELAY_SECONDS"; fi
if [[ "${SVC_FAKE_MODE:-success}" != "success" ]]; then printf "%s\n" "${SVC_FAKE_DIAGNOSTIC:-authentication failed}" >&2; exit 1; fi
last="" model="" effort="high"
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" || "$1" == "-o" ]]; then last="$2"; shift 2
  elif [[ "$1" == "--model" ]]; then model="$2"; shift 2
  elif [[ "$1" == "-c" && "$2" == model_reasoning_effort=* ]]; then effort="${2#*=}"; effort="${effort%\"}"; effort="${effort#\"}"; shift 2
  else shift; fi
done
cert=""
if [[ -n "${SVC_FAKE_CERT_KEY:-}" ]]; then cert="{\"key\":\"$SVC_FAKE_CERT_KEY\",\"certified\":true,\"reviewer_family\":\"openai\",\"for_content_sha\":\"\"}"; fi
rubric="\"rubric_score\":10,"; [[ "${SVC_FAKE_OMIT_RUBRIC:-0}" == 1 ]] && rubric=""
finding="{\"schema_version\":1,\"review_kind\":\"${SVC_REVIEW_KIND:-generic}\",${rubric}\"rubric_failures\":null,\"dependencies_needing_read\":null,\"reviewer\":{\"host\":\"codex\",\"family\":\"openai\",\"model\":\"$model\",\"effort\":\"$effort\"},\"verdict\":\"pass\",\"summary\":\"fixture pass\",\"findings\":[],\"certifications\":[${cert:-}]}"
if [[ "${SVC_FAKE_OUTPUT:-valid}" == malformed ]]; then finding="{bad"; fi
printf "%s" "$finding" > "$last"
if [[ "${SVC_FAKE_OMIT_RUNTIME_MODEL:-0}" == 1 ]]; then
  printf "%s\n" "{\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":10,\"output_tokens\":5}}"
else
  printf "%s\n" "{\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":10,\"output_tokens\":5},\"model\":\"${SVC_FAKE_RUNTIME_MODEL:-$model}\"}"
fi
printf "%s\n" "codex diagnostic stream" >&2
' > "$TMP/bin/codex"

printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' '
if [[ "${1:-}" == "--help" ]]; then
  if [[ "${SVC_FAKE_CAPABILITY_MISSING:-0}" == 1 ]]; then printf "%s\n" "--model"; else printf "%s\n" "--print --model --effort --safe-mode --tools --strict-mcp-config --mcp-config --permission-mode --no-session-persistence --disable-slash-commands --no-chrome --settings --json-schema --output-format --max-budget-usd"; fi
  exit 0
fi
if [[ "${SVC_FAKE_REJECT_MAX_TURNS:-0}" == 1 && " $* " == *" --max-turns "* ]]; then printf "%s\n" "unknown option --max-turns" >&2; exit 2; fi
for arg in "$@"; do if [[ "$arg" == "--version" ]]; then printf "%s\n" "2.1.210 (Claude Code)"; exit 0; fi; done
mkdir -p "$SVC_FAKE_LOG"
printf "%s\n" "$$" > "$SVC_FAKE_LOG/claude.pid"
printf "%s\n" "$*" >> "$SVC_FAKE_LOG/claude.argv"
printf "%s\n" "${CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK-<unset>}" >> "$SVC_FAKE_LOG/claude.refusal-env"
printf "%s\n" "${ANTHROPIC_MODEL-<unset>}|${CLAUDE_MODEL-<unset>}|${CLAUDE_CODE_MODEL-<unset>}" >> "$SVC_FAKE_LOG/claude.model-env"
printf "%s\n" "${SVC_FAKE_PASSTHROUGH-<unset>}" >> "$SVC_FAKE_LOG/claude.passthrough-env"
package="$(cat)"
printf "%s" "$package" > "$SVC_FAKE_LOG/claude.stdin"
model="" effort=""
while [[ $# -gt 0 ]]; do if [[ "$1" == "--model" ]]; then model="$2"; shift 2; elif [[ "$1" == "--effort" ]]; then effort="$2"; shift 2; else shift; fi; done
printf "%s\n" "$model" >> "$SVC_FAKE_LOG/calls"
mode="${SVC_FAKE_MODE:-success}"
if [[ "$mode" == "sleep" ]]; then sleep 5; fi
if [[ "$mode" == "term-zero" ]]; then trap "exit 0" TERM; sleep 5; fi
if [[ "${SVC_FAKE_CLAUDE_SUBSCRIPTION_DISABLED:-0}" == 1 ]]; then
  printf "%s\n" "{\"is_error\":true,\"terminal_reason\":\"api_error\",\"api_error_status\":403,\"result\":\"Your organization has disabled Claude subscription access for Claude Code · Use an Anthropic API key instead\",\"type\":\"result\"}"
  exit 1
fi
if [[ "$model" == "claude-fable-5" && "$mode" != "success" ]]; then
  if [[ -n "${SVC_FAKE_FAILURE_COST:-}" ]]; then
    printf "%s\n" "{\"error\":{\"code\":\"${SVC_FAKE_CODE:-provider_overload}\"},\"structured_output\":null,\"modelUsage\":{\"claude-fable-5\":{\"inputTokens\":10,\"outputTokens\":5,\"costUSD\":$SVC_FAKE_FAILURE_COST}},\"total_cost_usd\":$SVC_FAKE_FAILURE_COST,\"num_turns\":1,\"stop_reason\":\"provider_error\",\"terminal_reason\":\"provider_overload\",\"errors\":[\"provider overloaded\"]}"
    printf "%s\n" "${SVC_FAKE_DIAGNOSTIC:-provider overloaded}" >&2
    exit 1
  fi
  if [[ -n "${SVC_FAKE_CODE:-}" ]]; then printf "%s\n" "{\"error\":{\"code\":\"$SVC_FAKE_CODE\"}}"; fi
  if [[ -n "${SVC_FAKE_TOP_LEVEL_CODE:-}" ]]; then printf "%s\n" "{\"type\":\"$SVC_FAKE_TOP_LEVEL_CODE\"}"; fi
  printf "%s\n" "${SVC_FAKE_DIAGNOSTIC:-model unavailable}" >&2
  exit 1
fi
if [[ "$model" == "claude-opus-4-8" && "${SVC_FAKE_OPUS_MODE:-success}" != "success" ]]; then printf "%s\n" "fallback failed" >&2; exit 1; fi
cert=""
if [[ -n "${SVC_FAKE_CERT_KEY:-}" ]]; then cert="{\"key\":\"$SVC_FAKE_CERT_KEY\",\"certified\":true,\"reviewer_family\":\"anthropic\",\"for_content_sha\":\"\"}"; fi
rubric="\"rubric_score\":10,"; [[ "${SVC_FAKE_OMIT_RUBRIC:-0}" == 1 ]] && rubric=""
reviewer_effort="${SVC_FAKE_REVIEWER_EFFORT:-$effort}"
finding="{\"schema_version\":1,\"review_kind\":\"${SVC_REVIEW_KIND:-generic}\",${rubric}\"rubric_failures\":null,\"dependencies_needing_read\":null,\"reviewer\":{\"host\":\"claude\",\"family\":\"anthropic\",\"model\":\"$model\",\"effort\":\"$reviewer_effort\"},\"verdict\":\"pass\",\"summary\":\"fixture pass\",\"findings\":[],\"certifications\":[${cert:-}]}"
if [[ "${SVC_FAKE_EXTRA_KEY:-0}" == 1 ]]; then finding="${finding%?},\"toString\":\"smuggled\"}"; fi
if [[ "${SVC_FAKE_OUTPUT:-valid}" == malformed ]]; then printf "%s" "not-json"; exit 0; fi
node -e "const f=JSON.parse(process.argv[1]); const m=process.argv[2]; const protocol=process.env.SVC_FAKE_PROTOCOL||\"success\"; const runtime=protocol===\"provider-safety-failure\"?\"claude-opus-4-8\":process.env.SVC_FAKE_RUNTIME_MODEL||m; const modelUsage={[runtime]:{inputTokens:10,outputTokens:5,costUSD:0.01}}; if(process.env.SVC_FAKE_AUX_MODEL)modelUsage[process.env.SVC_FAKE_AUX_MODEL]={inputTokens:1,outputTokens:1,costUSD:0}; let out;if(protocol===\"structured-max-turns\")out={type:\"result\",subtype:\"error_max_turns\",structured_output:null,modelUsage,total_cost_usd:0.01,num_turns:4,stop_reason:\"tool_use\",terminal_reason:\"max_turns\",errors:[\"schema retry budget exhausted\"]};else if(protocol===\"structured-budget\")out={type:\"result\",subtype:\"error_max_budget_usd\",structured_output:null,modelUsage,total_cost_usd:5.52,num_turns:2,stop_reason:\"tool_use\",terminal_reason:\"budget_exhausted\",errors:[\"Reached maximum budget (\$5)\"]};else if(protocol===\"provider-safety-failure\")out={type:\"result\",subtype:\"error_safety_switch\",structured_output:null,modelUsage,total_cost_usd:0.01,num_turns:2,stop_reason:\"refusal\",terminal_reason:\"safety_switch_failed\",errors:[\"Bearer secret-fixture-token\"]};else out={type:\"result\",subtype:\"success\",structured_output:f,modelUsage,total_cost_usd:0.01,num_turns:protocol===\"two-turn\"?2:1,stop_reason:\"end_turn\",terminal_reason:\"success\",protocol_events:protocol===\"two-turn\"?[\"schema_tool_boundary\",\"structured_output\"]:[\"structured_output\"]}; process.stdout.write(JSON.stringify(out)); if(protocol===\"structured-max-turns\"||protocol===\"structured-budget\"||protocol===\"provider-safety-failure\")process.exitCode=1" "$finding" "$model"
printf "%s\n" "claude diagnostic stream" >&2
' > "$TMP/bin/claude"

printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' '
if [[ "${1:-}" == "--help" ]]; then
  printf "%s\n" "--sandbox --mode plan --model --effort --add-dir --json-schema --output-format json --print-timeout --print"
  exit 0
fi
for arg in "$@"; do if [[ "$arg" == "--version" ]]; then printf "%s\n" "1.1.11"; exit 0; fi; done
mkdir -p "$SVC_FAKE_LOG"
printf "%s\n" "$*" >> "$SVC_FAKE_LOG/agy.argv"
printf "%s\n" "agy" >> "$SVC_FAKE_LOG/calls"
model="" effort="" instruction="" schema=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--model" ]]; then model="$2"; shift 2
  elif [[ "$1" == "--effort" ]]; then effort="$2"; shift 2
  elif [[ "$1" == "--json-schema" ]]; then schema="$2"; shift 2
  elif [[ "$1" == "--print" ]]; then instruction="$2"; shift 2
  else shift; fi
done
[[ -n "$effort" ]] || effort="high"
package="$(printf "%s" "$instruction" | sed -E "s#^Read ([^ ]+) completely.*#\\1#")"
test -r "$package"; test -z "$schema"
cp "$package" "$SVC_FAKE_LOG/agy.package"
if [[ "${SVC_FAKE_MODE:-success}" != "success" ]]; then printf "%s\n" "${SVC_FAKE_DIAGNOSTIC:-IneligibleTierError: client is no longer supported for Gemini Code Assist}" >&2; exit 1; fi
finding="{\"schema_version\":1,\"review_kind\":\"${SVC_REVIEW_KIND:-generic}\",\"rubric_score\":10,\"rubric_failures\":null,\"dependencies_needing_read\":null,\"reviewer\":{\"host\":\"agy\",\"family\":\"google\",\"model\":\"$model\",\"effort\":\"$effort\"},\"verdict\":\"pass\",\"summary\":\"fixture pass\",\"findings\":[],\"certifications\":[]}"
node -e "process.stdout.write(JSON.stringify({response:process.argv[1],stats:{model:process.argv[2],input_tokens:10,output_tokens:5}}))" "$finding" "$model"
' > "$TMP/bin/agy"

printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' '
if [[ "${1:-}" == "--help" ]]; then
  printf "%s\n" "--print --output-format json --mode plan --sandbox enabled --model --workspace"
  exit 0
fi
for arg in "$@"; do if [[ "$arg" == "--version" ]]; then printf "%s\n" "2026.08.11-e8db854"; exit 0; fi; done
mkdir -p "$SVC_FAKE_LOG"
printf "%s\n" "$*" >> "$SVC_FAKE_LOG/cursor.argv"
printf "%s\n" "cursor" >> "$SVC_FAKE_LOG/calls"
joined=" $* "
if [[ "$joined" == *"bypassPermissions"* || "$joined" == *" --yolo "* || "$joined" == *"--dangerously-skip-permissions"* || "$joined" == *" --force "* ]]; then
  printf "%s\n" "forbidden approval mode" >&2
  exit 2
fi
model=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--model" ]]; then model="$2"; shift 2
  else shift; fi
done
family="${SVC_FAKE_CURSOR_FAMILY:-}"
if [[ -z "$family" ]]; then
  if [[ "$model" == gpt-5.6-sol* ]]; then family=openai; else family=anthropic; fi
fi
host="${SVC_FAKE_FINDINGS_HOST:-cursor}"
effort="${SVC_FAKE_FINDINGS_EFFORT:-high}"
finding="$(H="$host" F="$family" M="${SVC_FAKE_FINDINGS_MODEL:-$model}" E="$effort" python3 -c "import json,os; print(json.dumps({\"schema_version\":1,\"review_kind\":os.environ.get(\"SVC_REVIEW_KIND\",\"plan\"),\"rubric_score\":10,\"rubric_failures\":None,\"dependencies_needing_read\":None,\"reviewer\":{\"host\":os.environ[\"H\"],\"family\":os.environ[\"F\"],\"model\":os.environ[\"M\"],\"effort\":os.environ[\"E\"]},\"verdict\":\"pass\",\"summary\":\"fixture pass\",\"findings\":[],\"certifications\":[]}))")"
if [[ "${SVC_FAKE_MODE:-success}" != "success" ]]; then printf "%s\n" "${SVC_FAKE_DIAGNOSTIC:-authentication failed}" >&2; exit 1; fi
result="$finding"
if [[ "${SVC_FAKE_CURSOR_FENCE:-0}" == 1 ]]; then result="```json
$finding
```"; fi
if [[ "${SVC_FAKE_OUTPUT:-valid}" == malformed ]]; then printf "%s\n" "{\"type\":\"result\",\"is_error\":false,\"result\":\"{bad\"}"; exit 0; fi
python3 -c "import json,sys; print(json.dumps({\"type\":\"result\",\"is_error\":False,\"result\":sys.argv[1]}))" "$result"
' > "$TMP/bin/cursor-agent"
chmod 700 "$TMP/bin/codex" "$TMP/bin/claude" "$TMP/bin/agy" "$TMP/bin/cursor-agent"

export SVC_EXTERNAL_REVIEW_FIXTURE=1
export SVC_EXTERNAL_REVIEW_FIXTURE_ROOT="$TMP"
export SVC_EXTERNAL_REVIEW_CODEX_BIN="$TMP/bin/codex"
export SVC_EXTERNAL_REVIEW_CLAUDE_BIN="$TMP/bin/claude"
export SVC_EXTERNAL_REVIEW_AGY_BIN="$TMP/bin/agy"
export SVC_EXTERNAL_REVIEW_CURSOR_BIN="$TMP/bin/cursor-agent"
export SVC_EXTERNAL_REVIEW_CACHE_DIR="$TMP/cache"
export SVC_EXTERNAL_REVIEW_POLICY_DIR="$TMP/policy"
export SVC_EXTERNAL_REVIEW_CONTEXT_ROOT="$ROOT"
export SVC_FAKE_LOG="$TMP/log"
export CODEX_HOME="$TMP/codex-home"
export SVC_EXTERNAL_REVIEW_NOW="2026-07-19T20:59:59Z"
mkdir -p "$CODEX_HOME"

run_review() {
  local orchestrator="$1" package="$2" out="$3"
  mkdir -p "$out"
  printf '%s' "$package" | node "$LAUNCHER" --orchestrator "$orchestrator" --review-kind plan --artifacts-dir "$out"
}
receipt_from_summary() { node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(s.receipt)' "$1"; }

# WI-506 RED/GREEN probe: the mandatory blend-external planning outputs are
# planning evidence, not executable implementation. Keep this exact allowlist
# narrow; all other references/* changes remain implementation divergence.
if [[ "${SVC_WI506_RED_ONLY:-0}" == 1 ]]; then
  RED_REPO="$TMP/phase-classifier-red"
  mkdir -p "$RED_REPO/references/knowledge/runtime-state-portability/details"
  printf '# fixture context root\n' > "$RED_REPO/CLAUDE.md"
  printf 'base notice\n' > "$RED_REPO/NOTICES"
  printf '{}\n' > "$RED_REPO/references/blend-registry.json"
  printf 'base knowledge\n' > "$RED_REPO/references/knowledge/runtime-state-portability/details/runtime-state.md"
  git -C "$RED_REPO" -c init.defaultBranch=main init -q
  git -C "$RED_REPO" -c user.email=svc@example.com -c user.name=svc add -A
  git -C "$RED_REPO" -c user.email=svc@example.com -c user.name=svc -c commit.gpgsign=false commit -q -m base
  RED_BASE="$(git -C "$RED_REPO" rev-parse HEAD)"
  printf 'credited planning source\n' > "$RED_REPO/NOTICES"
  printf '{"updated":true}\n' > "$RED_REPO/references/blend-registry.json"
  printf 'updated knowledge\n' > "$RED_REPO/references/knowledge/runtime-state-portability/details/runtime-state.md"
  RED_PLANSHA="$(printf '%064d' 1)"
  printf '{"wi":"WI-506","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' \
    "$RED_BASE" "$RED_PLANSHA" > "$TMP/red-phase-binding.json"
  rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
  set +e
  printf blend-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan \
    --context-root "$RED_REPO" --phase-binding "$TMP/red-phase-binding.json" \
    --artifacts-dir "$TMP/out/red-phase-classifier" >/dev/null 2>&1
  RED_RC=$?
  set -e
  if [[ "$RED_RC" -ne 0 ]] || [[ "$(wc -l < "$SVC_FAKE_LOG/calls" 2>/dev/null || printf 0)" -ne 1 ]]; then
    echo "WI506-RED-PHASE-CLASSIFIER: mandatory blend artifacts rejected" >&2
    exit 1
  fi
  exit 0
fi

echo "=== Tier 1: deterministic external review launcher (WI-488) ==="

expect "findings schema parses" node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$ROOT/schemas/external-review-findings.schema.json"
# WI-489: the findings schema is passed to the real provider via --output-schema. gpt-5.6-sol
# enforces OpenAI strict structured-output: EVERY object must set additionalProperties:false AND
# list every property in `required` (optional => nullable). A regression here 400s every paid
# review before generation (the "consumer_payload" incident). Guard it statically.
expect "findings schema is OpenAI strict-structured-output compliant" node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));let ok=true;function c(n){if(n&&typeof n==="object"){if(n.properties){if(n.additionalProperties!==false)ok=false;const p=Object.keys(n.properties),r=n.required||[];if(p.some(k=>!r.includes(k)))ok=false;for(const k of p)c(n.properties[k]);}if(n.items)c(n.items);}}c(j);process.exit(ok?0:1);' "$ROOT/schemas/external-review-findings.schema.json"
expect "receipt schema parses" node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$ROOT/schemas/external-review-receipt.schema.json"
expect "launcher exists" test -f "$LAUNCHER"
if [[ ! -f "$LAUNCHER" ]]; then
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
expect "launcher parses" node --check "$LAUNCHER"
expect "production review and stale-lock defaults allow a complete 20-minute review" grep -q 'const DEFAULT_TIMEOUT_SECONDS = 1200;.*' "$LAUNCHER"
expect "production review budget defaults to fifty dollars for the whole launcher review" grep -q 'const DEFAULT_REVIEW_BUDGET_USD = 50;.*' "$LAUNCHER"
expect "production stale-lock default preserves the two-attempt-plus-margin invariant" grep -q 'const DEFAULT_LOCK_STALE_SECONDS = 2460;.*' "$LAUNCHER"
expect "registry retains backward-compatible scheduled reviewer profiles" node -e 'const r=require(process.argv[1]),p=r.externalReviewPolicy;if(!p||p.version!==3||p.cutover_utc!=="2026-07-19T21:00:00Z"||p.cutover_local!=="2026-07-20 00:00:00 EEST"||p.profiles?.["fable-high"]?.tuple?.model!=="claude-fable-5"||p.profiles?.["opus-high"]?.tuple?.model!=="claude-opus-4-8")process.exit(1)' "$ROOT/references/model-registry.json"
OLD_REVIEW_MODEL='gpt-5.6-'"codex"
expect "active review policy surfaces contain no incorrect legacy model pin" bash -c "! rg -n '$OLD_REVIEW_MODEL' '$ROOT/scripts/run-external-review.mjs' '$ROOT/scripts/resolve-adversarial-reviewer.sh' '$ROOT/references/model-registry.json' '$ROOT/skills/review-plan/SKILL.md' '$ROOT/skills/review-exec/SKILL.md' '$ROOT/skills/review-cross-model/SKILL.md'"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "package-one" "$TMP/out/codex-1" > "$TMP/codex-1.summary"
expect "Claude orchestration succeeds through Codex" test -s "$TMP/codex-1.summary"
expect "Codex package includes hashed worktree rules and the byte-exact review request" bash -c "grep -q '^SVC_REVIEW_CONTEXT_MANIFEST_V1 ' '$SVC_FAKE_LOG/codex.stdin' && grep -q 'target:AGENTS.md' '$SVC_FAKE_LOG/codex.stdin' && grep -q 'framework:skills/review-plan/SKILL.md' '$SVC_FAKE_LOG/codex.stdin' && grep -q 'package-one' '$SVC_FAKE_LOG/codex.stdin'"
expect "Codex exact gpt-5.6-sol model and high effort pinned" grep -q -- '--model gpt-5.6-sol.*model_reasoning_effort="high"' "$SVC_FAKE_LOG/codex.argv"
expect "Codex is read-only and isolated" grep -q -- '--sandbox read-only.*--ephemeral.*--ignore-user-config.*--ignore-rules.*--strict-config' "$SVC_FAKE_LOG/codex.argv"
expect "Codex output is schema/stream separated" grep -q -- '--output-schema .*--json.*--output-last-message .*--color never -' "$SVC_FAKE_LOG/codex.argv"
expect "CODEX_HOME authentication path preserved" grep -qx "$CODEX_HOME" "$SVC_FAKE_LOG/codex.home"
FIRST_RECEIPT="$(receipt_from_summary "$TMP/codex-1.summary")"
expect "success receipt records exact tuples, CLI version, hashed worktree context, and cache provenance" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(r.status!=="success"||r.classification!=="success"||r.requested_tuple.model!=="gpt-5.6-sol"||JSON.stringify(r.requested_tuple)!==JSON.stringify(r.invocation_tuple)||JSON.stringify(r.requested_tuple)!==JSON.stringify(r.effective_tuple)||r.cli_version!=="codex-cli-exec 0.144.4"||!r.artifacts.capabilities||!fs.existsSync(r.artifacts.capabilities)||!r.cache.reusable||r.fallback.used||r.attempts.length!==1||!r.package_context?.files?.some(f=>f.path==="target:AGENTS.md")||!r.package_context?.files?.some(f=>f.path==="framework:skills/review-plan/SKILL.md"))process.exit(1)' "$FIRST_RECEIPT"
expect "provider diagnostics never contaminate event stream" bash -c "! grep -q 'codex diagnostic stream' '$TMP/out/codex-1/attempt-1-events.jsonl' && grep -q 'codex diagnostic stream' '$TMP/out/codex-1/attempt-1-stderr.log'"

SVC_FAKE_MODE=success run_review claude "package-one" "$TMP/out/codex-2" > "$TMP/codex-2.summary"
expect "exact primary receipt is reusable" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 1
CACHE_HIT_RECEIPT="$(receipt_from_summary "$TMP/codex-2.summary")"
expect "cache hit retains the verified invocation tuple, CLI version, and capability artifact" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(r.classification!=="cache_hit"||JSON.stringify(r.requested_tuple)!==JSON.stringify(r.invocation_tuple)||r.cli_version!=="codex-cli-exec 0.144.4"||!r.artifacts.capabilities||!fs.existsSync(r.artifacts.capabilities))process.exit(1)' "$CACHE_HIT_RECEIPT"
SVC_FAKE_MODE=success run_review claude "package-two" "$TMP/out/codex-3" > "$TMP/codex-3.summary"
expect "changed package misses cache" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 2

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_OMIT_RUNTIME_MODEL=1 run_review claude "codex-no-model-echo" "$TMP/out/codex-no-model-echo" > "$TMP/codex-no-model-echo.summary"
NO_ECHO_RECEIPT="$(receipt_from_summary "$TMP/codex-no-model-echo.summary")"
expect "Codex success without a server model echo records requested acceptance without fabricating observation" node -e 'const r=require(process.argv[1]);if(r.status!=="success"||r.requested_tuple.model!=="gpt-5.6-sol"||r.model_attestation?.level!=="requested_accepted"||r.model_attestation?.requested_model!=="gpt-5.6-sol"||r.model_attestation?.observed_models?.length!==0||!/no_server_model_echo/.test(r.model_attestation?.evidence||""))process.exit(1)' "$NO_ECHO_RECEIPT"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK=1 ANTHROPIC_MODEL=claude-sonnet-5 CLAUDE_MODEL=claude-opus-legacy CLAUDE_CODE_MODEL=claude-haiku-legacy SVC_FAKE_PASSTHROUGH=control-survives SVC_FAKE_MODE=success run_review codex "claude-package" "$TMP/out/claude-1" > "$TMP/claude-1.summary"
expect "Codex orchestration succeeds through Fable" grep -qx 'claude-fable-5' "$SVC_FAKE_LOG/calls"
expect "Claude package includes hashed worktree rules and the byte-exact review request" bash -c "grep -q '^SVC_REVIEW_CONTEXT_MANIFEST_V1 ' '$SVC_FAKE_LOG/claude.stdin' && grep -q 'target:AGENTS.md' '$SVC_FAKE_LOG/claude.stdin' && grep -q 'framework:skills/review-plan/SKILL.md' '$SVC_FAKE_LOG/claude.stdin' && grep -q 'claude-package' '$SVC_FAKE_LOG/claude.stdin'"
expect "Fable exact high tuple pinned" grep -q -- '--model claude-fable-5.*--effort high' "$SVC_FAKE_LOG/claude.argv"
expect "Fable primary receives the full fifty-dollar review ceiling" grep -q -- '--max-budget-usd 50' "$SVC_FAKE_LOG/claude.argv"
expect "Claude safe auth-compatible isolation pins four agentic turns" grep -q -- '--safe-mode.*--tools .*--strict-mcp-config.*--permission-mode plan.*--no-session-persistence.*--max-turns 4' "$SVC_FAKE_LOG/claude.argv"
expect "Claude disables slash commands/browser and bounds budget" grep -q -- '--disable-slash-commands.*--no-chrome.*--json-schema .*--output-format json.*--max-budget-usd' "$SVC_FAKE_LOG/claude.argv"
expect "Claude never uses bare or hidden fallback" bash -c "! grep -q -- '--bare\\|--fallback-model' '$SVC_FAKE_LOG/claude.argv'"
expect "Fable enables safeguard routing and actually scrubs injected inherited model controls" bash -c "grep -q -- '--settings {\"switchModelsOnFlag\":true}' '$SVC_FAKE_LOG/claude.argv' && grep -qx '<unset>' '$SVC_FAKE_LOG/claude.refusal-env' && grep -qx '<unset>|<unset>|<unset>' '$SVC_FAKE_LOG/claude.model-env' && grep -qx 'control-survives' '$SVC_FAKE_LOG/claude.passthrough-env'"
FABLE_RECEIPT="$(receipt_from_summary "$TMP/claude-1.summary")"
expect "help-hidden max-turns capability succeeds through the configured argv parser" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(fs.readFileSync(r.artifacts.capabilities,"utf8").includes("--max-turns"))process.exit(1)' "$FABLE_RECEIPT"
expect "receipt v2 records scheduled profile protocol budget exact-primary route and server model evidence" node -e 'const r=require(process.argv[1]);if(r.schema_version!==2||r.policy?.version!==3||r.policy?.profile!=="fable-high"||r.policy?.source!=="schedule"||r.protocol?.process_invocations!==1||r.protocol?.configured_turn_ceiling!==4||r.protocol?.configured_budget_usd!==50||r.route?.kind!=="scheduled_primary"||r.effective_effort?.provenance!=="requested"||r.model_attestation?.level!=="server_observed"||!r.model_attestation?.observed_models?.includes("claude-fable-5"))process.exit(1)' "$FABLE_RECEIPT"
node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/launcher-policy.json"
expect "policy status registry and receipt contain no pricing entitlement or availability forecast" node -e 'const fs=require("fs"),status=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),registry=require(process.argv[2]).externalReviewPolicy,receipt=require(process.argv[3]),text=JSON.stringify({status,registry,policy:receipt.policy}).toLowerCase();if(/pricing|price_usd|billing_forecast|entitlement_forecast|availability_forecast|included with subscription|on-demand after/.test(text))process.exit(1)' "$TMP/launcher-policy.json" "$ROOT/references/model-registry.json" "$FABLE_RECEIPT"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_PROTOCOL=two-turn run_review codex "two-turn-protocol" "$TMP/out/two-turn-protocol" > "$TMP/two-turn-protocol.summary"
TWO_TURN_RECEIPT="$(receipt_from_summary "$TMP/two-turn-protocol.summary")"
expect "two-turn schema handshake completes in one Claude process" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(fs.readFileSync(process.argv[2],"utf8").trim().split(/\n/).length!==1||r.protocol?.process_invocations!==1||r.protocol?.reported_turns!==2||r.protocol?.terminal_reason!=="success")process.exit(1)' "$TWO_TURN_RECEIPT" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf structured-max-turns | SVC_FAKE_PROTOCOL=structured-max-turns node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/structured-max-turns" > "$TMP/structured-max-turns.summary" 2> "$TMP/structured-max-turns.err"
STRUCTURED_MAX_RC=$?
set -e
expect "structured max-turn terminal is schema_turn_budget with no Opus process" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[2]!=="1"||r.classification!=="schema_turn_budget"||r.protocol?.reported_turns!==4||r.protocol?.terminal_reason!=="max_turns"||fs.readFileSync(process.argv[3],"utf8").trim().split(/\n/).length!==1)process.exit(1)' "$TMP/out/structured-max-turns/receipt.json" "$STRUCTURED_MAX_RC" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf structured-budget | SVC_FAKE_PROTOCOL=structured-budget node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/structured-budget" > "$TMP/structured-budget.summary" 2> "$TMP/structured-budget.err"
STRUCTURED_BUDGET_RC=$?
set -e
expect "structured dollar-budget terminal is actionable budget_exhausted with no Opus process" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[2]!=="1"||r.classification!=="budget_exhausted"||r.protocol?.reported_turns!==2||r.protocol?.terminal_reason!=="budget_exhausted"||r.fallback.used||fs.readFileSync(process.argv[3],"utf8").trim().split(/\n/).length!==1)process.exit(1)' "$TMP/out/structured-budget/receipt.json" "$STRUCTURED_BUDGET_RC" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
SVC_FAKE_RUNTIME_MODEL=claude-opus-4-8 SVC_FAKE_REVIEWER_EFFORT=low run_review codex "provider-safety-route" "$TMP/out/provider-safety-route" > "$TMP/provider-safety-route.summary" 2> "$TMP/provider-safety-route.err"
SAFETY_RC=$?
set -e
SAFETY_RECEIPT="$TMP/out/provider-safety-route/receipt.json"
expect "same-process Fable safeguard route normalizes model-authored effort and labels causation as envelope-inferred" node -e 'const fs=require("fs"),r=require(process.argv[1]),f=require(r.artifacts.findings);if(process.argv[3]!=="0"||r.route?.kind!=="provider_safety_route"||r.route?.evidence!=="provider_model_usage_envelope_inferred"||r.requested_tuple.model!=="claude-fable-5"||r.invocation_tuple.model!=="claude-fable-5"||r.effective_tuple.model!=="claude-opus-4-8"||r.effective_effort?.value!==null||r.effective_effort?.provenance!=="provider-managed"||f.reviewer.effort!=="high"||r.fallback.used||r.cache.reusable||fs.readFileSync(process.argv[2],"utf8").trim().split(/\n/).length!==1)process.exit(1)' "$SAFETY_RECEIPT" "$SVC_FAKE_LOG/calls" "$SAFETY_RC"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf missing-envelope | SVC_EXTERNAL_REVIEW_FIXTURE_DISABLE_SAFETY_ENVELOPE=1 SVC_FAKE_RUNTIME_MODEL=claude-opus-4-8 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/missing-envelope" > "$TMP/missing-envelope.summary" 2> "$TMP/missing-envelope.err"
MISSING_ENVELOPE_RC=$?
set -e
expect "Opus observation without the controlled Fable envelope fails as model_mismatch" bash -c "test '$MISSING_ENVELOPE_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/missing-envelope/receipt.json')\" = model_mismatch && ! grep -q 'switchModelsOnFlag' '$SVC_FAKE_LOG/claude.argv'"
set +e
SVC_FAKE_RUNTIME_MODEL=claude-fable-5 run_review codex "provider-safety-route" "$TMP/out/provider-safety-route-retry" > "$TMP/provider-safety-route-retry.summary" 2> "$TMP/provider-safety-route-retry.err"
SAFETY_RETRY_RC=$?
set -e
expect "provider safety route never satisfies a later Fable primary request" bash -c "test '$SAFETY_RETRY_RC' -eq 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 2"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf provider-safety-failure | SVC_FAKE_PROTOCOL=provider-safety-failure node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/provider-safety-failure" > "$TMP/provider-safety-failure.summary" 2> "$TMP/provider-safety-failure.err"
PROVIDER_SAFETY_FAILURE_RC=$?
set -e
expect "failed same-process safeguard route never starts launcher fallback and redacts diagnostics" node -e 'const fs=require("fs"),r=require(process.argv[1]),calls=fs.readFileSync(process.argv[2],"utf8").trim().split(/\n/),events=fs.readFileSync(process.argv[3],"utf8");if(process.argv[4]!=="1"||r.classification!=="provider_safety_failure"||r.fallback.used||calls.length!==1||!events.includes("[REDACTED]")||events.includes("secret-fixture-token"))process.exit(1)' "$TMP/out/provider-safety-failure/receipt.json" "$SVC_FAKE_LOG/calls" "$TMP/out/provider-safety-failure/attempt-1-events.jsonl" "$PROVIDER_SAFETY_FAILURE_RC"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/policy"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T20:59:59Z node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-before.json" 2> "$TMP/status-before.err"
STATUS_BEFORE_RC=$?
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:00Z node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-at.json" 2> "$TMP/status-at.err"
STATUS_AT_RC=$?
set -e
expect "policy status is zero-spawn and switches at the exact UTC cutover" node -e 'const fs=require("fs"),b=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),a=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));if(process.argv[3]!=="0"||process.argv[4]!=="0"||b.profile!=="fable-high"||a.profile!=="opus-high"||b.profile_source!=="schedule"||a.profile_source!=="schedule"||fs.existsSync(process.argv[5]))process.exit(1)' "$TMP/status-before.json" "$TMP/status-at.json" "$STATUS_BEFORE_RC" "$STATUS_AT_RC" "$SVC_FAKE_LOG/calls"
set +e
node "$LAUNCHER" --select-profile fable-high --reason "fixture owner selection" > "$TMP/select.json" 2> "$TMP/select.err"
SELECT_RC=$?
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:00Z node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-selected.json" 2> "$TMP/status-selected.err"
STATUS_SELECTED_RC=$?
node "$LAUNCHER" --clear-profile-selection --reason "fixture clear" > "$TMP/clear.json" 2> "$TMP/clear.err"
CLEAR_RC=$?
set -e
expect "owner can select Fable then clear back to schedule without provider work" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(process.argv.slice(2,5).some(x=>x!=="0")||s.profile!=="fable-high"||s.profile_source!=="explicit-selection"||!s.selection?.sha256||fs.existsSync(process.argv[5]))process.exit(1)' "$TMP/status-selected.json" "$SELECT_RC" "$STATUS_SELECTED_RC" "$CLEAR_RC" "$SVC_FAKE_LOG/calls"

node "$LAUNCHER" --select-profile fable-high --reason "explicit invocation fixture" > "$TMP/select-explicit.json"
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:00Z run_review codex "explicit-fable" "$TMP/out/explicit-fable" > "$TMP/explicit-fable.summary"
EXPLICIT_FABLE_RECEIPT="$(receipt_from_summary "$TMP/explicit-fable.summary")"
expect "explicit Fable selection is receipted with owner hash and an explicit-primary route" node -e 'const r=require(process.argv[1]);if(r.policy.profile!=="fable-high"||r.policy.source!=="explicit-selection"||!r.policy.selection_sha256||r.policy.selection_authority!=="repository-owner"||r.route.kind!=="explicit_profile_primary"||r.requested_tuple.model!=="claude-fable-5"||r.fallback.used)process.exit(1)' "$EXPLICIT_FABLE_RECEIPT"
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:00Z run_review claude "selection-inert-for-claude-orchestration" "$TMP/out/selection-inert-claude" > "$TMP/selection-inert-claude.summary"
SELECTION_INERT_RECEIPT="$(receipt_from_summary "$TMP/selection-inert-claude.summary")"
expect "explicit Fable selection is inert for Claude orchestration" node -e 'const r=require(process.argv[1]);if(r.policy.profile!=="codex-high"||r.policy.source!=="fixed-policy"||r.policy.selection_sha256!==null||r.requested_tuple.model!=="gpt-5.6-sol"||r.requested_tuple.effort!=="high"||r.route.kind!=="exact_primary"||r.fallback.used)process.exit(1)' "$SELECTION_INERT_RECEIPT"
node "$LAUNCHER" --clear-profile-selection --reason "explicit invocation fixture cleanup" > "$TMP/clear-explicit.json"

REVIEWER_CONFIG="$TMP/reviewer-policy-v2.json"
node -e 'const fs=require("fs");const ext=(id,host,family,model,required=false)=>({id,kind:"external",required,authority:"independent",tuple:{host,family,model,effort:"high"}});const self={id:"self",kind:"inline-self",required:true,authority:"advisory",tuple:{host:"current",family:"openai",model:"current",effort:"high"}};const p={release_authority:false,stations:[self,ext("agy","agy","google","Gemini 3.6 Flash (High)"),ext("opus","claude","anthropic","claude-opus-4-6")]};fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:2,authority:"repository-owner",default_mode:"fast",modes:{fast:{orchestrators:{codex:{plan:p,exec:p}}}}},null,2),{mode:0o600})' "$REVIEWER_CONFIG"
CANDIDATE_DIGEST="$(node --input-type=module -e 'import {candidateTreeIdentity} from "./scripts/lib/external-review-provenance.mjs"; process.stdout.write(candidateTreeIdentity(process.cwd()).candidate_digest)')"
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf 'agy-independent candidate_digest=%s' "$CANDIDATE_DIGEST" | SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:00Z node "$LAUNCHER" --orchestrator codex --review-kind plan --candidate-digest "$CANDIDATE_DIGEST" --reviewer-config "$REVIEWER_CONFIG" --reviewer-mode fast --reviewer-phase plan --reviewer-station agy --artifacts-dir "$TMP/out/agy-independent" > "$TMP/agy-independent.summary"
AGY_RECEIPT="$(receipt_from_summary "$TMP/agy-independent.summary")"
expect "owner-configured Gemini 3.6 Flash runs through canonical AGY and emits an exact independent Google receipt" node -e 'const fs=require("fs"),r=require(process.argv[1]),argv=fs.readFileSync(process.argv[2],"utf8");if(r.policy.profile!=="fast:agy"||r.policy.source!=="owner-config"||!r.policy.selection_sha256||!r.candidate_digest||r.requested_tuple.host!=="agy"||r.requested_tuple.family!=="google"||r.requested_tuple.model!=="Gemini 3.6 Flash (High)"||r.requested_tuple.effort!=="high"||r.route.kind!=="owner_config_primary"||r.model_attestation.level!=="requested_accepted"||!argv.includes("--sandbox --mode plan --model Gemini 3.6 Flash (High)")||argv.includes("--effort")||argv.includes("--json-schema")||argv.includes("--output-format"))process.exit(1)' "$AGY_RECEIPT" "$SVC_FAKE_LOG/agy.argv"
expect "AGY review package crosses the canonical private-file bridge with the fail-closed schema" bash -c "grep -q 'agy-independent' '$SVC_FAKE_LOG/agy.package' && grep -q 'svc-external-review-findings-v1' '$SVC_FAKE_LOG/agy.package'"

node "$LAUNCHER" --validate-capabilities --orchestrator codex --reviewer-config "$REVIEWER_CONFIG" --reviewer-mode fast --reviewer-phase plan --reviewer-station opus --artifacts-dir "$TMP/out/opus46-capability" > "$TMP/opus46-capability.summary"
expect "optional Opus 4.6 is capability-probed without a review invocation" node -e 'const r=require(process.argv[1]);if(r.status!=="success"||r.review_kind!=="capability-probe"||r.requested_tuple.model!=="claude-opus-4-6"||r.attempts.length!==0)process.exit(1)' "$TMP/out/opus46-capability/receipt.json"

set +e
printf 'opus-disabled-subscription candidate_digest=%s' "$CANDIDATE_DIGEST" | SVC_FAKE_CLAUDE_SUBSCRIPTION_DISABLED=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --candidate-digest "$CANDIDATE_DIGEST" --reviewer-config "$REVIEWER_CONFIG" --reviewer-mode fast --reviewer-phase plan --reviewer-station opus --artifacts-dir "$TMP/out/opus46-disabled" > "$TMP/opus46-disabled.summary" 2> "$TMP/opus46-disabled.err"
OPUS_DISABLED_RC=$?
set -e
expect "structured Claude subscription-disabled 403 is classified as model entitlement" bash -c "test '$OPUS_DISABLED_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/opus46-disabled/receipt.json')\" = model_entitlement"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:00Z run_review codex "scheduled-opus" "$TMP/out/scheduled-opus" > "$TMP/scheduled-opus.summary"
SCHEDULED_OPUS_RECEIPT="$(receipt_from_summary "$TMP/scheduled-opus.summary")"
expect "cutover Opus is one high-effort primary with no fallback or switching envelope" node -e 'const fs=require("fs"),r=require(process.argv[1]),argv=fs.readFileSync(process.argv[2],"utf8"),calls=fs.readFileSync(process.argv[3],"utf8").trim().split(/\n/);if(r.policy.profile!=="opus-high"||r.policy.source!=="schedule"||r.requested_tuple.model!=="claude-opus-4-8"||r.requested_tuple.effort!=="high"||r.route.kind!=="scheduled_primary"||r.fallback.used||r.route.switching_enabled||calls.length!==1||argv.includes("switchModelsOnFlag"))process.exit(1)' "$SCHEDULED_OPUS_RECEIPT" "$SVC_FAKE_LOG/claude.argv" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/policy"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/policy"; chmod 700 "$TMP/policy"
printf '{}\n' > "$TMP/policy/foreign.json"
ln -s "$TMP/policy/foreign.json" "$TMP/policy/selection.json"
set +e
node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-symlink.json" 2> "$TMP/status-symlink.err"
SYMLINK_STATUS_RC=$?
set -e
rm "$TMP/policy/selection.json"
node "$LAUNCHER" --select-profile fable-high --reason "mode fixture" > "$TMP/select-mode.json"
chmod 0644 "$TMP/policy/selection.json"
set +e
node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-mode.json" 2> "$TMP/status-mode.err"
MODE_STATUS_RC=$?
set -e
rm "$TMP/policy/selection.json"
node "$LAUNCHER" --select-profile fable-high --reason "expiry fixture" --expires-at 2026-07-19T21:00:30Z > "$TMP/select-expiry.json"
set +e
SVC_EXTERNAL_REVIEW_NOW=2026-07-19T21:00:31Z node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-expired.json" 2> "$TMP/status-expired.err"
EXPIRED_STATUS_RC=$?
set -e
node "$LAUNCHER" --clear-profile-selection --reason "expiry fixture cleanup" > "$TMP/clear-expiry.json"
expect "symlink loose-mode and expired selections fail before cache or provider activity" bash -c "test '$SYMLINK_STATUS_RC' -ne 0 && test '$MODE_STATUS_RC' -ne 0 && test '$EXPIRED_STATUS_RC' -ne 0 && test ! -e '$SVC_FAKE_LOG/calls' && test -z \"\$(find '$TMP/cache' -mindepth 1 -print -quit)\""

node "$LAUNCHER" --select-profile fable-high --reason "directory hardening fixture" > "$TMP/select-directory-mode.json"
chmod 0777 "$TMP/policy"
set +e
node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/status-directory-mode.json" 2> "$TMP/status-directory-mode.err"
DIRECTORY_MODE_RC=$?
set -e
chmod 0700 "$TMP/policy"
node "$LAUNCHER" --clear-profile-selection --reason "directory hardening cleanup" > "$TMP/clear-directory-mode.json"
expect "group/world-writable selection directory fails before provider activity" bash -c "test '$DIRECTORY_MODE_RC' -ne 0 && grep -q 'directory must not be group/world writable' '$TMP/status-directory-mode.err' && test ! -e '$SVC_FAKE_LOG/calls'"

set +e
env -u SVC_EXTERNAL_REVIEW_FIXTURE -u SVC_EXTERNAL_REVIEW_FIXTURE_ROOT -u SVC_EXTERNAL_REVIEW_POLICY_DIR SVC_EXTERNAL_REVIEW_NOW=2026-07-19T20:59:59Z node "$LAUNCHER" --policy-status --orchestrator codex > "$TMP/production-clock.json" 2> "$TMP/production-clock.err"
PRODUCTION_CLOCK_RC=$?
set -e
expect "production clock injection is rejected before provider activity" bash -c "test '$PRODUCTION_CLOCK_RC' -ne 0 && grep -q 'fixture-only' '$TMP/production-clock.err' && test ! -e '$SVC_FAKE_LOG/calls'"

POLICY_FOR_STATUS="${SVC_DISPATCH_POLICY:-${SVC_REVIEWER_POLICY:-$HOME/.svc/dispatch-policy.json}}"
SVC_HOST=codex bash "$ROOT/scripts/resolve-adversarial-reviewer.sh" > "$TMP/resolver-policy.json"
node "$LAUNCHER" --policy-status --orchestrator codex --reviewer-config "$POLICY_FOR_STATUS" --reviewer-phase plan > "$TMP/launcher-policy.json"
expect "shell resolver delegates to the canonical policy status without a paid probe" node -e 'const fs=require("fs"),a=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),b=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));if(a.policy_version!==b.policy_version||a.profile!==b.profile||JSON.stringify(a.tuple)!==JSON.stringify(b.tuple)||fs.existsSync(process.argv[3]))process.exit(1)' "$TMP/resolver-policy.json" "$TMP/launcher-policy.json" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_AUX_MODEL=claude-haiku-4-5-20251001 run_review codex "allowed-auxiliary" "$TMP/out/allowed-auxiliary" > "$TMP/allowed-auxiliary.summary"
expect "known Claude CLI auxiliary model does not falsify the requested effective tuple" test -s "$TMP/allowed-auxiliary.summary"
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf unexpected-auxiliary | SVC_FAKE_AUX_MODEL=claude-sonnet-unrequested node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/unexpected-auxiliary" > "$TMP/unexpected-auxiliary.summary" 2> "$TMP/unexpected-auxiliary.err"
UNEXPECTED_AUX_RC=$?
set -e
expect "unrequested non-auxiliary Claude model hard-fails as model_mismatch" bash -c "test '$UNEXPECTED_AUX_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/unexpected-auxiliary/receipt.json')\" = model_mismatch"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf prototype-key | SVC_FAKE_EXTRA_KEY=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/prototype-key" > "$TMP/prototype-key.summary" 2> "$TMP/prototype-key.err"
PROTOTYPE_KEY_RC=$?
set -e
expect "prototype-chain property names cannot bypass closed findings schema" bash -c "test '$PROTOTYPE_KEY_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/prototype-key/receipt.json')\" = schema_invalid"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=failure SVC_FAKE_CODE=model_unavailable SVC_FAKE_FAILURE_COST=0 SVC_FAKE_DIAGNOSTIC='model unavailable' run_review codex "fallback-package" "$TMP/out/fallback" > "$TMP/fallback.summary"
expect "eligible Fable failure launches separate Opus" test "$(wc -l < "$SVC_FAKE_LOG/calls")" -eq 2
expect "fallback order is Fable then Opus" bash -c "test \"\$(sed -n '1p' '$SVC_FAKE_LOG/calls')\" = claude-fable-5 && test \"\$(sed -n '2p' '$SVC_FAKE_LOG/calls')\" = claude-opus-4-8"
SVC_FAKE_MODE=success run_review codex "fallback-package" "$TMP/out/fallback-retry" > "$TMP/fallback-retry.summary"
expect "fallback receipt never satisfies later primary" test "$(grep -c '^claude-fable-5$' "$SVC_FAKE_LOG/calls")" -eq 2

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=failure SVC_FAKE_CODE=provider_overload SVC_FAKE_FAILURE_COST=7.25 SVC_FAKE_DIAGNOSTIC='provider overloaded' run_review codex "aggregate-budget" "$TMP/out/aggregate-budget" > "$TMP/aggregate-budget.summary"
AGGREGATE_BUDGET_RECEIPT="$(receipt_from_summary "$TMP/aggregate-budget.summary")"
expect "fallback receives only the unspent remainder of the fifty-dollar review ceiling" node -e 'const fs=require("fs"),r=require(process.argv[1]),argv=fs.readFileSync(process.argv[2],"utf8").trim().split(/\n/);if(r.protocol?.configured_budget_usd!==50||r.attempts.length!==2||r.attempts[0].usage?.configured_budget_usd!==50||r.attempts[1].usage?.configured_budget_usd!==42.75||!argv[0].includes("--max-budget-usd 50")||!argv[1].includes("--max-budget-usd 42.75"))process.exit(1)' "$AGGREGATE_BUDGET_RECEIPT" "$SVC_FAKE_LOG/claude.argv"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf auth-package | SVC_FAKE_MODE=failure SVC_FAKE_DIAGNOSTIC='authentication failed' node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/auth" > "$TMP/auth.summary" 2> "$TMP/auth.err"
AUTH_RC=$?
set -e
expect "authentication failure hard-fails" test "$AUTH_RC" -ne 0
expect "authentication failure never launches Opus" test "$(wc -l < "$SVC_FAKE_LOG/calls")" -eq 1

for CASE in 'shared_quota|quota exhausted' 'network|network connection refused'; do
  CLASS="${CASE%%|*}"; DIAGNOSTIC="${CASE#*|}"
  rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
  set +e
  printf '%s' "$CLASS-package" | SVC_FAKE_MODE=failure SVC_FAKE_DIAGNOSTIC="$DIAGNOSTIC" node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/$CLASS" > "$TMP/$CLASS.summary" 2> "$TMP/$CLASS.err"
  RC=$?
  set -e
  expect "$CLASS hard-fails without fallback" bash -c "test '$RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 1 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/$CLASS/receipt.json')\" = '$CLASS'"
done

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf proxy-package | SVC_FAKE_MODE=failure SVC_FAKE_DIAGNOSTIC='proxy error: service temporarily unavailable' node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/proxy-network" > "$TMP/proxy-network.summary" 2> "$TMP/proxy-network.err"
PROXY_RC=$?
set -e
expect "free-text proxy overload wording never authorizes Opus" bash -c "test '$PROXY_RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 1 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/proxy-network/receipt.json')\" = unknown_provider"

for CLASS_DIAG in 'model_unavailable|model unavailable' 'model_entitlement|model entitlement required' 'provider_overload|provider overloaded'; do
  CLASS="${CLASS_DIAG%%|*}"; DIAGNOSTIC="${CLASS_DIAG#*|}"
  rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
  set +e
  SVC_FAKE_MODE=failure SVC_FAKE_DIAGNOSTIC="$DIAGNOSTIC" run_review codex "plain-$CLASS" "$TMP/out/plain-$CLASS" > "$TMP/plain-$CLASS.summary"
  PLAIN_RC=$?
  set -e
  expect "exact anchored plain diagnostic $CLASS cannot spend fallback budget without reported primary cost" bash -c "test '$PLAIN_RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 1 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/plain-$CLASS/receipt.json')\" = budget_exhausted"
done

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf untrusted-event | SVC_FAKE_MODE=failure SVC_FAKE_TOP_LEVEL_CODE=provider_overload SVC_FAKE_DIAGNOSTIC='proxy reports overload maybe' node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/untrusted-event" > "$TMP/untrusted-event.summary" 2> "$TMP/untrusted-event.err"
UNTRUSTED_EVENT_RC=$?
set -e
expect "model-authored top-level JSON type cannot authorize fallback" bash -c "test '$UNTRUSTED_EVENT_RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 1 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/untrusted-event/receipt.json')\" = unknown_provider"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf timeout-package | SVC_FAKE_MODE=sleep SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/timeout" > "$TMP/timeout.summary" 2> "$TMP/timeout.err"
TIMEOUT_RC=$?
set -e
expect "timeout kills one Fable process and never falls back" bash -c "test '$TIMEOUT_RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 1 && grep -q 'timeout' '$TMP/timeout.err'"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf term-zero-package | SVC_FAKE_MODE=term-zero SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/term-zero-timeout" > "$TMP/term-zero-timeout.summary" 2> "$TMP/term-zero-timeout.err"
TERM_ZERO_RC=$?
set -e
expect "timeout remains authoritative when child handles SIGTERM with exit zero" bash -c "test '$TERM_ZERO_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/term-zero-timeout/receipt.json')\" = timeout"
expect "timeout escalation is cancelled when the child closes after SIGTERM" bash -c "rg -q 'if \(escalationTimer\) clearTimeout\(escalationTimer\)' '$LAUNCHER' && test \"\$(rg -c '^[[:space:]]+cleanup\(\);' '$LAUNCHER')\" -eq 2"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf codex-timeout | SVC_FAKE_MODE=sleep SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=1 node "$LAUNCHER" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/codex-timeout" > "$TMP/codex-timeout.summary" 2> "$TMP/codex-timeout.err"
CODEX_TIMEOUT_RC=$?
set -e
expect "Codex timeout terminates its single attempt with no substitution" bash -c "test '$CODEX_TIMEOUT_RC' -ne 0 && test \"\$(grep -c '^codex$' '$SVC_FAKE_LOG/calls')\" -eq 1 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/codex-timeout/receipt.json')\" = timeout"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf cancelled-provider | SVC_FAKE_MODE=sleep node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/cancelled-provider" > "$TMP/cancelled-provider.summary" 2> "$TMP/cancelled-provider.err" & CANCELLED_LAUNCHER_PID=$!
for _ in $(seq 1 100); do [[ -s "$SVC_FAKE_LOG/claude.pid" && -s "$SVC_FAKE_LOG/calls" ]] && break; sleep 0.02; done
CANCELLED_PROVIDER_PID="$(cat "$SVC_FAKE_LOG/claude.pid")"
kill -TERM "$CANCELLED_LAUNCHER_PID"
wait "$CANCELLED_LAUNCHER_PID"
CANCELLED_RC=$?
set -e
expect "launcher cancellation terminates the detached provider and emits a classified receipt" bash -c "test '$CANCELLED_RC' -ne 0 && ! kill -0 '$CANCELLED_PROVIDER_PID' 2>/dev/null && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/cancelled-provider/receipt.json')\" = cancelled && test -z \"\$(find '$TMP/cache/locks' -name '*.lock' -print -quit)\""

for CLASS_DIAG in 'model_entitlement|not entitled' 'provider_overload|provider overloaded'; do
  CLASS="${CLASS_DIAG%%|*}"; DIAGNOSTIC="${CLASS_DIAG#*|}"
  rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
  SVC_FAKE_MODE=failure SVC_FAKE_CODE="$CLASS" SVC_FAKE_FAILURE_COST=0 SVC_FAKE_DIAGNOSTIC="$DIAGNOSTIC" run_review codex "$CLASS-package" "$TMP/out/$CLASS" > "$TMP/$CLASS.summary"
  expect "$CLASS launches exactly one separate Opus fallback" bash -c "test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 2 && test \"\$(tail -n 1 '$SVC_FAKE_LOG/calls')\" = claude-opus-4-8"
done

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf fallback-fail | SVC_FAKE_MODE=failure SVC_FAKE_CODE=model_unavailable SVC_FAKE_FAILURE_COST=0 SVC_FAKE_DIAGNOSTIC='model unavailable' SVC_FAKE_OPUS_MODE=failure node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/fallback-fail" > "$TMP/fallback-fail.summary" 2> "$TMP/fallback-fail.err"
FALLBACK_FAIL_RC=$?
set -e
expect "failed fallback stops after exactly two attempts" bash -c "test '$FALLBACK_FAIL_RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 2 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/fallback-fail/receipt.json')\" = fallback_failed"

for FAILURE in schema model; do
  rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
  set +e
  if [[ "$FAILURE" == schema ]]; then
    printf schema-package | SVC_FAKE_OUTPUT=malformed node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/schema" > "$TMP/schema.summary" 2> "$TMP/schema.err"
  else
    printf model-package | SVC_FAKE_RUNTIME_MODEL=claude-wrong-model node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/model" > "$TMP/model.summary" 2> "$TMP/model.err"
  fi
  RC=$?
  set -e
  EXPECTED="$([[ "$FAILURE" == schema ]] && printf schema_invalid || printf model_mismatch)"
  expect "$EXPECTED hard-fails without Opus" bash -c "test '$RC' -ne 0 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls')\" -eq 1 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/$FAILURE/receipt.json')\" = '$EXPECTED'"
done

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf capability | SVC_FAKE_CAPABILITY_MISSING=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/capability" > "$TMP/capability.summary" 2> "$TMP/capability.err"
CAPABILITY_RC=$?
set -e
expect "missing CLI controls produce one consolidated hard failure and zero paid calls" bash -c "test '$CAPABILITY_RC' -ne 0 && test ! -e '$SVC_FAKE_LOG/calls' && test \"\$(wc -l < '$TMP/capability.err')\" -eq 1 && grep -q 'missing .*--print.*--effort' '$TMP/capability.err'"
expect "pre-invocation capability failure records no fabricated invocation tuple and preserves CLI evidence" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(r.invocation_tuple!==null||r.effective_tuple!==null||r.attempts.length!==0||r.cli_version!=="2.1.210 (Claude Code)"||!r.artifacts.capabilities||!fs.existsSync(r.artifacts.capabilities))process.exit(1)' "$TMP/out/capability/receipt.json"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf hidden-max-turns | SVC_FAKE_REJECT_MAX_TURNS=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/hidden-max-turns" > "$TMP/hidden-max-turns.summary" 2> "$TMP/hidden-max-turns.err"
HIDDEN_MAX_TURNS_RC=$?
set -e
expect "parser rejection of help-hidden max-turns hard-fails before paid invocation" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[2]!=="1"||r.classification!=="capability"||r.attempts.length!==0||fs.existsSync(process.argv[3]))process.exit(1)' "$TMP/out/hidden-max-turns/receipt.json" "$HIDDEN_MAX_TURNS_RC" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf codex-unavailable | SVC_FAKE_CAPABILITY_MISSING=1 node "$LAUNCHER" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/codex-unavailable" > "$TMP/codex-unavailable.summary" 2> "$TMP/codex-unavailable.err"
CODEX_UNAVAILABLE_RC=$?
set -e
expect "unavailable Codex primary hard-fails with zero paid calls and no substitution" bash -c "test '$CODEX_UNAVAILABLE_RC' -ne 0 && test ! -e '$SVC_FAKE_LOG/calls' && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/codex-unavailable/receipt.json')\" = capability"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf codex-model-unavailable | SVC_FAKE_MODE=failure SVC_FAKE_DIAGNOSTIC='model unavailable' node "$LAUNCHER" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/codex-model-unavailable" > "$TMP/codex-model-unavailable.summary" 2> "$TMP/codex-model-unavailable.err"
CODEX_MODEL_UNAVAILABLE_RC=$?
set -e
expect "Codex primary model-unavailable hard-fails after one attempt with no substitution" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[2]!=="1"||fs.readFileSync(process.argv[3],"utf8").trim()!=="codex"||r.classification!=="model_unavailable"||r.attempts.length!==1||r.fallback.used)process.exit(1)' "$TMP/out/codex-model-unavailable/receipt.json" "$CODEX_MODEL_UNAVAILABLE_RC" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
OVERRIDE="$TMP/owner-override.json"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({authority:"repository-owner",source:"owner-console",reason:"explicit test override",timestamp:new Date().toISOString(),requested_tuple:{orchestrator:"codex",host:"claude",family:"anthropic",model:"claude-fable-5",effort:"xhigh"}}))' "$OVERRIDE"
OVERRIDE_SHA="$(sha256sum "$OVERRIDE" | awk '{print $1}')"
printf override-package | SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256="$OVERRIDE_SHA" node "$LAUNCHER" --orchestrator codex --review-kind plan --owner-override-file "$OVERRIDE" --artifacts-dir "$TMP/out/override" > "$TMP/override.summary"
expect "hashed repository-owner override can raise primary effort and is receipted" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);if(!r.override.used||r.override.authority!=="repository-owner"||r.override.actual_sha256!==r.override.expected_sha256||r.requested_tuple.effort!=="xhigh"||r.fallback.used)process.exit(1)' "$TMP/override.summary"
SVC_FAKE_MODE=success run_review codex "override-package" "$TMP/out/override-primary-high" > "$TMP/override-primary-high.summary"
expect "changed requested tuple gets a distinct cache identity and fresh primary invocation" test "$(grep -c '^claude-fable-5$' "$SVC_FAKE_LOG/calls")" -eq 2

SAME_FAMILY_OVERRIDE="$TMP/same-family-owner-override.json"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({authority:"repository-owner",source:"owner-console",reason:"same-family negative fixture",timestamp:new Date().toISOString(),requested_tuple:{orchestrator:"claude",host:"claude",family:"anthropic",model:"claude-fable-5",effort:"high"}}))' "$SAME_FAMILY_OVERRIDE"
SAME_FAMILY_SHA="$(sha256sum "$SAME_FAMILY_OVERRIDE" | awk '{print $1}')"
rm -rf "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG"
set +e
printf same-family | SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256="$SAME_FAMILY_SHA" node "$LAUNCHER" --orchestrator claude --review-kind plan --owner-override-file "$SAME_FAMILY_OVERRIDE" --artifacts-dir "$TMP/out/same-family-override" > "$TMP/same-family-override.summary" 2> "$TMP/same-family-override.err"
SAME_FAMILY_RC=$?
set -e
expect "owner override cannot defeat cross-family independence or unlock fallback" bash -c "test '$SAME_FAMILY_RC' -ne 0 && test ! -e '$SVC_FAKE_LOG/calls' && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/same-family-override/receipt.json')\" = override_invalid"

DIRECT_OPUS_OVERRIDE="$TMP/direct-opus-owner-override.json"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({authority:"repository-owner",source:"owner-console",reason:"direct fallback bypass negative fixture",timestamp:new Date().toISOString(),requested_tuple:{orchestrator:"codex",host:"claude",family:"anthropic",model:"claude-opus-4-8",effort:"xhigh"}}))' "$DIRECT_OPUS_OVERRIDE"
DIRECT_OPUS_SHA="$(sha256sum "$DIRECT_OPUS_OVERRIDE" | awk '{print $1}')"
rm -rf "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG"
set +e
printf direct-opus | SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256="$DIRECT_OPUS_SHA" node "$LAUNCHER" --orchestrator codex --review-kind plan --owner-override-file "$DIRECT_OPUS_OVERRIDE" --artifacts-dir "$TMP/out/direct-opus-override" > "$TMP/direct-opus-override.summary" 2> "$TMP/direct-opus-override.err"
DIRECT_OPUS_RC=$?
set -e
expect "owner override cannot bypass mandatory Fable-first policy with direct Opus" bash -c "test '$DIRECT_OPUS_RC' -ne 0 && test ! -e '$SVC_FAKE_LOG/calls' && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/direct-opus-override/receipt.json')\" = override_invalid"

EXTRA_KEY_OVERRIDE="$TMP/extra-key-owner-override.json"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({authority:"repository-owner",source:"owner-console",reason:"extra tuple key negative fixture",timestamp:new Date().toISOString(),requested_tuple:{orchestrator:"codex",host:"claude",family:"anthropic",model:"claude-fable-5",effort:"high",surprise:true}}))' "$EXTRA_KEY_OVERRIDE"
EXTRA_KEY_SHA="$(sha256sum "$EXTRA_KEY_OVERRIDE" | awk '{print $1}')"
set +e
printf extra-key | SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256="$EXTRA_KEY_SHA" node "$LAUNCHER" --orchestrator codex --review-kind plan --owner-override-file "$EXTRA_KEY_OVERRIDE" --artifacts-dir "$TMP/out/extra-key-override" > "$TMP/extra-key-override.summary" 2> "$TMP/extra-key-override.err"
EXTRA_KEY_RC=$?
set -e
expect "override tuple rejects extra keys and still emits schema-valid receipt" node -e 'const r=require(process.argv[1]);if(process.argv[2]!=="1"||r.classification!=="override_invalid")process.exit(1)' "$TMP/out/extra-key-override/receipt.json" "$EXTRA_KEY_RC"

set +e
printf unreadable-override | SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256=expected node "$LAUNCHER" --orchestrator codex --review-kind plan --owner-override-file "$TMP/does-not-exist.json" --artifacts-dir "$TMP/out/unreadable-override" > "$TMP/unreadable-override.summary" 2> "$TMP/unreadable-override.err"
UNREADABLE_OVERRIDE_RC=$?
set -e
expect "unreadable override records attempted path and expected hash" node -e 'const r=require(process.argv[1]);if(process.argv[2]!=="1"||r.classification!=="override_invalid"||!r.override.used||!r.override.path.endsWith("does-not-exist.json")||r.override.expected_sha256!=="expected")process.exit(1)' "$TMP/out/unreadable-override/receipt.json" "$UNREADABLE_OVERRIDE_RC"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf bad-override | SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256=deadbeef node "$LAUNCHER" --orchestrator codex --review-kind plan --owner-override-file "$OVERRIDE" --artifacts-dir "$TMP/out/bad-override" > "$TMP/bad-override.summary" 2> "$TMP/bad-override.err"
BAD_OVERRIDE_RC=$?
set -e
expect "untrusted override hard-fails before provider and records both hashes" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[2]!=="1"||fs.existsSync(process.argv[3])||r.classification!=="override_invalid"||r.override.expected_sha256!=="deadbeef"||!r.override.actual_sha256)process.exit(1)' "$TMP/out/bad-override/receipt.json" "$BAD_OVERRIDE_RC" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "same-bytes" "$TMP/out/kind-plan" > "$TMP/kind-plan.summary"
printf same-bytes | node "$LAUNCHER" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/kind-exec" > "$TMP/kind-exec.summary"
expect "cache never reuses findings across review kinds" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 2
SVC_FAKE_MODE=success run_review claude "same-bytes" "$TMP/out/kind-plan-again" > "$TMP/kind-plan-again.summary"
expect "review kind participates in the cache key without cross-kind eviction" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 2

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "corrupt-cache" "$TMP/out/corrupt-1" > "$TMP/corrupt-1.summary"
CACHE_ENTRY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache.entry)' "$TMP/corrupt-1.summary")"
node -e 'const fs=require("fs"),p=process.argv[1],r=require(p);r.fallback.used=true;fs.writeFileSync(p,JSON.stringify(r))' "$CACHE_ENTRY/receipt.json"
SVC_FAKE_MODE=success run_review claude "corrupt-cache" "$TMP/out/corrupt-2" > "$TMP/corrupt-2.summary"
expect "semantically corrupt cache receipt is never reusable" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 2
SVC_FAKE_MODE=success run_review claude "corrupt-cache" "$TMP/out/corrupt-3" > "$TMP/corrupt-3.summary"
expect "valid replay atomically heals the corrupt cache entry" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 2
expect "receipt semantic validator explicitly rejects primary tuple drift success hard-failure and malformed fallback binding" bash -c "rg -q 'exact primary routes require matching requested, invoked, and effective tuples' '$LAUNCHER' && rg -q 'successes cannot use hard_failure' '$LAUNCHER' && rg -q 'launcher fallback must bind requested primary and final fallback attempt tuples' '$LAUNCHER'"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "semantic-cache" "$TMP/out/semantic-cache-1" > "$TMP/semantic-cache-1.summary"
SEMANTIC_ENTRY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache.entry)' "$TMP/semantic-cache-1.summary")"
node -e 'const fs=require("fs"),p=process.argv[1],r=require(p);r.launcher_version="corrupt-old-version";r.fixture_mode=false;r.attempts=[];fs.writeFileSync(p,JSON.stringify(r))' "$SEMANTIC_ENTRY/receipt.json"
SVC_FAKE_MODE=success run_review claude "semantic-cache" "$TMP/out/semantic-cache-2" > "$TMP/semantic-cache-2.summary"
expect "cache rejects launcher-version, fixture-mode, and attempt-semantic laundering" bash -c "test \"\$(grep -c '^codex$' '$SVC_FAKE_LOG/calls')\" -eq 2 && test \"\$(node -e 'const fs=require(\"fs\"),s=JSON.parse(fs.readFileSync(process.argv[1],\"utf8\"));process.stdout.write(require(s.receipt).classification)' '$TMP/semantic-cache-2.summary')\" = success"

rm -rf "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG"
SVC_FAKE_MODE=success run_review claude "binding-source" "$TMP/out/binding-source" > "$TMP/binding-source.summary"
SOURCE_ENTRY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache.entry)' "$TMP/binding-source.summary")"
SVC_FAKE_MODE=success run_review claude "binding-target" "$TMP/out/binding-target-seed" > "$TMP/binding-target-seed.summary"
TARGET_ENTRY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache.entry)' "$TMP/binding-target-seed.summary")"
rm -rf "$TARGET_ENTRY"; cp -a "$SOURCE_ENTRY" "$TARGET_ENTRY"
SVC_FAKE_MODE=success run_review claude "binding-target" "$TMP/out/binding-target" > "$TMP/binding-target.summary"
expect "cache replay is bound to key and package/schema hashes" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 3

rm -rf "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/runtime-copy"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/runtime-copy/scripts/lib" "$TMP/runtime-copy/schemas" "$TMP/runtime-copy/references" "$TMP/runtime-copy/skills/review-exec" "$TMP/runtime-copy/skills/review-cross-model" "$TMP/runtime-copy/hooks/lib" "$TMP/runtime-copy/skills/research/scripts"
cp "$LAUNCHER" "$TMP/runtime-copy/scripts/run-external-review.mjs"
cp "$ROOT/scripts/review-topology-v2.mjs" "$TMP/runtime-copy/scripts/review-topology-v2.mjs"
cp "$ROOT/scripts/resolve-dispatch.mjs" "$TMP/runtime-copy/scripts/resolve-dispatch.mjs"
cp "$ROOT/scripts/lib/json-schema-validator.mjs" "$ROOT/scripts/lib/external-review-provenance.mjs" "$ROOT/scripts/lib/review-evidence-store.mjs" "$TMP/runtime-copy/scripts/lib/"
cp "$ROOT/skills/research/scripts/dispatch-agy.mjs" "$TMP/runtime-copy/skills/research/scripts/dispatch-agy.mjs"
cp "$ROOT/hooks/lib/wi-id.mjs" "$TMP/runtime-copy/hooks/lib/wi-id.mjs"
cp "$ROOT/schemas/external-review-findings.schema.json" "$ROOT/schemas/external-review-receipt.schema.json" "$ROOT/schemas/review-station-receipt-v2.schema.json" "$ROOT/schemas/dispatch-policy.schema.json" "$TMP/runtime-copy/schemas/"
cp "$ROOT/references/model-registry.json" "$TMP/runtime-copy/references/"
cp "$ROOT/skills/review-exec/SKILL.md" "$TMP/runtime-copy/skills/review-exec/"
cp "$ROOT/skills/review-cross-model/SKILL.md" "$TMP/runtime-copy/skills/review-cross-model/"
printf schema-version-key | node "$TMP/runtime-copy/scripts/run-external-review.mjs" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/key-schema-1" > "$TMP/key-schema-1.summary"
printf '\n' >> "$TMP/runtime-copy/schemas/external-review-findings.schema.json"
printf schema-version-key | node "$TMP/runtime-copy/scripts/run-external-review.mjs" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/key-schema-2" > "$TMP/key-schema-2.summary"
sed -i 's/const LAUNCHER_VERSION = '\''2.4.0'\''/const LAUNCHER_VERSION = '\''2.4.1'\''/' "$TMP/runtime-copy/scripts/run-external-review.mjs"
printf schema-version-key | node "$TMP/runtime-copy/scripts/run-external-review.mjs" --orchestrator claude --review-kind exec --artifacts-dir "$TMP/out/key-launcher-2" > "$TMP/key-launcher-2.summary"
expect "changed findings schema and launcher version each force a fresh cache key" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 3

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "expired-hit" "$TMP/out/expired-hit-seed" > "$TMP/expired-hit-seed.summary"
EXPIRED_ENTRY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache.entry)' "$TMP/expired-hit-seed.summary")"
node -e 'const fs=require("fs"),p=process.argv[1],r=require(p);r.finished_at=new Date(Date.now()-40*86400000).toISOString();fs.writeFileSync(p,JSON.stringify(r))' "$EXPIRED_ENTRY/receipt.json"
SVC_FAKE_MODE=success run_review claude "expired-hit" "$TMP/out/expired-hit-refresh" > "$TMP/expired-hit-refresh.summary"
expect "cache TTL is enforced on lookup even when GC has not run" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 2

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf blocked > "$TMP/cache/staging"
SVC_FAKE_MODE=success run_review claude "publish-failure" "$TMP/out/publish-failure" > "$TMP/publish-failure.summary"
expect "cache publication failure preserves successful findings without reusable-cache claim" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);if(!s.ok||s.cache_disposition!=="not_reusable"||r.status!=="success"||r.cache.reusable||!r.artifacts.cache_publish_error)process.exit(1)' "$TMP/publish-failure.summary"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
(SVC_FAKE_DELAY_SECONDS=0.3 run_review claude "concurrent-package" "$TMP/out/concurrent-1" > "$TMP/concurrent-1.summary") & P1=$!
(SVC_FAKE_DELAY_SECONDS=0.3 run_review claude "concurrent-package" "$TMP/out/concurrent-2" > "$TMP/concurrent-2.summary") & P2=$!
wait "$P1" "$P2"
expect "per-key lock collapses concurrent identical requests to one provider call" test "$(grep -c '^codex$' "$SVC_FAKE_LOG/calls")" -eq 1

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf orphan-guard | SVC_EXTERNAL_REVIEW_GUARD_STALE_MS=100 SVC_EXTERNAL_REVIEW_LOCK_GUARD_HOLD_MS=5000 node "$LAUNCHER" --orchestrator claude --review-kind plan --artifacts-dir "$TMP/out/orphan-guard-killed" > "$TMP/orphan-guard-killed.summary" 2> "$TMP/orphan-guard-killed.err" & ORPHAN_GUARD_PID=$!
ORPHAN_GUARD=''
for _ in $(seq 1 100); do ORPHAN_GUARD="$(find "$TMP/cache/locks" -name '*.lock.guard' -type d -print -quit 2>/dev/null || true)"; [[ -n "$ORPHAN_GUARD" && -s "$ORPHAN_GUARD/owner.json" ]] && break; sleep 0.02; done
kill -KILL "$ORPHAN_GUARD_PID"
wait "$ORPHAN_GUARD_PID"
ORPHAN_GUARD_RC=$?
set -e
SVC_EXTERNAL_REVIEW_GUARD_STALE_MS=100 SVC_FAKE_MODE=success run_review claude "orphan-guard" "$TMP/out/orphan-guard-recovered" > "$TMP/orphan-guard-recovered.summary"
expect "crashed mutation-guard owner is identity-reclaimed without wedging the content key" bash -c "test '$ORPHAN_GUARD_RC' -ne 0 && test \"\$(grep -c '^codex$' '$SVC_FAKE_LOG/calls')\" -eq 1 && test -z \"\$(find '$TMP/cache/locks' -name '*.lock.guard' -print -quit)\""

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "lock-seed" "$TMP/out/lock-seed" > "$TMP/lock-seed.summary"
LOCK_KEY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache_key)' "$TMP/lock-seed.summary")"
rm -rf "$TMP/cache/$LOCK_KEY" "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache/locks/$LOCK_KEY.lock"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:"foreign-host",pid:999999,process_start_token:"old",owner_token:"guarded-stale",heartbeat_at:new Date(Date.now()-800000).toISOString()}))' "$TMP/cache/locks/$LOCK_KEY.lock/owner.json"
(SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=5 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=70 SVC_EXTERNAL_REVIEW_LOCK_GUARD_HOLD_MS=150 run_review claude "lock-seed" "$TMP/out/guard-race-1" > "$TMP/guard-race-1.summary") & GUARD_P1=$!
(SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=5 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=70 SVC_EXTERNAL_REVIEW_LOCK_GUARD_HOLD_MS=150 run_review claude "lock-seed" "$TMP/out/guard-race-2" > "$TMP/guard-race-2.summary") & GUARD_P2=$!
wait "$GUARD_P1" "$GUARD_P2"
expect "mutation guard serializes stale takeover, ownership writes, release, and cache publication" bash -c "test \"\$(grep -c '^codex$' '$SVC_FAKE_LOG/calls')\" -eq 1 && test -z \"\$(find '$TMP/cache/locks' -name '*.lock' -print -quit)\""

rm -rf "$TMP/cache/$LOCK_KEY" "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache/locks/$LOCK_KEY.lock"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:"foreign-host",pid:999999,process_start_token:"old",owner_token:"foreign-stale",heartbeat_at:new Date(Date.now()-800000).toISOString()}))' "$TMP/cache/locks/$LOCK_KEY.lock/owner.json"
SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=5 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=70 SVC_FAKE_MODE=success run_review claude "lock-seed" "$TMP/out/foreign-stale" > "$TMP/foreign-stale.summary"
expect "stale foreign-host lock is reclaimed after the validated age bound" grep -qx codex "$SVC_FAKE_LOG/calls"

rm -rf "$TMP/cache/$LOCK_KEY" "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache/locks/$LOCK_KEY.lock"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:require("os").hostname(),pid:Number(process.argv[2]),process_start_token:"pid-reused-token",owner_token:"same-host-stale",heartbeat_at:new Date(Date.now()-800000).toISOString()}))' "$TMP/cache/locks/$LOCK_KEY.lock/owner.json" "$$"
SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=5 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=70 SVC_FAKE_MODE=success run_review claude "lock-seed" "$TMP/out/pid-reuse" > "$TMP/pid-reuse.summary"
expect "same-host stale lock with mismatched process-start token is reclaimed" grep -qx codex "$SVC_FAKE_LOG/calls"

rm -rf "$TMP/cache/$LOCK_KEY" "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache/locks/$LOCK_KEY.lock"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:require("os").hostname(),pid:99999999,process_start_token:"dead-process-token",owner_token:"same-host-dead",heartbeat_at:new Date(Date.now()-800000).toISOString()}))' "$TMP/cache/locks/$LOCK_KEY.lock/owner.json"
SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=5 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=70 SVC_FAKE_MODE=success run_review claude "lock-seed" "$TMP/out/same-host-dead" > "$TMP/same-host-dead.summary"
expect "same-host stale lock owned by a dead process is reclaimed" grep -qx codex "$SVC_FAKE_LOG/calls"

rm -rf "$TMP/cache/$LOCK_KEY" "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache/locks/$LOCK_KEY.lock"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:"foreign-malformed-heartbeat",pid:99999999,process_start_token:"dead",owner_token:"malformed-heartbeat",heartbeat_at:"not-a-date"}))' "$TMP/cache/locks/$LOCK_KEY.lock/owner.json"
touch -d '40 days ago' "$TMP/cache/locks/$LOCK_KEY.lock"
SVC_FAKE_MODE=success run_review claude "lock-seed" "$TMP/out/malformed-heartbeat" > "$TMP/malformed-heartbeat.summary"
expect "malformed heartbeat falls back to lock mtime for bounded reclaim" grep -qx codex "$SVC_FAKE_LOG/calls"

rm -rf "$TMP/cache/$LOCK_KEY" "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache/locks/$LOCK_KEY.lock"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:"foreign-live",pid:999999,process_start_token:"foreign",owner_token:"foreign-young",heartbeat_at:new Date().toISOString()}))' "$TMP/cache/locks/$LOCK_KEY.lock/owner.json"
set +e
printf lock-seed | timeout 0.5s env SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=1 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=62 node "$LAUNCHER" --orchestrator claude --review-kind plan --artifacts-dir "$TMP/out/foreign-young" > "$TMP/foreign-young.summary" 2> "$TMP/foreign-young.err"
FOREIGN_YOUNG_RC=$?
set -e
expect "young foreign-host lock is never reclaimed or allowed to spawn" bash -c "test '$FOREIGN_YOUNG_RC' -eq 124 && test ! -e '$SVC_FAKE_LOG/calls' && grep -q 'foreign-young' '$TMP/cache/locks/$LOCK_KEY.lock/owner.json'"
rm -rf "$TMP/cache/locks/$LOCK_KEY.lock"

rm -rf "$TMP/cache" "$SVC_FAKE_LOG"; mkdir -p "$TMP/cache" "$SVC_FAKE_LOG"
(SVC_FAKE_DELAY_SECONDS=0.5 SVC_EXTERNAL_REVIEW_HEARTBEAT_MS=50 run_review claude "heartbeat-package" "$TMP/out/heartbeat" > "$TMP/heartbeat.summary") & HEARTBEAT_PID=$!
OWNER_FILE=''
for _ in $(seq 1 20); do OWNER_FILE="$(find "$TMP/cache/locks" -path '*.lock/owner.json' -print -quit 2>/dev/null || true)"; [[ -n "$OWNER_FILE" ]] && break; sleep 0.02; done
HEARTBEAT_ONE="$(node -e 'process.stdout.write(require(process.argv[1]).heartbeat_at)' "$OWNER_FILE")"
sleep 0.15
HEARTBEAT_TWO="$(node -e 'process.stdout.write(require(process.argv[1]).heartbeat_at)' "$OWNER_FILE")"
wait "$HEARTBEAT_PID"
expect "lock owner heartbeat refreshes under the same owner token" test "$HEARTBEAT_ONE" != "$HEARTBEAT_TWO"

rm -rf "$SVC_FAKE_LOG"; mkdir -p "$SVC_FAKE_LOG"
set +e
printf bad-lock-config | SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS=5 SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS=60 node "$LAUNCHER" --orchestrator claude --review-kind plan --artifacts-dir "$TMP/out/bad-lock-config" > "$TMP/bad-lock-config.summary" 2> "$TMP/bad-lock-config.err"
BAD_LOCK_RC=$?
set -e
expect "invalid stale/timeout inequality is actionable config_invalid before spawn" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[2]!=="1"||r.classification!=="config_invalid"||fs.existsSync(process.argv[3]))process.exit(1)' "$TMP/out/bad-lock-config/receipt.json" "$BAD_LOCK_RC" "$SVC_FAKE_LOG/calls"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
SVC_EXTERNAL_REVIEW_HEARTBEAT_MS=bad node "$LAUNCHER" --validate-capabilities --orchestrator claude --artifacts-dir "$TMP/out/bad-heartbeat-config" > "$TMP/bad-heartbeat-config.summary" 2> "$TMP/bad-heartbeat-config.err"
BAD_HEARTBEAT_RC=$?
set -e
expect "invalid fixture heartbeat config fails before lock acquisition" bash -c "test '$BAD_HEARTBEAT_RC' -ne 0 && test ! -e '$SVC_FAKE_LOG/calls' && test -z \"\$(find '$TMP/cache/locks' -mindepth 1 -print -quit 2>/dev/null)\""

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
node "$LAUNCHER" --validate-capabilities --orchestrator claude --artifacts-dir "$TMP/out/capability-only" > "$TMP/capability-only.summary"
expect "documented capability-only mode records CLI evidence without claiming invocation" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);if(fs.existsSync(process.argv[2])||r.review_kind!=="capability-probe"||r.classification!=="success"||r.invocation_tuple!==null||r.effective_tuple!==null||r.cli_version!=="codex-cli-exec 0.144.4"||!fs.existsSync(r.artifacts.capabilities))process.exit(1)' "$TMP/capability-only.summary" "$SVC_FAKE_LOG/calls"

mkdir -p "$TMP/cache/expired" "$TMP/cache/held" "$TMP/cache/abandoned" "$TMP/cache/locks/held.lock" "$TMP/cache/locks/abandoned.lock" "$TMP/cache/locks/dead.lock.stale-12345678-1234-1234-1234-123456789abc"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({hostname:"foreign-dead",pid:999999,process_start_token:"dead",owner_token:"abandoned",heartbeat_at:new Date(Date.now()-40*86400000).toISOString()}))' "$TMP/cache/locks/abandoned.lock/owner.json"
touch -d '40 days ago' "$TMP/cache/expired" "$TMP/cache/held" "$TMP/cache/abandoned" "$TMP/cache/locks/abandoned.lock"
ln -s "$TMP/cache/expired" "$TMP/cache/do-not-follow"
node "$LAUNCHER" --gc-cache > "$TMP/gc.summary"
expect "cache GC removes expired unlocked entries" test ! -e "$TMP/cache/expired"
expect "cache GC preserves held entries and never follows symlinks" bash -c "test -d '$TMP/cache/held' && test -L '$TMP/cache/do-not-follow'"
expect "cache GC reclaims stale dead locks and their expired entries" bash -c "test ! -e '$TMP/cache/locks/abandoned.lock' && test ! -e '$TMP/cache/abandoned'"
expect "cache GC removes abandoned reclaim tombstones" test ! -e "$TMP/cache/locks/dead.lock.stale-12345678-1234-1234-1234-123456789abc"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
SVC_FAKE_MODE=success run_review claude "gc-race-package" "$TMP/out/gc-race-seed" > "$TMP/gc-race-seed.summary"
GC_RACE_ENTRY="$(node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=require(s.receipt);process.stdout.write(r.cache.entry)' "$TMP/gc-race-seed.summary")"
GC_RACE_KEY="$(basename "$GC_RACE_ENTRY")"
touch -d '40 days ago' "$GC_RACE_ENTRY"
(SVC_EXTERNAL_REVIEW_GC_HOLD_MS=300 node "$LAUNCHER" --gc-cache > "$TMP/gc-race.summary") & GC_PID=$!
for _ in $(seq 1 100); do [[ -e "$TMP/cache/locks/$GC_RACE_KEY.lock/owner.json" ]] && break; sleep 0.01; done
(SVC_FAKE_MODE=success run_review claude "gc-race-package" "$TMP/out/gc-race-republish" > "$TMP/gc-race-republish.summary") & REPUBLISH_PID=$!
wait "$GC_PID"
wait "$REPUBLISH_PID"
SVC_FAKE_MODE=success run_review claude "gc-race-package" "$TMP/out/gc-race-hit" > "$TMP/gc-race-hit.summary"
expect "cache GC serializes deletion with republish and preserves the fresh replacement" bash -c "test \"\$(grep -c '^codex$' '$SVC_FAKE_LOG/calls')\" -eq 2 && test -d '$GC_RACE_ENTRY' && test \"\$(node -e 'const fs=require(\"fs\"),s=JSON.parse(fs.readFileSync(process.argv[1],\"utf8\"));process.stdout.write(require(s.receipt).classification)' '$TMP/gc-race-hit.summary')\" = cache_hit"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf 'sentinel-before-cache\n' > "$TMP/cache-root-sentinel"
set +e
printf disabled | SVC_EXTERNAL_REVIEW_CACHE_DIR="$TMP/cache-root-sentinel" SVC_EXTERNAL_REVIEW_DISABLED=1 SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256=ignored node "$LAUNCHER" --orchestrator codex --review-kind plan --owner-override-file "$TMP/does-not-exist-and-must-be-ignored.json" --artifacts-dir "$TMP/out/disabled" > "$TMP/disabled.summary" 2> "$TMP/disabled.err"
DISABLED_RC=$?
printf '' | SVC_EXTERNAL_REVIEW_CACHE_DIR="$TMP/cache-root-sentinel" node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/empty" > "$TMP/empty.summary" 2> "$TMP/empty.err"
EMPTY_RC=$?
printf invalid-orchestrator | node "$LAUNCHER" --orchestrator unknown --review-kind plan --artifacts-dir "$TMP/out/invalid-orchestrator" > "$TMP/invalid-orchestrator.summary" 2> "$TMP/invalid-orchestrator.err"
INVALID_ORCHESTRATOR_RC=$?
set -e
expect "kill switch hard-fails before spawn" test "$DISABLED_RC" -ne 0
expect "empty stdin hard-fails before spawn" test "$EMPTY_RC" -ne 0
expect "invalid orchestrator hard-fails before spawn" test "$INVALID_ORCHESTRATOR_RC" -ne 0
expect "zero provider calls for disabled and empty" bash -c "test ! -e '$SVC_FAKE_LOG/calls'"
expect "kill switch ignores overrides and disabled/empty paths stop before cache access" grep -qx 'sentinel-before-cache' "$TMP/cache-root-sentinel"
expect "zero-provider terminal failures do not claim a provider invocation" node -e 'for(const p of process.argv.slice(1)){const r=require(p);if(r.invocation_tuple!==null||r.effective_tuple!==null||r.attempts.length!==0)process.exit(1)}' "$TMP/out/disabled/receipt.json" "$TMP/out/empty/receipt.json"
expect "invalid-input receipt uses null tuples instead of fabricated policy intent" node -e 'const r=require(process.argv[1]);if(r.requested_tuple!==null||r.invocation_tuple!==null)process.exit(1)' "$TMP/out/invalid-orchestrator/receipt.json"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/no-context"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache" "$TMP/no-context"
set +e
printf missing-context | SVC_EXTERNAL_REVIEW_CONTEXT_ROOT="$TMP/no-context" node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/missing-context" > "$TMP/missing-context.summary" 2> "$TMP/missing-context.err"
MISSING_CONTEXT_RC=$?
set -e
expect "missing target worktree instructions hard-fail before provider spawn" bash -c "test '$MISSING_CONTEXT_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/missing-context/receipt.json')\" = input_invalid && test \"\$(node -e 'process.stdout.write(String(require(process.argv[1]).attempts.length))' '$TMP/out/missing-context/receipt.json')\" = 0 && test ! -e '$SVC_FAKE_LOG/calls'"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
# The adapter now emits a WI-489 phase binding, so run it against a clean
# pre-execution fixture repo (resolvable origin/main, WI branch, no impl diff)
# to exercise the adapter -> launcher -> guard happy path end to end.
# -C-scoped fixture git helper (never cd-relative; never leaks identity to the real repo — WI-375)
fxgit() { git -C "$1" -c user.email=svc@example.com -c user.name=svc -c commit.gpgsign=false -c init.defaultBranch=main "${@:2}"; }
ADAPTER_REPO="$TMP/plan-adapter-repo"; rm -rf "$ADAPTER_REPO"; mkdir -p "$ADAPTER_REPO"
printf '# fixture context root\n' > "$ADAPTER_REPO/CLAUDE.md"
printf '# fixture plan\n' > "$ADAPTER_REPO/plan.md"
fxgit "$ADAPTER_REPO" init -q
fxgit "$ADAPTER_REPO" add -A
fxgit "$ADAPTER_REPO" commit -q -m base
fxgit "$ADAPTER_REPO" update-ref refs/remotes/origin/main HEAD
fxgit "$ADAPTER_REPO" checkout -q -b framework-WI-950-adapter
SVC_HOST=claude SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/plan-adapter" bash "$ROOT/scripts/review-plan-codex.sh" "$ADAPTER_REPO/plan.md" > "$TMP/plan-adapter.findings" 2> "$TMP/plan-adapter.err"
expect "plan adapter returns rubric-bearing shared findings and preserves launcher receipt" bash -c "node -e 'const fs=require(\"fs\"),f=JSON.parse(fs.readFileSync(process.argv[1],\"utf8\"));if(f.review_kind!==\"plan\"||f.rubric_score!==10)process.exit(1)' '$TMP/plan-adapter.findings' && grep -q 'receipt=' '$TMP/plan-adapter.err'"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf missing-rubric | SVC_FAKE_OMIT_RUBRIC=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --artifacts-dir "$TMP/out/missing-plan-rubric" > "$TMP/missing-plan-rubric.summary" 2> "$TMP/missing-plan-rubric.err"
MISSING_RUBRIC_RC=$?
set -e
expect "plan findings without the mandatory determinism rubric are rejected" bash -c "test '$MISSING_RUBRIC_RC' -ne 0 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).classification)' '$TMP/out/missing-plan-rubric/receipt.json')\" = schema_invalid"

printf '%s\n' '{"elements":[{"key":"req:a","content":"A"}]}' > "$TMP/blind.json"
printf '%s\n' '{"elements":[]}' > "$TMP/merged.json"
printf '%s\n' '[{"key":"req:a","change":"REMOVE"}]' > "$TMP/rows.json"
SVC_FAKE_CERT_KEY=req:a SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/blind-adapter" bash "$ROOT/scripts/blind-floor-judge.sh" --blind "$TMP/blind.json" --merged "$TMP/merged.json" --rows "$TMP/rows.json" --orchestrator-family anthropic > "$TMP/blind-adapter.json"
expect "blind-floor adapter maps shared certification and content-binds it" node -e 'const v=require(process.argv[1]),c=v.certifications[0];if(v.reviewer_family!=="openai"||!c.certified_strict_improvement||!c.for_content_sha||!v.external_review_receipt)process.exit(1)' "$TMP/blind-adapter.json"
SVC_FAKE_CERT_KEY=req:a SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/prompt-adapter" bash "$ROOT/scripts/prompt-floor-judge.sh" --blind "$TMP/blind.json" --merged "$TMP/merged.json" --rows "$TMP/rows.json" --orchestrator-family anthropic > "$TMP/prompt-adapter.json"
expect "prompt-floor adapter maps shared certification and content-binds it" node -e 'const v=require(process.argv[1]),c=v.certifications[0];if(v.reviewer_family!=="openai"||!c.certified_strict_improvement||!c.for_content_sha||!v.external_review_receipt)process.exit(1)' "$TMP/prompt-adapter.json"

# --- WI-489: phase-to-review-kind guard -------------------------------------
# A paid plan review is the RIGHT operation only BEFORE execute-changeset. Once
# execution has begun — proven by a durable exec-record OR by implementation
# files diverging from the bound pre-execution base — a plan review is refused
# before any provider spawn. The lane graph/status is never trusted; only
# durable receipt evidence and the implementation diff are.
make_phase_repo() {
  local repo="$1"; rm -rf "$repo"; mkdir -p "$repo/scripts" "$repo/docs"
  printf '# fixture context root\n' > "$repo/CLAUDE.md"
  printf 'export const impl = 1;\n' > "$repo/scripts/impl.mjs"
  fxgit "$repo" init -q
  fxgit "$repo" add -A
  fxgit "$repo" commit -q -m base
}

PLANSHA="$(printf '%064d' 1)"  # a valid sha256-shaped plan_manifest_sha256 (now required)

# F1 — pre-execution plan review is allowed (only exempt docs changed vs base)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_PRE="$TMP/phase-pre-repo"; make_phase_repo "$REPO_PRE"
BASE_PRE="$(fxgit "$REPO_PRE" rev-parse HEAD)"
printf '# plan\n' > "$REPO_PRE/docs/plan.md"
fxgit "$REPO_PRE" add -A
fxgit "$REPO_PRE" commit -q -m plan
printf '{"wi":"WI-901","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_PRE" "$PLANSHA" > "$TMP/binding-pre.json"
printf pre-exec-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_PRE" --phase-binding "$TMP/binding-pre.json" --artifacts-dir "$TMP/out/phase-pre" > "$TMP/phase-pre.summary" 2> "$TMP/phase-pre.err"
expect "pre-execution plan review is allowed and invokes the provider once" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!s.ok)process.exit(1);const r=JSON.parse(fs.readFileSync(s.receipt,"utf8"));if(r.classification!=="success"||r.phase_guard.applicable!==true||r.phase_guard.decision!=="allow"||r.phase_guard.wi!=="WI-901"||r.phase_guard.implementation_diverged!==false)process.exit(1);if(fs.readFileSync(process.argv[2],"utf8").split("\n").filter(Boolean).length!==1)process.exit(1);' "$TMP/phase-pre.summary" "$SVC_FAKE_LOG/calls"

# F1b — exact mandatory blend-external outputs remain planning evidence
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_BLEND="$TMP/phase-blend-repo"; make_phase_repo "$REPO_BLEND"
mkdir -p "$REPO_BLEND/references/knowledge/runtime-state-portability"
printf 'base notice\n' > "$REPO_BLEND/NOTICES"
printf '{}\n' > "$REPO_BLEND/references/blend-registry.json"
printf 'base\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/CAPABILITIES.md"
printf '1\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/.version"
printf '{}\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/capabilities.json"
printf '{"source":"base"}\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/sources.jsonl"
fxgit "$REPO_BLEND" add -A; fxgit "$REPO_BLEND" commit -q -m blend-base
BASE_BLEND="$(fxgit "$REPO_BLEND" rev-parse HEAD)"
printf 'credited source\n' > "$REPO_BLEND/NOTICES"
printf '{"updated":true}\n' > "$REPO_BLEND/references/blend-registry.json"
printf 'updated\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/CAPABILITIES.md"
printf '2\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/.version"
printf '{"updated":true}\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/capabilities.json"
printf '{"source":"updated"}\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/sources.jsonl"
printf '{"wi":"WI-907","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_BLEND" "$PLANSHA" > "$TMP/binding-blend.json"
printf blend-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_BLEND" --phase-binding "$TMP/binding-blend.json" --artifacts-dir "$TMP/out/phase-blend" > "$TMP/phase-blend.summary" 2> "$TMP/phase-blend.err"
expect "all mandatory blend evidence extensions remain pre-execution planning" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")),r=JSON.parse(fs.readFileSync(s.receipt,"utf8"));if(!s.ok||r.phase_guard.decision!=="allow"||r.phase_guard.implementation_diverged!==false||fs.readFileSync(process.argv[2],"utf8").trim().split(/\n/).length!==1)process.exit(1)' "$TMP/phase-blend.summary" "$SVC_FAKE_LOG/calls"

# Knowledge evidence path casing is exact. Case variants are implementation
# divergence on case-sensitive hosts and must never inherit the exemption.
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
mkdir -p "$REPO_BLEND/References/Knowledge/runtime-state-portability"
printf 'wrong-case evidence\n' > "$REPO_BLEND/References/Knowledge/runtime-state-portability/CASE.md"
set +e
printf wrong-case-knowledge | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_BLEND" --phase-binding "$TMP/binding-blend.json" --artifacts-dir "$TMP/out/phase-wrong-case-knowledge" > "$TMP/phase-wrong-case-knowledge.summary" 2> "$TMP/phase-wrong-case-knowledge.err"
PHASE_WRONG_CASE_RC=$?
set -e
expect "case-variant knowledge path remains implementation divergence" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[3]==="0"||r.classification!=="phase_violation"||!r.phase_guard.diverged_files.includes("References/Knowledge/runtime-state-portability/CASE.md")||fs.existsSync(process.argv[2]))process.exit(1)' "$TMP/out/phase-wrong-case-knowledge/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_WRONG_CASE_RC"
rm -rf "$REPO_BLEND/References"

# F1c — the exemption is exact: unrelated references remain implementation
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
mkdir -p "$REPO_BLEND/references/other"
printf 'implementation-like reference\n' > "$REPO_BLEND/references/other/runtime.md"
set +e
printf other-reference | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_BLEND" --phase-binding "$TMP/binding-blend.json" --artifacts-dir "$TMP/out/phase-other-reference" > "$TMP/phase-other-reference.summary" 2> "$TMP/phase-other-reference.err"
PHASE_OTHER_RC=$?
set -e
expect "unrelated references remain implementation divergence with zero provider calls" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[3]==="0"||r.classification!=="phase_violation"||r.phase_guard.reason!=="implementation_diverged"||fs.existsSync(process.argv[2]))process.exit(1)' "$TMP/out/phase-other-reference/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_OTHER_RC"

# F1d — executable files never inherit the knowledge-evidence exemption
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf 'export const executable = true;\n' > "$REPO_BLEND/references/knowledge/runtime-state-portability/probe.mjs"
set +e
printf executable-knowledge | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_BLEND" --phase-binding "$TMP/binding-blend.json" --artifacts-dir "$TMP/out/phase-executable-knowledge" > "$TMP/phase-executable-knowledge.summary" 2> "$TMP/phase-executable-knowledge.err"
PHASE_EXEC_KNOWLEDGE_RC=$?
set -e
expect "executable files under references/knowledge remain implementation divergence" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[3]==="0"||r.classification!=="phase_violation"||!r.phase_guard.diverged_files.includes("references/knowledge/runtime-state-portability/probe.mjs")||fs.existsSync(process.argv[2]))process.exit(1)' "$TMP/out/phase-executable-knowledge/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_EXEC_KNOWLEDGE_RC"

# F2 — post-execution plan review is refused with zero provider calls
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_POST="$TMP/phase-post-repo"; make_phase_repo "$REPO_POST"
BASE_POST="$(fxgit "$REPO_POST" rev-parse HEAD)"
printf 'export const impl = 2; // execution began\n' > "$REPO_POST/scripts/impl.mjs"
printf '{"wi":"WI-902","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_POST" "$PLANSHA" > "$TMP/binding-post.json"
set +e
printf post-exec-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_POST" --phase-binding "$TMP/binding-post.json" --artifacts-dir "$TMP/out/phase-post" > "$TMP/phase-post.summary" 2> "$TMP/phase-post.err"
PHASE_POST_RC=$?
set -e
expect "post-execution plan review is refused before any provider spawn" node -e 'const fs=require("fs");if(process.argv[3]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="phase_violation"||r.phase_guard.decision!=="reject"||r.phase_guard.reason!=="implementation_diverged"||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[2]))process.exit(1);' "$TMP/out/phase-post/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_POST_RC"
# F6 — a refused plan review runs no fallback loop
expect "a refused plan review runs no fallback loop" node -e 'const fs=require("fs"),r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.attempts.length!==0||r.fallback.used!==false||r.fallback.eligible!==false||r.route.kind!=="hard_failure")process.exit(1);' "$TMP/out/phase-post/receipt.json"

# F2b — rename detection must not hide an implementation source path when its
# destination happens to be phase-exempt. Test both staged and committed forms:
# Git's ordinary rename summary can otherwise report only docs/impl.mjs.
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_RENAME_STAGED="$TMP/phase-rename-staged-repo"; make_phase_repo "$REPO_RENAME_STAGED"
BASE_RENAME_STAGED="$(fxgit "$REPO_RENAME_STAGED" rev-parse HEAD)"
mv "$REPO_RENAME_STAGED/scripts/impl.mjs" "$REPO_RENAME_STAGED/docs/impl.mjs"
fxgit "$REPO_RENAME_STAGED" add -A
printf '{"wi":"WI-908","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_RENAME_STAGED" "$PLANSHA" > "$TMP/binding-rename-staged.json"
set +e
printf staged-rename-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_RENAME_STAGED" --phase-binding "$TMP/binding-rename-staged.json" --artifacts-dir "$TMP/out/phase-rename-staged" > "$TMP/phase-rename-staged.summary" 2> "$TMP/phase-rename-staged.err"
PHASE_RENAME_STAGED_RC=$?
set -e
expect "staged implementation-to-exempt rename remains implementation divergence" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[3]==="0"||r.classification!=="phase_violation"||r.phase_guard.reason!=="implementation_diverged"||!r.phase_guard.diverged_files.includes("scripts/impl.mjs")||fs.existsSync(process.argv[2]))process.exit(1)' "$TMP/out/phase-rename-staged/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_RENAME_STAGED_RC"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_RENAME_COMMITTED="$TMP/phase-rename-committed-repo"; make_phase_repo "$REPO_RENAME_COMMITTED"
BASE_RENAME_COMMITTED="$(fxgit "$REPO_RENAME_COMMITTED" rev-parse HEAD)"
mv "$REPO_RENAME_COMMITTED/scripts/impl.mjs" "$REPO_RENAME_COMMITTED/docs/impl.mjs"
fxgit "$REPO_RENAME_COMMITTED" add -A
fxgit "$REPO_RENAME_COMMITTED" commit -q -m 'move implementation into exempt path'
printf '{"wi":"WI-909","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_RENAME_COMMITTED" "$PLANSHA" > "$TMP/binding-rename-committed.json"
set +e
printf committed-rename-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_RENAME_COMMITTED" --phase-binding "$TMP/binding-rename-committed.json" --artifacts-dir "$TMP/out/phase-rename-committed" > "$TMP/phase-rename-committed.summary" 2> "$TMP/phase-rename-committed.err"
PHASE_RENAME_COMMITTED_RC=$?
set -e
expect "committed implementation-to-exempt rename remains implementation divergence" node -e 'const fs=require("fs"),r=require(process.argv[1]);if(process.argv[3]==="0"||r.classification!=="phase_violation"||r.phase_guard.reason!=="implementation_diverged"||!r.phase_guard.diverged_files.includes("scripts/impl.mjs")||fs.existsSync(process.argv[2]))process.exit(1)' "$TMP/out/phase-rename-committed/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_RENAME_COMMITTED_RC"

# F3 — a frozen exec review over the same diverged tree is allowed
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf frozen-exec | node "$LAUNCHER" --orchestrator codex --review-kind exec --context-root "$REPO_POST" --phase-binding "$TMP/binding-post.json" --artifacts-dir "$TMP/out/phase-exec" > "$TMP/phase-exec.summary" 2> "$TMP/phase-exec.err"
expect "frozen exec review over the diverged tree is allowed and records the binding" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!s.ok)process.exit(1);const r=JSON.parse(fs.readFileSync(s.receipt,"utf8"));if(r.classification!=="success"||r.review_kind!=="exec"||r.phase_guard.decision==="reject"||r.phase_guard.wi!=="WI-902")process.exit(1);' "$TMP/phase-exec.summary"

# F4 — a durable exec-record refuses the plan review even when the lane graph lies
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_FORGE="$TMP/phase-forge-repo"; make_phase_repo "$REPO_FORGE"
BASE_FORGE="$(fxgit "$REPO_FORGE" rev-parse HEAD)"
mkdir -p "$REPO_FORGE/.svc/receipts/staging/deadbeef"
printf '{"receipt_type":"exec-record","wi":"WI-903","tree_hash":"x"}\n' > "$REPO_FORGE/.svc/receipts/staging/deadbeef/exec-record.json"
printf '{"wi":"WI-903","phase":"planning","status":"in_progress"}\n' > "$REPO_FORGE/.svc/lane-tasks-WI-903.json"
printf '{"wi":"WI-903","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_FORGE" "$PLANSHA" > "$TMP/binding-forge.json"
set +e
printf forged-plan | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_FORGE" --phase-binding "$TMP/binding-forge.json" --artifacts-dir "$TMP/out/phase-forge" > "$TMP/phase-forge.summary" 2> "$TMP/phase-forge.err"
PHASE_FORGE_RC=$?
set -e
expect "a durable exec-record refuses a plan review even when the lane graph claims planning" node -e 'const fs=require("fs");if(process.argv[3]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="phase_violation"||r.phase_guard.decision!=="reject"||r.phase_guard.reason!=="exec_record_present"||r.phase_guard.exec_record_present!==true||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[2]))process.exit(1);' "$TMP/out/phase-forge/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_FORGE_RC"

# F5 — a receipted repository-owner retro-plan override permits the plan review
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
PHASE_OVERRIDE="$TMP/phase-override.json"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({authority:"repository-owner",source:"owner-console",reason:"retro documentation correction reopen",kind:"retro-plan-review",wi:"WI-902",timestamp:new Date().toISOString()}))' "$PHASE_OVERRIDE"
PHASE_OVERRIDE_SHA="$(sha256sum "$PHASE_OVERRIDE" | awk '{print $1}')"
printf override-plan | SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_SHA256="$PHASE_OVERRIDE_SHA" node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_POST" --phase-binding "$TMP/binding-post.json" --phase-override-file "$PHASE_OVERRIDE" --artifacts-dir "$TMP/out/phase-override" > "$TMP/phase-override.summary" 2> "$TMP/phase-override.err"
expect "receipted repository-owner retro-plan override permits the plan review and is recorded" node -e 'const fs=require("fs"),s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!s.ok)process.exit(1);const r=JSON.parse(fs.readFileSync(s.receipt,"utf8"));if(r.classification!=="success"||r.phase_guard.decision!=="allow-override"||r.phase_guard.override.used!==true||r.phase_guard.override.authority!=="repository-owner"||r.phase_guard.override.actual_sha256!==r.phase_guard.override.expected_sha256||r.phase_guard.override.kind!=="retro-plan-review")process.exit(1);' "$TMP/phase-override.summary"

# F7 — an unresolvable pre-execution base refuses the plan review before spawn
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf '{"wi":"WI-904","pre_execution_base":"0000000000000000000000000000000000000000","plan_manifest_sha256":"%s"}\n' "$PLANSHA" > "$TMP/binding-badbase.json"
set +e
printf bad-base | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_PRE" --phase-binding "$TMP/binding-badbase.json" --artifacts-dir "$TMP/out/phase-badbase" > "$TMP/phase-badbase.summary" 2>&1
PHASE_BADBASE_RC=$?
set -e
expect "an unresolvable pre-execution base refuses the plan review before spawn" node -e 'const fs=require("fs");if(process.argv[2]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="phase_violation"||r.phase_guard.reason!=="pre_execution_base_unresolved"||r.attempts.length!==0)process.exit(1);' "$TMP/out/phase-badbase/receipt.json" "$PHASE_BADBASE_RC"

# F8 — the require-phase-binding switch fail-closes a plan review with no binding
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
printf require-flag | SVC_EXTERNAL_REVIEW_REQUIRE_PHASE_BINDING=1 node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_PRE" --artifacts-dir "$TMP/out/phase-require" > "$TMP/phase-require.summary" 2>&1
PHASE_REQUIRE_RC=$?
set -e
expect "the require-phase-binding switch fail-closes a plan review with no binding" node -e 'const fs=require("fs");if(process.argv[2]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="phase_violation"||r.phase_guard.reason!=="phase_binding_missing"||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[3]))process.exit(1);' "$TMP/out/phase-require/receipt.json" "$PHASE_REQUIRE_RC" "$SVC_FAKE_LOG/calls"

# F9 — a plan binding without plan_manifest_sha256 is refused before spawn (EXTREV-EXEC-004)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
printf '{"wi":"WI-905","pre_execution_base":"%s"}\n' "$BASE_PRE" > "$TMP/binding-nohash.json"
set +e
printf no-hash | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_PRE" --phase-binding "$TMP/binding-nohash.json" --artifacts-dir "$TMP/out/phase-nohash" > "$TMP/phase-nohash.summary" 2>&1
PHASE_NOHASH_RC=$?
set -e
expect "a plan binding without plan_manifest_sha256 is refused before spawn" node -e 'const fs=require("fs");if(process.argv[3]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="phase_violation"||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[2]))process.exit(1);' "$TMP/out/phase-nohash/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_NOHASH_RC"

# F10 — a future-dated retro-plan override is rejected (no ~48h replay window) (EXTREV-EXEC-001)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
FUTURE_OVERRIDE="$TMP/phase-override-future.json"
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({authority:"repository-owner",source:"owner-console",reason:"future replay attempt",kind:"retro-plan-review",wi:"WI-902",timestamp:new Date(Date.now()+3600*1000).toISOString()}))' "$FUTURE_OVERRIDE"
FUTURE_OVERRIDE_SHA="$(sha256sum "$FUTURE_OVERRIDE" | awk '{print $1}')"
set +e
printf future-override | SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_SHA256="$FUTURE_OVERRIDE_SHA" node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_POST" --phase-binding "$TMP/binding-post.json" --phase-override-file "$FUTURE_OVERRIDE" --artifacts-dir "$TMP/out/phase-future-override" > "$TMP/phase-future-override.summary" 2>&1
PHASE_FUTURE_RC=$?
set -e
expect "a future-dated retro-plan override is rejected before any provider spawn" node -e 'const fs=require("fs");if(process.argv[3]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="override_invalid"||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[2]))process.exit(1);' "$TMP/out/phase-future-override/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_FUTURE_RC"

# F10b — every retro-plan trust field fails closed before provider spawn.
for INVALID_OVERRIDE_CASE in stale wrong-sha wrong-wi wrong-kind wrong-authority empty-source empty-reason; do
  rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
  INVALID_OVERRIDE="$TMP/phase-override-$INVALID_OVERRIDE_CASE.json"
  node - "$INVALID_OVERRIDE" "$INVALID_OVERRIDE_CASE" <<'NODE'
const fs = require('fs');
const [file, kind] = process.argv.slice(2);
const value = { authority:'repository-owner', source:'owner-console', reason:'bounded retro plan correction', kind:'retro-plan-review', wi:'WI-902', timestamp:new Date().toISOString() };
if (kind === 'stale') value.timestamp = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
if (kind === 'wrong-wi') value.wi = 'WI-999';
if (kind === 'wrong-kind') value.kind = 'routine-plan-review';
if (kind === 'wrong-authority') value.authority = 'agent';
if (kind === 'empty-source') value.source = '';
if (kind === 'empty-reason') value.reason = '';
fs.writeFileSync(file, JSON.stringify(value));
NODE
  INVALID_OVERRIDE_SHA="$(sha256sum "$INVALID_OVERRIDE" | awk '{print $1}')"
  if [[ "$INVALID_OVERRIDE_CASE" == wrong-sha ]]; then INVALID_OVERRIDE_SHA="$(printf '%064d' 0)"; fi
  set +e
  printf invalid-override | SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_SHA256="$INVALID_OVERRIDE_SHA" node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_POST" --phase-binding "$TMP/binding-post.json" --phase-override-file "$INVALID_OVERRIDE" --artifacts-dir "$TMP/out/phase-invalid-$INVALID_OVERRIDE_CASE" > "$TMP/phase-invalid-$INVALID_OVERRIDE_CASE.summary" 2>&1
  INVALID_OVERRIDE_RC=$?
  set -e
  expect "retro-plan override rejects $INVALID_OVERRIDE_CASE before provider spawn" node -e 'const fs=require("fs");if(process.argv[3]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="override_invalid"||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[2]))process.exit(1);' "$TMP/out/phase-invalid-$INVALID_OVERRIDE_CASE/receipt.json" "$SVC_FAKE_LOG/calls" "$INVALID_OVERRIDE_RC"
done

# F11 — an exec-record note on an ANCESTOR commit refuses the plan review even with no divergence and no mirror (EXTREV-EXEC-003)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_ANC="$TMP/phase-ancestor-repo"; make_phase_repo "$REPO_ANC"
BASE_ANC="$(fxgit "$REPO_ANC" rev-parse HEAD)"
printf 'export const impl = 2; // executed\n' > "$REPO_ANC/scripts/impl.mjs"
fxgit "$REPO_ANC" add -A; fxgit "$REPO_ANC" commit -q -m exec
EXEC_SHA="$(fxgit "$REPO_ANC" rev-parse HEAD)"
printf '{"exec-record":{"receipt_type":"exec-record","wi":"WI-906","tree_hash":"x"}}\n' > "$TMP/anc-note.json"
fxgit "$REPO_ANC" notes --ref refs/notes/svc-receipts add -F "$TMP/anc-note.json" "$EXEC_SHA"
printf 'export const impl = 1;\n' > "$REPO_ANC/scripts/impl.mjs"
printf '# after\n' > "$REPO_ANC/docs/after.md"
fxgit "$REPO_ANC" add -A; fxgit "$REPO_ANC" commit -q -m revert-and-docs
printf '{"wi":"WI-906","pre_execution_base":"%s","plan_manifest_sha256":"%s"}\n' "$BASE_ANC" "$PLANSHA" > "$TMP/binding-anc.json"
set +e
printf ancestor-note | node "$LAUNCHER" --orchestrator codex --review-kind plan --context-root "$REPO_ANC" --phase-binding "$TMP/binding-anc.json" --artifacts-dir "$TMP/out/phase-anc" > "$TMP/phase-anc.summary" 2>&1
PHASE_ANC_RC=$?
set -e
expect "an exec-record note on an ancestor commit refuses the plan review (durable note beats HEAD-only + no divergence)" node -e 'const fs=require("fs");if(process.argv[3]==="0")process.exit(1);const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(r.classification!=="phase_violation"||r.phase_guard.reason!=="exec_record_present"||r.phase_guard.exec_record_present!==true||r.attempts.length!==0)process.exit(1);if(fs.existsSync(process.argv[2]))process.exit(1);' "$TMP/out/phase-anc/receipt.json" "$SVC_FAKE_LOG/calls" "$PHASE_ANC_RC"

# F12 — the sanctioned adapter fails closed (exit 4, zero provider calls) when it cannot derive exactly one WI (EXTREV-EXEC-002)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_NOWI="$TMP/phase-nowi-repo"; rm -rf "$REPO_NOWI"; mkdir -p "$REPO_NOWI"
printf '# ctx\n' > "$REPO_NOWI/CLAUDE.md"; printf '# plan with no work item id\n' > "$REPO_NOWI/plan.md"
fxgit "$REPO_NOWI" init -q; fxgit "$REPO_NOWI" add -A; fxgit "$REPO_NOWI" commit -q -m base
set +e
SVC_HOST=claude SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/adapter-nowi" bash "$ROOT/scripts/review-plan-codex.sh" "$REPO_NOWI/plan.md" > "$TMP/adapter-nowi.out" 2> "$TMP/adapter-nowi.err"
ADAPTER_NOWI_RC=$?
set -e
expect "adapter fails closed with no provider call when no WI can be derived" bash -c "test '$ADAPTER_NOWI_RC' -eq 4 && test ! -e '$SVC_FAKE_LOG/calls' && grep -q 'cannot derive exactly one authoritative WI' '$TMP/adapter-nowi.err'"

# F13 — the sanctioned adapter fails closed when the WI is ambiguous (EXTREV-EXEC-002)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_MULTIWI="$TMP/phase-multiwi-repo"; rm -rf "$REPO_MULTIWI"; mkdir -p "$REPO_MULTIWI"
printf '# ctx\n' > "$REPO_MULTIWI/CLAUDE.md"; printf 'plan for WI-100 which depends on WI-200\n' > "$REPO_MULTIWI/plan.md"
fxgit "$REPO_MULTIWI" init -q; fxgit "$REPO_MULTIWI" add -A; fxgit "$REPO_MULTIWI" commit -q -m base
set +e
SVC_HOST=claude SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/adapter-multiwi" bash "$ROOT/scripts/review-plan-codex.sh" "$REPO_MULTIWI/plan.md" > "$TMP/adapter-multiwi.out" 2> "$TMP/adapter-multiwi.err"
ADAPTER_MULTIWI_RC=$?
set -e
expect "adapter fails closed with no provider call when the WI is ambiguous" bash -c "test '$ADAPTER_MULTIWI_RC' -eq 4 && test ! -e '$SVC_FAKE_LOG/calls'"

# F14 — the adapter fails closed when the branch WI disagrees with the plan's WI (EXTREV-EXEC-007)
rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
REPO_WIMISMATCH="$TMP/phase-wimismatch-repo"; rm -rf "$REPO_WIMISMATCH"; mkdir -p "$REPO_WIMISMATCH"
printf '# ctx\n' > "$REPO_WIMISMATCH/CLAUDE.md"; printf 'plan for WI-400\n' > "$REPO_WIMISMATCH/plan.md"
fxgit "$REPO_WIMISMATCH" init -q; fxgit "$REPO_WIMISMATCH" add -A; fxgit "$REPO_WIMISMATCH" commit -q -m base
fxgit "$REPO_WIMISMATCH" checkout -q -b framework-WI-300-stale
set +e
SVC_HOST=claude SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/adapter-wimismatch" bash "$ROOT/scripts/review-plan-codex.sh" "$REPO_WIMISMATCH/plan.md" > "$TMP/adapter-wimismatch.out" 2> "$TMP/adapter-wimismatch.err"
ADAPTER_WIMISMATCH_RC=$?
set -e
expect "adapter fails closed when the branch WI does not appear in the plan (stale/reused branch)" bash -c "test '$ADAPTER_WIMISMATCH_RC' -eq 4 && test ! -e '$SVC_FAKE_LOG/calls' && grep -q 'does not appear in the plan' '$TMP/adapter-wimismatch.err'"

# WI-559: named WI + owner-default multi-station Cursor transport
write_cursor_policy() {
  local file="$1"
  POLICY_OUT="$file" node <<'NODE'
const fs = require('fs');
const file = process.env.POLICY_OUT;
const labels = {
  STRAT: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
  PLAN: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
  EXEC: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
  REVIEW: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
  SENSE: { host: 'grok', family: 'xai', model: 'grok-code-fast', effort: 'high' },
  DISC: { host: 'grok', family: 'xai', model: 'web_search', effort: 'high' },
  PASS: { host: 'grok', family: 'xai', model: 'grok-code-fast', effort: 'high' }
};
const plan = {
  release_authority: true,
  stations: [
    { id: 'grok-self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' } },
    { id: 'fable', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'anthropic', model: 'claude-fable-5', effort: 'high' } },
    { id: 'sol-high', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } }
  ]
};
fs.writeFileSync(file, JSON.stringify({
  schema_version: 1,
  authority: 'repository-owner',
  default_mode: 'mixed-grok-cursor',
  modes: { 'mixed-grok-cursor': { labels, review: { plan, exec: plan } } }
}) + '\n', { mode: 0o600 });
NODE
  chmod 600 "$file"
}

CURSOR_POLICY="$TMP/cursor-dispatch-policy.json"
write_cursor_policy "$CURSOR_POLICY"
REPO_SCOUT="$TMP/named-wi-scout-repo"; rm -rf "$REPO_SCOUT"; mkdir -p "$REPO_SCOUT"
printf '# ctx\n' > "$REPO_SCOUT/CLAUDE.md"
cat > "$REPO_SCOUT/plan.md" <<'EOF'
# Scout capture durability plan

| Field | Value |
|---|---|
| **Work item:** | WI-SCOUT-CAPTURE-DURABILITY-01 |
EOF
fxgit "$REPO_SCOUT" init -q; fxgit "$REPO_SCOUT" add -A; fxgit "$REPO_SCOUT" commit -q -m base
fxgit "$REPO_SCOUT" update-ref refs/remotes/origin/main HEAD
fxgit "$REPO_SCOUT" checkout -q -b bugfix-WI-SCOUT-CAPTURE-DURABILITY-01

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$CURSOR_POLICY" SVC_REVIEWER_POLICY="$CURSOR_POLICY" \
  SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/adapter-named-default" \
  bash "$ROOT/scripts/review-plan-codex.sh" "$REPO_SCOUT/plan.md" > "$TMP/adapter-named-default.findings" 2> "$TMP/adapter-named-default.err"
ADAPTER_NAMED_DEFAULT_RC=$?
set -e
NAMED_DEFAULT_RECEIPT="$(grep -oE 'receipt=\S+' "$TMP/adapter-named-default.err" | tail -1 | sed 's/^receipt=//')"
expect "named WI with two independent stations and no mode override reaches exactly one resolver-selected fake reviewer" bash -c "test '$ADAPTER_NAMED_DEFAULT_RC' -eq 0 && test \"\$(grep -c '^cursor$' '$SVC_FAKE_LOG/calls' 2>/dev/null || printf 0)\" = 1 && test \"\$(wc -l < '$SVC_FAKE_LOG/calls' | tr -d ' ')\" = 1"
expect "default Cursor findings host matches the invoked tuple" node -e 'const fs=require("fs"),f=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(f.reviewer.host!=="cursor"||f.reviewer.family!=="anthropic"||f.review_kind!=="plan") process.exit(1)' "$TMP/adapter-named-default.findings"
expect "default Cursor receipt is schema-valid with equal exact tuples and requested_accepted or stronger attestation" node -e '
  const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const t=r.requested_tuple;
  if(r.status!=="success"||t.host!=="cursor"||t.family!=="anthropic"||t.model!=="claude-fable-5") process.exit(1);
  if(JSON.stringify(t)!==JSON.stringify(r.invocation_tuple)||JSON.stringify(t)!==JSON.stringify(r.effective_tuple)) process.exit(1);
  if(!["requested_accepted","server_observed"].includes(r.model_attestation.level)) process.exit(1);
  const argv=(r.attempts[0].command.argv||[]).slice(0,-1);
  const joined=argv.join(" ");
  if(!/--print/.test(joined)||!/--output-format/.test(joined)||!/--mode plan/.test(joined)||!/--sandbox enabled/.test(joined)||!/--model/.test(joined)) process.exit(1);
  if(/bypassPermissions|--yolo|--dangerously-skip-permissions/.test(joined)) process.exit(1);
' "$NAMED_DEFAULT_RECEIPT"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
set +e
SVC_HOST=codex SVC_DISPATCH_POLICY="$CURSOR_POLICY" SVC_REVIEWER_STATION=sol-high \
  SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/adapter-named-sol" \
  bash "$ROOT/scripts/review-plan-codex.sh" "$REPO_SCOUT/plan.md" > "$TMP/adapter-named-sol.findings" 2> "$TMP/adapter-named-sol.err"
ADAPTER_NAMED_SOL_RC=$?
set -e
NAMED_SOL_RECEIPT="$(grep -oE 'receipt=\S+' "$TMP/adapter-named-sol.err" | tail -1 | sed 's/^receipt=//')"
expect "explicit Cursor Sol station produces one fake Cursor call and an exact openai tuple receipt" bash -c "test '$ADAPTER_NAMED_SOL_RC' -eq 0 && test \"\$(grep -c '^cursor$' '$SVC_FAKE_LOG/calls' 2>/dev/null || printf 0)\" = 1"
expect "Sol findings and receipt stay on cursor/openai/gpt-5.6-sol" node -e '
  const fs=require("fs");
  const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const r=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  if(f.reviewer.host!=="cursor"||f.reviewer.family!=="openai") process.exit(1);
  if(r.requested_tuple.host!=="cursor"||r.requested_tuple.family!=="openai"||r.requested_tuple.model!=="gpt-5.6-sol") process.exit(1);
  if(!["requested_accepted","server_observed"].includes(r.model_attestation.level)) process.exit(1);
' "$TMP/adapter-named-sol.findings" "$NAMED_SOL_RECEIPT"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
export SVC_FAKE_FINDINGS_HOST=codex
set +e
SVC_HOST=codex SVC_DISPATCH_POLICY="$CURSOR_POLICY" SVC_REVIEWER_STATION=fable \
  SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/adapter-cursor-mismatch" \
  bash "$ROOT/scripts/review-plan-codex.sh" "$REPO_SCOUT/plan.md" > "$TMP/adapter-cursor-mismatch.out" 2> "$TMP/adapter-cursor-mismatch.err"
CURSOR_MISMATCH_RC=$?
set -e
unset SVC_FAKE_FINDINGS_HOST
expect "Cursor findings host mismatch fail-closes without review authorization" test "$CURSOR_MISMATCH_RC" -ne 0

expect "receipt and findings schemas admit cursor while retaining family enums" node -e '
  const receipt=require(process.argv[1]); const findings=require(process.argv[2]);
  if(!receipt.definitions.tuple.properties.host.enum.includes("cursor")) process.exit(1);
  if(!findings.properties.reviewer.properties.host.enum.includes("cursor")) process.exit(1);
  if(receipt.definitions.tuple.properties.orchestrator.enum.join(",")!=="claude,codex") process.exit(1);
' "$ROOT/schemas/external-review-receipt.schema.json" "$ROOT/schemas/external-review-findings.schema.json"

expect "Cursor success with attestation none remains semantically unauthorized" node --input-type=module -e "
  import { validateExternalReviewReceiptSemantics } from 'file://${LAUNCHER}';
  const tuple={orchestrator:'codex',host:'cursor',family:'anthropic',model:'claude-fable-5',effort:'high'};
  const receipt={status:'success',review_kind:'plan',classification:'success',requested_tuple:tuple,invocation_tuple:tuple,effective_tuple:tuple,attempts:[{}],protocol:{process_invocations:1},fallback:{used:false},route:{kind:'owner_config_primary',evidence:'requested_primary'},cache:{reusable:false},model_attestation:{level:'none',requested_model:'claude-fable-5',observed_models:[]},policy:{source:'owner-config'},candidate_digest:'a'.repeat(64),findings_sha256:'b'.repeat(64)};
  if(!validateExternalReviewReceiptSemantics(receipt).some((e)=>/model_attestation/.test(e))) process.exit(1);
"

rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"
export SVC_EXTERNAL_REVIEW_CONTEXT_ROOT="$ROOT"

if [[ "$RUNTIME_ONLY" != true ]]; then
  expect "active review sources have no obsolete codex profile/output-format example" bash -c "! rg -n 'codex -p .*--output-format|codex -p \"\\$\\(cat review-package' '$ROOT/review-cross-model' '$ROOT/review-plan' '$ROOT/review-exec'"
  expect "active review and judge sources contain no direct paid Claude/Codex command" bash -c "files=(); while IFS= read -r -d '' f; do files+=(\"\$f\"); done < <(find '$ROOT/scripts' -maxdepth 1 -type f \( -iname '*review*' -o -iname '*judge*' \) ! -name 'run-external-review.mjs' -print0); ! rg -n 'codex exec|claude (-p|--print)' \"\${files[@]}\" '$ROOT/review-cross-model' '$ROOT/review-plan' '$ROOT/review-exec'"
  expect "all active adapters name the canonical launcher" bash -c "rg -q 'run-external-review.mjs' '$ROOT/scripts/review-plan-codex.sh' && rg -q 'run-external-review.mjs' '$ROOT/scripts/blind-floor-judge.sh' && rg -q 'run-external-review.mjs' '$ROOT/scripts/prompt-floor-judge.sh'"
  expect "active review contracts contain no static always-Fable policy and explain provider route separation" bash -c "! rg -n 'Codex (orchestrator )?→ Fable 5/high|Codex-orchestrated review requests Fable 5/high' '$ROOT/skills/review-plan/SKILL.md' '$ROOT/skills/review-exec/SKILL.md' '$ROOT/skills/review-cross-model/SKILL.md' '$ROOT/references/plan-review-protocol.md' '$ROOT/CLAUDE.md' && rg -q 'same-process' '$ROOT/skills/review-cross-model/SKILL.md' '$ROOT/references/plan-review-protocol.md' '$ROOT/CLAUDE.md'"
fi

printf '\n  %s failed, %s passed\n' "$FAIL" "$PASS"
test "$FAIL" -eq 0
