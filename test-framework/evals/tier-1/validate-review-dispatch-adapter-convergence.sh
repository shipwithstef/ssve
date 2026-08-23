#!/usr/bin/env bash
# WI-559 hermetic original-failure and negative authorization matrix.
# Groups: bind review cursor helper execute  (default: all)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$ROOT/scripts/resolve-execute-dispatch.mjs"
ADAPTER="$ROOT/scripts/review-plan-codex.sh"
PREFLIGHT="$ROOT/scripts/execute-dispatch-preflight.sh"
WORKER="$ROOT/scripts/dispatch-worker.sh"
DISPATCH_LOG="$ROOT/scripts/dispatch-log.sh"
GUARD="$ROOT/hooks/svc-execute-dispatch-guard.sh"
LAUNCHER="$ROOT/scripts/run-external-review.mjs"

SELECTED_GROUPS="all"
if [[ "${1:-}" == "--groups" ]]; then
  SELECTED_GROUPS="${2:-all}"
  shift 2 || true
fi
if [[ -n "${SVC_WI559_GROUPS:-}" ]]; then
  SELECTED_GROUPS="$SVC_WI559_GROUPS"
fi
want() {
  if [ "$SELECTED_GROUPS" = all ]; then return 0; fi
  printf '%s\n' "$SELECTED_GROUPS" | tr ',' '\n' | grep -Fxq "$1"
}

TMP="$(mktemp -d)"
if [[ "${SVC_KEEP_TMP:-0}" != 1 ]]; then trap 'rm -rf "$TMP"' EXIT; else printf '  fixture tmp: %s\n' "$TMP"; fi
mkdir -p "$TMP/bin" "$TMP/log" "$TMP/policy" "$TMP/out"
chmod 700 "$TMP" "$TMP/bin" "$TMP/log" "$TMP/policy" "$TMP/out"

PASS=0
FAIL=0
ok() { printf '  ✓ %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  ✗ %s\n' "$1"; FAIL=$((FAIL + 1)); }
expect() { local label="$1"; shift; if "$@"; then ok "$label"; else bad "$label"; fi; }

fxgit() { git -C "$1" -c user.email=svc@example.com -c user.name=svc -c commit.gpgsign=false -c init.defaultBranch=main "${@:2}"; }

POLICY_JSON="$TMP/policy/dispatch-policy.json"
write_policy() {
  POLICY_JSON="$POLICY_JSON" node <<'NODE'
const fs = require('fs');
const file = process.env.POLICY_JSON;
const policy = {
  schema_version: 1,
  authority: 'repository-owner',
  default_mode: 'mixed-grok-cursor',
  modes: {
    'mixed-grok-cursor': {
      labels: {
        STRAT: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'xhigh' },
        PLAN: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        EXEC: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        REVIEW: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' },
        SENSE: { host: 'grok', family: 'xai', model: 'grok-code-fast', effort: 'high' },
        DISC: { host: 'grok', family: 'xai', model: 'web_search', effort: 'high' },
        PASS: { host: 'grok', family: 'xai', model: 'grok-code-fast', effort: 'high' }
      },
      review: {
        plan: {
          release_authority: true,
          stations: [
            { id: 'grok-self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' } },
            { id: 'fable', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'anthropic', model: 'claude-fable-5', effort: 'high' } },
            { id: 'sol-high', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } },
            { id: 'agy-gemini-3.7-high', kind: 'external', required: false, authority: 'independent', tuple: { host: 'agy', family: 'google', model: 'Gemini 3.7 Flash (High)', effort: 'high' }, fallback_only: true, explicit_request_only: true }
          ]
        },
        exec: {
          release_authority: true,
          stations: [
            { id: 'grok-self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'grok', family: 'xai', model: 'grok-4.6', effort: 'high' } },
            { id: 'fable', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'anthropic', model: 'claude-fable-5', effort: 'high' } },
            { id: 'sol-high', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } }
          ]
        }
      }
    },
    production: {
      labels: {
        STRAT: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' },
        PLAN: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' },
        EXEC: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' },
        REVIEW: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' },
        SENSE: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' },
        DISC: { host: 'codex', family: 'openai', model: 'web_search', effort: 'high' },
        PASS: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' }
      },
      review: {
        plan: {
          release_authority: true,
          stations: [
            { id: 'self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } },
            { id: 'independent', kind: 'external', required: true, authority: 'independent', tuple: { host: 'agy', family: 'google', model: 'Gemini 3.7 Flash (High)', effort: 'high' } }
          ]
        },
        exec: {
          release_authority: true,
          stations: [
            { id: 'self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'codex', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } },
            { id: 'independent', kind: 'external', required: true, authority: 'independent', tuple: { host: 'agy', family: 'google', model: 'Gemini 3.7 Flash (High)', effort: 'high' } }
          ]
        }
      }
    }
  }
};
fs.writeFileSync(file, JSON.stringify(policy, null, 2) + '\n', { mode: 0o600 });
NODE
  chmod 600 "$POLICY_JSON"
}

