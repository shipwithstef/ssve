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
dd of="$SVC_FAKE_LOG/cursor.stdin" status=none
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
base_model="$model"
for suffix in low medium high xhigh max; do base_model="${base_model%-$suffix}"; done
family="${SVC_FAKE_CURSOR_FAMILY:-}"
if [[ -z "$family" ]]; then
  if [[ "$model" == gpt-5.6-sol* ]]; then family=openai; else family=anthropic; fi
fi
host="${SVC_FAKE_FINDINGS_HOST:-cursor}"
effort="${SVC_FAKE_FINDINGS_EFFORT:-high}"
finding="$(H="$host" F="$family" M="${SVC_FAKE_FINDINGS_MODEL:-$base_model}" E="$effort" python3 -c 'import json,os; print(json.dumps({"schema_version":1,"review_kind":os.environ.get("SVC_REVIEW_KIND","plan"),"rubric_score":10,"rubric_failures":None,"dependencies_needing_read":None,"reviewer":{"host":os.environ["H"],"family":os.environ["F"],"model":os.environ["M"],"effort":os.environ["E"]},"verdict":"pass","summary":"fixture pass","findings":[],"certifications":[]}))')"
if [[ "${SVC_FAKE_MODE:-success}" != "success" ]]; then
  printf '%s\n' "${SVC_FAKE_DIAGNOSTIC:-authentication failed}" >&2
  exit 1
fi
result="$finding"
if [[ "${SVC_FAKE_CURSOR_FENCE:-0}" == 1 ]]; then
  result=$'```json\n'"$finding"$'\n```'
fi
if [[ "${SVC_FAKE_OUTPUT:-valid}" == malformed ]]; then
  printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"{bad"}'
  exit 0
fi
if [[ "${SVC_FAKE_CURSOR_IS_ERROR:-0}" == 1 ]]; then
  printf '%s\n' '{"type":"result","is_error":true,"result":"provider rejected request"}'
  exit 0
fi
if [[ "${SVC_FAKE_CURSOR_ENVELOPE:-}" == missing-error ]]; then
  python3 -c 'import json,sys; print(json.dumps({"type":"result","subtype":"success","result":sys.argv[1]}))' "$result"
  exit 0
fi
if [[ "${SVC_FAKE_CURSOR_ENVELOPE:-}" == wrong-subtype ]]; then
  python3 -c 'import json,sys; print(json.dumps({"type":"result","subtype":"partial","is_error":False,"result":sys.argv[1]}))' "$result"
  exit 0
fi
python3 -c 'import json,os,sys; print(json.dumps({"type":"result","subtype":"success","is_error":False,"result":sys.argv[1]}))' "$result"
FAKE
  cat > "$TMP/bin/grok" <<'FAKE'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--help" ]]; then
  printf '%s\n' '--cwd --model --reasoning-effort --permission-mode auto --no-subagents --disable-web-search --prompt-file'
  exit 0
fi
mkdir -p "$SVC_FAKE_LOG"
printf '%s\n' "$*" >> "$SVC_FAKE_LOG/grok.argv"
GROK_ARGV_JSON="$SVC_FAKE_LOG/grok.argv.json" python3 -c 'import json,os,sys; p=os.environ["GROK_ARGV_JSON"]; json.dump(sys.argv[1:], open(p,"w"), separators=(",",":")); open(p,"a").write("\n")' -- "$@"
previous=''
for argument in "$@"; do
  if [[ "$previous" == '--prompt-file' ]]; then cp "$argument" "$SVC_FAKE_LOG/grok.prompt"; fi
  previous="$argument"
done
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
  local plan_dir manifest repo_root manifest_rel manifest_sha
  plan_dir="$(dirname "$file")"
  manifest="$plan_dir/manifest.md"
  if [[ -f "$manifest" ]]; then
    repo_root="$(git -C "$plan_dir" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$plan_dir")"
    manifest_rel="${manifest#"$repo_root"/}"
    manifest_sha="$(sha256sum "$manifest" | awk '{print $1}')"
  else
    manifest_rel="docs/plans/active/manifest.md"
    manifest_sha="$(printf 'ineligible-placeholder' | sha256sum | awk '{print $1}')"
  fi
  cat > "$file" <<EOF
