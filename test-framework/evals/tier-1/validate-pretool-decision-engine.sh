#!/usr/bin/env bash
# WI-FW-HOOKS-SAFETY-01 T02/AC-2: unified pre-tool observation decision engine.
# Hermetic: temp dirs only, no network, no LLM, no repository-state writes.
set -euo pipefail

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf 'ok - %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL - %s\n' "$1"; }

ENGINE="$ROOT/hooks/lib/pretool-decision-engine.mjs"

evl() { # payload-json -> envelope-or-null
  printf '%s' "$1" | node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
let raw="";process.stdin.on("data",d=>raw+=d).on("end",()=>{
  const payload=JSON.parse(raw);
  const result=evaluatePreToolObservation(payload);
  process.stdout.write(JSON.stringify(result));
});'
}

P='{"tool_name":"Bash","tool_input":{"command":$CMD},"cwd":"'"$TMP"'","session_id":"s-1","tool_use_id":"t-1"}'

# 1. proven observations produce typed allow envelopes
for c in "cat sample.txt" "git status --short --branch" "git diff HEAD" "rg -n \"alpha|beta\" sample.txt | head -n 5" "sed -n '1,20p' sample.txt 2>/dev/null"; do
  OUT="$(CMD="$c" node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
console.log(JSON.stringify(evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:process.env.CMD},cwd:"'"$TMP"'"})))')"
  if printf '%s' "$OUT" | grep -q '"classification":"observation"' && printf '%s' "$OUT" | grep -q '"decision":"allow"'; then
    ok "observation proven: $c"
  else bad "should be proven observation: $c ($OUT)"; fi
done

# 2. mutation mutants are NOT engine decisions (governed path owns them)
for c in "git status && touch x" "git commit -m x" "sed -i 's/a/b/' sample.txt" "cat a > b" "echo \$(id)"; do
  OUT="$(CMD="$c" node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r = evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:process.env.CMD},cwd:"'"$TMP"'"});
console.log(r ? "engine" : "null")')"
  [[ "$OUT" == "null" ]] && ok "mutant stays governed: $c" || bad "engine must not claim mutant: $c ($OUT)"
done

# 3. normalization: exact single insertion per needing segment, others untouched
N1="$(CMD="x" node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git status"},cwd:"'"$TMP"'"});
console.log(r.execution_input.command)')"
[[ "$N1" == "git --no-optional-locks status" ]] && ok "git status normalized with top-level option" || bad "status normalization ($N1)"
N2="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git rev-parse --show-toplevel && git status --short"},cwd:"'"$TMP"'"});
console.log(r.execution_input.command)')"
[[ "$N2" == "git rev-parse --show-toplevel && git --no-optional-locks status --short" ]] && ok "compound read normalizes only the git-status segment" || bad "compound normalization ($N2)"
N3="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git -C /tmp/repo status"},cwd:"'"$TMP"'"});
console.log(r.execution_input.command)')"
[[ "$N3" == "git --no-optional-locks -C /tmp/repo status" ]] && ok "global-option position valid after insertion (-C preserved)" || bad "-C normalization ($N3)"
N4="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git --no-optional-locks diff"},cwd:"'"$TMP"'"});
console.log(JSON.stringify(r.execution_input))')"
[[ "$N4" == "null" ]] && ok "already-normalized git argv is passed through untouched" || bad "double normalization ($N4)"
N5="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"cat file.txt; git status"},cwd:"'"$TMP"'"});
console.log(JSON.stringify(r.execution_input.command))')"
[[ "$N5" == '"cat file.txt; git --no-optional-locks status"' ]] && ok "mixed compound rewrites ONLY the git segment, operators preserved verbatim" || bad "cat;git status rewrite ($N5)"
N6="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"cat file.txt"},cwd:"'"$TMP"'"});
console.log(JSON.stringify(r.execution_input))')"
[[ "$N6" == "null" ]] && ok "commands needing no normalization keep the original bytes entirely" || bad "plain cat rewrite ($N6)"

# 4. original input is immutable evidence: digest stable + distinct per distinct input
D1="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const p={tool_name:"Bash",tool_input:{command:"git status"},cwd:"'"$TMP"'"};
const a=evaluatePreToolObservation(p);
const b=evaluatePreToolObservation(p);
console.log((a.original_digest===b.original_digest&&a.original_digest.startsWith("sha256:")?"same":"drift"))')"
D2="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const a=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git status"},cwd:"'"$TMP"'"});
const b=evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git status --short"},cwd:"'"$TMP"'"});
console.log(a.original_digest!==b.original_digest?"distinct":"collision")')"
[[ "$D1" == "same" && "$D2" == "distinct" ]] && ok "original digest is stable and input-sensitive" || bad "digest ($D1/$D2)"

# 5. no repository state: evaluation performs zero .svc writes
BEFORE="$(find "$TMP" -newer "$ENGINE" -type f 2>/dev/null | wc -l)"
node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
for (const c of ["git status","git diff","cat /etc/hostname","pwd"]) evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:c},cwd:"'"$TMP"'"});
' >/dev/null
AFTER="$(find "$TMP" -type f | wc -l)"
[[ "$AFTER" -eq 0 ]] && ok "evaluation wrote zero files under cwd (authority-free reads)" || bad "state leaked during evaluation ($AFTER files)"