install_fakes() {
  cat > "$TMP/bin/cursor-agent" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' '--print --output-format json --mode plan --sandbox enabled --model --workspace'
  exit 0
fi
for arg in "$@"; do
  if [[ "$arg" == "--version" ]]; then printf '%s\n' '2026.08.11-e8db854'; exit 0; fi
done
mkdir -p "$SVC_FAKE_LOG"
printf '%s\n' "$*" >> "$SVC_FAKE_LOG/cursor.argv"
GROK_ARGV_JSON="$SVC_FAKE_LOG/cursor.argv.json" python3 -c 'import json,os,sys; p=os.environ["GROK_ARGV_JSON"]; json.dump(sys.argv[1:], open(p,"w"), separators=(",",":")); open(p,"a").write("\n")' -- "$@"
printf '%s\n' cursor >> "$SVC_FAKE_LOG/calls"
joined=" $* "
if [[ "$joined" == *"bypassPermissions"* || "$joined" == *" --force "* || "$joined" == *" --yolo "* || "$joined" == *"--dangerously-skip-permissions"* ]]; then
  printf '%s\n' 'forbidden approval mode' >&2
  exit 2
fi
model=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--model" ]]; then model="$2"; shift 2; else shift; fi
done
family="${SVC_FAKE_CURSOR_FAMILY:-}"
if [[ -z "$family" ]]; then
  if [[ "$model" == gpt-5.6-sol* ]]; then family=openai; else family=anthropic; fi
fi
host="${SVC_FAKE_FINDINGS_HOST:-cursor}"
effort="${SVC_FAKE_FINDINGS_EFFORT:-high}"
finding="$(H="$host" F="$family" M="${SVC_FAKE_FINDINGS_MODEL:-$model}" E="$effort" python3 -c 'import json,os; print(json.dumps({"schema_version":1,"review_kind":os.environ.get("SVC_REVIEW_KIND","plan"),"rubric_score":10,"rubric_failures":None,"dependencies_needing_read":None,"reviewer":{"host":os.environ["H"],"family":os.environ["F"],"model":os.environ["M"],"effort":os.environ["E"]},"verdict":"pass","summary":"fixture pass","findings":[],"certifications":[]}))')"
if [[ "${SVC_FAKE_MODE:-success}" != "success" ]]; then
  printf '%s\n' "${SVC_FAKE_DIAGNOSTIC:-authentication failed}" >&2
  exit 1
fi
result="$finding"
if [[ "${SVC_FAKE_CURSOR_FENCE:-0}" == 1 ]]; then
  result=$'```json\n'"$finding"$'\n```'
fi
if [[ "${SVC_FAKE_OUTPUT:-valid}" == malformed ]]; then
  printf '%s\n' '{"type":"result","is_error":false,"result":"{bad"}'
  exit 0
fi
python3 -c 'import json,os,sys; print(json.dumps({"type":"result","is_error":False,"result":sys.argv[1]}))' "$result"
FAKE
  cat > "$TMP/bin/grok" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' '--cwd --model --reasoning-effort --permission-mode auto --no-subagents --disable-web-search --single'
  exit 0
fi
mkdir -p "$SVC_FAKE_LOG"
printf '%s\n' "$*" >> "$SVC_FAKE_LOG/grok.argv"
GROK_ARGV_JSON="$SVC_FAKE_LOG/grok.argv.json" python3 -c 'import json,os,sys; p=os.environ["GROK_ARGV_JSON"]; json.dump(sys.argv[1:], open(p,"w"), separators=(",",":")); open(p,"a").write("\n")' -- "$@"
printf '%s\n' grok >> "$SVC_FAKE_LOG/calls"
joined=" $* "
if [[ "$joined" == *"bypassPermissions"* || "$joined" == *" --yolo "* || "$joined" == *"--dangerously-skip-permissions"* ]]; then
  printf '%s\n' 'forbidden permission bypass' >&2
  exit 2
fi
printf '%s\n' 'grok fixture ok'
FAKE
  cat > "$TMP/bin/agy" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' '--sandbox --mode plan --model --effort --add-dir --json-schema --output-format json --print-timeout --print'
  exit 0
fi
mkdir -p "$SVC_FAKE_LOG"
printf '%s\n' "$*" >> "$SVC_FAKE_LOG/agy.argv"
printf '%s\n' agy >> "$SVC_FAKE_LOG/calls"
printf '%s\n' '{"response":"{}","stats":{}}'
FAKE
  chmod 700 "$TMP/bin/cursor-agent" "$TMP/bin/grok" "$TMP/bin/agy"
}

write_policy
install_fakes

export PATH="$TMP/bin:$PATH"
export SVC_FAKE_LOG="$TMP/log"
export SVC_DISPATCH_POLICY="$POLICY_JSON"
export SVC_REVIEWER_POLICY="$POLICY_JSON"
export SVC_EXTERNAL_REVIEW_FIXTURE=1
export SVC_EXTERNAL_REVIEW_FIXTURE_ROOT="$TMP"
export SVC_EXTERNAL_REVIEW_CURSOR_BIN="$TMP/bin/cursor-agent"
export SVC_EXTERNAL_REVIEW_AGY_BIN="$TMP/bin/agy"
export SVC_EXTERNAL_REVIEW_CACHE_DIR="$TMP/cache"
export SVC_EXTERNAL_REVIEW_POLICY_DIR="$TMP/policy"
export SVC_EXTERNAL_REVIEW_CONTEXT_ROOT="$ROOT"
export SVC_HOST=codex
mkdir -p "$TMP/cache"
unset SVC_REVIEWER_MODE || true
unset SVC_REVIEWER_STATION || true