review_kind: plan
wi: ${wi}
manifest: ${manifest_rel}
manifest_sha256: ${manifest_sha}
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

  SYMLINK_MANIFEST="$NUMERIC/docs/plans/active/symlink-manifest.md"
  ln -s manifest.md "$SYMLINK_MANIFEST"
  set +e
  bind "$NUMERIC" "$SYMLINK_MANIFEST" > "$TMP/bind-symlink.out" 2> "$TMP/bind-symlink.err"
  BIND_SYMLINK_RC=$?
  set -e
  expect "bind-plan rejects a symlinked authority manifest before provider use" bash -c "test '$BIND_SYMLINK_RC' -eq 4 && grep -q 'symlink' '$TMP/bind-symlink.err' && test \"\$(call_count)\" = 0"

  SNAPSHOT="$NUMERIC/.svc/review-plan-snapshots/test.manifest.md"
  mkdir -p "$(dirname "$SNAPSHOT")"
  SNAPSHOT_BIND="$(node "$HELPER" bind-plan --repo "$NUMERIC" --manifest "$NUMERIC/docs/plans/active/manifest.md" --snapshot-out "$SNAPSHOT")"
  expect "bind-plan snapshots exactly the bytes whose digest it returns" node -e '
    const fs=require("fs"),crypto=require("crypto"); const j=JSON.parse(process.argv[1]);
    const digest=crypto.createHash("sha256").update(fs.readFileSync(process.argv[2])).digest("hex");
    if(j.manifest_sha256!==digest||j.snapshot!==".svc/review-plan-snapshots/test.manifest.md")process.exit(1);
  ' "$SNAPSHOT_BIND" "$SNAPSHOT"
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
  printf 'owner default without candidate binding' | SVC_HOST=codex node "$LAUNCHER" --orchestrator codex --review-kind plan --reviewer-config "$POLICY_JSON" --reviewer-phase plan --artifacts-dir "$TMP/out/default-no-candidate" > "$TMP/default-no-candidate.out" 2> "$TMP/default-no-candidate.err"
  DEFAULT_NO_CANDIDATE_RC=$?
  set -e
  expect "omitted owner-config station still requires exact candidate binding before provider spawn" bash -c "test '$DEFAULT_NO_CANDIDATE_RC' -ne 0 && test \"\$(call_count)\" = 0"

  reset_log
  PLANSHA="$(sha256sum "$SCOUT/docs/plans/active/manifest.md" | awk '{print $1}')"
  set +e
  printf 'candidate_digest=%s\nSVC_PLAN_BYTES_BEGIN_V1\ntampered-plan-bytes\nSVC_PLAN_BYTES_END_V1\n' "$PLANSHA" | SVC_HOST=codex node "$LAUNCHER" --orchestrator codex --review-kind plan --candidate-digest "$PLANSHA" --reviewer-config "$POLICY_JSON" --reviewer-phase plan --artifacts-dir "$TMP/out/tampered-plan-envelope" > "$TMP/tampered-plan-envelope.out" 2> "$TMP/tampered-plan-envelope.err"
  TAMPERED_PLAN_RC=$?
  set -e
  expect "launcher binds candidate digest to the exact packaged plan bytes" bash -c "test '$TAMPERED_PLAN_RC' -ne 0 && test \"\$(call_count)\" = 0 && grep -q 'bounded plan-byte envelope' '$TMP/tampered-plan-envelope.err'"

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

  POLICY_LINK="$TMP/policy/dispatch-policy-link.json"
  ln -s "$POLICY_JSON" "$POLICY_LINK"
  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_LINK" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/symlink-policy" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/symlink-policy.out" 2> "$TMP/symlink-policy.err"
  SYMLINK_POLICY_RC=$?
  set -e
  expect "ineligible symlink owner policy fails closed with zero provider calls" bash -c "test '$SYMLINK_POLICY_RC' -ne 0 && test \"\$(call_count)\" = 0 && grep -Eq 'regular non-symlink file|not an eligible regular non-symlink file' '$TMP/symlink-policy.err'"

  POLICY_PARENT_REAL="$TMP/policy-parent-real"
  mkdir -p "$POLICY_PARENT_REAL"
  chmod 700 "$POLICY_PARENT_REAL"
  cp "$POLICY_JSON" "$POLICY_PARENT_REAL/dispatch-policy.json"
  ln -s "$POLICY_PARENT_REAL" "$TMP/policy-parent-link"
  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$TMP/policy-parent-link/dispatch-policy.json" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/symlink-policy-parent" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/symlink-policy-parent.out" 2> "$TMP/symlink-policy-parent.err"
  SYMLINK_POLICY_PARENT_RC=$?
  set -e
  expect "owner policy under a symlinked parent fails closed with zero provider calls" bash -c "test '$SYMLINK_POLICY_PARENT_RC' -ne 0 && test \"\$(call_count)\" = 0"

  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION -u SVC_REVIEWER_POLICY SVC_HOST=codex SVC_DISPATCH_POLICY="$TMP/policy/missing-owner-policy.json" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/missing-policy" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/missing-policy.out" 2> "$TMP/missing-policy.err"
  MISSING_POLICY_RC=$?
  set -e
  expect "explicitly configured missing owner policy denies before provider use" bash -c "test '$MISSING_POLICY_RC' -ne 0 && test \"\$(call_count)\" = 0 && grep -q 'explicitly configured owner reviewer policy is missing' '$TMP/missing-policy.err'"

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
  printf 'station-only must not reach provider' | SVC_HOST=codex node "$LAUNCHER" --orchestrator codex --review-kind plan --reviewer-station fable --artifacts-dir "$TMP/out/station-only" > "$TMP/station-only.out" 2> "$TMP/station-only.err"
  STATION_ONLY_RC=$?
  set -e
  expect "station-only launcher invocation refuses legacy-policy fallback" bash -c "test '$STATION_ONLY_RC' -ne 0 && test \"\$(call_count)\" = 0 && grep -q 'require --reviewer-config' '$TMP/station-only.err'"

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
    const argv=r.attempts[0].command.argv;
    const expected=["--print","--output-format","json","--mode","plan","--sandbox","enabled","--model",`${t.model}-${t.effort}`,"--workspace",process.argv[2]];
    if(JSON.stringify(argv)!==JSON.stringify(expected)) process.exit(1);
    const joined=argv.join(" ");
    if(!argv.includes("--print")||!argv.includes("--output-format")||!argv.includes("json")||!argv.includes("--mode")||!argv.includes("plan")||!argv.includes("--sandbox")||!argv.includes("enabled")||!argv.includes("--model")) process.exit(1);
    if(/bypassPermissions|--yolo|--force\b|--dangerously-skip-permissions/.test(joined)) process.exit(1);
  ' "$RECEIPT_FABLE" "$SCOUT"
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-fable-repeat" \
    bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-fable-repeat.findings" 2> "$TMP/cursor-fable-repeat.err"
  CURSOR_FABLE_REPEAT_RC=$?
  set -e
  RECEIPT_FABLE_REPEAT="$(grep -oE 'receipt=\S+' "$TMP/cursor-fable-repeat.err" | tail -1 | sed 's/^receipt=//')"
  expect "Cursor workspace reviews are never replayed from package-only cache" bash -c "test '$CURSOR_FABLE_REPEAT_RC' -eq 0 && test \"\$(call_count cursor)\" = 2 && test \"\$(node -e 'process.stdout.write(require(process.argv[1]).cache.reusable?\"true\":\"false\")' '$RECEIPT_FABLE_REPEAT')\" = false"

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
  export SVC_FAKE_CURSOR_FENCE=1
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

  for TUPLE_FIELD in model effort; do
    reset_log
    set +e
    if [[ "$TUPLE_FIELD" == model ]]; then
      SVC_FAKE_FINDINGS_MODEL=gpt-5.6-sol SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-wrong-$TUPLE_FIELD" \
        bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-wrong-$TUPLE_FIELD.out" 2> "$TMP/cursor-wrong-$TUPLE_FIELD.err"
    else
      SVC_FAKE_FINDINGS_EFFORT=medium SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-wrong-$TUPLE_FIELD" \
        bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-wrong-$TUPLE_FIELD.out" 2> "$TMP/cursor-wrong-$TUPLE_FIELD.err"
    fi
    WRONG_TUPLE_RC=$?
    set -e
    expect "mismatched findings $TUPLE_FIELD fails closed" test "$WRONG_TUPLE_RC" -ne 0
  done

  for ENVELOPE_KIND in malformed is-error missing-error wrong-subtype; do
    reset_log
    set +e
    if [[ "$ENVELOPE_KIND" == malformed ]]; then
      SVC_FAKE_OUTPUT=malformed SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-$ENVELOPE_KIND" \
        bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-$ENVELOPE_KIND.out" 2> "$TMP/cursor-$ENVELOPE_KIND.err"
    elif [[ "$ENVELOPE_KIND" == is-error ]]; then
      SVC_FAKE_CURSOR_IS_ERROR=1 SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-$ENVELOPE_KIND" \
        bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-$ENVELOPE_KIND.out" 2> "$TMP/cursor-$ENVELOPE_KIND.err"
    else
      SVC_FAKE_CURSOR_ENVELOPE="$ENVELOPE_KIND" SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_REVIEWER_STATION=fable SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-$ENVELOPE_KIND" \
        bash "$ADAPTER" "$SCOUT/docs/plans/active/manifest.md" > "$TMP/cursor-$ENVELOPE_KIND.out" 2> "$TMP/cursor-$ENVELOPE_KIND.err"
    fi
    ENVELOPE_RC=$?
    set -e
    expect "Cursor $ENVELOPE_KIND envelope fails closed without findings authorization" bash -c "test '$ENVELOPE_RC' -ne 0 && test ! -s '$TMP/cursor-$ENVELOPE_KIND.out'"
  done

  expect "generalized receipt schema admits cursor host without weakening non-empty tuples" node -e 'const s=require(process.argv[1]),t=s.definitions.tuple.properties; if(t.host.type!=="string"||t.host.minLength!==1||t.orchestrator.type!=="string"||t.orchestrator.minLength!==1) process.exit(1);' "$ROOT/schemas/external-review-receipt.schema.json"
  expect "findings schema admits cursor host" node -e 'const s=require(process.argv[1]); if(!s.properties.reviewer.properties.host.enum.includes("cursor")) process.exit(1);' "$ROOT/schemas/external-review-findings.schema.json"
  expect "findings schema admits the exact direct Grok/xAI review tuple" node --input-type=module -e "
    import fs from 'node:fs';
    import { validate } from 'file://${ROOT}/scripts/lib/json-schema-validator.mjs';
    const schema=JSON.parse(fs.readFileSync('${ROOT}/schemas/external-review-findings.schema.json','utf8'));
    const findings={schema_version:1,review_kind:'exec',rubric_score:null,rubric_failures:[],dependencies_needing_read:[],reviewer:{host:'grok',family:'xai',model:'grok-4.6',effort:'high'},verdict:'pass',summary:'exact tuple',findings:[],certifications:[]};
    if(!validate(schema,findings).valid) process.exit(1);
  "

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

  BAD_CURSOR_POLICY="$TMP/policy/cursor-google-policy.json"
  POLICY_IN="$POLICY_JSON" POLICY_OUT="$BAD_CURSOR_POLICY" node <<'NODE'
