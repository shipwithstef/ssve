#!/usr/bin/env bash
set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

# Host-identity assertions must not inherit the shell that launched this suite.
unset SVC_HOST GROK_SESSION_ID GROK_HOME GROK_CLI XAI_API_KEY

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
export CODEX_SKILLS_DIR="$ROOT/skills"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"
RUNTIME="$TMP/runtime"
mkdir -m 700 "$RUNTIME"
SESSION="codex-test-session"
TURN="turn-1"
GRAPH_DIR="$TMP/graph"
GRAPH="$GRAPH_DIR/lane-tasks-WI-485.json"
CLAIMS="$GRAPH_DIR/claims"
CONTRACT="$TMP/session-contract.jsonl"
GUARD="$TMP/completion-guard.sh"
mkdir -m 700 "$GRAPH_DIR"
mkdir -m 700 "$CLAIMS"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({wi:"WI-485",lane:"framework",status:"in_progress",tasks:[{id:1,skill:"execute-changeset",status:"in_progress",subject:"fixture task",metadata:{skill:"execute-changeset",wi:"WI-485"},blocked_by:[]}]},null,2))' "$GRAPH"
printf '%s\n' '#!/usr/bin/env bash' 'printf '\''{"decision":"block","reason":"continue %s"}\n'\'' "$SVC_WORKER_WI"' > "$GUARD"
chmod 700 "$GUARD"
export SVC_CODEX_TEST_MODE=1
export NODE_ENV=test
export SVC_CODEX_TASK_GRAPH="$GRAPH"
export SVC_CODEX_CLAIMS_DIR="$CLAIMS"
export SVC_CODEX_SESSION_CONTRACT="$CONTRACT"
export SVC_CODEX_COMPLETION_GUARD="$GUARD"
export SVC_CODEX_TEST_REPO="$ROOT"
TEST_CWD="$TMP/codex-consumer"
mkdir -p "$TEST_CWD/.svc"
git -C "$TEST_CWD" init -q -b main
git -C "$TEST_CWD" config user.email t@t
git -C "$TEST_CWD" config user.name t
export SVC_CODEX_TEST_REPO="$TEST_CWD"
PASS=0
FAIL=0

ok() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
bad() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
expect() { local label="$1"; shift; if "$@"; then ok "$label"; else bad "$label"; fi; }

for f in \
  hooks/codex/lib/codex-hook-context.mjs \
  hooks/codex/svc-codex-prompt-authority.mjs \
  hooks/codex/svc-codex-stop-firewall.mjs \
  hooks/codex/svc-codex-skill-load-enforcer.mjs \
  scripts/codex-load-skill.mjs; do
  expect "$f parses" node --check "$ROOT/$f"
done
CODEX_ASK="$(node --input-type=module -e 'import {emitDecision,ASK} from "./hooks/lib/hook-decision.mjs"; emitDecision({host:"codex",event:"PreToolUse",decision:ASK,reason:"protected fixture"})')"
expect "Codex ask is normalized to a supported deny" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$CODEX_ASK"
CLAUDE_ASK="$(node --input-type=module -e 'import {emitDecision,ASK} from "./hooks/lib/hook-decision.mjs"; emitDecision({host:"claude",event:"PreToolUse",decision:ASK,reason:"protected fixture"})')"
expect "Claude ask remains interactive" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="ask"?0:1)' "$CLAUDE_ASK"
expect "explicit turn id remains unchanged and absent Grok turn falls back to session" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { turnId } from "./hooks/codex/lib/codex-hook-context.mjs";
  assert.equal(turnId({session_id:"sid-1",turn_id:"turn-1"},{}),"turn-1");
  assert.equal(turnId({session_id:"sid-1"},{}),"session:sid-1");
  assert.equal(turnId({}, {CODEX_THREAD_ID:"sid-env"}),"session:sid-env");
  assert.equal(turnId({}, {}),"");
'
expect "all supported shell aliases share one canonical classifier" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { SHELL_TOOLS, isShellTool } from "./hooks/lib/shell-tools.mjs";
  const expected = ["Bash", "Shell", "run_shell_command", "shell", "run_terminal_command"];
  assert.deepEqual([...SHELL_TOOLS], expected);
  for (const name of expected) assert.equal(isShellTool(name), true);
  assert.equal(isShellTool("terminal"), false);
'
expect "GROK_SESSION_ID resolves shared authority host and session without Codex fallback" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { resolveAuthorityHost, sessionId } from "./hooks/lib/resolve-wi.mjs";
  const env = { GROK_SESSION_ID: "grok-session-01" };
  assert.equal(resolveAuthorityHost({}, env), "grok");
  assert.equal(sessionId({}, env), "grok-session-01");
  assert.equal(resolveAuthorityHost({host:"claude"}, env), "grok");
  assert.equal(resolveAuthorityHost({host:"claude"}, {SVC_HOST:"grok"}), "grok");
  assert.equal(resolveAuthorityHost({}, {SVC_HOST:"bogus",GROK_SESSION_ID:"grok-session-01"}), "");
'
expect "dispatcher gives Grok marker precedence over hooks/codex fallback without shell-interpolating session identity" node -e '
  const fs=require("fs"),s=fs.readFileSync(process.argv[1],"utf8");
  const grok=s.indexOf("process.env.GROK_SESSION_ID");
  const fallback=s.indexOf("path.basename(HERE)");
  if(grok<0||fallback<0||grok>fallback)process.exit(1);
  if(!s.includes("`SVC_HOST=${hostId} ${encodeSimpleCommand(bootstrapArgv)}`")||s.includes("SVC_SESSION_ID=${JSON.stringify(sid)}"))process.exit(1);
' "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"
expect "bootstrap parser accepts only the allowlisted propagated host prefix" node --input-type=module -e '
  import assert from "node:assert/strict";
  import { parseBootstrapCommand } from "./hooks/codex/lib/bootstrap-command.mjs";
  const base = "node scripts/svc-ensure-worktree.mjs --wi WI-GROK-PROBE-01 --branch framework-WI-GROK-PROBE-01 --from origin/main --print-cd";
  const parsed = parseBootstrapCommand(`SVC_HOST=grok ${base}`);
  assert.equal(parsed.identity.SVC_HOST, "grok");
  assert.equal(parseBootstrapCommand(`SVC_HOST=unknown ${base}`), null);
  assert.equal(parseBootstrapCommand(`SVC_HOST=grok SVC_SESSION_ID=x ${base}`), null);
  assert.equal(parseBootstrapCommand(`EVIL=value ${base}`), null);
'
GROK_BOOT_SRC="$TMP/grok-boot-src"
GROK_BOOT_REPO="$TMP/grok-boot-repo"
GROK_BOOT_RUNTIME="$TMP/grok-boot-runtime"
mkdir -p "$GROK_BOOT_SRC" "$GROK_BOOT_RUNTIME"
chmod 700 "$GROK_BOOT_RUNTIME"
git -C "$GROK_BOOT_SRC" init -q -b main
git -C "$GROK_BOOT_SRC" config user.email t@t
git -C "$GROK_BOOT_SRC" config user.name t
printf 'grok bootstrap fixture\n' > "$GROK_BOOT_SRC/README.md"
printf '.worktrees/\n' > "$GROK_BOOT_SRC/.gitignore"
git -C "$GROK_BOOT_SRC" add README.md .gitignore
git -C "$GROK_BOOT_SRC" commit -qm init
git clone -q "$GROK_BOOT_SRC" "$GROK_BOOT_REPO"
mkdir -p "$GROK_BOOT_REPO/.svc"
GROK_BOOT_CMD="node $ROOT/scripts/svc-ensure-worktree.mjs --wi WI-GROK-PROBE-01 --branch framework-WI-GROK-PROBE-01 --from origin/main --print-cd"
GROK_BOOT_SESSION="01a05200-f1e6-74d0-9b90-7192c6174a2a"
GROK_BOOT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:"run_terminal_command",tool_input:{command:process.argv[3],workdir:process.argv[2]}}))' "$GROK_BOOT_SESSION" "$GROK_BOOT_REPO" "$GROK_BOOT_CMD")"
GROK_BOOT_OUT="$(printf '%s' "$GROK_BOOT_PAYLOAD" | env -u SVC_HOST -u SVC_SESSION_ID -u CODEX_THREAD_ID -u CODEX_SESSION_ID \
  GROK_SESSION_ID="$GROK_BOOT_SESSION" SVC_CODEX_RUNTIME_DIR="$GROK_BOOT_RUNTIME" \
  node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs")"
expect "Grok run_terminal_command bootstrap reaches allow and carries host while handoff carries session" node -e '
  const j=JSON.parse(process.argv[1]);
  const h=j.hookSpecificOutput||{};
  const c=String(h.updatedInput?.command||"");
  process.exit(h.permissionDecision==="allow"&&c.startsWith("SVC_HOST=grok node ")&&!c.includes("grok-probe-session")&&c.includes(" --wi WI-GROK-PROBE-01 ")?0:1);
' "$GROK_BOOT_OUT"
GROK_BOOT_REWRITTEN="$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(j.hookSpecificOutput.updatedInput.command)' "$GROK_BOOT_OUT")"
GROK_BOOT_RESULT="$(cd "$GROK_BOOT_REPO" && env -u SVC_SESSION_ID GROK_SESSION_ID="$GROK_BOOT_SESSION" SVC_CODEX_RUNTIME_DIR="$GROK_BOOT_RUNTIME" bash -c "$GROK_BOOT_REWRITTEN")"
GROK_BOOT_WORKTREE="$(node -e 'const s=process.argv[1];process.stdout.write(JSON.parse(s.slice(3)))' "$GROK_BOOT_RESULT")"
expect "rewritten Grok bootstrap executes and creates the bound worktree" bash -c 'test -d "$1" && test -f "$1/.svc/lane-tasks-WI-GROK-PROBE-01.json"' _ "$GROK_BOOT_WORKTREE"
GROK_FOLLOW_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:"run_terminal_command",tool_input:{command:"printf harmless",workdir:process.argv[2]}}))' "$GROK_BOOT_SESSION" "$GROK_BOOT_WORKTREE")"
GROK_FOLLOW_OUT="$(printf '%s' "$GROK_FOLLOW_PAYLOAD" | env -u SVC_HOST -u SVC_SESSION_ID -u CODEX_THREAD_ID -u CODEX_SESSION_ID GROK_SESSION_ID="$GROK_BOOT_SESSION" SVC_CODEX_RUNTIME_DIR="$GROK_BOOT_RUNTIME" node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs")"
expect "first bound Grok follow-on reaches the task gate without controller-principal drift" node -e '
  const j=JSON.parse(process.argv[1]);
  const reason=String(j.hookSpecificOutput?.permissionDecisionReason||"");
  process.exit(reason.includes("controller principal changed")||reason.includes("principal mismatch")?1:0);
' "$GROK_FOLLOW_OUT"

GROK_META_REPO="$TMP/grok-meta-repo"
git clone -q "$GROK_BOOT_SRC" "$GROK_META_REPO"
mkdir -p "$GROK_META_REPO/.svc"
GROK_META_BRANCH='framework-WI-GROK-META-01-$(touch${IFS}PWNED)'
GROK_META_SESSION="01a05201-f1e6-74d0-9b90-7192c6174a2b"
GROK_META_CMD="node $ROOT/scripts/svc-ensure-worktree.mjs --wi WI-GROK-META-01 --branch '$GROK_META_BRANCH' --from origin/main --print-cd"
GROK_META_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:"run_terminal_command",tool_input:{command:process.argv[3],workdir:process.argv[2]}}))' "$GROK_META_SESSION" "$GROK_META_REPO" "$GROK_META_CMD")"
GROK_META_OUT="$(printf '%s' "$GROK_META_PAYLOAD" | env -u SVC_HOST -u SVC_SESSION_ID GROK_SESSION_ID="$GROK_META_SESSION" SVC_CODEX_RUNTIME_DIR="$GROK_BOOT_RUNTIME" node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs")"
GROK_META_REWRITTEN="$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(j.hookSpecificOutput.updatedInput.command)' "$GROK_META_OUT")"
expect "bootstrap rewrite quotes a Git-valid branch containing shell substitution" node --input-type=module - "$ROOT" "$GROK_META_REWRITTEN" "$GROK_META_BRANCH" <<'NODE'
  import assert from "node:assert/strict";
  import path from "node:path";
  import { pathToFileURL } from "node:url";
  const [root, command, branch] = process.argv.slice(2);
  const { lexSimpleCommand } = await import(pathToFileURL(path.join(root, "hooks/codex/lib/argv-lex.mjs")));
  const parsed = lexSimpleCommand(command);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.argv[parsed.argv.indexOf("--branch") + 1], branch);
NODE
(cd "$GROK_META_REPO" && env -u SVC_SESSION_ID GROK_SESSION_ID="$GROK_META_SESSION" SVC_CODEX_RUNTIME_DIR="$GROK_BOOT_RUNTIME" bash -c "$GROK_META_REWRITTEN" >/dev/null)
expect "quoted bootstrap branch cannot execute command substitution" bash -c 'test ! -e "$1/PWNED"' _ "$GROK_META_REPO"
GROK_INJECTION_SESSION='grok-$(touch should-never-run)'
GROK_INJECTION_CMD="node $ROOT/scripts/svc-ensure-worktree.mjs --wi WI-GROK-PROBE-02 --branch framework-WI-GROK-PROBE-02 --from origin/main --print-cd"
GROK_INJECTION_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],cwd:process.argv[2],tool_name:"run_terminal_command",tool_input:{command:process.argv[3],workdir:process.argv[2]}}))' "$GROK_INJECTION_SESSION" "$GROK_BOOT_REPO" "$GROK_INJECTION_CMD")"
GROK_INJECTION_OUT="$(printf '%s' "$GROK_INJECTION_PAYLOAD" | env -u SVC_HOST -u SVC_SESSION_ID -u CODEX_THREAD_ID -u CODEX_SESSION_ID \
  "GROK_SESSION_ID=$GROK_INJECTION_SESSION" SVC_CODEX_RUNTIME_DIR="$GROK_BOOT_RUNTIME" \
  node "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs")"
