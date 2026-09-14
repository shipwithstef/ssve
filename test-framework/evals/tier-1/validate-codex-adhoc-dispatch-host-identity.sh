#!/usr/bin/env bash
# WI-FW-CODEX-SVC-HOST-DISPATCH-01 — ad-hoc Codex lane dispatch must not lose
# host identity. Proves:
#   P0-1  hostIdentity() fallback chain (CODEX_THREAD_ID | CODEX_SESSION_ID |
#         CODEX_HOME | canonical hooks/codex path) resolves when wiring omits
#         SVC_HOST, while an explicit-but-unknown SVC_HOST still fails closed;
#   P0-2  scripts/lib/dispatch-codex-lane.sh exports SVC_HOST=codex into the
#         detached child and refuses to wrap non-codex commands;
#   P1-1  read-only `az pipelines runs show|list` is provider observation
#         (zero-block with NO identity evidence at all); mutating az shapes,
#         file-writing flags, and `az devops invoke` stay governed.
# Acceptance: a relaunched lane can poll Azure after a failed build without a
# host-identity deny.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOOK="$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"
DISPATCH="$ROOT/scripts/lib/dispatch-codex-lane.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -m 700 -p "$TMP/home" "$TMP/runtime" "$TMP/repo" "$TMP/bin" "$TMP/jobs" "$TMP/codex-home"
git -C "$TMP/repo" init -q
printf '%s\n' alpha beta > "$TMP/repo/sample.txt"

FAIL=0
pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; FAIL=$((FAIL + 1)); }

payload() {
  node -e 'process.stdout.write(JSON.stringify({session_id:"svc-adhoc-lane-session",tool_name:"Bash",tool_input:{command:process.argv[1]},cwd:process.argv[2]}))' "$1" "$TMP/repo"
}

# Run the dispatcher WITHOUT SVC_HOST, with caller-supplied extra env as args.
run_hook() {
  local command="$1"; shift
  payload "$command" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_HOST "$@" node "$HOOK"
}

# A governed mutation is the probe for fallback resolution: it must get PAST
# the host-identity gate and fail on missing binding authority instead.
assert_past_host_gate() {
  local label="$1"; shift
  local output
  output="$(run_hook "touch changed.txt" "$@")"
  if printf '%s' "$output" | grep -q 'permissionDecision.*deny' \
     && ! printf '%s' "$output" | grep -q 'host identity missing'; then
    pass "$label"
  else
    fail "$label ($output)"
  fi
}

expect_allow() {
  local command="$1" label="$2"
  local output
  output="$(run_hook "$command" -u CODEX_THREAD_ID -u CODEX_SESSION_ID -u CODEX_HOME)"
  if [ "$(printf '%s' "$output" | tr -d '[:space:]')" = '{}' ] || printf '%s' "$output" | grep -q 'permissionDecision.*allow'; then pass "$label"; else fail "$label ($output)"; fi
}

expect_deny() {
  local command="$1" label="$2"
  local output
  output="$(run_hook "$command" -u CODEX_THREAD_ID -u CODEX_SESSION_ID -u CODEX_HOME)"
  if printf '%s' "$output" | grep -q 'permissionDecision.*deny'; then pass "$label"; else fail "$label ($output)"; fi
}

# --- P0-1: hostIdentity() fallback chain ------------------------------------
assert_past_host_gate "CODEX_THREAD_ID alone resolves host identity" CODEX_THREAD_ID="thread-adhoc-01"
assert_past_host_gate "CODEX_SESSION_ID alone resolves host identity" CODEX_SESSION_ID="session-adhoc-01"
assert_past_host_gate "CODEX_HOME alone resolves host identity"       CODEX_HOME="$TMP/codex-home"
assert_past_host_gate "canonical hooks/codex install path resolves host identity"

host_gate_output="$(run_hook "touch changed.txt" CODEX_THREAD_ID="thread-adhoc-01" SVC_HOST=bogus-host)"
if printf '%s' "$host_gate_output" | grep -q 'host identity missing'; then
  pass "explicit but unknown SVC_HOST still fails closed over codex inference"
else
  fail "explicit but unknown SVC_HOST still fails closed ($host_gate_output)"
fi

