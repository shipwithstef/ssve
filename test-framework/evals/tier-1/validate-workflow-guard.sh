#!/bin/bash
# validate-workflow-guard.sh — tier-1 regression test for svc-workflow-guard.mjs
#
# Covers:
#   - Host-agnostic payload parsing (Claude, Kimi, Codex, Gemini shapes)
#   - All three modes (default, --phase-boundary, --bash-guard)
#   - Universal hard-block contract (exit 2, not exit 1)
#   - Fail-open on ambiguous input
#   - Preserves behavior from the pre-port .js version

set -u
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$REPO_ROOT/hooks/svc-workflow-guard.mjs"

FAIL=0
PASS=0

run_case() {
  local name="$1"; local mode="$2"; local payload="$3"; local expected_exit="$4"
  local actual_exit
  actual_exit=$(echo "$payload" | node "$GUARD" "$mode" > /dev/null 2>&1; echo $?)
  if [[ "$actual_exit" == "$expected_exit" ]]; then
    echo "  PASS: $name (exit=$actual_exit)"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name — expected exit=$expected_exit got $actual_exit"
    FAIL=$((FAIL+1))
  fi
}

run_case_in_dir() {
  local name="$1"; local cwd="$2"; local mode="$3"; local payload="$4"; local expected_exit="$5"
  local actual_exit
  actual_exit=$(cd "$cwd" && echo "$payload" | node "$GUARD" "$mode" > /dev/null 2>&1; echo $?)
  if [[ "$actual_exit" == "$expected_exit" ]]; then
    echo "  PASS: $name (exit=$actual_exit)"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name — expected exit=$expected_exit got $actual_exit"
    FAIL=$((FAIL+1))
  fi
}

payload_for_command() {
  local command="$1"
  local encoded
  encoded=$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$command")
  printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$encoded"
}

echo "== Bash guard: block --no-verify (hard block exit 2) =="
run_case "claude-shape no-verify"  "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m test"}}' 2
run_case "kimi-shape no-verify"    "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m test"}}' 2
run_case "codex-shape no-verify"   "--bash-guard" \
  '{"tool":"Bash","arguments":{"command":"git commit --no-verify -m test"}}' 2
run_case "gemini-shape no-verify"  "--bash-guard" \
  '{"name":"Bash","args":{"command":"git commit --no-verify -m test"}}' 2

echo "== Bash guard: allow non-violating commands =="
run_case "safe command allow"     "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' 0

echo "== Destructive git preamble enforcement =="
run_case "force push without preamble blocks" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git push --force-with-lease origin feature-x"}}' 2
run_case "force push with fresh last assistant preamble allows" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git push --force-with-lease origin feature-x"},"last_assistant_message":"DESTRUCTIVE: running git push --force-with-lease origin feature-x. Pre-check: status=clean, unpushed=0, disposition=safe."}' 0
run_case "different destructive preamble still blocks" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git reset --hard origin/main"},"last_assistant_message":"DESTRUCTIVE: running git push --force-with-lease origin feature-x. Pre-check: status=clean, unpushed=0, disposition=safe."}' 2
run_case "review disposition preamble blocks" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git push --force-with-lease origin feature-x"},"last_assistant_message":"DESTRUCTIVE: running git push --force-with-lease origin feature-x. Pre-check: status=dirty, unpushed=1, disposition=review."}' 2
run_case "reset hard without preamble blocks" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git reset --hard origin/main"}}' 2
run_case "clean force without preamble blocks" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git clean -fd"}}' 2
run_case "branch delete force without preamble blocks" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git branch -D stale-branch"}}' 2