const fs = require('fs');
const policy = JSON.parse(fs.readFileSync(process.env.POLICY_IN, 'utf8'));
policy.modes['mixed-grok-cursor'].review.plan.stations.find((row) => row.id === 'fable').tuple.family = 'google';
fs.writeFileSync(process.env.POLICY_OUT, JSON.stringify(policy) + '\n', { mode: 0o600 });
NODE
  reset_log
  set +e
  printf 'candidate_digest=%s\n' "$PLANSHA" | SVC_HOST=codex node "$LAUNCHER" --orchestrator codex --review-kind plan --candidate-digest "$PLANSHA" --reviewer-config "$BAD_CURSOR_POLICY" --reviewer-phase plan --reviewer-station fable --artifacts-dir "$TMP/out/cursor-google-preflight" > "$TMP/cursor-google-preflight.out" 2> "$TMP/cursor-google-preflight.err"
  CURSOR_GOOGLE_RC=$?
  set -e
  expect "ineligible Cursor family fails before capability or provider spawn" bash -c "test '$CURSOR_GOOGLE_RC' -ne 0 && test \"\$(call_count)\" = 0"

  CROSSED_CURSOR_POLICY="$TMP/policy/cursor-crossed-family-policy.json"
  POLICY_IN="$POLICY_JSON" POLICY_OUT="$CROSSED_CURSOR_POLICY" node <<'NODE'
const fs = require('fs');
const policy = JSON.parse(fs.readFileSync(process.env.POLICY_IN, 'utf8'));
policy.modes['mixed-grok-cursor'].review.plan.stations.find((row) => row.id === 'fable').tuple.family = 'openai';
fs.writeFileSync(process.env.POLICY_OUT, JSON.stringify(policy) + '\n', { mode: 0o600 });
NODE
  reset_log
  set +e
  printf 'candidate_digest=%s\n' "$PLANSHA" | SVC_HOST=codex node "$LAUNCHER" --orchestrator codex --review-kind plan --candidate-digest "$PLANSHA" --reviewer-config "$CROSSED_CURSOR_POLICY" --reviewer-phase plan --reviewer-station fable --artifacts-dir "$TMP/out/cursor-crossed-preflight" > "$TMP/cursor-crossed-preflight.out" 2> "$TMP/cursor-crossed-preflight.err"
  CURSOR_CROSSED_RC=$?
  set -e
  expect "crossed Cursor model-family pair fails before provider spawn" bash -c "test '$CURSOR_CROSSED_RC' -ne 0 && test \"\$(call_count)\" = 0"

  LARGE="$TMP/cursor-large-repo"
  make_plan_repo "$LARGE" bugfix-WI-SCOUT-CAPTURE-DURABILITY-01 WI-SCOUT-CAPTURE-DURABILITY-01
  python3 - "$LARGE" <<'PY'
from pathlib import Path
import sys
root = Path(sys.argv[1])
# More than 3 MiB with no interior spaces proves stdin avoids both MAX_ARG_STRLEN
# and aggregate ARG_MAX; the fake captures the exact bytes it receives.
pad = ('x' * (3 * 1024 * 1024 + 257))
(root / 'CLAUDE.md').write_text('# ctx\n' + pad + '\n', encoding='utf8')
PY
  fxgit "$LARGE" add CLAUDE.md
  fxgit "$LARGE" commit -q -m pad
  fxgit "$LARGE" checkout -q -B main
  fxgit "$LARGE" update-ref refs/remotes/origin/main HEAD
  fxgit "$LARGE" checkout -q -B bugfix-WI-SCOUT-CAPTURE-DURABILITY-01
  reset_log
  set +e
  env -u SVC_REVIEWER_MODE -u SVC_REVIEWER_STATION SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_EXTERNAL_REVIEW_ARTIFACTS_DIR="$TMP/out/cursor-large" \
    bash "$ADAPTER" "$LARGE/docs/plans/active/manifest.md" > "$TMP/cursor-large.findings" 2> "$TMP/cursor-large.err"
  CURSOR_LARGE_RC=$?
  set -e
  RECEIPT_LARGE="$(grep -oE 'receipt=\S+' "$TMP/cursor-large.err" | tail -1 | sed 's/^receipt=//')"
  expect "multi-MiB unsplittable Cursor package reaches exactly one fake Cursor call" bash -c "test '$CURSOR_LARGE_RC' -eq 0 && test -n '$RECEIPT_LARGE' && test \"\$(call_count cursor)\" = 1"
  expect "large Cursor findings stay schema-valid with the owner Cursor tuple" node -e 'const fs=require("fs"); const f=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(f.review_kind!=="plan"||f.reviewer.host!=="cursor"||f.reviewer.family!=="anthropic"||f.reviewer.model!=="claude-fable-5") process.exit(1)' "$TMP/cursor-large.findings"
  expect "large Cursor receipt uses prompt-free argv and exact stdin bytes" node --input-type=module -e "
    import fs from 'node:fs';
    const receiptPath = process.argv[1];
    const stdinPath = process.argv[2];
    const r = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    const t = r.requested_tuple;
    if (r.status !== 'success' || r.classification !== 'success') process.exit(1);
    if (!t || t.host !== 'cursor' || t.family !== 'anthropic' || t.model !== 'claude-fable-5') process.exit(1);
    if (JSON.stringify(t) !== JSON.stringify(r.invocation_tuple) || JSON.stringify(t) !== JSON.stringify(r.effective_tuple)) process.exit(1);
    if (!['requested_accepted', 'server_observed'].includes(r.model_attestation.level) || r.model_attestation.level === 'none') process.exit(1);
    const pkgPath = r.artifacts?.package;
    if (!pkgPath || !fs.existsSync(pkgPath)) process.exit(1);
    const packageBytes = fs.readFileSync(pkgPath);
    if (packageBytes.length <= 3 * 1024 * 1024) process.exit(1);
    if (!fs.existsSync(stdinPath) || !packageBytes.equals(fs.readFileSync(stdinPath))) process.exit(1);
    const argv = r.attempts[0]?.command?.argv;
    if (!Array.isArray(argv)) process.exit(1);
    const prefix = ['--print', '--output-format', 'json', '--mode', 'plan', '--sandbox', 'enabled', '--model', t.model + '-' + t.effort, '--workspace', process.argv[3]];
    if (JSON.stringify(argv) !== JSON.stringify(prefix)) process.exit(1);
    const joinedFlags = prefix.join(' ');
    if (/bypassPermissions|--yolo|--force\\b|--dangerously-skip-permissions/.test(joinedFlags)) process.exit(1);
  " "$RECEIPT_LARGE" "$SVC_FAKE_LOG/cursor.stdin" "$LARGE"
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
    if(j.mode!=="mixed-grok-cursor"||j.phase!=="exec"||j.station!=="implementor"||!j.policy_sha256||!j.review_log_sha256) process.exit(1);
    if(!String(j.review_log||"").includes("docs/plans/active/review-log.yaml")) process.exit(1);
    if(String(j.review_log||"").includes("docs/plans/done")) process.exit(1);
  ' "$PRE_JSON"
  PRE_JSON2="$(node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex)"
  expect "preflight is deterministic" test "$PRE_JSON" = "$PRE_JSON2"

  MUTATED_MANIFEST="$TMP/mutated-manifest-repo"
  make_plan_repo "$MUTATED_MANIFEST" bugfix-WI-559-mutated-manifest WI-559
  write_review_log "$MUTATED_MANIFEST/docs/plans/active/review-log.yaml" PROMOTED WI-559
  printf '\npost-review mutation\n' >> "$MUTATED_MANIFEST/docs/plans/active/manifest.md"
  set +e
  node "$HELPER" preflight --repo "$MUTATED_MANIFEST" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-mutated-manifest.out" 2> "$TMP/pre-mutated-manifest.err"
  MUTATED_MANIFEST_RC=$?
  set -e
  expect "post-review manifest mutation invalidates execution authority" bash -c "test '$MUTATED_MANIFEST_RC' -ne 0 && grep -q 'does not bind current manifest' '$TMP/pre-mutated-manifest.err'"

  NESTED_STATE="$TMP/nested-state-repo"
  make_plan_repo "$NESTED_STATE" bugfix-WI-559-nested-state WI-559
  NESTED_MANIFEST_SHA="$(sha256sum "$NESTED_STATE/docs/plans/active/manifest.md" | awk '{print $1}')"
  cat > "$NESTED_STATE/docs/plans/active/review-log.yaml" <<EOF