# --- P1-1: az pipelines runs show|list is provider observation --------------
AZ_SHOW="az pipelines runs show --id 11 --organization https://dev.azure.com/org --project proj --query '{status:status,result:result}' --output json"
AZ_LIST="az pipelines runs list --organization https://dev.azure.com/org --project proj --top 5 --output table"
expect_allow "$AZ_SHOW" "az pipelines runs show polls Azure with zero identity evidence (acceptance)"
expect_allow "$AZ_LIST" "az pipelines runs list polls Azure with zero identity evidence"
expect_deny "az pipelines runs show --id 11 --output-file leaked.json" "az output-file write remains governed"
expect_deny "az pipelines build queue --definition-name ios --organization x" "az build queue remains governed"
expect_deny "az devops invoke --area build --resource timeline --route-parameters project=p buildId=11" "az devops invoke remains governed"

# Acceptance end-to-end: ad-hoc lane env (CODEX_THREAD_ID only, no SVC_HOST)
# can both poll Azure and read files without any host-identity deny.
lane_output="$(run_hook "$AZ_SHOW" CODEX_THREAD_ID="thread-adhoc-01")"
if [ "$(printf '%s' "$lane_output" | tr -d '[:space:]')" = '{}' ]; then
  pass "relaunched lane polls failed Azure build without host-identity deny"
else
  fail "relaunched lane polls failed Azure build ($lane_output)"
fi

# --- P0-2: dispatch-codex-lane.sh exports SVC_HOST=codex ---------------------
if [ -x "$DISPATCH" ] || [ -f "$DISPATCH" ]; then
  pass "dispatch-codex-lane.sh exists at scripts/lib/"
else
  fail "dispatch-codex-lane.sh exists at scripts/lib/ (missing)"
fi

cat > "$TMP/bin/codex" <<'EOF'
#!/usr/bin/env bash
printf 'SVC_HOST=%s ARGS=%s\n' "${SVC_HOST:-UNSET}" "$*"
EOF
chmod +x "$TMP/bin/codex"

stub_out="$(PATH="$TMP/bin:$PATH" SVC_CODEX_JOBS_ROOT="$TMP/jobs" bash "$DISPATCH" --label t1 -- "$TMP/bin/codex" exec --flag prompt)"
job_log="$(printf '%s' "$stub_out" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).log_path||"")}catch{process.stdout.write("")}})')"
if [ -n "$job_log" ]; then
  for _ in $(seq 1 25); do grep -q 'SVC_HOST=codex' "$job_log" 2>/dev/null && break; sleep 0.2; done
  if grep -q 'SVC_HOST=codex' "$job_log" 2>/dev/null; then
    pass "detached codex child inherits SVC_HOST=codex from dispatch wrapper"
  else
    fail "detached codex child inherits SVC_HOST=codex ($(cat "$job_log" 2>/dev/null || echo 'no log'))"
  fi
  if printf '%s' "$stub_out" | grep -q '"job_id":"codex-lane-' && printf '%s' "$stub_out" | grep -q '"pid_path":'; then
    pass "dispatch wrapper emits job_id/pid_path JSON contract"
  else
    fail "dispatch wrapper emits job JSON ($stub_out)"
  fi
  if [ -s "$TMP/jobs/index.jsonl" ]; then
    pass "dispatch wrapper appends launch registry line"
  else
    fail "dispatch wrapper appends launch registry line"
  fi
else
  fail "dispatch wrapper emits log_path JSON ($stub_out)"
fi

if PATH="$TMP/bin:$PATH" SVC_CODEX_JOBS_ROOT="$TMP/jobs" bash "$DISPATCH" -- echo hijack >/dev/null 2>&1; then
  fail "non-codex invocation is refused"
else
  pass "non-codex invocation is refused"
fi

if find "$TMP/repo" -path '*/.svc/*' -print -quit | grep -q .; then
  fail "identity resolution created authority state in the probed repo"
else
  pass "identity resolution created no authority state"
fi

if [ "$FAIL" -ne 0 ]; then
  printf 'validate-codex-adhoc-dispatch-host-identity: %s failed\n' "$FAIL" >&2
  exit 1
fi
printf 'validate-codex-adhoc-dispatch-host-identity: 17 passed, 0 failed\n'