TMP_TRANSCRIPT="$(mktemp)"
STALE_TS="$(date -u -d '6 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"   # WI-399 A2: window is 300s now
FRESH_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"timestamp":"%s","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"DESTRUCTIVE: running git reset --hard origin/main. Pre-check: status=clean, unpushed=0, disposition=safe."}]}}\n' "$STALE_TS" > "$TMP_TRANSCRIPT"
run_case "stale transcript preamble blocks" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git reset --hard origin/main\"},\"transcript_path\":\"$TMP_TRANSCRIPT\"}" 2
printf '{"timestamp":"%s","type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"DESTRUCTIVE: running git reset --hard origin/main. Pre-check: status=clean, unpushed=0, disposition=safe."}]}}\n' "$FRESH_TS" > "$TMP_TRANSCRIPT"
run_case "fresh transcript preamble allows" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git reset --hard origin/main\"},\"transcript_path\":\"$TMP_TRANSCRIPT\"}" 0
rm -f "$TMP_TRANSCRIPT"

echo "== Commit-quality: block missing Co-Authored-By (when not minimal) =="
run_case "missing co-author"      "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m test-message-without-coauthor"}}' 2
run_case "with co-author allow"   "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"short but Co-Authored-By line present\""}}' 0
run_case "fix if needed block"    "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix if needed Co-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\""}}' 2
run_case "fix if-needed block"    "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"fix if-needed Co-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\""}}' 2
run_case "fix if-needed case-insensitive" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"Fix If-Needed Co-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\""}}' 2
run_case "proper commit allow"    "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m \"feat: implement feature properly Co-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\""}}' 0

echo "== Bash guard: Base44 coding/write entity schema protection =="
TMP_BASE44="$(mktemp -d)"
trap 'rm -rf "$TMP_BASE44"' EXIT
mkdir -p "$TMP_BASE44/repo/.svc" "$TMP_BASE44/repo-logged/.svc"
cat > "$TMP_BASE44/repo/.svc/base44-schema-change-WI-test.md" <<'MD'
# Base44 Schema Write

Rollback: restore the previous entity schema if the write fails.
Round-trip: run coding/write entities/Invoice and read the schema back.
Persistence: run classify-persistence-bisect.mjs after the schema change.
RLS: run audit-base44-entity-rls.mjs before closeout.
MD
cat > "$TMP_BASE44/repo-logged/.svc/pipeline-decisions.jsonl" <<'JSONL'
{"base44_schema_write_override":true,"entity":"Invoice","reasoning":"tier-1 emergency schema repair fixture","approved_by":"tier-1"}
JSONL
BASE44_SCHEMA_CMD='curl -s -X POST "https://app.base44.com/api/apps/app-1/coding/write" -H "Content-Type: application/json" -d "{\"file_path\":\"entities/Invoice\",\"content\":\"{}\"}"'
BASE44_PLANNED_CMD='SVC_BASE44_SCHEMA_WRITE_ARTIFACT=.svc/base44-schema-change-WI-test.md curl -s -X POST "https://app.base44.com/api/apps/app-1/coding/write" -H "Content-Type: application/json" -d "{\"file_path\":\"entities/Invoice\",\"content\":\"{}\"}"'
BASE44_FUNCTION_CMD='curl -s -X POST "https://app.base44.com/api/apps/app-1/coding/write" -H "Content-Type: application/json" -d "{\"file_path\":\"functions/redeployInvoice\",\"content\":\"export default {}\"}"'
run_case_in_dir "ad hoc entity schema write blocks" "$TMP_BASE44/repo" "--bash-guard" \
  "$(payload_for_command "$BASE44_SCHEMA_CMD")" 2
run_case_in_dir "planned entity schema write with artifact allows" "$TMP_BASE44/repo" "--bash-guard" \
  "$(payload_for_command "$BASE44_PLANNED_CMD")" 0
run_case_in_dir "logged schema-write override allows" "$TMP_BASE44/repo-logged" "--bash-guard" \
  "$(payload_for_command "$BASE44_SCHEMA_CMD")" 0
run_case_in_dir "function coding/write recovery remains allowed" "$TMP_BASE44/repo" "--bash-guard" \
  "$(payload_for_command "$BASE44_FUNCTION_CMD")" 0