review_kind: plan
wi: WI-559
manifest: docs/plans/active/manifest.md
manifest_sha256: $NESTED_MANIFEST_SHA
findings:
  terminal_state: PROMOTED
EOF
  set +e
  node "$HELPER" preflight --repo "$NESTED_STATE" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-nested-state.out" 2> "$TMP/pre-nested-state.err"
  NESTED_STATE_RC=$?
  set -e
  expect "nested YAML terminal_state cannot impersonate root review authority" bash -c "test '$NESTED_STATE_RC' -ne 0 && grep -q 'root-level terminal_state' '$TMP/pre-nested-state.err'"

  NOTES_ONLY="$TMP/notes-only-repo"
  make_plan_repo "$NOTES_ONLY" bugfix-WI-559-notes WI-100
  printf '# notes\n\n**Work item:** WI-559\n' > "$NOTES_ONLY/docs/plans/active/notes.md"
  write_review_log "$NOTES_ONLY/docs/plans/active/review-log.yaml" PROMOTED WI-559
  set +e
  node "$HELPER" preflight --repo "$NOTES_ONLY" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-notes-only.out" 2> "$TMP/pre-notes-only.err"
  NOTES_ONLY_RC=$?
  set -e
  expect "arbitrary Markdown cannot impersonate a canonical plan manifest" test "$NOTES_ONLY_RC" -ne 0

  WRONG_LOG_WI="$TMP/wrong-log-wi-repo"
  make_plan_repo "$WRONG_LOG_WI" bugfix-WI-559-wrong-log WI-559
  write_review_log "$WRONG_LOG_WI/docs/plans/active/review-log.yaml" PROMOTED WI-100
  set +e
  node "$HELPER" preflight --repo "$WRONG_LOG_WI" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-wrong-log-wi.out" 2> "$TMP/pre-wrong-log-wi.err"
  WRONG_LOG_WI_RC=$?
  set -e
  expect "review log must bind its own WI to the requested WI" bash -c "test '$WRONG_LOG_WI_RC' -ne 0 && grep -q 'does not match requested WI-559' '$TMP/pre-wrong-log-wi.err'"

  DUAL_MANIFEST="$TMP/dual-manifest-repo"
  make_plan_repo "$DUAL_MANIFEST" bugfix-WI-559-dual-manifest WI-559
  printf '# duplicate canonical plan\n\n**Work item:** WI-559\n' > "$DUAL_MANIFEST/docs/plans/active/plan.md"
  write_review_log "$DUAL_MANIFEST/docs/plans/active/review-log.yaml" PROMOTED WI-559
  set +e
  node "$HELPER" preflight --repo "$DUAL_MANIFEST" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-dual-manifest.out" 2> "$TMP/pre-dual-manifest.err"
  DUAL_MANIFEST_RC=$?
  set -e
  expect "multiple canonical manifests cannot share one execution authority log" bash -c "test '$DUAL_MANIFEST_RC' -ne 0 && grep -q 'exactly one canonical manifest' '$TMP/pre-dual-manifest.err'"

  STALE_MANIFEST="$TMP/stale-manifest-repo"
  make_plan_repo "$STALE_MANIFEST" bugfix-WI-559-stale-manifest WI-559
  write_review_log "$STALE_MANIFEST/docs/plans/active/review-log.yaml" PROMOTED WI-559
  mkdir -p "$STALE_MANIFEST/docs/plans/newer"
  printf '# newer unreviewed plan\n\n**Work item:** WI-559\n' > "$STALE_MANIFEST/docs/plans/newer/manifest.md"
  set +e
  node "$HELPER" preflight --repo "$STALE_MANIFEST" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-stale-manifest.out" 2> "$TMP/pre-stale-manifest.err"
  STALE_MANIFEST_RC=$?
  set -e
  expect "an unreviewed newer same-WI manifest invalidates stale review authority" bash -c "test '$STALE_MANIFEST_RC' -ne 0 && grep -q 'exactly one canonical manifest' '$TMP/pre-stale-manifest.err'"

  MULTIDOC="$TMP/multidoc-review-repo"
  make_plan_repo "$MULTIDOC" bugfix-WI-559-multidoc WI-559
  MANIFEST_SHA="$(sha256sum "$MULTIDOC/docs/plans/active/manifest.md" | awk '{print $1}')"
  printf 'wi: WI-559\nmanifest: docs/plans/active/manifest.md\n---\nmanifest_sha256: %s\nterminal_state: PROMOTED\n' "$MANIFEST_SHA" > "$MULTIDOC/docs/plans/active/review-log.yaml"
  set +e
  node "$HELPER" preflight --repo "$MULTIDOC" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-multidoc.out" 2> "$TMP/pre-multidoc.err"
  MULTIDOC_RC=$?
  set -e
  expect "authority fields split across YAML documents fail closed" bash -c "test '$MULTIDOC_RC' -ne 0 && grep -q 'exactly one YAML document' '$TMP/pre-multidoc.err'"

  SYMLINK_LOG="$TMP/symlink-log-repo"
  make_plan_repo "$SYMLINK_LOG" bugfix-WI-559-symlink-log WI-559
  write_review_log "$TMP/symlink-review-log.yaml" PROMOTED WI-559
  ln -s "$TMP/symlink-review-log.yaml" "$SYMLINK_LOG/docs/plans/active/review-log.yaml"
  set +e
  node "$HELPER" preflight --repo "$SYMLINK_LOG" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/pre-symlink-log.out" 2> "$TMP/pre-symlink-log.err"
  SYMLINK_LOG_RC=$?
  set -e
  expect "symlink review logs cannot authorize execution" test "$SYMLINK_LOG_RC" -ne 0

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

  OVERRIDE="$TMP/override.json"
  OVERRIDE="$OVERRIDE" node <<'NODE'