expect "Grok session identity is transported only in the private handoff, never shell-interpolated" node -e '
  const j=JSON.parse(process.argv[1]);
  const h=j.hookSpecificOutput||{};
  const c=String(h.updatedInput?.command||"");
  process.exit(h.permissionDecision==="allow"&&!c.includes(process.argv[2])&&!c.includes("touch should-never-run")?0:1);
' "$GROK_INJECTION_OUT" "$GROK_INJECTION_SESSION"
GROK_DIRECT_SESSION="01a05202-f1e6-74d0-9b90-7192c6174a2c"
GROK_DIRECT_ENSURE="$(cd "$GROK_BOOT_REPO" && env -u SVC_HOST -u SVC_SESSION_ID GROK_SESSION_ID="$GROK_DIRECT_SESSION" \
  node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi WI-GROK-PROBE-03 --branch framework-WI-GROK-PROBE-03 --from origin/main --authority-v2 --json)"
expect "ensure-worktree stamps the Grok principal from GROK_SESSION_ID without dispatcher handoff" node --input-type=module - "$ROOT" "$GROK_DIRECT_ENSURE" "$GROK_DIRECT_SESSION" <<'NODE'
  import assert from "node:assert/strict";
  import path from "node:path";
  import { pathToFileURL } from "node:url";
  const [root, raw, session] = process.argv.slice(2);
  const { principalId } = await import(pathToFileURL(path.join(root, "hooks/lib/authority-store.mjs")));
  const result = JSON.parse(raw);
  assert.equal(result.owner_session, session);
  assert.equal(result.authority_v2?.lease?.controller_principal, principalId({ host: "grok", session_id: session }));
NODE
expect "ensure-worktree rejects an unknown wired host before direct Grok bootstrap mutation" bash -c '
  ! (cd "$1" && env SVC_HOST=bogus GROK_SESSION_ID="$2" node "$3/scripts/svc-ensure-worktree.mjs" --wi WI-GROK-PROBE-04 --branch framework-WI-GROK-PROBE-04 --from origin/main --authority-v2 --json) >/dev/null 2>&1
' _ "$GROK_BOOT_REPO" "$GROK_DIRECT_SESSION" "$ROOT"
expect "unknown-host direct bootstrap creates no branch" bash -c '
  ! git -C "$1" show-ref --verify --quiet refs/heads/framework-WI-GROK-PROBE-04
' _ "$GROK_BOOT_REPO"

AUTH_REPO="$TMP/grok-authority"
mkdir -p "$AUTH_REPO"
git -C "$AUTH_REPO" init -q -b main
git -C "$AUTH_REPO" config user.email t@t
git -C "$AUTH_REPO" config user.name t
printf 'authority fixture\n' > "$AUTH_REPO/README.md"
git -C "$AUTH_REPO" add README.md
git -C "$AUTH_REPO" commit -qm init
AUTH_BOOT="$(SVC_HOST=codex SVC_SESSION_ID=synthetic-codex node "$ROOT/scripts/svc-authority.mjs" bootstrap --wi WI-GROK-AUTH-01 --worktree "$AUTH_REPO")"
AUTH_OLD="$(printf '%s' "$AUTH_BOOT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).controller_principal))')"
expect "authority CLI trusts GROK_SESSION_ID alone with matching explicit session during takeover" env -u SVC_HOST -u SVC_SESSION_ID GROK_SESSION_ID=grok-session-01 \
  node "$ROOT/scripts/svc-authority.mjs" takeover --wi WI-GROK-AUTH-01 --worktree "$AUTH_REPO" \
  --session-id grok-session-01 --expected-principal "$AUTH_OLD" --expected-generation 1 --reason "hermetic Grok identity proof" >/dev/null
expect "authority CLI rejects unknown explicit SVC_HOST even when a Grok marker exists" bash -c '
  ! env SVC_HOST=bogus GROK_SESSION_ID=grok-session-01 node "$1/scripts/svc-authority.mjs" resume --wi WI-GROK-AUTH-01 --worktree "$2" --session-id grok-session-01 >/dev/null 2>&1
' _ "$ROOT" "$AUTH_REPO"
expect "authority CLI takeover stamps exact Grok principal" bash -c '
  actual=$(node "$1/scripts/svc-authority.mjs" status --wi WI-GROK-AUTH-01 --worktree "$2" | node -e '\''let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).lease.controller_principal))'\'')
  expected=$(node --input-type=module -e '\''import {principalId} from "./hooks/lib/authority-store.mjs";process.stdout.write(principalId({host:"grok",session_id:"grok-session-01"}))'\'')
  test "$actual" = "$expected"
' _ "$ROOT" "$AUTH_REPO"
ln -s "$ROOT/scripts" "$TMP/installed-scripts"
expect "authority CLI executes through an installed symlinked scripts directory" bash -c '
  out=$(node "$1/installed-scripts/svc-authority.mjs" status --wi WI-GROK-AUTH-01 --worktree "$2")
  test "$(printf "%s" "$out" | node -e '\''let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).lease.wi))'\'')" = WI-GROK-AUTH-01
' _ "$TMP" "$AUTH_REPO"

AUTH_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],prompt:"continue WI-485 and do not store SECRET_VALUE"}))' "$SESSION" "$TURN" "$TEST_CWD")"
expect "prompt authority records exact session/turn" bash -c "printf '%s' '$AUTH_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-prompt-authority.mjs' >/dev/null"

AUTH_FILE="$(find "$RUNTIME" -name prompt-authority.json -type f | head -1)"
expect "authority file created" test -s "$AUTH_FILE"
expect "authority file mode 0600" test "$(stat -c %a "$AUTH_FILE")" = 600
expect "authority redacts prompt and secret" bash -c "! rg -q 'continue WI-485|SECRET_VALUE|prompt\"' '$AUTH_FILE'"
expect "authority carries hash and WI only" node -e 'const j=require(process.argv[1]); process.exit(j.session_id===process.argv[2]&&j.turn_id===process.argv[3]&&j.explicit_wi==="WI-485"&&/^sha256:/.test(j.prompt_hash)?0:1)' "$AUTH_FILE" "$SESSION" "$TURN"

SAME_STOP_OUT="$(printf '%s' "$AUTH_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-stop-firewall.mjs")"
expect "explicit same-session current-turn continuation delegates" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.decision==="block"&&String(j.reason).includes("WI-485")?0:1)' "$SAME_STOP_OUT"
node -e 'const fs=require("fs");const p=process.argv[1],j=JSON.parse(fs.readFileSync(p));j.recorded_at="not-a-date";fs.writeFileSync(p,JSON.stringify(j),{mode:0o600})' "$AUTH_FILE"
expect "malformed authority timestamp never pressures Stop" bash -c "test \"\$(printf '%s' '$AUTH_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
printf '%s' "$AUTH_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null

SUMMARY_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],prompt:"summarize WI-485 without continuing"}))' "$SESSION" "$TURN" "$TEST_CWD")"
printf '%s' "$SUMMARY_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null
expect "explicit WI without continuation intent never pressures Stop" bash -c "test \"\$(printf '%s' '$SUMMARY_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
NEGATED_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],prompt:"do not continue WI-485"}))' "$SESSION" "$TURN" "$TEST_CWD")"
printf '%s' "$NEGATED_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null
expect "negated continuation intent never pressures Stop" bash -c "test \"\$(printf '%s' '$NEGATED_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
for NEGATED_PROMPT in \
  "please don't try to continue WI-485" \
  "do not attempt to continue WI-485" \
  "stop trying to continue WI-485" \
  "no need to continue WI-485" \
  "never continue WI-485" \
  "avoid continuing WI-485" \
  "refrain from continuing WI-485" \
  "let's not continue WI-485" \
  "I'd rather not continue WI-485" \
  "I don't think we should continue WI-485" \
  "we should not continue WI-485"; do
  NEGATED_VARIANT="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],prompt:process.argv[4]}))' "$SESSION" "$TURN" "$TEST_CWD" "$NEGATED_PROMPT")"
  printf '%s' "$NEGATED_VARIANT" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null
  NEGATED_RESULT="$(printf '%s' "$NEGATED_VARIANT" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-stop-firewall.mjs")"
  expect "natural negation never pressures Stop: $NEGATED_PROMPT" test "$NEGATED_RESULT" = '{}'
done
printf '%s' "$AUTH_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null

FOREIGN="$(node -e 'process.stdout.write(JSON.stringify({session_id:"foreign",turn_id:process.argv[1],cwd:process.argv[2]}))' "$TURN" "$TEST_CWD")"
expect "foreign Stop allows without continuation" bash -c "test \"\$(printf '%s' '$FOREIGN' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"

INCIDENT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],prompt:"continue WI-479"}))' "$SESSION" "$TURN" "$TEST_CWD")"
printf '%s' "$INCIDENT_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null
expect "recorded foreign WI-479 Stop incident emits no continuation" bash -c "test \"\$(printf '%s' '$FOREIGN' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"

# Route inference requires a fresh authority record: a prior explicit WI now
# intentionally persists across continuation prompts (session recovery).
rm "$AUTH_FILE"
ROUTE_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],prompt:"continue"}))' "$SESSION" "$TURN" "$TEST_CWD")"
printf '%s' "$ROUTE_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({timestamp:new Date(Date.now()+1000).toISOString(),session_token:process.argv[2],turn_id:process.argv[3],wi:"WI-485",repo_root:process.argv[4],worktree:process.argv[4]})+"\n")' "$CONTRACT" "$SESSION" "$TURN" "$TEST_CWD"
ROUTE_OUT="$(printf '%s' "$ROUTE_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-stop-firewall.mjs")"
expect "post-authority same-session route binding delegates" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.decision==="block"&&String(j.reason).includes("WI-485")?0:1)' "$ROUTE_OUT"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({timestamp:"2000-01-01T00:00:00Z",session_token:process.argv[2],turn_id:process.argv[3],wi:"WI-485",repo_root:process.argv[4],worktree:process.argv[4]})+"\n")' "$CONTRACT" "$SESSION" "$TURN" "$TEST_CWD"
expect "pre-authority route binding cannot authorize Stop" bash -c "test \"\$(printf '%s' '$ROUTE_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({timestamp:new Date(Date.now()+1000).toISOString(),session_token:"foreign",turn_id:process.argv[2],wi:"WI-485"})+"\n"+JSON.stringify({timestamp:new Date(Date.now()+1000).toISOString(),session_token:process.argv[3],turn_id:"wrong-turn",wi:"WI-485"})+"\n")' "$CONTRACT" "$TURN" "$SESSION"
expect "wrong-session and wrong-turn route bindings cannot authorize Stop" bash -c "test \"\$(printf '%s' '$ROUTE_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
printf '%s' "$AUTH_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-prompt-authority.mjs" >/dev/null

MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"apply_patch",tool_input:{patch:"*** Begin Patch\\n*** Update File: docs/plans/x.md"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
DENY_OUT="$(printf '%s' "$MUTATION" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "governed mutation denied before load" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$DENY_OUT"

ADD_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"apply_patch",tool_input:{patch:"*** Begin Patch\\n*** Add File: docs/plans/new.md\\n+new"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
DELETE_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"apply_patch",tool_input:{patch:"*** Begin Patch\\n*** Delete File: docs/plans/old.md"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
EDIT_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Edit",tool_input:{path:"docs/plans/x.md",new_string:"changed"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
WRITE_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Write",tool_input:{path:"docs/plans/x.md",content:"changed"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
for payload in "$ADD_MUTATION" "$DELETE_MUTATION" "$EDIT_MUTATION" "$WRITE_MUTATION"; do
  MATRIX_DENY="$(printf '%s' "$payload" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
  expect "canonical mutation variant denied before receipt" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$MATRIX_DENY"
done

READ="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:"git status --short"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
expect "read-only Bash allowed without receipt" bash -c "test \"\$(printf '%s' '$READ' | SVC_CODEX_TASK_GRAPH='$GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"git --no-optional-locks --no-pager status --short\"}}}'"
for shell_tool in Bash Shell run_shell_command shell run_terminal_command; do
  ALIAS_READ="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:process.argv[4],tool_input:{command:"git status --short"}}))' "$SESSION" "$TURN" "$TEST_CWD" "$shell_tool")"
  expect "read-only $shell_tool is classified as Bash-shaped" bash -c "test \"\$(printf '%s' '$ALIAS_READ' | SVC_CODEX_TASK_GRAPH='$GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"git --no-optional-locks --no-pager status --short\"}}}'"
done

GROK_SHELL_PROBE="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"run_terminal_command",tool_input:{command:"printf grok-owned-probe"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
expect "owned Grok run_terminal_command skips the Codex skill receipt only with Grok host identity" bash -c "test \"\$(printf '%s' '$GROK_SHELL_PROBE' | SVC_HOST=grok SVC_CODEX_TASK_GRAPH='$GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"
NON_GROK_TERMINAL_OUT="$(printf '%s' "$GROK_SHELL_PROBE" | env -u SVC_HOST -u GROK_SESSION_ID SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "non-Grok run_terminal_command mutation still requires the Codex skill receipt" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$NON_GROK_TERMINAL_OUT"
expect "Grok ffmpeg remains subject to worktree isolation after receipt bypass" node --input-type=module - "$ROOT" "$TEST_CWD" "$SESSION" <<'NODE'
  import assert from "node:assert/strict";
  import path from "node:path";
  import { pathToFileURL } from "node:url";
  const [root, cwd, sessionId] = process.argv.slice(2);
  const { classifyMutation } = await import(pathToFileURL(path.join(root, "hooks/svc-worktree-isolation-guard.mjs")));
  const raw = {
    host: "grok",
    session_id: sessionId,
    cwd,
    tool_name: "run_terminal_command",
    tool_input: { command: "ffmpeg -i input.mp4 -c copy output.mp4" },
  };
  const decision = classifyMutation({
    toolName: raw.tool_name,
    toolInput: raw.tool_input,
    sessionId,
    cwd,
    raw,
  }, { ...process.env, SVC_HOST: "grok", PWD: cwd });
  assert.equal(decision.allow, false);
  assert.match(decision.reason, /default checkout|authoritative session\/WI binding/);
NODE
GROK_SHELL_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Shell",tool_input:{command:"touch grok-output.mp4"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
expect "Grok host identity skips the Codex receipt for the Shell alias" bash -c "test \"\$(printf '%s' '$GROK_SHELL_MUTATION' | SVC_HOST=grok SVC_CODEX_TASK_GRAPH='$GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"
CODEX_SHELL_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Shell",tool_input:{command:"touch output.mp4"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
CODEX_SHELL_OUT="$(printf '%s' "$CODEX_SHELL_MUTATION" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "non-Grok Shell mutation still requires the Codex skill receipt" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$CODEX_SHELL_OUT"
GROK_LOADER="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"run_terminal_command",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "node $ROOT/scripts/codex-load-skill.mjs --graph /wrong --task 1 --skill execute-changeset")"
GROK_LOADER_OUT="$(printf '%s' "$GROK_LOADER" | SVC_HOST=grok GROK_SESSION_ID="$SESSION" SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "Grok loader-shaped command never takes the receipt bypass" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$GROK_LOADER_OUT"
GROK_MARKER_LOADER_OUT="$(printf '%s' "$GROK_LOADER" | env -u SVC_HOST GROK_SESSION_ID="$SESSION" SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "GROK_SESSION_ID-only loader command never takes the receipt bypass" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$GROK_MARKER_LOADER_OUT"
GROK_COMPOUND_LOADER="$(node -e 'const j=JSON.parse(process.argv[1]);j.tool_input.command="echo before && node scripts/codex-load-skill.mjs --graph /wrong --task 1 --skill execute-changeset";process.stdout.write(JSON.stringify(j))' "$GROK_LOADER")"
GROK_COMPOUND_LOADER_OUT="$(printf '%s' "$GROK_COMPOUND_LOADER" | SVC_HOST=grok GROK_SESSION_ID="$SESSION" SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "compound Grok command mentioning the loader never takes the receipt bypass" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$GROK_COMPOUND_LOADER_OUT"

for command in \
  "find . -exec rm {} +" \
  "find /tmp -delete" \
  "find . -fprintf /tmp/pwn.txt content" \
  "find . '-exec' echo bypass {} +" \
  "find . -delet\\e" \
  "sed -n -i s/old/new/ victim.txt" \
  "git diff --output=/tmp/pwn.txt" \
  "git show --ext-diff" \
  "rg --pre=touch pattern ." \
  "rg --hostname-bin=/tmp/receipt-bypass pattern ." \
  "rg --search-zip pattern archive.gz" \
  "rg -z pattern archive.gz" \
  "node --check --require preload.js target.js"; do
  FIND_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "$command")"
  FIND_OUT="$(printf '%s' "$FIND_MUTATION" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
  expect "$command denied without receipt" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$FIND_OUT"
done

printf '%s\n' '{"claimed_by":"foreign-agent","lane":"framework","tier":3}' > "$CLAIMS/WI-485.claim.json"
expect "unknown foreign claim schema prevents Stop continuation" bash -c "test \"\$(printf '%s' '$AUTH_PAYLOAD' | SVC_CODEX_CLAIMS_DIR='$CLAIMS' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
printf '%s\n' '{"session":"foreign-session","source":"legacy"}' > "$CLAIMS/WI-485.claim.json"
expect "foreign claim without freshness proof prevents Stop continuation" bash -c "test \"\$(printf '%s' '$AUTH_PAYLOAD' | SVC_CODEX_CLAIMS_DIR='$CLAIMS' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({session_token:"foreign-session",started_at:new Date().toISOString(),ttl_hours:24})+"\n")' "$CLAIMS/WI-485.claim.json"
expect "valid fresh foreign claim prevents plain continuation theft" bash -c "test \"\$(printf '%s' '$AUTH_PAYLOAD' | SVC_CODEX_CLAIMS_DIR='$CLAIMS' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-stop-firewall.mjs')\" = '{}'"
rm -f "$CLAIMS/WI-485.claim.json"

mkdir -m 755 "$TMP/home-cache"
# Umask-proof the fixture HOME: `mkdir -p` yields 0775 under umask 0002 and the
# runtime-root ancestor check would reject a group-writable HOME outright.
expect "home fallback accepts conventional shared cache parent" env -u XDG_RUNTIME_DIR -u SVC_CODEX_RUNTIME_DIR HOME="$TMP/home" bash -c "mkdir -p '$TMP/home/.cache'; chmod 755 '$TMP/home'; chmod 755 '$TMP/home/.cache'; node --input-type=module -e 'import {runtimeRoot} from \"$ROOT/hooks/codex/lib/codex-hook-context.mjs\"; const root=runtimeRoot({}); process.exit(root.endsWith(\"/.cache/svc-codex-runtime\")?0:1)'"
mkdir -p "$TMP/consumer/skills/execute-changeset" "$TMP/installed/execute-changeset"
printf '%s\n' 'consumer-local must not execute' > "$TMP/consumer/skills/execute-changeset/SKILL.md"
printf '%s\n' 'installed consumer skill' > "$TMP/installed/execute-changeset/SKILL.md"
expect "consumer repo resolves only approved installed canonical skill" node --input-type=module -e 'const {resolveCanonicalSkill}=await import(process.argv[1]);const e=resolveCanonicalSkill(process.argv[2],"execute-changeset",{CODEX_SKILLS_DIR:process.argv[3],CODEX_HOME:process.argv[4]});process.exit(e&&e.path===process.argv[5]&&e.allowedPaths.size===1?0:1)' "file://$ROOT/hooks/codex/lib/codex-hook-context.mjs" "$TMP/consumer" "$TMP/installed" "$TMP/empty-codex-home" "$(realpath "$TMP/installed/execute-changeset/SKILL.md")"
mkdir -p "$TMP/repo-local-only/skills/route-workflow"
printf '%s\n' 'repo-local canonical skill' > "$TMP/repo-local-only/skills/route-workflow/SKILL.md"
mkdir -p "$TMP/missing-skills"
printf '%s\n' "$TMP/repo-local-only" > "$TMP/missing-skills/.source-repo"
expect "regular repo-local packaged skill is included in its own allowlist" node --input-type=module -e 'const {resolveCanonicalSkill}=await import(process.argv[1]);const e=resolveCanonicalSkill(process.argv[2],"route-workflow",{CODEX_SKILLS_DIR:process.argv[3],CODEX_HOME:process.argv[4]});const expected=process.argv[5];process.exit(e&&e.path===expected&&e.allowedPaths.size===1&&e.allowedPaths.has(expected)?0:1)' "file://$ROOT/hooks/codex/lib/codex-hook-context.mjs" "$TMP/repo-local-only" "$TMP/missing-skills" "$TMP/empty-codex-home" "$(realpath "$TMP/repo-local-only/skills/route-workflow/SKILL.md")"
printf '%s\n' 'host-secret-sentinel' > "$TMP/host-secret"
mkdir -p "$TMP/consumer/skills/execute-changeset"
rm -f "$TMP/consumer/skills/execute-changeset/SKILL.md"
ln -s "$TMP/host-secret" "$TMP/consumer/skills/execute-changeset/SKILL.md"
expect "repository skill symlink cannot override or disclose installed skill" node --input-type=module -e 'const {resolveCanonicalSkill}=await import(process.argv[1]);const e=resolveCanonicalSkill(process.argv[2],"execute-changeset",{CODEX_SKILLS_DIR:process.argv[3],CODEX_HOME:process.argv[4]});process.exit(e&&e.path===process.argv[5]&&!e.content.includes("host-secret-sentinel")?0:1)' "file://$ROOT/hooks/codex/lib/codex-hook-context.mjs" "$TMP/consumer" "$TMP/installed" "$TMP/empty-codex-home" "$(realpath "$TMP/installed/execute-changeset/SKILL.md")"
expect "repository skill symlink is rejected when no installed canonical skill exists" node --input-type=module -e 'const {resolveCanonicalSkill}=await import(process.argv[1]);const e=resolveCanonicalSkill(process.argv[2],"execute-changeset",{CODEX_SKILLS_DIR:process.argv[3],CODEX_HOME:process.argv[4]});process.exit(e===null?0:1)' "file://$ROOT/hooks/codex/lib/codex-hook-context.mjs" "$TMP/consumer" "$TMP/missing-skills" "$TMP/empty-codex-home"

LOAD_CMD="node $ROOT/scripts/codex-load-skill.mjs --graph $GRAPH --task 1 --skill execute-changeset --turn $TURN"
LOAD_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "$LOAD_CMD")"
expect "exact recovery loader command is bootstrap-allowed" bash -c "test \"\$(printf '%s' '$LOAD_PAYLOAD' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"
BAD_LOAD_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "node $ROOT/scripts/codex-load-skill.mjs --graph $GRAPH --task 999 --skill execute-changeset --turn $TURN")"
BAD_LOAD_OUT="$(printf '%s' "$BAD_LOAD_PAYLOAD" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "altered recovery loader command remains governed" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$BAD_LOAD_OUT"

expect "load CLI writes exact receipt" env CODEX_SESSION_ID= CODEX_THREAD_ID="$SESSION" SVC_CODEX_RUNTIME_DIR="$RUNTIME" CODEX_SKILLS_DIR="$ROOT/skills" node "$ROOT/scripts/codex-load-skill.mjs" --graph "$GRAPH" --task 1 --skill execute-changeset --turn "$TURN" >/dev/null
LOAD_FILE="$(find "$RUNTIME" -name skill-load.json -type f | head -1)"
expect "skill receipt mode 0600" test "$(stat -c %a "$LOAD_FILE")" = 600
ALLOW_OUT="$(printf '%s' "$MUTATION" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "same-session mutation allowed after exact load" test "$ALLOW_OUT" = '{}'
PROD_TEST_OUT="$(printf '%s' "$MUTATION" | NODE_ENV=production SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "production mode cannot activate test-fixture authority" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$PROD_TEST_OUT"
FOREIGN_TEST_OUT="$(printf '%s' "$MUTATION" | SVC_CODEX_TEST_REPO="$TMP" SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "test-fixture authority is bound to its exact hermetic repo" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$FOREIGN_TEST_OUT"
for payload in "$ADD_MUTATION" "$DELETE_MUTATION" "$EDIT_MUTATION" "$WRITE_MUTATION"; do
  MATRIX_ALLOW="$(printf '%s' "$payload" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
  expect "canonical mutation variant allowed after exact receipt" test "$MATRIX_ALLOW" = '{}'
done
LATER_MUTATION="$(node -e 'const j=JSON.parse(process.argv[1]);j.turn_id="turn-2";process.stdout.write(JSON.stringify(j))' "$MUTATION")"
expect "later turn in unchanged session/task remains allowed" bash -c "test \"\$(printf '%s' '$LATER_MUTATION' | SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"

cp "$LOAD_FILE" "$TMP/good-load.json"
node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p));j.skill_sha256="sha256:bad";fs.writeFileSync(p,JSON.stringify(j),{mode:0o600})' "$LOAD_FILE"
STALE_OUT="$(printf '%s' "$MUTATION" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "stale skill hash denied" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$STALE_OUT"
cp "$TMP/good-load.json" "$LOAD_FILE" && chmod 600 "$LOAD_FILE"

printf '%s\n' 'forged skill bytes' > "$TMP/forged-skill.md"
node -e 'const fs=require("fs"),crypto=require("crypto");const p=process.argv[1],skill=process.argv[2];const j=JSON.parse(fs.readFileSync(p));j.skill_path=skill;j.skill_sha256="sha256:"+crypto.createHash("sha256").update(fs.readFileSync(skill)).digest("hex");fs.writeFileSync(p,JSON.stringify(j),{mode:0o600})' "$LOAD_FILE" "$TMP/forged-skill.md"
FORGED_OUT="$(printf '%s' "$MUTATION" | SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "self-consistent forged skill receipt denied against canonical source" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$FORGED_OUT"
cp "$TMP/good-load.json" "$LOAD_FILE" && chmod 600 "$LOAD_FILE"

for field in session_id task_id task_graph worktree; do
  cp "$TMP/good-load.json" "$LOAD_FILE" && chmod 600 "$LOAD_FILE"
  node -e 'const fs=require("fs");const p=process.argv[1];const field=process.argv[2];const j=JSON.parse(fs.readFileSync(p));j[field]=field==="task_id"?999:`/foreign/${field}`;if(field==="session_id")j[field]="foreign-session";fs.writeFileSync(p,JSON.stringify(j),{mode:0o600})' "$LOAD_FILE" "$field"
  MATRIX_OUT="$(printf '%s' "$MUTATION" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
  expect "foreign $field receipt denied" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$MATRIX_OUT"
done
cp "$TMP/good-load.json" "$LOAD_FILE" && chmod 600 "$LOAD_FILE"