reset_log() { rm -rf "$SVC_FAKE_LOG" "$TMP/cache"; mkdir -p "$SVC_FAKE_LOG" "$TMP/cache"; }

call_count() {
  local name="${1:-}"
  if [[ ! -f "$SVC_FAKE_LOG/calls" ]]; then printf '0'; return; fi
  if [[ -z "$name" ]]; then wc -l < "$SVC_FAKE_LOG/calls" | tr -d ' '; return; fi
  grep -c "^$name$" "$SVC_FAKE_LOG/calls" 2>/dev/null || printf '0'
}
export -f call_count reset_log

make_plan_repo() {
  local repo="$1" branch="$2" wi="$3"
  rm -rf "$repo"
  mkdir -p "$repo/docs/plans/active" "$repo/.svc"
  printf '# ctx\n' > "$repo/CLAUDE.md"
  cat > "$repo/docs/plans/active/manifest.md" <<EOF
# Plan

| Field | Value |
|---|---|
| **Work item:** | ${wi} |

**Work item:** ${wi}
EOF
  fxgit "$repo" init -q
  fxgit "$repo" add -A
  fxgit "$repo" commit -q -m base
  fxgit "$repo" update-ref refs/remotes/origin/main HEAD
  fxgit "$repo" checkout -q -b "$branch"
}

write_review_log() {
  local file="$1" state="$2" wi="${3:-}"
  cat > "$file" <<EOF
review_kind: plan
wi: ${wi}
terminal_state: ${state}
unresolved_critical: 0
remaining_high: 0
EOF
}

bind() {
  node "$HELPER" bind-plan --repo "$1" --manifest "$2"
}

# ---------------------------------------------------------------------------
# bind
# ---------------------------------------------------------------------------
if want bind; then
  set +e
  printf '\n=== bind-plan identity ===\n'
  NUMERIC="$TMP/numeric-repo"
  make_plan_repo "$NUMERIC" bugfix-WI-559-numeric WI-559
  reset_log
  BIND_OUT="$(bind "$NUMERIC" "$NUMERIC/docs/plans/active/manifest.md")"
  expect "numeric WI-559 binds exactly" node -e 'const j=JSON.parse(process.argv[1]); if(j.schema_version!==1||j.wi!=="WI-559"||j.branch!=="bugfix-WI-559-numeric"||!j.manifest_sha256||j.manifest!=="docs/plans/active/manifest.md") process.exit(1)' "$BIND_OUT"
  BIND_OUT2="$(bind "$NUMERIC" "$NUMERIC/docs/plans/active/manifest.md")"
  expect "numeric bind is deterministic" bash -c "test -n \"$BIND_OUT\" && test \"$BIND_OUT\" = \"$BIND_OUT2\""
  expect "bind-plan never calls a provider" test "$(call_count)" = 0

  NAMED="$TMP/named-repo"
  make_plan_repo "$NAMED" bugfix-WI-SCOUT-CAPTURE-DURABILITY-01 WI-SCOUT-CAPTURE-DURABILITY-01
  BIND_NAMED="$(bind "$NAMED" "$NAMED/docs/plans/active/manifest.md")"
  expect "named WI-SCOUT-CAPTURE-DURABILITY-01 binds exactly" node -e 'const j=JSON.parse(process.argv[1]); if(j.wi!=="WI-SCOUT-CAPTURE-DURABILITY-01"||j.branch!=="bugfix-WI-SCOUT-CAPTURE-DURABILITY-01") process.exit(1)' "$BIND_NAMED"

  HEADER="$TMP/header-repo"
  make_plan_repo "$HEADER" bugfix-WI-559-header WI-559
  printf '# Plan\n\n**Work item:** WI-559\n' > "$HEADER/docs/plans/active/manifest.md"
  BIND_HEADER="$(bind "$HEADER" "$HEADER/docs/plans/active/manifest.md")"
  expect "structured Work item header binds" node -e 'const j=JSON.parse(process.argv[1]); if(j.wi!=="WI-559") process.exit(1)' "$BIND_HEADER"

  NOWI="$TMP/nowi-repo"
  make_plan_repo "$NOWI" feature-no-id WI-559
  printf '# plan with no work item id\n' > "$NOWI/docs/plans/active/manifest.md"
  fxgit "$NOWI" checkout -q -B main
  set +e
  bind "$NOWI" "$NOWI/docs/plans/active/manifest.md" > "$TMP/bind-nowi.out" 2> "$TMP/bind-nowi.err"
  BIND_NOWI_RC=$?
  set -e
  expect "missing WI exits 4 with zero provider calls" bash -c "test '$BIND_NOWI_RC' -eq 4 && test \"\$(cat '$SVC_FAKE_LOG/calls' 2>/dev/null | wc -l | tr -d ' ')\" = 0 && grep -q 'cannot derive exactly one authoritative WI' '$TMP/bind-nowi.err'"

  MULTI="$TMP/multi-repo"
  make_plan_repo "$MULTI" feature-multi WI-100
  fxgit "$MULTI" checkout -q -B main
  printf 'plan for WI-100 which depends on WI-200\n' > "$MULTI/docs/plans/active/manifest.md"
  set +e
  bind "$MULTI" "$MULTI/docs/plans/active/manifest.md" > "$TMP/bind-multi.out" 2> "$TMP/bind-multi.err"
  BIND_MULTI_RC=$?
  set -e
  expect "two distinct WIs exit 4 and name both candidates" bash -c "test '$BIND_MULTI_RC' -eq 4 && grep -q 'WI-100' '$TMP/bind-multi.err' && grep -q 'WI-200' '$TMP/bind-multi.err' && test ! -e '$SVC_FAKE_LOG/calls' -o \"\$(call_count)\" = 0"

  MISMATCH="$TMP/mismatch-repo"
  make_plan_repo "$MISMATCH" framework-WI-300-stale WI-400
  printf 'plan for WI-400\n' > "$MISMATCH/docs/plans/active/manifest.md"
  set +e
  bind "$MISMATCH" "$MISMATCH/docs/plans/active/manifest.md" > "$TMP/bind-mismatch.out" 2> "$TMP/bind-mismatch.err"
  BIND_MISMATCH_RC=$?
  set -e
  expect "branch/manifest mismatch exits 4 before provider use" bash -c "test '$BIND_MISMATCH_RC' -eq 4 && grep -qE 'does not appear in the plan|disagreement|WI-300' '$TMP/bind-mismatch.err' && grep -q 'WI-400' '$TMP/bind-mismatch.err'"

  LOWER="$TMP/lower-repo"
  make_plan_repo "$LOWER" feature-lower WI-559
  fxgit "$LOWER" checkout -q -B main
  printf 'plan mentions wi-scout-capture-durability-01 only\n' > "$LOWER/docs/plans/active/manifest.md"
  set +e
  bind "$LOWER" "$LOWER/docs/plans/active/manifest.md" > "$TMP/bind-lower.out" 2> "$TMP/bind-lower.err"
  BIND_LOWER_RC=$?
  set -e
  expect "lowercase wi token is not a canonical candidate" test "$BIND_LOWER_RC" -eq 4

  TWOBRANCH="$TMP/twobranch-repo"
  make_plan_repo "$TWOBRANCH" bugfix-WI-100-and-WI-200 WI-100
  printf '**Work item:** WI-100\n' > "$TWOBRANCH/docs/plans/active/manifest.md"
  set +e
  bind "$TWOBRANCH" "$TWOBRANCH/docs/plans/active/manifest.md" > "$TMP/bind-twobranch.out" 2> "$TMP/bind-twobranch.err"
  BIND_TWOBRANCH_RC=$?
  set -e
  expect "two branch WI candidates exit 4" bash -c "test '$BIND_TWOBRANCH_RC' -eq 4 && grep -q 'WI-100' '$TMP/bind-twobranch.err' && grep -q 'WI-200' '$TMP/bind-twobranch.err'"
  set -e