const fs = require('fs');
fs.writeFileSync(process.env.OVERRIDE, JSON.stringify({
  authority: 'repository-owner',
  source: 'owner-console',
  wi: 'WI-559',
  timestamp: new Date().toISOString(),
  accept: true,
  reason: 'bounded owner override for WI-559 fixture'
}) + '\n');
NODE
  chmod 600 "$OVERRIDE"
  OV_JSON="$(node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE")"
  expect "accepted override prints owner-override without inventing a tuple" node -e '
    const j=JSON.parse(process.argv[1]);
    if(j.decision!=="owner-override"||j.wi!=="WI-559"||!j.override_sha256||!j.reason||!j.review_log_sha256) process.exit(1);
    if(j.host||j.model||j.family||j.effort) process.exit(1);
  ' "$OV_JSON"

  OVERRIDE_LINK="$TMP/override-link.json"
  ln -s "$OVERRIDE" "$OVERRIDE_LINK"
  set +e
  node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE_LINK" > "$TMP/override-link.out" 2> "$TMP/override-link.err"
  OVERRIDE_LINK_RC=$?
  set -e
  expect "symlinked execute owner override is denied before dispatch" test "$OVERRIDE_LINK_RC" -ne 0

  OVERRIDE_PARENT_REAL="$TMP/override-parent-real"
  mkdir -p "$OVERRIDE_PARENT_REAL"
  chmod 700 "$OVERRIDE_PARENT_REAL"
  cp "$OVERRIDE" "$OVERRIDE_PARENT_REAL/override.json"
  ln -s "$OVERRIDE_PARENT_REAL" "$TMP/override-parent-link"
  set +e
  node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$TMP/override-parent-link/override.json" > "$TMP/override-parent-link.out" 2> "$TMP/override-parent-link.err"
  OVERRIDE_PARENT_LINK_RC=$?
  set -e
  expect "execute owner override under a symlinked parent is denied before dispatch" test "$OVERRIDE_PARENT_LINK_RC" -ne 0

  set +e
  node "$HELPER" preflight --repo "$DRAFT_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE" > "$TMP/override-draft.out" 2> "$TMP/override-draft.err"
  OVERRIDE_DRAFT_RC=$?
  set -e
  expect "owner override never bypasses a non-authorized review log" test "$OVERRIDE_DRAFT_RC" -ne 0

  for BAD_KIND in missing-authority missing-source wrong-wi stale; do
    BAD_OVERRIDE="$TMP/override-$BAD_KIND.json"
    BAD_OVERRIDE="$BAD_OVERRIDE" BAD_KIND="$BAD_KIND" node <<'NODE'
const fs = require('fs');
const kind = process.env.BAD_KIND;
const row = {
  authority: kind === 'missing-authority' ? undefined : 'repository-owner',
  source: kind === 'missing-source' ? undefined : 'owner-console',
  wi: kind === 'wrong-wi' ? 'WI-100' : 'WI-559',
  timestamp: kind === 'stale' ? new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() : new Date().toISOString(),
  accept: true,
  reason: 'must not authorize'
};
fs.writeFileSync(process.env.BAD_OVERRIDE, JSON.stringify(row) + '\n');
NODE
    set +e
    node "$HELPER" preflight --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$BAD_OVERRIDE" > "$TMP/override-$BAD_KIND.out" 2> "$TMP/override-$BAD_KIND.err"
    BAD_OVERRIDE_RC=$?
    set -e
    expect "owner override rejects $BAD_KIND before dispatch" test "$BAD_OVERRIDE_RC" -ne 0
  done

  HASHES="$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write([j.policy_sha256,j.review_log_sha256,j.host,j.family,j.model,j.effort,j.mode,j.phase,j.station,j.orchestrator,j.manifest,j.manifest_sha256].join(" "))' "$PRE_JSON")"
  read -r POLICY_SHA REVIEW_SHA HOST FAMILY MODEL EFFORT MODE PHASE STATION ORCHESTRATOR MANIFEST MANIFEST_SHA <<<"$HASHES"
  mkdir -p "$EXEC_REPO/.svc"
  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" HOST="$HOST" FAMILY="$FAMILY" MODEL="$MODEL" EFFORT="$EFFORT" MODE="$MODE" PHASE="$PHASE" STATION="$STATION" ORCHESTRATOR="$ORCHESTRATOR" MANIFEST="$MANIFEST" MANIFEST_SHA="$MANIFEST_SHA" node <<'NODE'
const fs = require('fs');
const file = process.env.LOG_FILE;
const { POLICY_SHA: policy, REVIEW_SHA: review, HOST: host, FAMILY: family, MODEL: model, EFFORT: effort, MODE: mode, PHASE: phase, STATION: station, ORCHESTRATOR: orchestrator, MANIFEST: manifest, MANIFEST_SHA: manifest_sha256 } = process.env;
const now = new Date().toISOString();
const rows = [
  '{not-json',
  JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-100', decision: 'dispatch', skill: 'execute-changeset', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 0 }),
  JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'dispatch', skill: 'review-plan', mode, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, duration_ms: 1, exit_code: 0 }),
  JSON.stringify({ ts: now, harness: 'opencode', model: 'mimo-v2-pro', skill: 'execute-changeset', exit_code: 0 }),
  JSON.stringify({ schema_version: 2, ts: now, wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, phase, station, orchestrator, host, family, model, effort, policy_sha256: policy, review_log_sha256: review, manifest, manifest_sha256, duration_ms: 9, exit_code: 0, log_path: '/tmp/x' })
];
fs.writeFileSync(file, rows.join('\n') + '\n');
NODE
  VERIFY="$(node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --max-age-seconds 21600)"
  expect "verify-receipt accepts recent exact schema-2 Grok row and ignores malformed/legacy/other-WI" node -e 'const j=JSON.parse(process.argv[1]); if(j.ok!==true&&j.decision!=="dispatch") process.exit(1);' "$VERIFY"

  for INVALID_AGE in NaN Infinity 21601 0 -1; do
    set +e
    node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --max-age-seconds "$INVALID_AGE" > "$TMP/verify-age-$INVALID_AGE.out" 2> "$TMP/verify-age-$INVALID_AGE.err"
    INVALID_AGE_RC=$?
    set -e
    expect "invalid receipt max age $INVALID_AGE fails closed" bash -c "test '$INVALID_AGE_RC' -eq 2 && grep -q 'integer from 1 through 21600' '$TMP/verify-age-$INVALID_AGE.err'"
  done

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

  LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" HOST="$HOST" FAMILY="$FAMILY" MODEL="$MODEL" EFFORT="$EFFORT" MODE="$MODE" ORCHESTRATOR="$ORCHESTRATOR" MANIFEST="$MANIFEST" MANIFEST_SHA="$MANIFEST_SHA" node <<'NODE'
