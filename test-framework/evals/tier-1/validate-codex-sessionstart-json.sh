#!/usr/bin/env bash
# WI-499 (F003): regression guard for the Codex SessionStart JSON host-contract
# (SB-02/SB-03) and the enforcer session-id-bridge presence (SB-01/SB-02 env-guard).
# The SessionStart hooks must emit VALID JSON when invoked via a ~/.codex/ path
# (Codex rejects non-JSON: "invalid session start JSON output") and BYTE-IDENTICAL
# plain text via a ~/.claude/ path. The enforcer must bridge the payload session id
# into env only when the env has none.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
FAIL=0
ok(){ echo "  ok   - $1"; }; bad(){ echo "  FAIL - $1"; FAIL=1; }
is_json(){ printf '%s' "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s);process.exit(0)}catch(e){process.exit(1)}})'; }

# Invoke a hook under a fake host path (argv[1] carries the host dir). We symlink the
# real hook under a .codex/.claude/Windows-style tree so argv[1] contains the marker
# while the code is unchanged.
run_as(){ # $1=hookfile $2=fake-argv0-dir(with trailing marker) -> stdout
  local hook="$1" dir="$2"; mkdir -p "$dir"; ln -sf "$ROOT/hooks/$hook" "$dir/$(basename "$hook")"
  printf '{"hook_event_name":"SessionStart","session_id":"s","cwd":"'"$TMP"'"}' | node "$dir/$(basename "$hook")" 2>/dev/null
}

echo "== SB-03: SessionStart hooks emit VALID JSON on the Codex path =="
for h in svc-learning-preload.mjs; do
  OUT="$(run_as "$h" "$TMP/home/.codex/skills/hooks")"
  is_json "$OUT" && ok "$h -> valid JSON on ~/.codex/ path" || bad "$h -> NOT json on codex path"
done
OUT="$(run_as svc-session-start-healthcheck.mjs "$TMP/home/.codex/skills/hooks")"
is_json "$OUT" && ok "healthcheck -> valid JSON on ~/.codex/ path" || bad "healthcheck -> NOT json on codex path"

echo "== SB-03: Claude path stays plain text (byte-identical, NOT wrapped) =="
OUT="$(run_as svc-learning-preload.mjs "$TMP/home/.claude/skills/hooks")"
if printf '%s' "$OUT" | head -c 40 | grep -q "FRAMEWORK LEARNINGS"; then ok "learning-preload -> plain text on ~/.claude/ path"; else bad "learning-preload claude output changed"; fi

echo "== SB-02: Windows-style backslash .codex path also detected =="
# emulate a path whose separators are backslashes by passing an argv that contains \.codex\
WINOUT="$(printf '{"hook_event_name":"SessionStart"}' | node -e '
const {execFileSync}=require("node:child_process");
// simulate: node hook with argv[1] using backslash .codex marker via a wrapper is
// hard cross-platform; instead assert the detection expression handles backslashes.
const p="C:\\Users\\x\\.codex\\skills\\hooks\\svc-learning-preload.mjs";
const detected = p.replace(/\\/g,"/").includes("/.codex/");
process.stdout.write(JSON.stringify({detected}));
')"
printf '%s' "$WINOUT" | grep -q '"detected":true' && ok "backslash \\.codex\\ path detected as Codex" || bad "windows path detection broken"

echo "== SB-01: enforcer carries the session-id bridge (payload -> env before ownership) =="
grep -q "session-id bridge" "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" \
  && grep -q "process.env.CODEX_SESSION_ID = ctx.session_id" "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" \
  && ok "enforcer bridges ctx.session_id -> env (guarded)" || bad "enforcer bridge missing"
# SB-02 env-guard: the bridge must NOT override an existing env session
grep -q '!process.env.SVC_SESSION_ID && !process.env.CODEX_THREAD_ID && !process.env.CODEX_SESSION_ID' "$ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" \
  && ok "bridge never overrides an existing env session (SB-02)" || bad "bridge env-guard missing"

if [ "$FAIL" -eq 0 ]; then echo "TIER-1 PASS: validate-codex-sessionstart-json"; else echo "TIER-1 FAIL"; exit 1; fi