fi

# ---------------------------------------------------------------------------
# review adapter
# ---------------------------------------------------------------------------
if want review; then
  set +e
  printf '\n=== review adapter selection ===\n'
  SCOUT="$TMP/scout-repo"
  make_plan_repo "$SCOUT" bugfix-WI-SCOUT-CAPTURE-DURABILITY-01 WI-SCOUT-CAPTURE-DURABILITY-01
  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_POLICY="$POLICY_JSON" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/default-mode" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/default-mode.findings" 2> "$TMP/default-mode.err"
  DEFAULT_RC=$?
  set -e
  expect "omitted mode uses owner default and makes exactly one fake reviewer call" bash -c "test '$DEFAULT_RC' -eq 0 && test \"\$(call_count cursor)\" = 1 && test \"\$(call_count)\" = 1"
  expect "default-mode findings stay schema-valid with cursor host" node -e 'const fs=require("fs"); const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(f.review_kind!=="plan"||f.reviewer.host!=="cursor"||f.reviewer.family!=="anthropic"||f.rubric_score!==10) process.exit(1)' "$TMP/default-mode.findings"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_MODE=mixed-grok-cursor SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/explicit-mode" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/explicit-mode.findings" 2> "$TMP/explicit-mode.err"
  EXPLICIT_MODE_RC=$?
  set -e
  expect "explicit configured mode remains supported" bash -c "test '$EXPLICIT_MODE_RC' -eq 0 && test \"\$(call_count cursor)\" = 1"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_MODE=not-a-mode SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/unknown-mode" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/unknown-mode.out" 2> "$TMP/unknown-mode.err"
  UNKNOWN_RC=$?
  set -e
  expect "unknown explicit mode fails closed with zero provider calls" bash -c "test '$UNKNOWN_RC' -ne 0 && test \"\$(call_count)\" = 0"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_MODE=mixed-grok-cursor SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/explicit-fable" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/explicit-fable.findings" 2> "$TMP/explicit-fable.err"
  FABLE_RC=$?
  set -e
  expect "explicit eligible fable station makes one Cursor call" bash -c "test '$FABLE_RC' -eq 0 && test \"\$(call_count cursor)\" = 1"
  expect "explicit fable findings host/family match invoked Cursor Anthropic tuple" node -e 'const fs=require("fs"); const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(f.reviewer.host!=="cursor"||f.reviewer.family!=="anthropic"||f.reviewer.model!=="claude-fable-5") process.exit(1)' "$TMP/explicit-fable.findings"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_MODE=mixed-grok-cursor SVC_REVIEWER_STATION=sol-high SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/explicit-sol" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/explicit-sol.findings" 2> "$TMP/explicit-sol.err"
  SOL_RC=$?
  set -e
  expect "explicit eligible sol station makes one Cursor call" bash -c "test '$SOL_RC' -eq 0 && test \"\$(call_count cursor)\" = 1"
  expect "explicit sol findings host/family match invoked Cursor OpenAI tuple" node -e 'const fs=require("fs"); const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(f.reviewer.host!=="cursor"||f.reviewer.family!=="openai"||f.reviewer.model!=="gpt-5.6-sol") process.exit(1)' "$TMP/explicit-sol.findings"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=missing-station SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/wrong-station" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/wrong-station.out" 2> "$TMP/wrong-station.err"
  WRONG_STATION_RC=$?
  set -e
  expect "wrong station fails closed with zero provider calls" bash -c "test '$WRONG_STATION_RC' -ne 0 && test \"\$(call_count)\" = 0"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=agy-gemini-3.7-high SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/optional-agy" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/optional-agy.out" 2> "$TMP/optional-agy.err"
  OPTIONAL_RC=$?
  set -e
  expect "optional/explicit-request station is rejected before provider invocation" bash -c "test '$OPTIONAL_RC' -ne 0 && test \"\$(call_count)\" = 0"

  NUM="$TMP/num-review-repo"
  make_plan_repo "$NUM" bugfix-WI-559-review WI-559
  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/numeric-review" \
    bash "$ADAPTER" "$NUM/docs/plans/active/manifest.md" > "$TMP/numeric-review.findings" 2> "$TMP/numeric-review.err"
  NUM_RC=$?
  set -e
  expect "numeric WI-559 review adapter binds and invokes once" bash -c "test '$NUM_RC' -eq 0 && test \"\$(call_count cursor)\" = 1"
  set -e