const fs = require('fs');
const { POLICY_SHA: policy_sha256, REVIEW_SHA: review_log_sha256, HOST: host, FAMILY: family, MODEL: model, EFFORT: effort, MODE: mode, ORCHESTRATOR: orchestrator, MANIFEST: manifest, MANIFEST_SHA: manifest_sha256 } = process.env;
const ts = new Date(Date.now() + 10 * 60 * 1000).toISOString();
fs.writeFileSync(process.env.LOG_FILE, JSON.stringify({ schema_version: 2, ts, wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, orchestrator, host, family, model, effort, policy_sha256, review_log_sha256, manifest, manifest_sha256, duration_ms: 1, exit_code: 0 }) + '\n');
NODE
  set +e
  node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/verify-future.out" 2> "$TMP/verify-future.err"
  FUTURE_RC=$?
  set -e
  expect "future-dated receipt beyond clock skew is denied" test "$FUTURE_RC" -ne 0

  for AUTH_FIELD in mode phase station orchestrator; do
    LOG_FILE="$EXEC_REPO/.svc/dispatch-log.jsonl" POLICY_SHA="$POLICY_SHA" REVIEW_SHA="$REVIEW_SHA" HOST="$HOST" FAMILY="$FAMILY" MODEL="$MODEL" EFFORT="$EFFORT" MODE="$MODE" PHASE="$PHASE" STATION="$STATION" ORCHESTRATOR="$ORCHESTRATOR" MANIFEST="$MANIFEST" MANIFEST_SHA="$MANIFEST_SHA" AUTH_FIELD="$AUTH_FIELD" node <<'NODE'
const fs = require('fs');
let { POLICY_SHA: policy_sha256, REVIEW_SHA: review_log_sha256, HOST: host, FAMILY: family, MODEL: model, EFFORT: effort, MODE: mode, PHASE: phase, STATION: station, ORCHESTRATOR: orchestrator, MANIFEST: manifest, MANIFEST_SHA: manifest_sha256 } = process.env;
if (process.env.AUTH_FIELD === 'mode') mode = 'wrong-mode';
else if (process.env.AUTH_FIELD === 'phase') phase = 'plan';
else if (process.env.AUTH_FIELD === 'station') station = 'wrong-station';
else orchestrator = 'wrong-orchestrator';
fs.writeFileSync(process.env.LOG_FILE, JSON.stringify({ schema_version: 2, ts: new Date().toISOString(), wi: 'WI-559', decision: 'dispatch', skill: 'execute-changeset', mode, phase, station, orchestrator, host, family, model, effort, policy_sha256, review_log_sha256, manifest, manifest_sha256, duration_ms: 1, exit_code: 0 }) + '\n');
NODE
    set +e
    node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/verify-wrong-$AUTH_FIELD.out" 2> "$TMP/verify-wrong-$AUTH_FIELD.err"
    WRONG_AUTH_RC=$?
    set -e
    expect "wrong receipt $AUTH_FIELD is denied" test "$WRONG_AUTH_RC" -ne 0
  done

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

  node "$HELPER" record-override --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE" > "$TMP/record-override.json"
  OV_VERIFY="$(node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE")"
  expect "schema-2 exact-WI owner-override receipt is accepted" node -e 'const j=JSON.parse(process.argv[1]); if(!(j.ok===true||j.decision==="owner-override")) process.exit(1);' "$OV_VERIFY"
  rm -f "$EXEC_REPO/.svc/dispatch-log.jsonl"
  : > "$TMP/dispatch-log-target.jsonl"
  ln -s "$TMP/dispatch-log-target.jsonl" "$EXEC_REPO/.svc/dispatch-log.jsonl"
  set +e
  node "$HELPER" record-override --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE" > "$TMP/record-override-symlink.out" 2> "$TMP/record-override-symlink.err"
  RECORD_SYMLINK_RC=$?
  set -e
  expect "dispatch evidence writer refuses a symlink target" test "$RECORD_SYMLINK_RC" -ne 0
  set +e
  node "$HELPER" verify-receipt --repo "$EXEC_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex > "$TMP/verify-symlink-log.out" 2> "$TMP/verify-symlink-log.err"
  VERIFY_SYMLINK_LOG_RC=$?
  set -e
  expect "dispatch evidence reader refuses a symlink target" test "$VERIFY_SYMLINK_LOG_RC" -ne 0

  PARENT_LINK_REPO="$TMP/parent-link-repo"
  make_plan_repo "$PARENT_LINK_REPO" bugfix-WI-559-parent-link WI-559
  write_review_log "$PARENT_LINK_REPO/docs/plans/active/review-log.yaml" PROMOTED WI-559
  mkdir -p "$TMP/redirected-svc"
  rmdir "$PARENT_LINK_REPO/.svc"
  ln -s "$TMP/redirected-svc" "$PARENT_LINK_REPO/.svc"
  set +e
  node "$HELPER" record-override --repo "$PARENT_LINK_REPO" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE" > "$TMP/record-parent-link.out" 2> "$TMP/record-parent-link.err"
  RECORD_PARENT_LINK_RC=$?
  set -e
  expect "dispatch evidence writer rejects symlinked parent components" bash -c "test '$RECORD_PARENT_LINK_RC' -ne 0 && test ! -e '$TMP/redirected-svc/dispatch-log.jsonl'"

  SWAP_ROOT="$TMP/append-parent-swap"
  SWAP_REDIRECT="$TMP/append-parent-redirect"
  mkdir -p "$SWAP_ROOT/.svc" "$SWAP_REDIRECT"
  node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({pid:999999,ts:new Date(Date.now()+1000).toISOString()}))' "$SWAP_ROOT/.svc/dispatch-log.jsonl.lock"
  node --input-type=module - "$ROOT/scripts/state-io.mjs" "$SWAP_ROOT" <<'NODE' > "$TMP/append-parent-swap.out" 2>&1 &
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const [stateIoPath, root] = process.argv.slice(2);
const { appendJsonlLine } = await import(pathToFileURL(stateIoPath).href);
appendJsonlLine(path.join(root, '.svc', 'dispatch-log.jsonl'), { marker: 'anchored-parent' }, {
  authorityRoot: root,
  staleMs: 500,
  timeoutMs: 2500,
  retryMs: 25,
});
NODE
  SWAP_PID=$!
  sleep 0.15
  mv "$SWAP_ROOT/.svc" "$SWAP_ROOT/.svc-original"
  ln -s "$SWAP_REDIRECT" "$SWAP_ROOT/.svc"
  set +e
  wait "$SWAP_PID"
  SWAP_RC=$?
  set -e
  expect "dispatch append stays anchored when its parent path is swapped mid-write" bash -c "test '$SWAP_RC' -eq 0 && grep -q anchored-parent '$SWAP_ROOT/.svc-original/dispatch-log.jsonl' && test ! -e '$SWAP_REDIRECT/dispatch-log.jsonl'"
  set -e
fi

