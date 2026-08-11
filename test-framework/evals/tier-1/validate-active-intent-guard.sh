#!/usr/bin/env bash
#
# Tier-1 regression test: latest active user intent suppresses stale Stop-hook
# completion pressure unless the user explicitly resumes the same WI.
#
set -euo pipefail

echo "=== Tier 1: Active intent guard for stale Stop-hook completion pressure ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

write_graph() {
  local repo="$1"
  local wi="$2"
  mkdir -p "$repo/.svc"
  cat > "$repo/.svc/lane-tasks-${wi}.json" <<JSON
{
  "wi": "${wi}",
  "lane": "framework",
  "created": "2026-06-04T20:00:00.000Z",
  "status": "pending",
  "tasks": [
    {
      "id": 18,
      "status": "pending",
      "subject": "base44-environment: deploy Phase 1 through canonical flow",
      "metadata": { "skill": "base44-environment" }
    },
    {
      "id": 19,
      "status": "pending",
      "subject": "verify-promotion: production API/UI proof",
      "metadata": { "skill": "verify-promotion" }
    },
    {
      "id": 20,
      "status": "pending",
      "subject": "track-visuals: capture desktop and mobile screenshots",
      "metadata": { "skill": "track-visuals" }
    }
  ]
}
JSON
}

write_contract() {
  local repo="$1"
  local wi="$2"
  mkdir -p "$repo/.svc"
  cat > "$repo/.svc/session-contract.jsonl" <<JSONL
{"timestamp":"2026-06-04T20:00:00.000Z","wi":"${wi}","bound_to":"${wi}","execution_mode":"end_to_end","request":"Proceed with stale ${wi} closeout."}
JSONL
}

make_repo() {
  local repo="$1"
  local primary_wi="${2:-WI-335}"
  mkdir -p "$repo"
  write_graph "$repo" "$primary_wi"
  write_contract "$repo" "$primary_wi"
}

json_prompt() {
  local repo="$1"
  local session="$2"
  local prompt="$3"
  printf '{"session_id":"%s","cwd":"%s","prompt":"%s"}' "$session" "$repo" "$prompt"
}

record_prompt() {
  local repo="$1"
  local session="$2"
  local prompt="$3"
  (
    cd "$repo"
    json_prompt "$repo" "$session" "$prompt" | node "$ROOT/hooks/svc-prompt-stale-state.mjs" >/dev/null 2>/dev/null
  )
}

run_guard() {
  local repo="$1"
  local session="$2"
  local stdout_file="$3"
  local stderr_file="$4"
  shift 4
  (
    cd "$repo"
    "$@" bash "$ROOT/hooks/svc-task-completion-guard.sh" \
      >"$stdout_file" \
      2>"$stderr_file" \
      <<<"$(printf '{"session_id":"%s","cwd":"%s"}' "$session" "$repo")"
  )
}

assert_not_blocked() {
  local stdout_file="$1"
  local stderr_file="$2"
  local label="$3"
  if grep -q '"decision":"block"' "$stdout_file"; then
    echo "FAIL: $label produced a hard Stop-hook block" >&2
    cat "$stdout_file" >&2
    exit 1
  fi
  if ! grep -q "advisory only" "$stderr_file"; then
    echo "FAIL: $label did not emit advisory-only output" >&2
    cat "$stderr_file" >&2
    exit 1
  fi
}

assert_blocked() {
  local stdout_file="$1"
  local label="$2"
  if ! grep -q '"decision":"block"' "$stdout_file"; then
    echo "FAIL: $label should preserve the normal completion-guard block" >&2
    cat "$stdout_file" >&2
    exit 1
  fi
}

PHRASES=(
  "stop"
  "ignore this"
  "this is unrelated to the current conversation"
  "what are you doing this was a talk about a totally unrelated thing"
)