fi

# ---------------------------------------------------------------------------
# cursor transport / receipt
# ---------------------------------------------------------------------------
if want cursor; then
  set +e
  printf '\n=== Cursor transport and receipt schema ===\n'
  SCOUT="$TMP/cursor-scout-repo"
  make_plan_repo "$SCOUT" bugfix-WI-SCOUT-CAPTURE-DURABILITY-01 WI-SCOUT-CAPTURE-DURABILITY-01
  PLANSHA="$(sha256sum "$SCOUT/docs/plans/active/manifest.md" | awk '{print $1}')"

  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-fable" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-fable.findings" 2> "$TMP/cursor-fable.err"
  CURSOR_FABLE_RC=$?
  set -e
  RECEIPT_FABLE="$(grep -oE 'receipt=\S+' "$TMP/cursor-fable.err" | tail -1 | sed 's/^receipt=//')"
  expect "owner-selected cursor/anthropic/claude-fable-5 passes findings and exact receipt" bash -c "test '$CURSOR_FABLE_RC' -eq 0 && test -n '$RECEIPT_FABLE' && test \"\$(call_count cursor)\" = 1"
  expect "fable receipt tuples are equal and cursor host is schema-valid" node -e '
    const fs=require("fs");
    const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const t=r.requested_tuple;
    if(r.status!=="success") process.exit(1);
    if(!t||t.host!=="cursor"||t.family!=="anthropic"||t.model!=="claude-fable-5") process.exit(1);
    if(JSON.stringify(t)!==JSON.stringify(r.invocation_tuple)||JSON.stringify(t)!==JSON.stringify(r.effective_tuple)) process.exit(1);
    if(!["requested_accepted","server_observed"].includes(r.model_attestation.level)||r.model_attestation.level==="none") process.exit(1);
    if(!Array.isArray(r.attempts[0]?.command?.argv)) process.exit(1);
    const argv=r.attempts[0].command.argv.slice(0,-1);
    const joined=argv.join(" ");
    if(!argv.includes("--print")||!argv.includes("--output-format")||!argv.includes("json")||!argv.includes("--mode")||!argv.includes("plan")||!argv.includes("--sandbox")||!argv.includes("enabled")||!argv.includes("--model")) process.exit(1);
    if(/bypassPermissions|--yolo|--force\b|--dangerously-skip-permissions/.test(joined)) process.exit(1);
  ' "$RECEIPT_FABLE"

  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=sol-high SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-sol" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-sol.findings" 2> "$TMP/cursor-sol.err"
  CURSOR_SOL_RC=$?
  set -e
  RECEIPT_SOL="$(grep -oE 'receipt=\S+' "$TMP/cursor-sol.err" | tail -1 | sed 's/^receipt=//')"
  expect "owner-selected cursor/openai/gpt-5.6-sol passes findings and exact receipt" bash -c "test '$CURSOR_SOL_RC' -eq 0 && test -n '$RECEIPT_SOL' && test \"\$(call_count cursor)\" = 1"
  expect "sol receipt tuples are equal and attestation is requested_accepted or stronger" node -e '
    const fs=require("fs");
    const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    const t=r.requested_tuple;
    if(t.host!=="cursor"||t.family!=="openai"||t.model!=="gpt-5.6-sol") process.exit(1);
    if(JSON.stringify(t)!==JSON.stringify(r.invocation_tuple)||JSON.stringify(t)!==JSON.stringify(r.effective_tuple)) process.exit(1);
    if(!["requested_accepted","server_observed"].includes(r.model_attestation.level)) process.exit(1);
  ' "$RECEIPT_SOL"

  reset_log
  SVC_FAKE_CURSOR_FENCE=1
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-fence" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-fence.findings" 2> "$TMP/cursor-fence.err"
  FENCE_RC=$?
  set -e
  unset SVC_FAKE_CURSOR_FENCE
  expect "fenced Cursor result JSON still validates" test "$FENCE_RC" -eq 0

  reset_log
  export SVC_FAKE_FINDINGS_HOST=codex
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-mismatch" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-mismatch.out" 2> "$TMP/cursor-mismatch.err"
  MISMATCH_FINDINGS_RC=$?
  set -e
  unset SVC_FAKE_FINDINGS_HOST
  expect "mismatched findings host fail-closed with no review authorization" bash -c "test '$MISMATCH_FINDINGS_RC' -ne 0"

  expect "receipt schema admits cursor host" node -e 'const s=require(process.argv[1]); if(!s.definitions.tuple.properties.host.enum.includes("cursor")) process.exit(1); if(s.definitions.tuple.properties.orchestrator.enum.join(",")!=="claude,codex") process.exit(1);' "$ROOT/schemas/external-review-receipt.schema.json"
  expect "findings schema admits cursor host" node -e 'const s=require(process.argv[1]); if(!s.properties.reviewer.properties.host.enum.includes("cursor")) process.exit(1);' "$ROOT/schemas/external-review-findings.schema.json"

  expect "Cursor success with attestation none is semantically invalid" node --input-type=module -e "
    import { validateExternalReviewReceiptSemantics } from 'file://${LAUNCHER}';
    const tuple = { orchestrator:'codex', host:'cursor', family:'anthropic', model:'claude-fable-5', effort:'high' };
    const receipt = {
      status:'success', review_kind:'plan', classification:'success',
      requested_tuple: tuple, invocation_tuple: tuple, effective_tuple: tuple,
      attempts:[{}], protocol:{process_invocations:1}, fallback:{used:false},
      route:{kind:'owner_config_primary', evidence:'requested_primary'},
      cache:{reusable:false},
      model_attestation:{level:'none', requested_model:'claude-fable-5', observed_models:[]},
      policy:{source:'owner-config'}, candidate_digest:'a'.repeat(64), findings_sha256:'b'.repeat(64)
    };
    const errors = validateExternalReviewReceiptSemantics(receipt);
    if(!errors.some((e)=>/model_attestation/.test(e))) process.exit(1);
  "

  expect "Cursor+google family is semantically invalid on success" node --input-type=module -e "
    import { validateExternalReviewReceiptSemantics } from 'file://${LAUNCHER}';
    const tuple = { orchestrator:'codex', host:'cursor', family:'google', model:'claude-fable-5', effort:'high' };
    const receipt = {
      status:'success', review_kind:'plan', classification:'success',
      requested_tuple: tuple, invocation_tuple: tuple, effective_tuple: tuple,
      attempts:[{}], protocol:{process_invocations:1}, fallback:{used:false},
      route:{kind:'owner_config_primary', evidence:'requested_primary'},
      cache:{reusable:false},
      model_attestation:{level:'requested_accepted', requested_model:'claude-fable-5', observed_models:[]},
      policy:{source:'owner-config'}, candidate_digest:'a'.repeat(64), findings_sha256:'b'.repeat(64)
    };
    const errors = validateExternalReviewReceiptSemantics(receipt);
    if(!errors.some((e)=>/family|host/.test(e))) process.exit(1);
  "
  set -e