expect "authority and skill receipts use exact redacted schemas" node -e '
const fs=require("fs");
const authority=JSON.parse(fs.readFileSync(process.argv[1]));
const receipt=JSON.parse(fs.readFileSync(process.argv[2]));
const exact=(value,keys)=>JSON.stringify(Object.keys(value).sort())===JSON.stringify(keys.sort());
const authorityKeys=["schema_version","session_id","turn_id","prompt_hash","cwd","session_cwd","repo_root","governance_worktree","explicit_wi","continuation_intent","authorization_prompt_hash","authorization_turn_id","recorded_at"];
const receiptKeys=["schema_version","session_id","turn_id","task_graph","task_id","skill","skill_path","skill_sha256","worktree","authority_model","loaded_at"];
if(receipt.authority_model!=="test-fixture")process.exit(1);
process.exit(exact(authority,authorityKeys)&&exact(receipt,receiptKeys)?0:1);' "$AUTH_FILE" "$LOAD_FILE"
RAW_PROMPT='continue WI-485 and do not store SECRET_VALUE'
ENC_PROMPT="$(node -e 'process.stdout.write(Buffer.from(process.argv[1]).toString("base64"))' "$RAW_PROMPT")"
ENC_SECRET="$(node -e 'process.stdout.write(Buffer.from(process.argv[1]).toString("base64"))' 'SECRET_VALUE')"
expect "recursive runtime scan contains no raw or encoded prompt/secret" bash -c "! rg -q 'continue WI-485 and do not store SECRET_VALUE|SECRET_VALUE|$ENC_PROMPT|$ENC_SECRET' '$RUNTIME'"

HOOKS="$TMP/hooks.json"
CONFIG="$TMP/config.toml"
printf '[features]\ncodex_hooks = true\n' > "$CONFIG"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({hooks:{Stop:[{matcher:"*",hooks:[{type:"command",command:"node svc-codex-stop-firewall.mjs"},{type:"command",command:"bash svc-task-completion-guard.sh"}]}]}},null,2)+"\n")' "$HOOKS"
WIRE_OUT="$(node "$ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$ROOT" --hooks-file "$HOOKS" --config "$CONFIG")"
expect "Codex wirer installs composite authority boundary" test -s "$HOOKS"
expect "wirer reports four installed-state fields separately" node -e 'const lines=process.argv[1].split(/\n/);const j=JSON.parse(lines.find(x=>x.startsWith("{")));process.exit(j.configured===true&&j.effective_single_stop===true&&j.trusted==="unknown"&&j.runtime_observed===false?0:1)' "$WIRE_OUT"
expect "effective config has exactly one nested svc Stop firewall" node -e 'const j=require(process.argv[1]);const commands=(j.hooks?.Stop||[]).flatMap(x=>x.hooks||[]).map(x=>x.command||"").filter(x=>x.includes("svc-"));process.exit(commands.length===1&&commands[0].includes("svc-codex-stop-firewall")?0:1)' "$HOOKS"
expect "obsolete Kimi loader absent from Codex config" bash -c "! rg -q 'svc-kimi-skill-load-enforcer|svc-task-completion-guard.sh' '$HOOKS'"
expect "current hooks feature flag enabled" bash -c "rg -q '^hooks = true$' '$CONFIG' && ! rg -q 'codex_hooks' '$CONFIG'"
expect "wirer is idempotent" node "$ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$ROOT" --hooks-file "$HOOKS" --config "$CONFIG" >/dev/null

HOOKS_INVERSE="$TMP/hooks-inverse.json"
CONFIG_INVERSE="$TMP/config-inverse.toml"
printf '[features]\nhooks = true\n' > "$CONFIG_INVERSE"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({hooks:{Stop:[{matcher:"*",hooks:[{type:"command",command:"bash svc-task-completion-guard.sh"},{type:"command",command:"node svc-codex-stop-firewall.mjs"}]}]}},null,2)+"\n")' "$HOOKS_INVERSE"
expect "inverse nested duplicate Stop order reconciles to one firewall" node "$ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$ROOT" --hooks-file "$HOOKS_INVERSE" --config "$CONFIG_INVERSE" >/dev/null
expect "inverse config has one nested svc Stop command" node -e 'const j=require(process.argv[1]);const c=(j.hooks?.Stop||[]).flatMap(x=>x.hooks||[]).map(x=>x.command||"").filter(x=>x.includes("svc-"));process.exit(c.length===1&&c[0].includes("svc-codex-stop-firewall")?0:1)' "$HOOKS_INVERSE"

BAD_HOOKS="$TMP/invalid-hooks.json"
BAD_CONFIG="$TMP/invalid-config.toml"
printf '{invalid' > "$BAD_HOOKS"
printf '[features]\ncodex_hooks = false\n' > "$BAD_CONFIG"
cp "$BAD_CONFIG" "$TMP/invalid-config.before"
expect "invalid hooks abort before config mutation" bash -c "! node '$ROOT/scripts/wire-codex-hooks.mjs' --skills-path '$ROOT' --hooks-file '$BAD_HOOKS' --config '$BAD_CONFIG' >/dev/null 2>&1"
expect "failed wiring leaves config byte-identical" cmp -s "$BAD_CONFIG" "$TMP/invalid-config.before"

DUP_REPO="$TMP/duplicate-repo"
mkdir -p "$DUP_REPO/.codex"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({hooks:{Stop:[{matcher:"*",hooks:[{type:"command",command:"bash svc-task-completion-guard.sh"}]}]}},null,2)+"\n")' "$DUP_REPO/.codex/hooks.json"
DUP_CONFIG="$TMP/duplicate-config.toml"
DUP_HOOKS="$TMP/duplicate-user-hooks.json"
printf '[features]\ncodex_hooks = false\n' > "$DUP_CONFIG"
cp "$DUP_CONFIG" "$TMP/duplicate-config.before"
expect "duplicate repository Stop aborts before host config mutation" bash -c "cd '$DUP_REPO' && ! node '$ROOT/scripts/wire-codex-hooks.mjs' --skills-path '$ROOT' --hooks-file '$DUP_HOOKS' --config '$DUP_CONFIG' >/dev/null 2>&1"
expect "duplicate effective-view failure leaves config byte-identical" cmp -s "$DUP_CONFIG" "$TMP/duplicate-config.before"

expect "documentation preserves four distinct state labels" node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");process.exit(["configured","effective-single-stop","trusted","runtime-observed"].every(x=>s.includes("`"+x+"`"))?0:1)' "$ROOT/references/codex-hook-execution-integrity.md"
expect "documentation states PreToolUse limits and post-action validation" bash -c "rg -q 'PreToolUse is preventive but not omniscient' '$ROOT/references/codex-hook-execution-integrity.md' && rg -q 'Post-action validation' '$ROOT/references/codex-hook-execution-integrity.md'"

for i in 1 2 3 4 5; do
  case "$i" in
    1) payload="$FOREIGN" ;;
    2) payload="$READ" ;;
    3) payload="$MUTATION" ;;
    4) payload="{}" ;;
    5) payload="{malformed" ;;
  esac
  printf '%s' "$payload" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" >/dev/null || bad "interleaving $i exits zero"
done
ok "five hermetic interleavings exit safely"

for i in $(seq 1 100); do
  case $((i % 3)) in
    0) payload="$FOREIGN"; hook="$ROOT/hooks/codex/svc-codex-stop-firewall.mjs" ;;
    1) payload="$READ"; hook="$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" ;;
    2) payload="$MUTATION"; hook="$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" ;;
  esac
  OUT="$(printf '%s' "$payload" | SVC_CODEX_TASK_GRAPH="$GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$hook")"
  node -e 'JSON.parse(process.argv[1])' "$OUT" || { bad "100-case interleaving stress emits JSON"; break; }
done
ok "100-case interleaving stress completed"

# --- WI-486 (SIB-01/03/06/08): safe reads classified BEFORE any graph inventory,
#     and a graph override outside the bound worktree never enables mutation. ------
FOREIGN_GRAPH_DIR="$TMP/foreign-graph"
mkdir -m 700 "$FOREIGN_GRAPH_DIR"
FOREIGN_GRAPH="$FOREIGN_GRAPH_DIR/lane-tasks-WI-777.json"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({wi:"WI-777",lane:"framework",status:"in_progress",tasks:[{id:1,skill:"execute-changeset",status:"in_progress",subject:"foreign"}]},null,2))' "$FOREIGN_GRAPH"

# A proved read is allowed even when the pointed-at task graph is FOREIGN/ambiguous —
# reads are classified before authority/inventory resolution (SIB-01/03/08).
expect "read allowed before inventory even with a foreign task graph" bash -c "test \"\$(printf '%s' '$READ' | SVC_CODEX_TASK_GRAPH='$FOREIGN_GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"git --no-optional-locks --no-pager status --short\"}}}'"

# A governed mutation whose SVC_CODEX_TASK_GRAPH override points at a foreign graph
# (not the tuple's derived graph) is denied — the override is a consistency
# assertion, never an authority source (SIB-06/07).
OVERRIDE_DENY="$(printf '%s' "$MUTATION" | SVC_CODEX_TASK_GRAPH="$FOREIGN_GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "mismatched graph override never enables mutation" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$OVERRIDE_DENY"

# --- WI-486 (EXEC-001): governed mutation is DENIED when there is no owned
#     in_progress task (fail closed). Only the skill-loader command is excepted. --
NO_TASK_GRAPH_DIR="$TEST_CWD"
NO_TASK_GRAPH="$NO_TASK_GRAPH_DIR/.svc/lane-tasks-WI-778.json"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({wi:"WI-778",lane:"framework",status:"in_progress",tasks:[{id:1,skill:"execute-changeset",status:"pending",subject:"not started",metadata:{skill:"execute-changeset"}}]},null,2))' "$NO_TASK_GRAPH"
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$NO_TASK_GRAPH_DIR" --session-id "$SESSION" --wi WI-778 --role mutating >/dev/null
NO_TASK_MUTATION="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Write",tool_input:{path:"docs/plans/x.md",content:"changed"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
NO_TASK_OUT="$(printf '%s' "$NO_TASK_MUTATION" | SVC_CODEX_TASK_GRAPH="$NO_TASK_GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "governed mutation denied when no in_progress task is owned" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$NO_TASK_OUT"
# The well-formed skill-loader command IS allowed with no active task (first-load bootstrap).
LOADER_BOOT="node $ROOT/scripts/codex-load-skill.mjs --graph $NO_TASK_GRAPH --task 1 --skill execute-changeset --turn $TURN"
LOADER_BOOT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "$LOADER_BOOT")"
expect "skill-loader shape allowed before any task is in_progress" bash -c "test \"\$(printf '%s' '$LOADER_BOOT_PAYLOAD' | SVC_CODEX_TASK_GRAPH='$NO_TASK_GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"

# --- WI-486 (EXEC-R2-002): the no-active-task loader exception is NOT satisfied by
#     lexical shape alone. A loader pointed at a FOREIGN graph (not the session's
#     owned graph) is DENIED, so it can never write a skill-load receipt into
#     another worktree's graph. Also: wrong --turn and wrong --task are denied.
LOADER_FOREIGN="node $ROOT/scripts/codex-load-skill.mjs --graph $FOREIGN_GRAPH --task 1 --skill execute-changeset --turn $TURN"
LOADER_FOREIGN_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "$LOADER_FOREIGN")"
LOADER_FOREIGN_OUT="$(printf '%s' "$LOADER_FOREIGN_PAYLOAD" | SVC_CODEX_TASK_GRAPH="$NO_TASK_GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "loader targeting a FOREIGN graph is denied even with no active task (EXEC-R2-002)" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$LOADER_FOREIGN_OUT"
LOADER_WRONGTURN="node $ROOT/scripts/codex-load-skill.mjs --graph $NO_TASK_GRAPH --task 1 --skill execute-changeset --turn wrong-turn"
LOADER_WRONGTURN_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "$LOADER_WRONGTURN")"
LOADER_WRONGTURN_OUT="$(printf '%s' "$LOADER_WRONGTURN_PAYLOAD" | SVC_CODEX_TASK_GRAPH="$NO_TASK_GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "loader with a mismatched --turn is denied even with no active task (EXEC-R2-002)" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$LOADER_WRONGTURN_OUT"
LOADER_WRONGTASK="node $ROOT/scripts/codex-load-skill.mjs --graph $NO_TASK_GRAPH --task 999 --skill execute-changeset --turn $TURN"
LOADER_WRONGTASK_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$TEST_CWD" "$LOADER_WRONGTASK")"
LOADER_WRONGTASK_OUT="$(printf '%s' "$LOADER_WRONGTASK_PAYLOAD" | SVC_CODEX_TASK_GRAPH="$NO_TASK_GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "loader naming a non-first-runnable --task is denied even with no active task (EXEC-R2-002)" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$LOADER_WRONGTASK_OUT"
# A read stays allowed regardless (reads gate before resolution).
NO_TASK_READ="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:"git status --short"}}))' "$SESSION" "$TURN" "$TEST_CWD")"
expect "read allowed even with no in_progress task" bash -c "test \"\$(printf '%s' '$NO_TASK_READ' | SVC_CODEX_TASK_GRAPH='$NO_TASK_GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"git --no-optional-locks --no-pager status --short\"}}}'"

# --- WI-486 EXEC-R3-001: a FRESH bootstrap placeholder graph — the EXACT shape
#     scripts/svc-ensure-worktree.mjs emits (NUMERIC task id, graph status == the
#     task-derived status, first pending task = route-workflow) — loads its FIRST
#     skill end-to-end, and the enforcer accepts the loader through the ONE canonical
#     recoverable id domain for BOTH numeric AND string ids, while foreign/wrong-id
#     loaders stay denied. Before this fix the string id "task-1" + a numeric-only
#     enforcer/loader/task-graph comparison meant a freshly bootstrapped Codex graph
#     could never load its first skill.
BOOT_DIR="$TMP/boot-graph"
mkdir -m 700 -p "$BOOT_DIR/.svc"
git -C "$BOOT_DIR" init -q -b main
git -C "$BOOT_DIR" config user.email t@t
git -C "$BOOT_DIR" config user.name t
BOOT_GRAPH="$BOOT_DIR/.svc/lane-tasks-WI-950.json"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,wi:"WI-950",lane:"framework",status:"pending",created:new Date().toISOString(),tasks:[{id:1,status:"pending",skill:"route-workflow",subject:"route workflow",blocked_by:[]}]},null,2)+"\n")' "$BOOT_GRAPH"
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$BOOT_DIR" --session-id "$SESSION" --wi WI-950 --role mutating >/dev/null
STR_DIR="$TMP/string-graph"
mkdir -m 700 -p "$STR_DIR/.svc"
git -C "$STR_DIR" init -q -b main
git -C "$STR_DIR" config user.email t@t
git -C "$STR_DIR" config user.name t@t
STR_GRAPH="$STR_DIR/.svc/lane-tasks-WI-951.json"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,wi:"WI-951",status:"pending",tasks:[{id:"task-1",status:"pending",skill:"route-workflow"}]}))' "$STR_GRAPH"
node "$ROOT/hooks/lib/wi-claim.mjs" binding write --worktree-root "$STR_DIR" --session-id "$SESSION" --wi WI-951 --role mutating >/dev/null