# 6. crashed classifier never allows: malformed payload shapes return null or typed deny inputs
M1="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
try { const r = evaluatePreToolObservation({tool_name:"Bash",tool_input:null}); console.log(r===null?"null":"engine"); }
catch { console.log("throw"); }')"
M2="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
try { const r = evaluatePreToolObservation(null); console.log(r===null?"null":"engine"); }
catch { console.log("throw"); }')"
[[ "$M1" == "null" && "$M2" == "null" ]] && ok "malformed payloads never yield an engine allow" || bad "malformed payload handling ($M1/$M2)"

# 7. EXTREV-EXEC-007: git normalization preserves diagnostic redirections
N1="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r = evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git status 2>/dev/null"},cwd:"'"$TMP"'"});
console.log(r?.execution_input?.command||"none")')"
case "$N1" in
  *"--no-optional-locks"*"2>/dev/null"*) ok "normalization re-appends diagnostic redirection suffixes byte-for-byte" ;;
  *) bad "redirection suffix lost during normalization ($N1)" ;;
esac
N2="$(node --input-type=module -e '
import { evaluatePreToolObservation } from "'"$ENGINE"'";
const r = evaluatePreToolObservation({tool_name:"Bash",tool_input:{command:"git status --short 2>&1"},cwd:"'"$TMP"'"});
console.log(r?.execution_input?.command||"none")')"
case "$N2" in
  *"--no-optional-locks"*"2>&1"*) ok "compound suffix (2>&1) survives argv normalization" ;;
  *) bad "2>&1 suffix lost ($N2)" ;;
esac

# 8. EXTREV-EXEC-008: exactly ONE classification entry point — the dispatcher
# must not carry its own observation classifier or fast path
if grep -qE "lightRead|isReadOnlyTool\(" "$ROOT/hooks/codex/svc-codex-pretool-dispatcher.mjs"; then
  bad "dispatcher still classifies observations itself"
else
  ok "dispatcher delegates all classification to the engine entry point"
fi
grep -q "ULTRA_HOT_READ" "$ENGINE" && ok "ultra-hot read fast path lives inside the engine" || bad "engine ultra-hot path missing"

# 9. EXTREV-EXEC-003: self-heal authority requires provable turn and exact repo
git -C "$TMP" init -q 2>/dev/null || true
mkdir -p "$TMP/rt" && chmod 700 "$TMP/rt"
S1="$(SVC_RUNTIME_DIR="$TMP/rt" node --input-type=module -e '
import { evaluateSelfHealAuthority } from "'"$ENGINE"'";
// Session fallback supplies a stable turn, but no authority record exists.
const r = evaluateSelfHealAuthority({session_id:"s9",cwd:"'"$TMP"'"}, process.env, {repo_root:"'"$TMP"'"});
console.log(r.reason_code)')"
[[ "$S1" == "PROMPT_AUTHORITY_ABSENT" ]] && ok "session turn fallback cannot fabricate prompt authority" || bad "turn gate ($S1)"
S2="$(SVC_RUNTIME_DIR="$TMP/rt" node --input-type=module - <<NODE
import fs from "node:fs";
import { evaluateSelfHealAuthority } from "$ENGINE";
import { hookContext, authorityPath } from "$ROOT/hooks/codex/lib/codex-hook-context.mjs";
const payload = { session_id: "s9b", turn_id: "t9", cwd: "$TMP" };
const ctx = hookContext(payload, process.env);
fs.mkdirSync(ctx.session_dir, { recursive: true });
fs.writeFileSync(authorityPath(ctx), JSON.stringify({
  schema_version: 1, session_id: "s9b", turn_id: "t9",
  recorded_at: new Date().toISOString(), continuation_intent: "work_on",
  explicit_wi: "WI-X", repo_root: "/somewhere/else",
}));
const r = evaluateSelfHealAuthority(payload, process.env, { repo_root: "$TMP" });
console.log(r.reason_code);
NODE
)"
[[ "$S2" == "AUTH_TUPLE_REPO_MISMATCH" ]] && ok "cross-repository authority tuple is ineligible" || bad "repo tuple gate ($S2)"

S3="$(SVC_RUNTIME_DIR="$TMP/rt" node --input-type=module - <<NODE
import fs from "node:fs";
import { evaluateSelfHealAuthority } from "$ENGINE";
import { hookContext, authorityPath } from "$ROOT/hooks/codex/lib/codex-hook-context.mjs";
const payload = {session_id: "s9-resume", cwd: "$TMP"};
const ctx = hookContext(payload, process.env);
if (ctx.turn_id !== "session:s9-resume") throw new Error("unexpected fallback turn");
fs.mkdirSync(ctx.session_dir, {recursive: true});
fs.writeFileSync(authorityPath(ctx), JSON.stringify({
  schema_version: 1, session_id: payload.session_id, turn_id: ctx.turn_id,
  recorded_at: new Date().toISOString(), continuation_intent: "resume",
  explicit_wi: "WI-FIXTURE-RESUME", repo_root: "$TMP",
}));
const r = evaluateSelfHealAuthority(payload, process.env, {repo_root: "$TMP"});
console.log(r.eligible && r.wi === "WI-FIXTURE-RESUME" ? r.reason_code : "unexpected");
NODE
)"
[[ "$S3" == "FRESH_POSITIVE_INTENT" ]] && ok "session fallback accepts exact fresh positive authority" || bad "session fallback ($S3)"

printf '\nT02 decision engine: %s passed, %s failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