fi

# ---------------------------------------------------------------------------
# helper preflight / verify-receipt
# ---------------------------------------------------------------------------
if want helper; then
  set +e
  printf '\n=== shared helper preflight and receipts ===\n'
  EXEC_REPO="$TMP/exec-repo"
  make_plan_repo "$EXEC_REPO" bugfix-WI-559-exec WI-559
  write_review_log "$EXEC_REPO/docs/plans/active/review-log.yaml" PROMOTED WI-559
  UNRELATED="$EXEC_REPO/docs/plans/older"
  mkdir -p "$UNRELATED"
  printf '# older\n\n**Work item:** WI-100\n' > "$UNRELATED/manifest.md"
  write_review_log "$UNRELATED/review-log.yaml" PROMOTED WI-100
  mkdir -p "$EXEC_REPO/docs/plans/done/archived"
  printf '# done\n\n**Work item:** WI-559\n' > "$EXEC_REPO/docs/plans/done/archived/manifest.md"
  write_review_log "$EXEC_REPO/docs/plans/done/archived/review-log.yaml" DRAFTED WI-559

  PRE_JSON="$(node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex)"
  expect "preflight emits compact schema-2 Grok EXEC tuple for exact WI" node -e '
    const j=JSON.parse(process.argv[1]);
    if(j.schema_version!==2||j.decision!=="dispatch"||j.wi!=="WI-559") process.exit(1);
    if(j.host!=="grok"||j.family!=="xai"||j.model!=="grok-4.6"||j.effort!=="high") process.exit(1);
    if(j.mode!=="mixed-grok-cursor"||!j.policy_sha256||!j.review_log_sha256) process.exit(1);
    if(!String(j.review_log||"").includes("docs/plans/active/review-log.yaml")) process.exit(1);
    if(String(j.review_log||"").includes("docs/plans/done")) process.exit(1);
  ' "$PRE_JSON"
  PRE_JSON2="$(node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex)"
  expect "preflight is deterministic" test "$PRE_JSON" = "$PRE_JSON2"

  DRAFT_REPO="$TMP/draft-repo"
  make_plan_repo "$DRAFT_REPO" bugfix-WI-559-draft WI-559
  write_review_log "$DRAFT_REPO/docs/plans/active/review-log.yaml" DRAFTED WI-559
  set +e
  node "$HELPER" preflight --repo "$DRAFT_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-draft.out" 2> "$TMP/pre-draft.err"
  DRAFT_RC=$?
  set -e
  expect "non-authorized terminal state is denied" bash -c "test '$DRAFT_RC' -ne 0 && ! grep -q not-required '$TMP/pre-draft.out' && ! grep -q DISPATCH= '$TMP/pre-draft.out'"

  ZERO_REPO="$TMP/zero-log-repo"
  make_plan_repo "$ZERO_REPO" bugfix-WI-559-nolog WI-559
  set +e
  node "$HELPER" preflight --repo "$ZERO_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-zero.out" 2> "$TMP/pre-zero.err"
  ZERO_RC=$?
  set -e
  expect "zero active logs deny preflight" test "$ZERO_RC" -ne 0

  DUP="$TMP/dup-log-repo"
  make_plan_repo "$DUP" bugfix-WI-559-dup WI-559
  mkdir -p "$DUP/docs/plans/other"
  printf '# other\n\n**Work item:** WI-559\n' > "$DUP/docs/plans/other/manifest.md"
  write_review_log "$DUP/docs/plans/active/review-log.yaml" PROMOTED WI-559
  write_review_log "$DUP/docs/plans/other/review-log.yaml" PROMOTED WI-559
  set +e
  node "$HELPER" preflight --repo "$DUP" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-dup.out" 2> "$TMP/pre-dup.err"
  DUP_RC=$?
  set -e
  expect "two matching active logs deny preflight" test "$DUP_RC" -ne 0

  OVERRIDE="$TMP/override.yaml"
  printf 'accept: true\nreason: bounded owner override for WI-559 fixture\n' > "$OVERRIDE"
  chmod 600 "$OVERRIDE"
  OV_JSON="$(node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE")"
  expect "accepted override prints owner-override without inventing a tuple" node -e '
    const j=JSON.parse(process.argv[1]);
    if(j.decision!=="owner-override"||j.wi!=="WI-559"||!j.override_sha256||!j.reason||!j.review_log_sha256) process.exit(1);
    if(j.host||j.model||j.family||j.effort) process.exit(1);
  ' "$OV_JSON"

  HASHES="$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write([j.policy_sha256,j.review_log_sha256,j.host,j.family,j.model,j.effort,j.mode].join(" "))' "$PRE_JSON")"
  read -r POLICY_SHA REVIEW_SHA HOST FAMILY MODEL EFFORT MODE <<<"$HASHES"
  mkdir -p "$EXEC_REPO/.svc"
  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" HOST="$HOST" FAMILY="$FAMILY" MODEL="$MODEL" EFFORT="$EFFORT" MODE="$MODE" node <<'NODE'