run_case_in_dir "read-only coding/write docs search remains allowed" "$TMP_BASE44/repo" "--bash-guard" \
  "$(payload_for_command 'rg "coding/write entities/" skills/base44-environment/SKILL.md')" 0

echo "== Edit/Write default: config protection (WI-399 A4: ask-class + hard-deny) =="
# ask-class configs: exit 0 WITH a native permissionDecision:ask payload
ask_case() {
  local name="$1"; local payload="$2"
  local out; out=$(echo "$payload" | node "$GUARD" --edit-write 2>/dev/null)
  local code=$?
  if [[ "$code" == "0" && "$out" == *'"permissionDecision":"ask"'* ]]; then
    echo "  PASS: $name (ask emitted)"; PASS=$((PASS+1))
  else
    echo "  FAIL: $name — expected ask JSON + exit 0, got exit=$code"; FAIL=$((FAIL+1))
  fi
}
ask_case "eslint.config.js asks" \
  '{"tool_name":"Edit","tool_input":{"file_path":"/x/eslint.config.js","old_string":"a","new_string":"b"}}'
ask_case "tsconfig.json asks" \
  '{"tool_name":"Write","tool_input":{"file_path":"/x/tsconfig.json","content":""}}'
# hard-deny class: lock files + env secrets still exit 2 (negative fixture)
run_case "package-lock.json hard-denies" "--edit-write" \
  '{"tool_name":"Write","tool_input":{"file_path":"/x/package-lock.json","content":""}}' 2
run_case ".env hard-denies" "--edit-write" \
  '{"tool_name":"Edit","tool_input":{"file_path":"/x/.env","old_string":"a","new_string":"b"}}' 2
run_case "regular file allow"     "--edit-write" \
  '{"tool_name":"Edit","tool_input":{"file_path":"/x/src/feature.ts","old_string":"a","new_string":"b"}}' 0
# logged-override channel: pre-authorized path edits pass silently
TMP_OVR="$(mktemp -d)"
mkdir -p "$TMP_OVR/.svc"
printf '%s\n' '{"config_protection_override":true,"path_prefix":"hooks/","reasoning":"tier-1 fixture: user pre-authorized hook edits","approved_by":"tier-1"}' > "$TMP_OVR/.svc/pipeline-decisions.jsonl"
run_case_in_dir "logged override allows protected path" "$TMP_OVR" "--edit-write" \
  '{"tool_name":"Edit","tool_input":{"file_path":"hooks/svc-x.mjs","old_string":"a","new_string":"b"}}' 0
rm -rf "$TMP_OVR"

echo "== Fail-open on ambiguous input =="
run_case "empty payload"    "--bash-guard"    ""                                       0
run_case "empty json"       "--bash-guard"    "{}"                                     0
run_case "literal envvar"   "--bash-guard"    '$TOOL_INPUT'                            0
run_case "malformed"        "--bash-guard"    "not-json"                               0
run_case "no tool_input"    "--edit-write"    '{"tool_name":"Bash"}'                   0

echo "== Phase-boundary: soft warning on planning-file edit in repo with src/ =="
# This one uses edit-write not phase-boundary — verifies no accidental block when
# src/ exists in cwd. We just assert exit 0 (soft warning goes to stderr).
run_case "planning file warn-only" "--phase-boundary" \
  '{"tool_name":"Edit","tool_input":{"file_path":"/x/docs/specs/features/foo.md","old_string":"a","new_string":"b"}}' 0

