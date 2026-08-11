#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOOK="$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -m 700 -p "$TMP/home" "$TMP/runtime" "$TMP/repo"
git -C "$TMP/repo" init -q
printf '%s\n' alpha beta > "$TMP/repo/sample.txt"

FAIL=0
pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1" >&2; FAIL=$((FAIL + 1)); }

payload() {
  node -e 'process.stdout.write(JSON.stringify({host:"codex",tool_name:"Bash",tool_input:{command:process.argv[1]},cwd:process.argv[2]}))' "$1" "$TMP/repo"
}

expect_allow() {
  local command="$1" label="$2" output
  output="$(payload "$command" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_SESSION_ID -u CODEX_SESSION_ID -u CODEX_THREAD_ID node "$HOOK")"
  if [ "$(printf '%s' "$output" | tr -d '[:space:]')" = '{}' ] || printf '%s' "$output" | grep -q 'permissionDecision.*allow'; then pass "$label"; else fail "$label ($output)"; fi
}

expect_deny() {
  local command="$1" label="$2" output
  output="$(payload "$command" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_SESSION_ID -u CODEX_SESSION_ID -u CODEX_THREAD_ID node "$HOOK")"
  if printf '%s' "$output" | grep -q 'permissionDecision.*deny'; then pass "$label"; else fail "$label ($output)"; fi
}

expect_allow "sed -n '1,20p' sample.txt" "quoted sed read needs no session or WI"
expect_allow "git rev-parse --show-toplevel" "git rev-parse read needs no session or WI"
expect_allow "git branch --show-current" "git branch inspection needs no session or WI"
expect_allow "git branch" "bare git branch listing needs no session or WI"
expect_allow "git worktree list --porcelain" "git worktree inspection needs no session or WI"
expect_allow "rg -n 'alpha|beta' sample.txt | head -n 5" "quoted piped read needs no session or WI"
expect_allow "sed -n '1,20p' sample.txt 2>/dev/null" "diagnostic redirection to dev-null stays read-only"
expect_allow "sed -n '1,20p' sample.txt >/dev/null 2>&1" "combined diagnostic redirections stay read-only"
expect_allow "git status 2>&1" "file-descriptor duplication stays read-only"
status_output="$(payload "git status" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_SESSION_ID -u CODEX_SESSION_ID -u CODEX_THREAD_ID node "$HOOK")"
if printf '%s' "$status_output" | grep -q 'export GIT_OPTIONAL_LOCKS=0; git status'; then pass "authority-free git status disables optional index locks"; else fail "authority-free git status disables optional index locks ($status_output)"; fi
compound_status_output="$(payload "git rev-parse --show-toplevel && git status" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_SESSION_ID -u CODEX_SESSION_ID -u CODEX_THREAD_ID node "$HOOK")"
if printf '%s' "$compound_status_output" | grep -q 'export GIT_OPTIONAL_LOCKS=0; git rev-parse.*&& git status'; then pass "optional-lock protection covers every segment of a compound read"; else fail "optional-lock protection covers every segment of a compound read ($compound_status_output)"; fi
expect_allow "sort sample.txt" "sort without an output target stays read-only"
expect_allow "uniq sample.txt" "uniq with one input stays read-only"
expect_allow "file sample.txt" "file inspection stays read-only"
expect_allow "cat /etc/os-release" "external regular-file read needs no session or WI"
expect_allow "node --version" "known runtime version probe needs no session or WI"
expect_allow "SVC_SUBAGENT=1 git --git-dir=$TMP/repo/.git show HEAD:sample.txt" "delegated exact-object read needs no controller authority"
expect_allow "SVC_SUBAGENT=1 git -C $TMP/repo show HEAD:sample.txt" "delegated git -C read needs no controller authority"

expect_deny "git branch new-branch" "git branch mutation remains governed"
expect_deny "SVC_SUBAGENT=1 git --git-dir=$TMP/repo/.git branch delegated-mutation" "delegated assignment cannot launder a git mutation"
expect_deny "SVC_SUBAGENT=1 git -c core.pager=cat show HEAD:sample.txt" "unsafe git global config remains governed"
expect_deny "sed -i 's/a/b/' sample.txt" "sed in-place mutation remains governed"
expect_deny "sed -n '1p' -e1wchanged.txt" "sed option-shaped output operand remains governed"
expect_deny "sed -n '1p' \"-e1wchanged.txt\"" "quoted sed option-shaped operand remains governed"
expect_deny "sed -n '1p' \\-e1wchanged.txt" "escaped sed option-shaped operand remains governed"
expect_deny "cat sample.txt > changed.txt" "output redirection remains governed"
expect_deny "cat sample.txt &> changed.txt" "combined file redirection remains governed"
expect_deny "sort -o changed.txt sample.txt" "sort output file remains governed"
expect_deny "uniq sample.txt changed.txt" "uniq output file remains governed"
expect_deny "file -C -m sample.txt" "file magic compilation remains governed"
expect_deny "file -Cm sample.txt" "compact file magic compilation remains governed"
expect_deny "node scripts/unknown.mjs --help" "arbitrary script help does not bypass authority"
expect_deny "git status && touch changed.txt" "mixed read/write chain remains governed"

if find "$TMP/repo" "$TMP/runtime" "$TMP/home" -path '*/.svc/*' -print -quit | grep -q .; then
  fail "read classification created authority state"
else
  pass "read classification created no authority state"
fi

samples=()
benchmark_payload="$(payload "sed -n '1,2p' sample.txt")"
for _ in $(seq 1 5); do
  printf '%s' "$benchmark_payload" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_SESSION_ID -u CODEX_SESSION_ID -u CODEX_THREAD_ID node "$HOOK" >/dev/null
done
for _ in $(seq 1 40); do
  start_ns="$(date +%s%N)"
  printf '%s' "$benchmark_payload" | HOME="$TMP/home" XDG_RUNTIME_DIR="$TMP/runtime" env -u SVC_SESSION_ID -u CODEX_SESSION_ID -u CODEX_THREAD_ID node "$HOOK" >/dev/null
  samples+=("$(( ( $(date +%s%N) - start_ns ) / 1000000 ))")
done
IFS=$'\n' sorted=($(printf '%s\n' "${samples[@]}" | sort -n)); unset IFS
p95_ms="${sorted[37]}"
baseline_samples=()
for _ in $(seq 1 20); do
  start_ns="$(date +%s%N)"; node -e '' >/dev/null
  baseline_samples+=("$(( ( $(date +%s%N) - start_ns ) / 1000000 ))")
done
IFS=$'\n' baseline_sorted=($(printf '%s\n' "${baseline_samples[@]}" | sort -n)); unset IFS
baseline_p95="${baseline_sorted[18]}"
allowed_ms=100
[ "$baseline_p95" -le 45 ] || allowed_ms=$(( baseline_p95 + 75 ))
if [ "$p95_ms" -le "$allowed_ms" ]; then
  pass "native read-hook p95 budget (${p95_ms}ms raw; ${baseline_p95}ms Node baseline; ${allowed_ms}ms contention-adjusted ceiling)"
else
  fail "native read-hook p95 budget (${p95_ms}ms raw; ${baseline_p95}ms Node baseline; ${allowed_ms}ms ceiling)"
fi

if [ "$FAIL" -ne 0 ]; then
  printf 'validate-codex-zero-block-reads: %s failed\n' "$FAIL" >&2
  exit 1
fi
printf 'validate-codex-zero-block-reads: 35 passed, 0 failed\n'