# ---------------------------------------------------------------------------
# execute adapters (T3 surface; red until execute adapters converge)
# ---------------------------------------------------------------------------
if want execute; then
  set +e
  printf '\n=== execute adapters / guard / grok transport ===\n'
  node "$ROOT/scripts/validate-host-authority-capabilities.mjs" --root "$ROOT" > "$TMP/host-authority-capabilities.out" 2>&1
  HOST_AUTHORITY_RC=$?
  expect "delegated execution validates the installed host authority capability contract" test "$HOST_AUTHORITY_RC" -eq 0
  node "$ROOT/test-framework/evals/tier-1/validate-child-transport-resolver.mjs" > "$TMP/child-transport-resolver.out" 2>&1
  CHILD_TRANSPORT_RC=$?
  expect "delegated transport and contained-exec sources run inside the convergence proof" test "$CHILD_TRANSPORT_RC" -eq 0
  if [[ -z "${OVERRIDE:-}" ]]; then
    OVERRIDE="$TMP/execute-override.json"
    OVERRIDE="$OVERRIDE" node <<'NODE'
const fs = require('fs');
fs.writeFileSync(process.env.OVERRIDE, JSON.stringify({ authority: 'repository-owner', source: 'owner-console', wi: 'WI-559', timestamp: new Date().toISOString(), accept: true, reason: 'bounded owner override for WI-559 fixture' }) + '\n');
NODE
    chmod 600 "$OVERRIDE"
  fi
  EXEC_SHELL="$TMP/exec-shell-repo"
  make_plan_repo "$EXEC_SHELL" bugfix-WI-559-shell WI-559
  write_review_log "$EXEC_SHELL/docs/plans/active/review-log.yaml" PROMOTED WI-559
  fxgit "$EXEC_SHELL" add docs/plans/active/review-log.yaml
  fxgit "$EXEC_SHELL" commit -q -m reviewed-plan
  reset_log
  set +e
  SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" bash "$PREFLIGHT" "$EXEC_SHELL" WI-559 > "$TMP/preflight-shell.out" 2> "$TMP/preflight-shell.err"
  PRE_SHELL_RC=$?
  set -e
  expect "execute preflight emits compact Grok JSON rather than DISPATCH=sonnet" bash -c "test '$PRE_SHELL_RC' -eq 0 && grep -q grok-4.6 '$TMP/preflight-shell.out' && ! grep -q DISPATCH=sonnet '$TMP/preflight-shell.out' && ! grep -q not-required '$TMP/preflight-shell.out'"

  reset_log
  set +e
  SVC_HARNESS=grok SVC_WORKER_SKILL=review-exec SVC_WORKER_MUTATION=false SVC_WORKER_MODEL=grok-4.6 SVC_WORKER_EFFORT=high SVC_WORKER_FAMILY=xai SVC_WORKER_POLICY_SHA256="$(sha256sum "$POLICY_JSON" | awk '{print $1}')" SVC_WORKER_MODE=mixed-grok-cursor SVC_WORKER_ORCHESTRATOR=codex SVC_WORKER_CWD="$EXEC_SHELL" SVC_DISPATCH_DIR="$TMP/worker-dispatch" SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_WORKER_WI=WI-559 \
    bash -c 'cd "$1" && bash "$2" "implement the reviewed plan"' _ "$EXEC_SHELL" "$WORKER" > "$TMP/worker.out" 2> "$TMP/worker.err"
  WORKER_RC=$?
  set -e
  expect "fake Grok argv contains required bounded flags and no bypass" node -e '
    const fs=require("fs");
    const raw=fs.readFileSync(process.argv[1],"utf8").trim().split(/\n/).filter(Boolean).pop();
    const argv=JSON.parse(raw);
    const joined=argv.join(" ");
    for (const flag of ["--cwd","--model","grok-4.6","--reasoning-effort","high","--permission-mode","auto","--no-subagents","--disable-web-search","--prompt-file"]) {
      if(!argv.includes(flag) && !joined.includes(flag)) process.exit(1);
    }
    if(argv[argv.indexOf("--cwd")+1]!==process.argv[2])process.exit(1);
    if(/bypassPermissions|--yolo|--dangerously-skip-permissions/.test(joined)) process.exit(1);
    if(joined.includes("implement the reviewed plan")) process.exit(1);
  ' "$SVC_FAKE_LOG/grok.argv.json" "$EXEC_SHELL"
  expect "Grok prompt is file-backed and byte-complete outside argv" grep -q 'implement the reviewed plan' "$SVC_FAKE_LOG/grok.prompt"
  expect "Grok worker fixture exited successfully" test "$WORKER_RC" -eq 0

  head -c 262144 /dev/zero | tr '\0' x > "$TMP/large-grok-payload.txt"
  reset_log
  set +e
  SVC_HARNESS=grok SVC_WORKER_SKILL=review-exec SVC_WORKER_MUTATION=false SVC_WORKER_MODEL=grok-4.6 SVC_WORKER_EFFORT=high SVC_WORKER_FAMILY=xai SVC_WORKER_POLICY_SHA256="$(sha256sum "$POLICY_JSON" | awk '{print $1}')" SVC_WORKER_MODE=mixed-grok-cursor SVC_WORKER_ORCHESTRATOR=codex SVC_WORKER_CWD="$EXEC_SHELL" SVC_DISPATCH_DIR="$TMP/large-worker-dispatch" SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_WORKER_WI=WI-559 \
    bash -c 'cd "$1" && bash "$2" "@$3"' _ "$EXEC_SHELL" "$WORKER" "$TMP/large-grok-payload.txt" > "$TMP/worker-large.out" 2> "$TMP/worker-large.err"
  WORKER_LARGE_RC=$?
  set -e
  expect "Grok payload above MAX_ARG_STRLEN remains file-backed end to end" bash -c "test '$WORKER_LARGE_RC' -eq 0 && test \"\$(wc -c < '$SVC_FAKE_LOG/grok.prompt')\" -gt 262144 && ! grep -q 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' '$SVC_FAKE_LOG/grok.argv'"

  DEFAULT_EVIDENCE_REPO="$TMP/default-evidence-repo"
  make_plan_repo "$DEFAULT_EVIDENCE_REPO" bugfix-WI-559-default-evidence WI-559
  write_review_log "$DEFAULT_EVIDENCE_REPO/docs/plans/active/review-log.yaml" PROMOTED WI-559
  fxgit "$DEFAULT_EVIDENCE_REPO" add docs/plans/active/review-log.yaml
  fxgit "$DEFAULT_EVIDENCE_REPO" commit -q -m reviewed-plan
  reset_log
  set +e
  SVC_HARNESS=grok SVC_WORKER_SKILL=review-exec SVC_WORKER_MUTATION=false SVC_WORKER_MODEL=grok-4.6 SVC_WORKER_EFFORT=high SVC_WORKER_FAMILY=xai SVC_WORKER_POLICY_SHA256="$(sha256sum "$POLICY_JSON" | awk '{print $1}')" SVC_WORKER_MODE=mixed-grok-cursor SVC_WORKER_ORCHESTRATOR=codex SVC_WORKER_CWD="$DEFAULT_EVIDENCE_REPO" SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_WORKER_WI=WI-559 \
    bash -c 'cd "$1" && bash "$2" "default evidence path"' _ "$DEFAULT_EVIDENCE_REPO" "$WORKER" > "$TMP/worker-default-evidence.out" 2> "$TMP/worker-default-evidence.err"
  DEFAULT_EVIDENCE_RC=$?
  set -e
  expect "dispatcher-owned runtime evidence defaults outside the child worktree" bash -c "test '$DEFAULT_EVIDENCE_RC' -eq 0 && test -z \"\$(git -C '$DEFAULT_EVIDENCE_REPO' status --porcelain)\" && test ! -e '$DEFAULT_EVIDENCE_REPO/.svc/dispatch'"

  SUBDIR_REPO="$TMP/subdir-dispatch-repo"
  make_plan_repo "$SUBDIR_REPO" bugfix-WI-559-subdir-dispatch WI-559
  write_review_log "$SUBDIR_REPO/docs/plans/active/review-log.yaml" PROMOTED WI-559
  fxgit "$SUBDIR_REPO" add docs/plans/active/review-log.yaml
  fxgit "$SUBDIR_REPO" commit -q -m reviewed-plan
  mkdir -p "$SUBDIR_REPO/docs/subdir"
  printf 'subdirectory dispatch payload\n' > "$TMP/subdir-payload.txt"
  reset_log
  set +e
  SVC_WORKER_WI=WI-559 SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" bash -c 'cd "$1" && bash "$2" grok review-exec "@$3"' _ "$SUBDIR_REPO/docs/subdir" "$DISPATCH_LOG" "$TMP/subdir-payload.txt" > "$TMP/subdir-dispatch.out" 2> "$TMP/subdir-dispatch.err"
  SUBDIR_DISPATCH_RC=$?
  set -e
  expect "dispatch from a subdirectory normalizes worker cwd to the authorized repo root" bash -c "test '$SUBDIR_DISPATCH_RC' -eq 0 && grep -q 'subdirectory dispatch payload' '$SVC_FAKE_LOG/grok.prompt' && test \"\$(node -e 'const fs=require(\"fs\"),a=JSON.parse(fs.readFileSync(process.argv[1],\"utf8\").trim().split(/\\n/).pop());process.stdout.write(a[a.indexOf(\"--cwd\")+1])' '$SVC_FAKE_LOG/grok.argv.json')\" = '$SUBDIR_REPO'"

  printf 'dirty before worker\n' > "$EXEC_SHELL/untracked.txt"
  set +e
  SVC_HARNESS=grok SVC_WORKER_SKILL=review-exec SVC_WORKER_MUTATION=false SVC_WORKER_MODEL=grok-4.6 SVC_WORKER_EFFORT=high SVC_WORKER_FAMILY=xai SVC_WORKER_POLICY_SHA256="$(sha256sum "$POLICY_JSON" | awk '{print $1}')" SVC_WORKER_MODE=mixed-grok-cursor SVC_WORKER_ORCHESTRATOR=codex SVC_WORKER_CWD="$EXEC_SHELL" SVC_DISPATCH_DIR="$TMP/dirty-worker-dispatch" SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_WORKER_WI=WI-559 \
    bash -c 'cd "$1" && bash "$2" "detect dirty result"' _ "$EXEC_SHELL" "$WORKER" > "$TMP/worker-dirty.out" 2> "$TMP/worker-dirty.err"
  WORKER_DIRTY_RC=$?
  set -e
  expect "dirty-tree worker result returns nonzero instead of authorizing success" bash -c "test '$WORKER_DIRTY_RC' -ne 0 && grep -q 'failed:dirty-tree' '$TMP/dirty-worker-dispatch/WI-559.result.json'"
  rm -f "$EXEC_SHELL/untracked.txt"

  set +e
  SVC_HARNESS=grok SVC_WORKER_MUTATION=false SVC_WORKER_SKILL=execute-changeset SVC_WORKER_WI=WI-559 bash "$WORKER" 'must deny mutation downgrade' > "$TMP/worker-downgrade.out" 2> "$TMP/worker-downgrade.err"
  WORKER_DOWNGRADE_RC=$?
  set -e
  expect "execute-changeset mutation classification cannot be downgraded" bash -c "test '$WORKER_DOWNGRADE_RC' -ne 0 && grep -q 'cannot be downgraded' '$TMP/worker-downgrade.err'"

  NOLOG_GUARD="$TMP/no-log-guard-repo"
  make_plan_repo "$NOLOG_GUARD" bugfix-WI-559-no-log-guard WI-559
  mkdir -p "$NOLOG_GUARD/src"
  printf 'export const blocked=true;\n' > "$NOLOG_GUARD/src/blocked.js"
  fxgit "$NOLOG_GUARD" add src/blocked.js
  set +e
  SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_HOST=codex bash -c 'cd "$1" && bash "$2"' _ "$NOLOG_GUARD" "$GUARD" > "$TMP/guard-no-log.out" 2> "$TMP/guard-no-log.err"
  GUARD_NO_LOG_RC=$?
  set -e
  expect "staged src activation with zero review logs fails closed" bash -c "test '$GUARD_NO_LOG_RC' -ne 0 && grep -q 'found no active review log' '$TMP/guard-no-log.err'"

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

  reset_log
  set +e
  SVC_WORKER_MUTATION=false SVC_WORKER_WI=WI-559 SVC_WORKER_EFFORT=xhigh SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" \
    bash -c 'cd "$1" && bash "$2" grok execute-changeset "mismatched effort must not launch"' _ "$EXEC_SHELL" "$DISPATCH_LOG" > "$TMP/dispatch-mismatch.out" 2> "$TMP/dispatch-mismatch.err"
  DISPATCH_MISMATCH_RC=$?
  set -e
  expect "dispatch logger rejects requested effort drift before worker launch" bash -c "test '$DISPATCH_MISMATCH_RC' -ne 0 && test \"\$(call_count grok)\" = 0"

  reset_log
  set +e
  SVC_WORKER_WI=WI-559 SVC_HOST=codex SVC_DISPATCH_POLICY="$POLICY_JSON" \
    bash -c 'cd "$1" && bash "$2" grok execute-changeset "execute exact reviewed tuple"' _ "$EXEC_SHELL" "$DISPATCH_LOG" > "$TMP/dispatch-exact.out" 2> "$TMP/dispatch-exact.err"
  DISPATCH_EXACT_RC=$?
  set -e
  expect "execute dispatch without a persisted delegation is denied before Grok launch" bash -c "test '$DISPATCH_EXACT_RC' -ne 0 && test \"\$(call_count grok)\" = 0 && grep -q 'persisted SVC_DELEGATION_ID' '$TMP/dispatch-exact.out'"

  node "$HELPER" record-override --repo "$EXEC_SHELL" --wi WI-559 --policy "$POLICY_JSON" --orchestrator codex --allow-override-file "$OVERRIDE" > "$TMP/shell-record-override.json"

  set +e
  SVC_DISPATCH_POLICY="$POLICY_JSON" SVC_HOST=codex SVC_EXECUTE_DISPATCH_OVERRIDE_FILE="$OVERRIDE" bash -c 'cd "$1" && bash "$2"' _ "$EXEC_SHELL" "$GUARD" > "$TMP/guard-exact.out" 2> "$TMP/guard-exact.err"
  GUARD_EXACT_RC=$?
  set -e
  expect "commit guard accepts only a recent exact current owner-override receipt" test "$GUARD_EXACT_RC" -eq 0
fi

printf '\n  %s failed, %s passed\n' "$FAIL" "$PASS"
test "$FAIL" -eq 0