for phrase in "${PHRASES[@]}"; do
  repo="$TMP_ROOT/phrase-${phrase//[^a-zA-Z0-9]/-}"
  make_repo "$repo" "WI-335"
  stdout_file="$repo/stdout.txt"
  stderr_file="$repo/stderr.txt"
  record_prompt "$repo" "sess-a" "$phrase"
  run_guard "$repo" "sess-a" "$stdout_file" "$stderr_file" env
  assert_not_blocked "$stdout_file" "$stderr_file" "phrase '$phrase'"
done
echo "  Correction phrase suppression: PASS"

repo="$TMP_ROOT/new-topic"
make_repo "$repo" "WI-335"
record_prompt "$repo" "sess-a" "I need accounting and launch vehicle advice before deciding what to commit"
run_guard "$repo" "sess-a" "$repo/stdout.txt" "$repo/stderr.txt" env
assert_not_blocked "$repo/stdout.txt" "$repo/stderr.txt" "new non-WI user topic after stale contract"
echo "  New non-WI prompt after stale concrete WI contract suppresses: PASS"

# Captured WI-479 sequence: a newer ordinary user prompt replaces stale
# backlog pressure, while an exact same-session resume restores it. Keep the
# resume beyond the persisted 240-character preview to prove classification
# metadata, not truncated raw text, carries authority.
repo="$TMP_ROOT/wi-479-captured-sequence"
make_repo "$repo" "WI-479"
record_prompt "$repo" "sess-a" "there is more implementation? how much more what remains"
run_guard "$repo" "sess-a" "$repo/unrelated.out" "$repo/unrelated.err" env
assert_not_blocked "$repo/unrelated.out" "$repo/unrelated.err" "captured WI-479 latest prompt"
printf -v long_prefix '%0250d' 0
record_prompt "$repo" "sess-a" "$long_prefix resume WI-479"
run_guard "$repo" "sess-a" "$repo/resume.out" "$repo/resume.err" env
assert_blocked "$repo/resume.out" "captured WI-479 long explicit resume"
echo "  Captured WI-479 latest-prompt and long-resume sequence: PASS"

repo="$TMP_ROOT/continue"
make_repo "$repo" "WI-335"
record_prompt "$repo" "sess-a" "what are you doing this is unrelated"
record_prompt "$repo" "sess-a" "continue WI-335"
run_guard "$repo" "sess-a" "$repo/stdout.txt" "$repo/stderr.txt" env
assert_blocked "$repo/stdout.txt" "explicit continue WI-335"
echo "  Explicit same-WI continuation restores hard block: PASS"

repo="$TMP_ROOT/different-session"
make_repo "$repo" "WI-335"
record_prompt "$repo" "sess-a" "unrelated"
run_guard "$repo" "sess-b" "$repo/stdout.txt" "$repo/stderr.txt" env
assert_blocked "$repo/stdout.txt" "different session"
echo "  Session-scoped suppression: PASS"

repo="$TMP_ROOT/different-wi"
make_repo "$repo" "WI-335"
write_graph "$repo" "WI-336"
record_prompt "$repo" "sess-a" "ignore WI-335"
run_guard "$repo" "sess-a" "$repo/stdout.txt" "$repo/stderr.txt" env SVC_WORKER_WI=WI-336
assert_blocked "$repo/stdout.txt" "different WI"
echo "  WI-scoped suppression: PASS"

repo_a="$TMP_ROOT/repo-a"
repo_b="$TMP_ROOT/repo-b"
make_repo "$repo_a" "WI-335"
make_repo "$repo_b" "WI-335"
record_prompt "$repo_a" "sess-a" "unrelated"
run_guard "$repo_b" "sess-a" "$repo_b/stdout.txt" "$repo_b/stderr.txt" env
assert_blocked "$repo_b/stdout.txt" "different repo/cwd"
echo "  Repo/cwd-scoped suppression: PASS"

echo "Active intent guard regression: passed"
exit 0