# Enforcer accepts the loader for the OWNED numeric-id bootstrap graph (pristine).
BOOT_LOADER="node $ROOT/scripts/codex-load-skill.mjs --graph $BOOT_GRAPH --task 1 --skill route-workflow --turn $TURN"
BOOT_LOADER_PL="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$BOOT_DIR" "$BOOT_LOADER")"
expect "enforcer allows the numeric-id bootstrap loader (EXEC-R3-001)" bash -c "test \"\$(printf '%s' '$BOOT_LOADER_PL' | SVC_CODEX_TASK_GRAPH='$BOOT_GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"
# Canonical string equality: a STRING-id owned bootstrap graph's loader is ALSO accepted
# (the shape/authority layer supports the recoverableId string+number domain — WI-486).
STR_LOADER="node $ROOT/scripts/codex-load-skill.mjs --graph $STR_GRAPH --task task-1 --skill route-workflow --turn $TURN"
STR_LOADER_PL="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$STR_DIR" "$STR_LOADER")"
expect "enforcer allows a STRING-id bootstrap loader via canonical id equality (EXEC-R3-001)" bash -c "test \"\$(printf '%s' '$STR_LOADER_PL' | SVC_CODEX_TASK_GRAPH='$STR_GRAPH' SVC_CODEX_RUNTIME_DIR='$RUNTIME' node '$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs')\" = '{}'"
# A loader whose --task does not match the first runnable pending task is denied.
WRONGID_LOADER="node $ROOT/scripts/codex-load-skill.mjs --graph $BOOT_GRAPH --task 999 --skill route-workflow --turn $TURN"
WRONGID_PL="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:process.argv[2],cwd:process.argv[3],tool_name:"Bash",tool_input:{command:process.argv[4]}}))' "$SESSION" "$TURN" "$BOOT_DIR" "$WRONGID_LOADER")"
WRONGID_OUT="$(printf '%s' "$WRONGID_PL" | SVC_CODEX_TASK_GRAPH="$BOOT_GRAPH" SVC_CODEX_RUNTIME_DIR="$RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "enforcer denies a wrong-id bootstrap loader (EXEC-R3-001)" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$WRONGID_OUT"
# END-TO-END: the load CLI advances the exact bootstrap graph (numeric id) through
# scripts/task-graph.mjs — the write-time authority — and records a skill_receipt.
expect "fresh bootstrap graph loads its FIRST skill end-to-end (EXEC-R3-001)" env CODEX_THREAD_ID="$SESSION" SVC_CODEX_RUNTIME_DIR="$RUNTIME" CODEX_SKILLS_DIR="$ROOT/skills" node "$ROOT/scripts/codex-load-skill.mjs" --graph "$BOOT_GRAPH" --task 1 --skill route-workflow --turn "$TURN" >/dev/null
expect "bootstrap load recorded a route-workflow skill_receipt on the graph (EXEC-R3-001)" node -e 'const g=require(process.argv[1]);process.exit(g.tasks[0].skill_receipt&&g.tasks[0].skill_receipt.skill==="route-workflow"?0:1)' "$BOOT_GRAPH"

# =============================================================================
# WI-494: codex enforcer zero-state bootstrap deadlock (Defect A)
#
# Tier-1 promotion note (rules/tier-1-promotion.md): this EXTENDS the existing
# tier-1 validator below (validator_path: this file) rather than adding a new
# one. failure_class: zero-state bootstrap has no authorized exit -- a live
# Codex host deadlock (no owned task graph, so every governed mutation denies,
# including the one command that would create the graph). promotion_signal:
# condition 3 -- hooks/codex/* is the framework's governed-mutation decision
# boundary, run on every Codex tool call. expected_runtime_budget: a handful of
# hermetic child processes plus a few disposable --local clones; sub-5s
# addition. why_tier_2_or_targeted_is_insufficient: this IS the enforcement hot
# path; a tier-2/manual check would not run on every local/CI pass and would
# not catch a regression before it reached an installed host (the
# asymmetric-detection concern from the plan's change-impact triad).
#
# SCOPE NOTE (owner directive, 2026-07-17): the read-classification widening
# (gh/kubectl/argocd allowlist, CED-03/04/05) that shipped alongside the
# bootstrap fix in earlier iterations is DESCOPED from WI-494 -- it carried its
# own G6 criticals (gh --web/-w=true, --cache) and is a fragile denylist-style
# surface that deserves its own dedicated design pass. Those fixtures are
# removed from this file; WI-494 now covers ONLY the bootstrap deadlock
# (isBootstrapShape + the bootstrap-intent marker + svc-ensure-worktree.mjs).
# See docs/specs/work-items/WI-494.md "Descoped" note for the follow-up WI.
# =============================================================================

echo "--- WI-494: zero-state bootstrap exit end-to-end (CED-01/CED-02) ---"

# The file-level harness `export`ed SVC_CODEX_TEST_MODE=1 + SVC_CODEX_TASK_GRAPH
# earlier (the pre-existing WI-485 fixture graph, still on disk) so that graph
# override would otherwise leak into every command below and make laneGraphs()
# report an owned graph regardless of which repo/session is actually being
# probed -- exactly hiding the zero-state this section exists to prove. Unset
# for the remainder of this file; nothing after this point relies on the override.
unset SVC_CODEX_TEST_MODE SVC_CODEX_TASK_GRAPH

WI494_REPO="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO"
rm -rf "$WI494_REPO/.svc"/lane-tasks-*.json "$WI494_REPO/.svc/bootstrap-intent"
git -C "$WI494_REPO" config user.email t@t
git -C "$WI494_REPO" config user.name t
if ! git -C "$WI494_REPO" rev-parse --verify origin/main >/dev/null 2>&1; then
  git -C "$WI494_REPO" update-ref refs/remotes/origin/main HEAD
fi
WI494_RUNTIME="$(mktemp -d)"; chmod 700 "$WI494_RUNTIME"
WI494_SESSION="sess-Alonger-than-8"
WI494_WI="WI-$RANDOM$RANDOM"
WI494_BR="wi-boot-$$-$RANDOM"
# F-005: --json is the EXACT flag the actual invocation below (Step 3) uses to get
# parseable output, so the authorization check in Step 2 must exercise the SAME
# shape actually executed -- not a laxer/stripped-down stand-in that never proves
# the real allowed command. --json/--print-cd are authorized valueless output-format
# flags in isBootstrapShape (see WI-494 round-2 F-001/F-005 comment there).
# WI-498 (F-001): the relative spelling is authorized ONLY in the exact install
# (repo_root === the enforcer's self-located install root). This fixture repo is a
# CLONE of $ROOT (a different dir with its OWN copy of the script — the very
# "runs the clone's copy" hazard the authors flag at Step 3), so a clone is treated
# as a non-install repo and the relative form is DENIED. Onboarded repos use the
# install-absolute form, which the deny() recovery renders and which is what this
# authorization check now exercises. The relative form's DENY is asserted below.
WI494_BOOT_CMD="node $ROOT/scripts/svc-ensure-worktree.mjs --wi $WI494_WI --branch $WI494_BR --json"
WI494_BOOT_CMD_REL="node scripts/svc-ensure-worktree.mjs --wi $WI494_WI --branch $WI494_BR --json"

wi494_payload() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "$1" "$2" "$3"; }
wi494_drive() { printf '%s' "$1" | SVC_SESSION_ID="$2" SVC_CODEX_RUNTIME_DIR="$WI494_RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs"; }
wi494_is_allow() { [ "$1" = '{}' ]; }
wi494_is_deny() { node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$1"; }

# Step 2: drive the hook, cwd=$WI494_REPO, BEFORE the command is executed.
WI494_STEP2_OUT="$(wi494_drive "$(wi494_payload "$WI494_SESSION" "$WI494_REPO" "$WI494_BOOT_CMD")" "$WI494_SESSION")"
expect "CED-01 zero-state bootstrap command allowed (install-absolute)" wi494_is_allow "$WI494_STEP2_OUT"
WI494_GROK_STEP2_PAYLOAD="$(wi494_payload "$WI494_SESSION" "$WI494_REPO" "$WI494_BOOT_CMD" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);p.tool_name="run_terminal_command";process.stdout.write(JSON.stringify(p))})')"
WI494_GROK_STEP2_OUT="$(wi494_drive "$WI494_GROK_STEP2_PAYLOAD" "$WI494_SESSION")"
expect "Grok run_terminal_command reaches the exact zero-state bootstrap hatch" wi494_is_allow "$WI494_GROK_STEP2_OUT"
# WI-498 (F-001): the relative spelling from a clone (repo_root != install) is DENIED.
WI494_STEP2_REL_OUT="$(wi494_drive "$(wi494_payload "$WI494_SESSION" "$WI494_REPO" "$WI494_BOOT_CMD_REL")" "$WI494_SESSION")"
expect "WI-498: relative bootstrap from a non-install repo is DENIED (F-001)" wi494_is_deny "$WI494_STEP2_REL_OUT"

# Step 3: ACTUALLY run it in $WI494_REPO.
# NOTE: invoke $ROOT's OWN (current, possibly-uncommitted) copy of the script
# while cwd is the disposable clone -- `node scripts/svc-ensure-worktree.mjs`
# (relative) would instead run the CLONE's committed-at-HEAD copy, silently
# skipping any in-progress change to this very file.
WI494_ENSURE_OUT="$( (cd "$WI494_REPO" && SVC_SESSION_ID="$WI494_SESSION" node "$ROOT/scripts/svc-ensure-worktree.mjs" --wi "$WI494_WI" --branch "$WI494_BR" --json) )"
expect "CED-01 bootstrap command actually succeeds" test -n "$WI494_ENSURE_OUT"
WI494_GRAPH="$(node -e 'console.log(JSON.parse(process.argv[1]).absolute_graph)' "$WI494_ENSURE_OUT")"
WI494_WORKTREE="$(node -e 'console.log(JSON.parse(process.argv[1]).absolute_worktree)' "$WI494_ENSURE_OUT")"
expect "CED-01 graph created at reported path" test -f "$WI494_GRAPH"
expect "CED-01 marker removed on completion (no anchor left behind)" test ! -f "$WI494_REPO/.svc/bootstrap-intent/$WI494_WI.json"
WI494_TASKID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tasks[0].id)' "$WI494_GRAPH")"

# Step 4: drive the hook for the canonical loader, cwd=$WI494_WORKTREE (where
# ownership now resolves via the WI-486 binding tuple) -> isSkillLoaderShape allows.
# WI-498 (F-011): loader token authorized as install-absolute (the worktree is a
# clone-derived worktree, i.e. repo_root != install, so the relative form denies).
WI494_LOAD_CMD="node $ROOT/scripts/codex-load-skill.mjs --graph $WI494_GRAPH --task $WI494_TASKID --skill route-workflow --turn t1"
WI494_LOAD_CMD_REL="node scripts/codex-load-skill.mjs --graph $WI494_GRAPH --task $WI494_TASKID --skill route-workflow --turn t1"
WI494_STEP4_OUT="$(wi494_drive "$(wi494_payload "$WI494_SESSION" "$WI494_WORKTREE" "$WI494_LOAD_CMD")" "$WI494_SESSION")"
expect "CED-01 loader for the created graph allowed (install-absolute; deadlock exits in one hop)" wi494_is_allow "$WI494_STEP4_OUT"
WI494_STEP4_REL_OUT="$(wi494_drive "$(wi494_payload "$WI494_SESSION" "$WI494_WORKTREE" "$WI494_LOAD_CMD_REL")" "$WI494_SESSION")"
expect "WI-498: relative loader token from a non-install worktree is DENIED (F-011)" wi494_is_deny "$WI494_STEP4_REL_OUT"

# Step 5: drive the hook AGAIN with the step-2 bootstrap command, cwd=$WI494_WORKTREE
# (the context in which the session's ownership tuple is now resolvable) -> the
# bootstrap exception has evaporated because a graph is owned; isSkillLoaderShape
# governs from here on, not isBootstrapShape.
WI494_STEP5_OUT="$(wi494_drive "$(wi494_payload "$WI494_SESSION" "$WI494_WORKTREE" "$WI494_BOOT_CMD")" "$WI494_SESSION")"
expect "CED-02 second bootstrap once graph owned is denied (exit closes behind itself)" wi494_is_deny "$WI494_STEP5_OUT"

# NOTE: $WI494_REPO / $WI494_WORKTREE / $WI494_RUNTIME cleanup is DEFERRED to
# after the "mutation-adequacy" bootstrap-predicate mutant section below, which
# reuses this exact live owned-graph state for a non-vacuous "graph already
# owned" probe (R2-F005(b): the prior ordering deleted this state FIRST, so that
# probe's cwd resolved to no repo at all and the enforcer allow()ed unconditionally
# — a vacuous pass that never exercised the mutant). See the cleanup + source
# worktree-list assertion at the end of that section.

echo "--- WI-494: zero-state bootstrap negative fixtures (CED-02) ---"