echo "== WI-399 A2: op+target preamble matching (spelling-robust) =="
A2_PRE='DESTRUCTIVE: running git branch -D stale-x. Pre-check: status=merged, unpushed=0, disposition=safe.'
run_case "op+target preamble validates plain spelling" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git branch -D stale-x\"},\"last_assistant_message\":\"$A2_PRE\"}" 0
run_case "op+target preamble validates cd+pipe respelling" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"cd /r && git branch -D stale-x 2>&1 | tail -3\"},\"last_assistant_message\":\"$A2_PRE\"}" 0
run_case "op+target preamble validates git -C respelling" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git -C /r branch -D stale-x\"},\"last_assistant_message\":\"$A2_PRE\"}" 0
run_case "wrong target still blocks (negative)" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git branch -D other-y\"},\"last_assistant_message\":\"$A2_PRE\"}" 2
# G6 R2-F1 attack repro: extracted target must not float-match preamble
# boilerplate (target "clean" vs "status=clean")
run_case "boilerplate-floating target still blocks (G6 F1 repro)" "--bash-guard" \
  "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git branch -D clean\"},\"last_assistant_message\":\"DESTRUCTIVE: running git branch -D safe-branch. Pre-check: status=clean, unpushed=0, disposition=safe.\"}" 2

echo "== WI-399 A5: --no-gpg-sign is NOT a check bypass (skips signing only) =="
run_case "no-gpg-sign alone allows" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit --no-gpg-sign -m \"feat: signed-off properly Co-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\""}}' 0
run_case "no-verify still blocks (negative fixture)" "--bash-guard" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit --no-verify -m \"feat: msg Co-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\""}}' 2

echo "== WI-399 A5: git commit -F <file> — trailer in the message FILE =="
TMP_MSG="$(mktemp -d)"
printf 'feat: proper subject\n\nBody.\n\nCo-Authored-By: Antigravity <contact-4a2d56cec3@example.invalid>\n' > "$TMP_MSG/with-trailer.txt"
printf 'feat: proper subject\n\nBody without any trailer.\n' > "$TMP_MSG/without-trailer.txt"
run_case_in_dir "commit -F with trailer in file allows" "$TMP_MSG" "--bash-guard" \
  "$(payload_for_command "git commit -F $TMP_MSG/with-trailer.txt")" 0
run_case_in_dir "commit --file= with trailer in file allows" "$TMP_MSG" "--bash-guard" \
  "$(payload_for_command "git commit --file=$TMP_MSG/with-trailer.txt")" 0
run_case_in_dir "commit -F WITHOUT trailer in file blocks (negative fixture)" "$TMP_MSG" "--bash-guard" \
  "$(payload_for_command "git commit -F $TMP_MSG/without-trailer.txt")" 2
run_case_in_dir "commit -F unreadable file blocks (fail-closed)" "$TMP_MSG" "--bash-guard" \
  "$(payload_for_command "git commit -F $TMP_MSG/nonexistent.txt")" 2
rm -rf "$TMP_MSG"

echo "== WI-399 A1: merged default mode carries the dynamic phase gate (one spawn) =="
TMP_PHASE="$(mktemp -d)"
mkdir -p "$TMP_PHASE/.svc" "$TMP_PHASE/src"
cat > "$TMP_PHASE/.svc/lane-tasks-WI-T.json" <<'JSON'
{"wi":"WI-T","tasks":[{"id":"t1","skill":"plan-changeset","status":"pending"}]}
JSON
run_case_in_dir "default mode blocks src/ edit when plan-changeset pending" "$TMP_PHASE" "--edit-write" \
  '{"tool_name":"Edit","tool_input":{"file_path":"src/feature.ts","old_string":"a","new_string":"b"}}' 2
cat > "$TMP_PHASE/.svc/lane-tasks-WI-T.json" <<'JSON'
{"wi":"WI-T","tasks":[{"id":"t1","skill":"plan-changeset","status":"completed"}]}
JSON
run_case_in_dir "default mode allows src/ edit when plan-changeset completed" "$TMP_PHASE" "--edit-write" \
  '{"tool_name":"Edit","tool_input":{"file_path":"src/feature.ts","old_string":"a","new_string":"b"}}' 0
rm -rf "$TMP_PHASE"

echo
echo "== Summary =="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