const fs = require('fs');
const file = process.env.LOG_FILE;
const { POLICY_SHA: policy, REVIEW_SHA: review, HOST: host, FAMILY: family, MODEL: model, EFFORT: effort, MODE: mode } = process.env;
const now = new Date().toISOString();
const rows = [
  '{not-json',
  JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-100', decision: 'dispatch', skill: 'execute-changeset', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 0 }),
  JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'dispatch', skill: 'review-plan', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 0 }),
  JSON.stringify({ ts: now, harness: 'opencode', model: 'mimo-v2-pro', skill: 'execute-changeset', exit_code: 0 }),
  JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 9, exit_code: 0, log_path: '/tmp/x' })
];
fs.writeFileSync(file, rows.join('\n') + '\n');
NODE
  VERIFY="$(node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --max-age-seconds 21600)"
  expect "verify-receipt accepts recent exact schema-2 Grok row and ignores malformed/legacy/other-WI" node -e 'const j=JSON.parse(process.argv[1]); if(j.ok!==true&&j.decision!=="dispatch") process.exit(1);' "$VERIFY"

  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" HOST="$HOST" FAMILY="$FAMILY" MODEL="$MODEL" EFFORT="$EFFORT" MODE="$MODE" node <<'NODE'
const fs = require('fs');
const file = process.env.LOG_FILE;
const { POLICY_SHA: policy, REVIEW_SHA: review, HOST: host, FAMILY: family, MODEL: model, EFFORT: effort, MODE: mode } = process.env;
const stale = new Date(Date.now() - 7 * 3600 * 1000).toISOString();
fs.writeFileSync(file, JSON.stringify({ schema_version: 2, ts: stale, wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 0 }) + '\n');
NODE
  set +e
  node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --max-age-seconds 21600 > "$TMP/verify-stale.out" 2> "$TMP/verify-stale.err"
  STALE_RC=$?
  set -e
  expect "stale receipt is denied" test "$STALE_RC" -ne 0

  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" HOST="$HOST" FAMILY="$FAMILY" MODEL="$MODEL" EFFORT="$EFFORT" MODE="$MODE" node <<'NODE'