WI494_REPO2="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO2"
rm -rf "$WI494_REPO2/.svc"/lane-tasks-*.json "$WI494_REPO2/.svc/bootstrap-intent"
git -C "$WI494_REPO2" config user.email t@t
git -C "$WI494_REPO2" config user.name t
WI494_RUNTIME2="$(mktemp -d)"; chmod 700 "$WI494_RUNTIME2"
# From cwd=$WI494_REPO2 (the repo root, never the target of a WI-486 binding
# write -- bindings live under the created WORKTREE) every session is zero-state
# for the purposes of laneGraphs(), so a fresh --wi per fixture below is enough
# to keep marker paths disjoint; no fresh clone is needed per fixture.
wi494_drive2() { printf '%s' "$1" | SVC_SESSION_ID="$WI494_SESSION" SVC_CODEX_RUNTIME_DIR="$WI494_RUNTIME2" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs"; }

for bad_cmd in \
  "node scripts/svc-ensure-worktree.mjs --wi WI-1 --branch ../../../etc/evil" \
  "node scripts/svc-ensure-worktree.mjs --wi ../WI-1 --branch ok-branch" \
  "node scripts/task-graph.mjs init --wi WI-1 --branch ok-branch" \
  "node scripts/svc-ensure-worktree.mjs --wi WI-9 --branch b --evil x" \
  "node scripts/svc-ensure-worktree.mjs --wi WI-1 --wi WI-2 --branch ok-branch"; do
  BAD_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "$bad_cmd")")"
  expect "zero-state bootstrap shape rejected: $bad_cmd" wi494_is_deny "$BAD_OUT"
done

# WI-FW-HOOKS-SAFETY-01 (FP-01): a Git-valid SLASH branch is now an accepted
# bootstrap shape (literal-ref validation replaced the slash-free regex). It is
# still denied HERE because zero-state bootstrap requires the default checkout;
# the shape itself must parse, so the denial reason is isolation, not shape.
SLASH_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "node scripts/svc-ensure-worktree.mjs --wi WI-1 --branch feat/slash-shape")")"
expect "slash-branch bootstrap parses (denied only by zero-state isolation)" wi494_is_deny "$SLASH_OUT"

mkdir -m 700 -p "$WI494_REPO2/.svc/bootstrap-intent"

WI494_FOREIGN_WI="WI-$RANDOM$RANDOM"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,session_id:"sess-OTHER-session",wi:process.argv[2],branch:"foreign-br",target_worktree:process.argv[3]}))' \
  "$WI494_REPO2/.svc/bootstrap-intent/$WI494_FOREIGN_WI.json" "$WI494_FOREIGN_WI" "$WI494_REPO2"
FOREIGN_MARKER_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "node scripts/svc-ensure-worktree.mjs --wi $WI494_FOREIGN_WI --branch foreign-br")")"
expect "marker owned by a foreign session denies bootstrap (F-003)" wi494_is_deny "$FOREIGN_MARKER_OUT"

WI494_WRONGWI="WI-$RANDOM$RANDOM"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,session_id:process.argv[2],wi:"WI-999999",branch:"br-x",target_worktree:process.argv[3]}))' \
  "$WI494_REPO2/.svc/bootstrap-intent/$WI494_WRONGWI.json" "$WI494_SESSION" "$WI494_REPO2"
WRONGWI_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "node scripts/svc-ensure-worktree.mjs --wi $WI494_WRONGWI --branch br-x")")"
expect "marker whose wi field mismatches the request denies bootstrap (F-003)" wi494_is_deny "$WRONGWI_OUT"

WI494_WRONGBR="WI-$RANDOM$RANDOM"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,session_id:process.argv[2],wi:process.argv[3],branch:"some-other-branch",target_worktree:process.argv[4]}))' \
  "$WI494_REPO2/.svc/bootstrap-intent/$WI494_WRONGBR.json" "$WI494_SESSION" "$WI494_WRONGBR" "$WI494_REPO2"
WRONGBR_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "node scripts/svc-ensure-worktree.mjs --wi $WI494_WRONGBR --branch br-y")")"
expect "marker whose branch field mismatches the request denies bootstrap (F-003)" wi494_is_deny "$WRONGBR_OUT"

WI494_WRONGTREE="WI-$RANDOM$RANDOM"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,session_id:process.argv[2],wi:process.argv[3],branch:"br-z",target_worktree:"/etc"}))' \
  "$WI494_REPO2/.svc/bootstrap-intent/$WI494_WRONGTREE.json" "$WI494_SESSION" "$WI494_WRONGTREE"
WRONGTREE_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "node scripts/svc-ensure-worktree.mjs --wi $WI494_WRONGTREE --branch br-z")")"
expect "marker whose target_worktree is outside the repo denies bootstrap (F-003)" wi494_is_deny "$WRONGTREE_OUT"

WI494_VALIDRERUN="WI-$RANDOM$RANDOM"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,session_id:process.argv[2],wi:process.argv[3],branch:"br-rerun",target_worktree:process.argv[4],pid:999999,owner_token:"dead-writer"}))' \
  "$WI494_REPO2/.svc/bootstrap-intent/$WI494_VALIDRERUN.json" "$WI494_SESSION" "$WI494_VALIDRERUN" "$WI494_REPO2"
VALIDRERUN_OUT="$(wi494_drive2 "$(wi494_payload "$WI494_SESSION" "$WI494_REPO2" "node $ROOT/scripts/svc-ensure-worktree.mjs --wi $WI494_VALIDRERUN --branch br-rerun")")"
expect "same-session marker with a dead writer pid is a valid rerun (F-003, install-absolute)" wi494_is_allow "$VALIDRERUN_OUT"

rm -rf "$WI494_REPO2" "$WI494_RUNTIME2"

echo "--- WI-494 round 2 (F-001): nested-cwd shadow-script negative fixture ---"

# A hostile svc-ensure-worktree.mjs SHADOWED under a repo subdirectory must never be
# authorized merely because argv[1] resolves (against repo_root) to the canonical
# script -- node actually executes the file relative to the Bash tool's EFFECTIVE
# cwd, not repo_root. CONFIRMED CRITICAL: pre-fix, this predicate blessed the
# canonical copy while the nested shadow would run (ACE, no owned task).
WI494_REPO5="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO5"
git -C "$WI494_REPO5" config user.email t@t
git -C "$WI494_REPO5" config user.name t
mkdir -p "$WI494_REPO5/nested/scripts"
printf '%s\n' '#!/usr/bin/env node' 'require("fs").writeFileSync(require("path").join(__dirname, "..", "..", "PWNED"), "shadow-executed")' > "$WI494_REPO5/nested/scripts/svc-ensure-worktree.mjs"
WI494_RUNTIME5="$(mktemp -d)"; chmod 700 "$WI494_RUNTIME5"
WI494_SHADOW_WI="WI-$RANDOM$RANDOM"
WI494_SHADOW_CMD="node scripts/svc-ensure-worktree.mjs --wi $WI494_SHADOW_WI --branch shadow-br"
SHADOW_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "sess-Alonger-than-8" "$WI494_REPO5/nested" "$WI494_SHADOW_CMD")"
SHADOW_OUT="$(printf '%s' "$SHADOW_PAYLOAD" | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_RUNTIME5" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "F-001: nested-cwd shadow svc-ensure-worktree.mjs is DENIED (cwd != repo_root)" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$SHADOW_OUT"
# Sanity: the install-absolute command from the repo ROOT cwd is allowed -- proves
# the deny above is specifically the cwd fence, not an unrelated shape rejection.
# (WI-498: the relative form from this clone-root would ALSO deny — repo != install —
# so the install-absolute form is used to isolate the cwd fence being tested here.)
WI494_SHADOW_CMD_ABS="node $ROOT/scripts/svc-ensure-worktree.mjs --wi $WI494_SHADOW_WI --branch shadow-br"
SHADOW_ROOT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "sess-Alonger-than-8" "$WI494_REPO5" "$WI494_SHADOW_CMD_ABS")"
SHADOW_ROOT_OUT="$(printf '%s' "$SHADOW_ROOT_PAYLOAD" | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_RUNTIME5" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "F-001 sanity: install-absolute command from repo ROOT cwd is allowed" wi494_is_allow "$SHADOW_ROOT_OUT"
# WI-498: and the RELATIVE command from the clone root is DENIED (repo != install).
SHADOW_ROOT_REL_OUT="$(printf '%s' "$SHADOW_ROOT_PAYLOAD" | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8"));p.tool_input.command="'"$WI494_SHADOW_CMD"'";process.stdout.write(JSON.stringify(p))' | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_RUNTIME5" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "WI-498: relative command from clone ROOT cwd is DENIED (repo != install)" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$SHADOW_ROOT_REL_OUT"
expect "F-001: shadow script was never actually invoked by this fixture" bash -c "! test -f '$WI494_REPO5/PWNED'"
rm -rf "$WI494_REPO5" "$WI494_RUNTIME5"

echo "--- WI-494 round 2 (F-004): symlinked bootstrap-intent/.worktrees parent negative fixtures ---"

# A PRE-PLANTED symlink at .svc/bootstrap-intent must never authorize a bootstrap
# read/write redirected outside the repository -- lstat-the-leaf-only checks never
# notice an intermediate symlinked component. CONFIRMED HIGH.
WI494_REPO6="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO6"
git -C "$WI494_REPO6" config user.email t@t
git -C "$WI494_REPO6" config user.name t
WI494_EVIL_MARKER_DIR="$(mktemp -d)"
mkdir -p "$WI494_REPO6/.svc"
rm -rf "$WI494_REPO6/.svc/bootstrap-intent"
ln -s "$WI494_EVIL_MARKER_DIR" "$WI494_REPO6/.svc/bootstrap-intent"
WI494_RUNTIME6="$(mktemp -d)"; chmod 700 "$WI494_RUNTIME6"
WI494_SYMLINK_WI="WI-$RANDOM$RANDOM"
WI494_SYMLINK_CMD="node scripts/svc-ensure-worktree.mjs --wi $WI494_SYMLINK_WI --branch symlink-br"
SYMLINK_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "sess-Alonger-than-8" "$WI494_REPO6" "$WI494_SYMLINK_CMD")"
SYMLINK_OUT="$(printf '%s' "$SYMLINK_PAYLOAD" | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_RUNTIME6" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "F-004: symlinked .svc/bootstrap-intent parent is DENIED by the enforcer" node -e 'const j=JSON.parse(process.argv[1]);process.exit(j.hookSpecificOutput?.permissionDecision==="deny"?0:1)' "$SYMLINK_OUT"
expect "F-004: svc-ensure-worktree.mjs itself hard-errors on the symlinked marker parent" bash -c \
  "! (cd '$WI494_REPO6' && SVC_SESSION_ID='sess-Alonger-than-8' node '$ROOT/scripts/svc-ensure-worktree.mjs' --wi '$WI494_SYMLINK_WI' --branch symlink-br) >/dev/null 2>&1"
expect "F-004: nothing was written into the .svc/bootstrap-intent symlink target" bash -c "[ -z \"\$(ls -A '$WI494_EVIL_MARKER_DIR')\" ]"
rm -rf "$WI494_REPO6" "$WI494_RUNTIME6" "$WI494_EVIL_MARKER_DIR"

# Same fence for a PRE-PLANTED symlink at .worktrees itself, redirecting worktree
# creation outside the repository. This layer is enforced by svc-ensure-worktree.mjs
# itself (the enforcer authorizes RUNNING the command; the script must still refuse
# to be tricked once it runs), so this is proven by direct script invocation.
WI494_REPO7="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO7"
git -C "$WI494_REPO7" config user.email t@t
git -C "$WI494_REPO7" config user.name t
WI494_EVIL_WORKTREES_DIR="$(mktemp -d)"
ln -s "$WI494_EVIL_WORKTREES_DIR" "$WI494_REPO7/.worktrees"
WI494_WT_SYMLINK_WI="WI-$RANDOM$RANDOM"
expect "F-004: svc-ensure-worktree.mjs hard-errors on a symlinked .worktrees parent" bash -c \
  "! (cd '$WI494_REPO7' && SVC_SESSION_ID='sess-Alonger-than-8' node '$ROOT/scripts/svc-ensure-worktree.mjs' --wi '$WI494_WT_SYMLINK_WI' --branch worktrees-symlink-br) >/dev/null 2>&1"
expect "F-004: nothing was written into the .worktrees symlink target" bash -c "[ -z \"\$(ls -A '$WI494_EVIL_WORKTREES_DIR')\" ]"
rm -rf "$WI494_REPO7" "$WI494_EVIL_WORKTREES_DIR"

echo "--- WI-494: bootstrap-marker.mjs tri-state unit coverage (F-003) ---"

WI494_MARKER_TMP="$(mktemp -d)"; chmod 700 "$WI494_MARKER_TMP"
expect "absent marker (ENOENT) is tri-state absent, not invalid" node --input-type=module -e '
import { readMarker } from "'"$ROOT"'/hooks/codex/lib/bootstrap-marker.mjs";
const r = readMarker(process.argv[1]);
process.exit(r.state === "absent" && r.marker === null ? 0 : 1);
' "$WI494_MARKER_TMP/does-not-exist.json"

node -e 'require("fs").writeFileSync(process.argv[1], "{not json")' "$WI494_MARKER_TMP/malformed.json"
expect "malformed JSON marker is tri-state invalid, never downgraded to absent" node --input-type=module -e '
import { readMarker } from "'"$ROOT"'/hooks/codex/lib/bootstrap-marker.mjs";
const r = readMarker(process.argv[1]);
process.exit(r.state === "invalid" ? 0 : 1);
' "$WI494_MARKER_TMP/malformed.json"

node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({schema_version:1,session_id:"s",wi:"WI-1"}))' "$WI494_MARKER_TMP/missing-field.json"
expect "marker missing a required field is tri-state invalid" node --input-type=module -e '
import { readMarker } from "'"$ROOT"'/hooks/codex/lib/bootstrap-marker.mjs";
const r = readMarker(process.argv[1]);
process.exit(r.state === "invalid" ? 0 : 1);
' "$WI494_MARKER_TMP/missing-field.json"

ln -s "$WI494_MARKER_TMP/malformed.json" "$WI494_MARKER_TMP/symlink.json"
expect "symlinked marker path is tri-state invalid" node --input-type=module -e '
import { readMarker } from "'"$ROOT"'/hooks/codex/lib/bootstrap-marker.mjs";
const r = readMarker(process.argv[1]);
process.exit(r.state === "invalid" ? 0 : 1);
' "$WI494_MARKER_TMP/symlink.json"

node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({schema_version:1,session_id:"s",wi:"WI-1",branch:"b",target_worktree:"/tmp/x"}))' "$WI494_MARKER_TMP/valid.json"
expect "well-formed marker is tri-state valid" node --input-type=module -e '
import { readMarker } from "'"$ROOT"'/hooks/codex/lib/bootstrap-marker.mjs";
const r = readMarker(process.argv[1]);
process.exit(r.state === "valid" && r.marker.wi === "WI-1" ? 0 : 1);
' "$WI494_MARKER_TMP/valid.json"
rm -rf "$WI494_MARKER_TMP"

echo "--- WI-494: svc-ensure-worktree.mjs hard-errors on an invalid marker (F-003 round 3) ---"

WI494_REPO3="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO3"
git -C "$WI494_REPO3" config user.email t@t
git -C "$WI494_REPO3" config user.name t
WI494_INVALID_WI="WI-$RANDOM$RANDOM"
mkdir -m 700 -p "$WI494_REPO3/.svc/bootstrap-intent"
printf '{not json' > "$WI494_REPO3/.svc/bootstrap-intent/$WI494_INVALID_WI.json"
# Invoke $ROOT's OWN copy of the script (see the CED-01 note above) -- the
# tri-state hard-error path is this-file-local WI-494 logic that a disposable
# clone's committed-at-HEAD copy would not yet carry.
expect "ensure-worktree hard-errors (never silently overwrites) on an invalid on-disk marker" bash -c \
  "! (cd '$WI494_REPO3' && SVC_SESSION_ID='sess-Alonger-than-8' node '$ROOT/scripts/svc-ensure-worktree.mjs' --wi '$WI494_INVALID_WI' --branch invalid-marker-br2) >/dev/null 2>&1"
expect "the malformed marker was NOT deleted by the hard-error path" test -f "$WI494_REPO3/.svc/bootstrap-intent/$WI494_INVALID_WI.json"
rm -rf "$WI494_REPO3"

echo "--- WI-494: mutation-adequacy proofs (F-006) -- each negative is a real detector ---"

WI494_MUT="$(mktemp -d)"
# Combine with (not replace) the file-level cleanup trap set at the top of this
# script -- overwriting it would silently drop the original "$TMP" cleanup.
trap 'rm -rf "$TMP" "$WI494_MUT"' EXIT

# --- Lexer mutant: lexSimpleCommand degrades to a naive whitespace split with no
#     rejection at all. A vector is "killed" when the MUTANT now parses it (ok:true)
#     where the real lexSimpleCommand rejects it (already proven ok:false above via
#     the driven injection-negative loop).
mkdir -p "$WI494_MUT/lexer"
cat > "$WI494_MUT/lexer/argv-lex.mjs" <<'MUTEOF'
export function lexSimpleCommand(input) {
  const argv = String(input ?? "").trim().split(/\s+/).filter(Boolean);
  return argv.length ? { ok: true, argv } : { ok: false, reason: "empty" };
}
MUTEOF
for vector in \
  'kubectl get pods $(rm -rf /)' \
  'kubectl get pods `id`' \
  'kubectl get pods | tee /etc/x' \
  'kubectl get pods > /etc/x' \
  'kubectl get pods; rm -rf /' \
  'cat "$(id)"' \
  'cat *.md' \
  'cat file # note' \
  'cat ~' \
  'ls {a,b}'; do
  expect "lexer mutant killed by: $vector" node --input-type=module -e '
import { lexSimpleCommand } from "'"$WI494_MUT"'/lexer/argv-lex.mjs";
process.exit(lexSimpleCommand(process.argv[1]).ok === true ? 0 : 1);
' "$vector"
done

# --- Bootstrap-predicate mutant: isBootstrapShape unconditionally true, spliced
#     into a full COPY of the enforcer + its dependency tree (the real files are
#     never touched). A vector is "killed" when the mutant hook now ALLOWS a
#     command the real enforcer denies (proven above via the driven fixtures).
mkdir -p "$WI494_MUT/boot/hooks/codex/lib" "$WI494_MUT/boot/hooks/lib"
cp "$ROOT/hooks/codex/lib/argv-lex.mjs" "$WI494_MUT/boot/hooks/codex/lib/argv-lex.mjs"
cp "$ROOT/hooks/codex/lib/bootstrap-marker.mjs" "$WI494_MUT/boot/hooks/codex/lib/bootstrap-marker.mjs"
cp "$ROOT/hooks/codex/lib/codex-hook-context.mjs" "$WI494_MUT/boot/hooks/codex/lib/codex-hook-context.mjs"
cp "$ROOT/hooks/codex/lib/session-handoff.mjs" "$WI494_MUT/boot/hooks/codex/lib/session-handoff.mjs"
cp "$ROOT/hooks/lib/resolve-wi.mjs" "$WI494_MUT/boot/hooks/lib/resolve-wi.mjs"
cp "$ROOT/hooks/lib/operation-scope.mjs" "$WI494_MUT/boot/hooks/lib/operation-scope.mjs"
cp "$ROOT/hooks/lib/shell-tools.mjs" "$WI494_MUT/boot/hooks/lib/shell-tools.mjs"
cp "$ROOT/hooks/lib/pretool-decision-engine.mjs" "$WI494_MUT/boot/hooks/lib/pretool-decision-engine.mjs"
cp "$ROOT/hooks/lib/validate-task-graph-shape.mjs" "$WI494_MUT/boot/hooks/lib/validate-task-graph-shape.mjs"
cp "$ROOT/hooks/lib/wi-claim.mjs" "$WI494_MUT/boot/hooks/lib/wi-claim.mjs"
cp "$ROOT/hooks/lib/authoritative-binding.mjs" "$WI494_MUT/boot/hooks/lib/authoritative-binding.mjs"
cp "$ROOT/hooks/lib/svc-runtime-root.mjs" "$WI494_MUT/boot/hooks/lib/svc-runtime-root.mjs"
cp "$ROOT/hooks/lib/authority-store.mjs" "$WI494_MUT/boot/hooks/lib/authority-store.mjs"
# WI-562: authority-store now imports the shared liveness lib
cp "$ROOT/hooks/lib/process-liveness.mjs" "$WI494_MUT/boot/hooks/lib/process-liveness.mjs"
cp "$ROOT/hooks/lib/delegation-authority.mjs" "$WI494_MUT/boot/hooks/lib/delegation-authority.mjs"
cp "$ROOT/hooks/lib/claim-owner.mjs" "$WI494_MUT/boot/hooks/lib/claim-owner.mjs"
cp "$ROOT/hooks/lib/wi-id.mjs" "$WI494_MUT/boot/hooks/lib/wi-id.mjs"  # WI-497 canonical dep
# WI-FW-HOOKS-SAFETY-01: the enforcer now imports the shared literal-ref validator
cp "$ROOT/hooks/lib/literal-branch.mjs" "$WI494_MUT/boot/hooks/lib/literal-branch.mjs"
cp "$ROOT/hooks/lib/worktree-policy.mjs" "$WI494_MUT/boot/hooks/lib/worktree-policy.mjs"
cp "$ROOT/hooks/codex/lib/argv-encode.mjs" "$WI494_MUT/boot/hooks/codex/lib/argv-encode.mjs"
node -e '
const fs = require("fs");
const src = fs.readFileSync(process.argv[1], "utf8");
const start = src.indexOf("function isBootstrapShape(payload, ctx, env = process.env) {");
const end = src.indexOf("\nfunction bootstrapShapeInner", start);
if (start < 0 || end < 0) { console.error("mutant splice markers not found"); process.exit(1); }
const mutated = src.slice(0, start) + "function isBootstrapShape() { return true; }\nfunction __unused_bootstrapShapeInner" + src.slice(end + "\nfunction bootstrapShapeInner".length);
fs.writeFileSync(process.argv[2], mutated);
' "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" "$WI494_MUT/boot/hooks/codex/svc-codex-skill-load-enforcer.mjs"
WI494_MUT_RUNTIME="$(mktemp -d)"; chmod 700 "$WI494_MUT_RUNTIME"
for vector in \
  "node scripts/svc-ensure-worktree.mjs --wi bad-wi --branch b" \
  "node scripts/svc-ensure-worktree.mjs --wi WI-1 --branch b --evil x" \
  "node scripts/task-graph.mjs init --wi WI-1 --branch b"; do
  MUT_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "sess-Alonger-than-8" "$TEST_CWD" "$vector")"
  MUT_OUT="$(printf '%s' "$MUT_PAYLOAD" | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_MUT_RUNTIME" node "$WI494_MUT/boot/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
  expect "bootstrap-predicate mutant killed by: $vector" test "$MUT_OUT" = '{}'
done
# "graph already owned" vector: reuse the real e2e worktree state proven denied above.
MUT_OWNED_PAYLOAD="$(node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' "$WI494_SESSION" "$WI494_WORKTREE" "$WI494_BOOT_CMD")"
# F-005: capture stdout and exit status SEPARATELY -- the previous
# `2>/dev/null || echo '{}'` translated ANY failure (including a crash with no
# stdout at all) into the literal string '{}', which would satisfy the assertion
# below even if the mutant enforcer had crashed instead of correctly denying. A
# crash must be a visible test failure, never silently reinterpreted as "allow".
MUT_OWNED_STDERR="$WI494_MUT_RUNTIME/mut-owned.stderr"
MUT_OWNED_OUT="$(printf '%s' "$MUT_OWNED_PAYLOAD" | SVC_SESSION_ID="$WI494_SESSION" SVC_CODEX_RUNTIME_DIR="$WI494_MUT_RUNTIME" node "$WI494_MUT/boot/hooks/codex/svc-codex-skill-load-enforcer.mjs" 2>"$MUT_OWNED_STDERR")" && MUT_OWNED_STATUS=0 || MUT_OWNED_STATUS=$?
expect "bootstrap-predicate mutant graph-owned probe exits cleanly (no crash masked as allow)" test "$MUT_OWNED_STATUS" -eq 0
expect "bootstrap-predicate mutant killed by: graph already owned (laneGraphs!=0)" test "$MUT_OWNED_OUT" = '{}'
rm -rf "$WI494_MUT_RUNTIME"

# Step 6 (deferred from the CED-01/CED-02 e2e section above, R2-F005(b)): full
# cleanup of the live e2e bootstrap state, now that the "graph already owned"
# mutant probe above has actually exercised it non-vacuously. Assert no leakage
# into the SOURCE repo's worktree list.
WI494_SOURCE_WORKTREES_BEFORE="$(git -C "$ROOT" worktree list)"
rm -rf "$WI494_REPO" "$WI494_RUNTIME"
WI494_SOURCE_WORKTREES_AFTER="$(git -C "$ROOT" worktree list)"
expect "disposable clone left the source repo's worktree list unchanged" test "$WI494_SOURCE_WORKTREES_BEFORE" = "$WI494_SOURCE_WORKTREES_AFTER"

# --- Marker-reader mutant: readMarker always reports the ON-DISK marker as valid
#     and trustworthy verbatim (no ownership/type/uid/schema/field validation). A
#     vector is "killed" when the mutant's bootstrap predicate now trusts a marker
#     the real tri-state reader would have rejected as invalid (proven above).
mkdir -p "$WI494_MUT/marker/hooks/codex/lib" "$WI494_MUT/marker/hooks/lib"
cp "$ROOT/hooks/codex/lib/argv-lex.mjs" "$WI494_MUT/marker/hooks/codex/lib/argv-lex.mjs"
cp "$ROOT/hooks/codex/lib/codex-hook-context.mjs" "$WI494_MUT/marker/hooks/codex/lib/codex-hook-context.mjs"
cp "$ROOT/hooks/codex/lib/session-handoff.mjs" "$WI494_MUT/marker/hooks/codex/lib/session-handoff.mjs"
cp "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" "$WI494_MUT/marker/hooks/codex/svc-codex-skill-load-enforcer.mjs"
cp "$ROOT/hooks/lib/resolve-wi.mjs" "$WI494_MUT/marker/hooks/lib/resolve-wi.mjs"
cp "$ROOT/hooks/lib/operation-scope.mjs" "$WI494_MUT/marker/hooks/lib/operation-scope.mjs"
cp "$ROOT/hooks/lib/shell-tools.mjs" "$WI494_MUT/marker/hooks/lib/shell-tools.mjs"
cp "$ROOT/hooks/lib/pretool-decision-engine.mjs" "$WI494_MUT/marker/hooks/lib/pretool-decision-engine.mjs"
cp "$ROOT/hooks/lib/validate-task-graph-shape.mjs" "$WI494_MUT/marker/hooks/lib/validate-task-graph-shape.mjs"
cp "$ROOT/hooks/lib/wi-claim.mjs" "$WI494_MUT/marker/hooks/lib/wi-claim.mjs"
cp "$ROOT/hooks/lib/authoritative-binding.mjs" "$WI494_MUT/marker/hooks/lib/authoritative-binding.mjs"
# WI-562: wi-claim/authority-store import the shared liveness lib
cp "$ROOT/hooks/lib/process-liveness.mjs" "$WI494_MUT/marker/hooks/lib/process-liveness.mjs"
cp "$ROOT/hooks/lib/svc-runtime-root.mjs" "$WI494_MUT/marker/hooks/lib/svc-runtime-root.mjs"
cp "$ROOT/hooks/lib/authority-store.mjs" "$WI494_MUT/marker/hooks/lib/authority-store.mjs"
cp "$ROOT/hooks/lib/delegation-authority.mjs" "$WI494_MUT/marker/hooks/lib/delegation-authority.mjs"
cp "$ROOT/hooks/lib/claim-owner.mjs" "$WI494_MUT/marker/hooks/lib/claim-owner.mjs"
cp "$ROOT/hooks/lib/wi-id.mjs" "$WI494_MUT/marker/hooks/lib/wi-id.mjs"  # WI-497 canonical dep
# WI-FW-HOOKS-SAFETY-01: enforcer dependency tree includes the ref validator
cp "$ROOT/hooks/lib/literal-branch.mjs" "$WI494_MUT/marker/hooks/lib/literal-branch.mjs"
cp "$ROOT/hooks/lib/worktree-policy.mjs" "$WI494_MUT/marker/hooks/lib/worktree-policy.mjs"
cp "$ROOT/hooks/codex/lib/argv-encode.mjs" "$WI494_MUT/marker/hooks/codex/lib/argv-encode.mjs"
cat > "$WI494_MUT/marker/hooks/codex/lib/bootstrap-marker.mjs" <<'MUTEOF'
import path from "node:path";
export function markerPathFor(repoRoot, wi) { return path.join(repoRoot, ".svc", "bootstrap-intent", `${wi}.json`); }
// F-004: this mutant targets ONLY readMarker's trust behavior; secureAncestors is
// a pass-through no-op here so the import contract still matches the real module
// and the ancestor fence (proven by its own dedicated fixtures above) never masks
// this specific vector.
export function secureAncestors() { return true; }
// Mutant: blindly parses and trusts whatever bytes are on disk, no ownership/
// uid/symlink/schema/required-field checks at all -- exactly the WI-494 F-003
// downgrade-to-trusted defect the real tri-state reader closes.
import fs from "node:fs";
export function readMarker(markerPath) {
  try { return { state: "valid", marker: JSON.parse(fs.readFileSync(markerPath, "utf8")) }; }
  catch { return { state: "absent", marker: null }; }
}
MUTEOF
WI494_REPO4="$(mktemp -d)"
git clone --quiet --local --no-hardlinks "$ROOT" "$WI494_REPO4"
mkdir -m 700 -p "$WI494_REPO4/.svc/bootstrap-intent"
WI494_MUT_MARKER_WI="WI-$RANDOM$RANDOM"
# The marker's OWNERSHIP fields (session_id/wi/branch/target_worktree) deliberately
# MATCH the request that will be driven below -- the only defect is a missing
# schema_version, which the real tri-state reader treats as `invalid` (a
# structural/schema check, not an ownership check). A mutant that blindly trusts
# on-disk bytes (no schema/field validation at all) will therefore ALLOW here,
# while the real readMarker denies -- proving the schema/field validation itself
# (not just the ownership comparison) is load-bearing.
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({session_id:process.argv[4],wi:process.argv[2],branch:"foreign-br",target_worktree:process.argv[3]}))' \
  "$WI494_REPO4/.svc/bootstrap-intent/$WI494_MUT_MARKER_WI.json" "$WI494_MUT_MARKER_WI" "$WI494_REPO4" "sess-Alonger-than-8"