const fs = require('fs');
const file = process.env.LOG_FILE;
const { POLICY_SHA: policy, REVIEW_SHA: review, HOST: host, FAMILY: family, MODEL: model, EFFORT: effort, MODE: mode } = process.env;
const now = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 1 }) + '\n');
NODE
  set +e
  node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/verify-fail.out" 2> "$TMP/verify-fail.err"
  FAILROW_RC=$?
  set -e
  expect "nonzero exit receipt is denied" test "$FAILROW_RC" -ne 0

  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" MODE="$MODE" node <<'NODE'
const fs = require('fs');
const file = process.env.LOG_FILE;
const { POLICY_SHA: policy, REVIEW_SHA: review, MODE: mode } = process.env;
const now = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, host: 'claude', family: 'anthropic', model: 'claude-sonnet-5', effort: 'high', policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 0 }) + '\n');
NODE
  set +e
  node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/verify-wrong.out" 2> "$TMP/verify-wrong.err"
  WRONG_RC=$?
  set -e
  expect "wrong host/family/model/effort receipt is denied" test "$WRONG_RC" -ne 0

  OV_SHA="$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.override_sha256)' "$OV_JSON")"
  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" OV_SHA="$OV_SHA" REVIEW_SHA="$REVIEW_SHA" node <<'NODE'
const fs = require('fs');
const file = process.env.LOG_FILE;
const now = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'owner-override', skill: 'execute-changeset', override_sha256: process.env.OV_SHA, reason: 'bounded owner override for WI-559 fixture', review_log_sha256: process.env.REVIEW_SHA, exit_code: 0 }) + '\n');
NODE
  OV_VERIFY="$(node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE")"
  expect "schema-2 exact-WI owner-override receipt is accepted" node -e 'const j=JSON.parse(process.argv[1]); if(!(j.ok===true||j.decision==="owner-override")) process.exit(1);' "$OV_VERIFY"
  set -e
fi

# ---------------------------------------------------------------------------
# execute adapters (T3 surface; red until execute adapters converge)
# ---------------------------------------------------------------------------
if want execute; then
  set +e
  printf '\n=== execute adapters / guard / grok transport ===\n'
  EXEC_SHELL="$TMP/exec-shell-repo"
  make_plan_repo "$EXEC_SHELL" bugfix-WI-559-shell WI-559
  write_review_log "$EXEC_SHELL/docs/plans/active/review-log.yaml" PROMOTED WI-559
  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" bash "$PREFLIGHT" "$EXEC_SHELL" WI-559 > "$TMP/preflight-shell.out" 2> "$TMP/preflight-shell.err"
  PRE_SHELL_RC=$?
  set -e
  expect "execute preflight emits compact Grok JSON rather than DISPATCH=sonnet" bash -c "test '$PRE_SHELL_RC' -eq 0 && grep -q grok-4.6 '$TMP/preflight-shell.out' && ! grep -q DISPATCH=sonnet '$TMP/preflight-shell.out' && ! grep -q not-required '$TMP/preflight-shell.out'"

  reset_log
  set +e
  SVC_HARNESS=grok SVC_WORKER_MUTATION=false SVC_WORKER_MODEL=grok-4.6 SVC_WORKER_EFFORT=high SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_WORKER_WI=WI-559 \
    bash "$WORKER" 'implement the reviewed plan' > "$TMP/worker.out" 2> "$TMP/worker.err"
  WORKER_RC=$?
  set -e
  expect "fake Grok argv contains required bounded flags and no bypass" node -e '
    const fs=require("fs");
    const raw=fs.readFileSync(process.argv[1],"utf8").trim().split(/\n/).filter(Boolean).pop();
    const argv=JSON.parse(raw);
    const joined=argv.join(" ");
    for (const flag of ["--cwd","--model","grok-4.6","--reasoning-effort","high","--permission-mode","auto","--no-subagents","--disable-web-search","--single"]) {
      if(!argv.includes(flag) && !joined.includes(flag)) process.exit(1);
    }
    if(/bypassPermissions|--yolo|--dangerously-skip-permissions/.test(joined)) process.exit(1);
  ' "$SVC_FAKE_LOG/grok.argv.json"
  expect "Grok worker fixture exited successfully" test "$WORKER_RC" -eq 0

  mkdir -p "$EXEC_SHELL/src" "$EXEC_SHELL/.svc"
  printf 'export const x=1;\n' > "$EXEC_SHELL/src/app.js"
  fxgit "$EXEC_SHELL" add src/app.js
  printf '%s\n' '{"ts":"2020-01-01T00:00:00Z","harness":"opencode","model":"mimo-v2-pro","skill":"execute-changeset","exit_code":0}' > "$EXEC_SHELL/.svc/dispatch-log.jsonl"
  set +e
  git -C "$EXEC_SHELL" -c user.email=svc@example.com -c user.name=svc -c commit.gpgsign=false -c core.hooksPath=/dev/null diff --cached >/dev/null
  SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_HOST=codex bash -c 'cd "$1" && STAGED=1 bash "$2"' _ "$EXEC_SHELL" "$GUARD" > "$TMP/guard.out" 2> "$TMP/guard.err"
  GUARD_RC=$?
  set -e
  expect "legacy MiMo/Sonnet/Opus rows cannot authorize the current Grok tuple" test "$GUARD_RC" -ne 0
fi

printf '\n  %s failed, %s passed\n' "$FAIL" "$PASS"
test "$FAIL" -eq 0