WI494_MUT_RUNTIME4="$(mktemp -d)"; chmod 700 "$WI494_MUT_RUNTIME4"
# WI-498: each enforcer is driven via ITS OWN install-absolute svc-ensure-worktree
# path (Arm B), so the repo!=install relative guard does not fire and the MARKER
# schema check remains the deciding factor being tested here. The mutant tree lacks
# a scripts/ dir, so plant a dummy (the enforcer only realpath-matches it; it is
# never executed during authorization).
mkdir -p "$WI494_MUT/marker/scripts"
printf '%s\n' '#!/usr/bin/env node' > "$WI494_MUT/marker/scripts/svc-ensure-worktree.mjs"
mut_marker_payload() { node -e 'process.stdout.write(JSON.stringify({session_id:process.argv[1],turn_id:"t1",cwd:process.argv[2],tool_name:"Bash",tool_input:{command:process.argv[3]}}))' \
  "sess-Alonger-than-8" "$WI494_REPO4" "$1"; }
MUT_MARKER_OUT="$(printf '%s' "$(mut_marker_payload "node $WI494_MUT/marker/scripts/svc-ensure-worktree.mjs --wi $WI494_MUT_MARKER_WI --branch foreign-br")" | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_MUT_RUNTIME4" node "$WI494_MUT/marker/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "marker-reader mutant killed by: missing-schema_version marker blindly trusted" test "$MUT_MARKER_OUT" = '{}'
# Sanity: the REAL (unmutated) reader must still deny the identical on-disk marker
# (driven via the REAL enforcer's own install-absolute path).
REAL_MARKER_OUT="$(printf '%s' "$(mut_marker_payload "node $ROOT/scripts/svc-ensure-worktree.mjs --wi $WI494_MUT_MARKER_WI --branch foreign-br")" | SVC_SESSION_ID="sess-Alonger-than-8" SVC_CODEX_RUNTIME_DIR="$WI494_MUT_RUNTIME4" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "real reader still denies the missing-schema_version marker (vector is genuine)" wi494_is_deny "$REAL_MARKER_OUT"
rm -rf "$WI494_REPO4" "$WI494_MUT_RUNTIME4"

rm -rf "$WI494_MUT"


# =============================================================================
# WI-496: installed-script binding -- the bootstrap/loader exits must work in
# ONBOARDED product repos, which do not vendor svc scripts (live-reproduced in
# example-marketplace: the WI-494 exit denied its own recovery command there).
# Arm A (repo-local relative) is covered by the WI-494 fixtures above (ISB-02
# regression fence). This section proves Arm B (installed absolute), the
# negatives, and the repo-aware recovery strings. Cleanup: single ISB_T root
# removed once at the end (no per-fixture trap accumulation -- R3-F004).
# =============================================================================

echo "--- WI-496: installed-path bootstrap exit in an onboarded repo (ISB-01) ---"
ISB_T="$(mktemp -d)"
ISB_SESSION="sess-wi496-fixture-0001"
ISB_RUNTIME="$ISB_T/runtime"; mkdir -p "$ISB_RUNTIME"; chmod 700 "$ISB_RUNTIME"
# A realistic onboarded product repo: cloned from an origin (ensure-worktree
# requires origin/main), with .worktrees/ ignored, and NO vendored svc scripts.
mkdir -p "$ISB_T/src"
git -C "$ISB_T/src" init -q -b main
git -C "$ISB_T/src" config user.email t@t
git -C "$ISB_T/src" config user.name t
printf '.worktrees/\n.svc/\n' > "$ISB_T/src/.gitignore"
printf 'onboarded product repo\n' > "$ISB_T/src/README.md"
git -C "$ISB_T/src" add -A
git -C "$ISB_T/src" commit -qm init
git clone -q "$ISB_T/src" "$ISB_T/onb"
git -C "$ISB_T/onb" config user.email t@t
git -C "$ISB_T/onb" config user.name t
mkdir -p "$ISB_T/onb/.svc"
ISB_INSTALLED="$(realpath "$ROOT/scripts/svc-ensure-worktree.mjs")"
ISB_INSTALLED_LOADER="$(realpath "$ROOT/scripts/codex-load-skill.mjs")"
isb_drive() { printf '%s' "$1" | SVC_SESSION_ID="$ISB_SESSION" SVC_CODEX_RUNTIME_DIR="$ISB_RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs"; }

# ISB-01 step 1: enforcer ALLOWS the installed-absolute bootstrap command.
ISB_BOOT_CMD="node $ISB_INSTALLED --wi WI-9 --branch wi9-isb-branch --json"
ISB_S1="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_T/onb" "$ISB_BOOT_CMD")")"
expect "ISB-01 installed-path bootstrap command allowed in onboarded repo" wi494_is_allow "$ISB_S1"

# ISB-01 step 2: EXECUTE it; parse absolute_graph from the JSON; validate shape (R3-F006).
ISB_JSON="$(cd "$ISB_T/onb" && SVC_SESSION_ID="$ISB_SESSION" node "$ISB_INSTALLED" --wi WI-9 --branch wi9-isb-branch --json)"
expect "ISB-01 bootstrap command actually succeeds" test -n "$ISB_JSON"
ISB_GRAPH="$(printf '%s' "$ISB_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).absolute_graph||"")}catch(e){}})')"
expect "ISB-01 graph created at reported path" test -f "$ISB_GRAPH"
expect "ISB-01 created graph passes canonical shape validation" node --input-type=module -e 'import {validateTaskGraphShape} from "'"$ROOT"'/hooks/lib/validate-task-graph-shape.mjs"; import fs from "node:fs"; const g=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.exit(validateTaskGraphShape(g).ok?0:1)' "$ISB_GRAPH"

# ISB-01 step 3: loader for the created graph is allowed -- via the INSTALLED
# absolute loader token (product repos do not vendor codex-load-skill.mjs either).
ISB_WT="$(dirname "$(dirname "$ISB_GRAPH")")"
ISB_TASK_ID="$(node -e 'const g=require(process.argv[1]);const t=(g.tasks||[]).find(x=>x.status==="pending");process.stdout.write(String(t?t.id:""))' "$ISB_GRAPH")"
ISB_TASK_SKILL="$(node -e 'const g=require(process.argv[1]);const t=(g.tasks||[]).find(x=>x.status==="pending");process.stdout.write(String((t&&(t.metadata&&t.metadata.skill||t.skill))||""))' "$ISB_GRAPH")"
ISB_LOAD_CMD="node $ISB_INSTALLED_LOADER --graph $ISB_GRAPH --task $ISB_TASK_ID --skill $ISB_TASK_SKILL"
ISB_S3="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_WT" "$ISB_LOAD_CMD")")"
expect "ISB-01 installed-path loader for the created graph allowed (one-hop exit)" wi494_is_allow "$ISB_S3"

# ISB-01 step 4: re-driving the bootstrap after the graph exists is denied.
ISB_S4="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_WT" "$ISB_BOOT_CMD")")"
expect "ISB-01 second bootstrap once graph owned is denied (idempotent close)" wi494_is_deny "$ISB_S4"

echo "--- WI-496: installed-path negatives (ISB-03) ---"
cp "$ISB_INSTALLED" "$ISB_T/elsewhere.mjs"
ISB_N1="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_T/onb" "node $ISB_T/elsewhere.mjs --wi WI-9 --branch wi9-isb-branch")")"
expect "ISB-03a absolute path to a byte-copy at a third location denied" wi494_is_deny "$ISB_N1"
ISB_N2="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_T/onb" "node scripts/svc-ensure-worktree.mjs --wi WI-9 --branch wi9-isb-branch")")"
expect "ISB-03b relative spelling in a repo without the script denied" wi494_is_deny "$ISB_N2"
ln -s "$ISB_T/elsewhere.mjs" "$ISB_T/link.mjs"
ISB_N3="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_T/onb" "node $ISB_T/link.mjs --wi WI-9 --branch wi9-isb-branch")")"
expect "ISB-03c symlink resolving to the third-location copy denied" wi494_is_deny "$ISB_N3"
cp "$ISB_INSTALLED_LOADER" "$ISB_T/loader-copy.mjs"
ISB_N4="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_WT" "node $ISB_T/loader-copy.mjs --graph $ISB_GRAPH --task $ISB_TASK_ID --skill $ISB_TASK_SKILL")")"
expect "ISB-03d loader byte-copy at a third location denied" wi494_is_deny "$ISB_N4"

echo "--- WI-496: repo-aware recovery strings (ISB-04) ---"
ISB_T2="$(mktemp -d)"
mkdir -p "$ISB_T2/onb2"
git -C "$ISB_T2/onb2" init -q
mkdir -p "$ISB_T2/onb2/.svc"
ISB_R1="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_T2/onb2" "touch x")")"
expect "ISB-04 onboarded-repo denial names the installed absolute path" node -e 'const j=JSON.parse(process.argv[1]);const r=j.hookSpecificOutput?.permissionDecisionReason||"";process.exit(r.includes("node "+process.argv[2]+" --wi")&&!r.includes("node scripts/svc-ensure-worktree.mjs")?0:1)' "$ISB_R1" "$ISB_INSTALLED"
mkdir -p "$ISB_T2/vend"
git -C "$ISB_T2/vend" init -q
mkdir -p "$ISB_T2/vend/.svc" "$ISB_T2/vend/scripts"
cp "$ISB_INSTALLED" "$ISB_T2/vend/scripts/svc-ensure-worktree.mjs"
ISB_R2="$(isb_drive "$(wi494_payload "$ISB_SESSION" "$ISB_T2/vend" "touch x")")"
# WI-498 (G6-F002): a vendored repo that is NOT the install can no longer use the
# relative spelling (the enforcer rejects it — repo != install), so the recovery
# must name the install-absolute path there too. A relative recovery would advise a
# command the enforcer refuses. (Only a genuine framework checkout, repo==install,
# gets the relative recovery — covered by the ROOT-cwd sanity assertions above.)
expect "ISB-04 vendored non-install repo denial names the installed absolute path (G6-F002)" node -e 'const j=JSON.parse(process.argv[1]);const r=j.hookSpecificOutput?.permissionDecisionReason||"";process.exit(r.includes("node "+process.argv[2]+" --wi")&&!r.includes("node scripts/svc-ensure-worktree.mjs")?0:1)' "$ISB_R2" "$ISB_INSTALLED"
# ISB-04b: string tracks payload repo_root, not the hook process cwd.
ISB_R3="$(cd "$ROOT" && printf '%s' "$(wi494_payload "$ISB_SESSION" "$ISB_T2/onb2" "touch x")" | SVC_SESSION_ID="$ISB_SESSION" SVC_CODEX_RUNTIME_DIR="$ISB_RUNTIME" node "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs")"
expect "ISB-04b recovery string tracks ctx.repo_root, not process cwd" node -e 'const j=JSON.parse(process.argv[1]);const r=j.hookSpecificOutput?.permissionDecisionReason||"";process.exit(r.includes("node "+process.argv[2]+" --wi")?0:1)' "$ISB_R3" "$ISB_INSTALLED"

rm -rf "$ISB_T" "$ISB_T2"

echo "codex execution integrity: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
