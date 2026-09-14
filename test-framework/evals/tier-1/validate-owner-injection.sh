#!/usr/bin/env bash
# Tier 1: action-time intended-owner injection gate (WI-392).
#
# Proves the PreToolUse owner router is ADDITIVE-ONLY (allow + additionalContext,
# never a deny — AC1), DETERMINISTIC (project-first, then task_class ASC, deduped
# by task_class — golden, order-stable), loads BOTH the global ownersRegistry
# (skills-manifest.json, AC3) AND a project .svc/task-owners.json that SHADOWS a
# global row of the same class (AC2), and is FAIL-OPEN (any error → exit 0, never
# breaks a tool call). Hermetic + deterministic; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Action-time Intended-Owner Injection (WI-392) ==="

LIB="hooks/lib/owner-index.mjs"
HOOK="hooks/svc-owner-inject.mjs"
[ -s "$LIB" ] && pass "owner-index lib present" || fail "owner-index lib missing"
[ -s "$HOOK" ] && pass "svc-owner-inject hook present" || fail "hook missing"
node --check "$LIB" 2>/dev/null && pass "lib parses" || fail "lib syntax error"
node --check "$HOOK" 2>/dev/null && pass "hook parses" || fail "hook syntax error"

# ---- AC3: ownersRegistry present in the real manifest, ≥1 entry, well-shaped ----
node -e '
const m=require("./skills-manifest.json");
const e=(m.ownersRegistry&&m.ownersRegistry.entries)||[];
const ok=Array.isArray(e)&&e.length>=1&&e.every(r=>r.task_class&&r.owner&&r.signals);
process.exit(ok?0:1);
' && pass "ownersRegistry present in skills-manifest.json, every row has task_class+owner+signals (AC3)" || fail "ownersRegistry missing/malformed"

# ---- AC1 determinism: matchOwners order-stable (project-first, task_class ASC) --
node --input-type=module -e '
import { matchOwners } from "./hooks/lib/owner-index.mjs";
const mk=(task_class,owner,origin,bash)=>({task_class,owner,owner_kind:"skill",message:"",signals:{bash:[bash],paths:[]},origin});
const O=[
  mk("deploy","global-deploy","global","X"),
  mk("deploy","project-deploy","project","X"),   // same class, project → SHADOWS global
  mk("browser-verify","global-bv","global","X"),
];
const r1=matchOwners(O,{command:"X"},5).map(o=>o.task_class+":"+o.owner);
const r2=matchOwners(O,{command:"X"},5).map(o=>o.task_class+":"+o.owner);
// expect: browser-verify(global) + deploy(project wins) → ordered project-first then task_class asc
const expect=["deploy:project-deploy","browser-verify:global-bv"];
let rc=0;
if(JSON.stringify(r1)===JSON.stringify(r2)) console.log("  ✓ idempotent (run-twice identical)"); else {console.log("  ✗ not idempotent: "+JSON.stringify(r1)); rc=1;}
if(JSON.stringify(r1)===JSON.stringify(expect)) console.log("  ✓ order-stable + project shadows global of same task_class (AC1/AC2)"); else {console.log("  ✗ order/shadow wrong: "+JSON.stringify(r1)+" want "+JSON.stringify(expect)); rc=1;}
process.exit(rc);
' && pass "match deterministic + project-shadows-global + order-stable" || fail "match determinism/shadow wrong"

# ---- AC1 + AC2: live hook is additive-only, loads global + project owners -----
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT
mkdir -p "$TMPD/.svc"
# minimal global registry: deploy → global-owner on `mydeploy`
cat > "$TMPD/skills-manifest.json" <<JSON
{"ownersRegistry":{"entries":[
  {"task_class":"deploy","owner":"global-owner","owner_kind":"skill","message":"global deploy owner","signals":{"bash":["\\\\bmydeploy\\\\b"]}}
]}}
JSON
# project file SHADOWS deploy with project-owner (AC2). Project signals are
# LITERAL substrings (never compiled to regex) — ReDoS-proof by construction.
cat > "$TMPD/.svc/task-owners.json" <<JSON
[{"task_class":"deploy","owner":"project-owner","owner_kind":"app","message":"project deploy owner","signals":{"bash":["mydeploy"]}}]
JSON
OUT=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"mydeploy --prod"},"session_id":"o1","cwd":"%s"}' "$TMPD" | node "$REPO_ROOT/$HOOK" 2>/dev/null)
if echo "$OUT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);const o=j.hookSpecificOutput;process.exit(o&&o.permissionDecision==="allow"&&/project-owner/.test(o.additionalContext)?0:1)})'; then
  pass "live hook injects the (project-shadowed) owner with permissionDecision=allow (AC1 additive, AC2 project)"
else fail "live hook did not allow+inject the project owner"; fi
if echo "$OUT" | grep -q '"deny"'; then fail "hook emitted a deny (must be additive-only)"; else pass "hook never denies (AC1)"; fi
# global owner must NOT also appear (project shadowed it — one owner per task_class)
if echo "$OUT" | grep -q 'global-owner'; then fail "global owner leaked despite project shadow"; else pass "project row shadows global of same task_class (no double-owner)"; fi

# ---- dedup: second identical command same session → no re-fire, exit 0 --------
OUT2=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"mydeploy --prod"},"session_id":"o1","cwd":"%s"}' "$TMPD" | node "$REPO_ROOT/$HOOK" 2>/dev/null; echo "rc=$?")
echo "$OUT2" | grep -q "rc=0" && pass "re-run same session: no break (dedup, exit 0)" || fail "re-run broke the call"
echo "$OUT2" | grep -q 'project-owner' && fail "dedup failed: owner re-fired same session" || pass "dedup holds: owner fires once per session"

# ---- non-owner command must NOT fire (no over-injection) ----------------------
OUT3=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git status"},"session_id":"o2","cwd":"%s"}' "$TMPD" | node "$REPO_ROOT/$HOOK" 2>/dev/null)
[ -z "$OUT3" ] && pass "unrelated command → no injection (no over-fire)" || fail "fired on an unowned command"

# ---- malformed payload → fail-open (never breaks a tool call) -----------------
echo 'not json' | node "$REPO_ROOT/$HOOK" >/dev/null 2>&1 && pass "malformed payload → exit 0 (fail-open)" || fail "malformed payload broke the hook"

# ---- Codex G6 F2 + Gemini re-review: ReDoS-proof. GLOBAL regex signals pass a
# ---- safeRe guard that rejects quantified groups ((a+)+, (a?)+, (a|aa)+ — incl.
# ---- the Gemini bypasses); PROJECT signals are literal substrings (no regex exec).
node --input-type=module -e '
import { matchOwners } from "./hooks/lib/owner-index.mjs";
const evil=["(a+)+$","(a?)+$","(a|aa)+$"];
const big="a".repeat(6000)+"!";
let rc=0;
for(const pat of evil){
  const G=[{task_class:"g",owner:"x",owner_kind:"skill",message:"",signals:{bash:[pat],paths:[]},origin:"global"}];
  const t0=Date.now(); const r=matchOwners(G,{command:big},5); const ms=Date.now()-t0;
  if(ms>=500||r.length!==0){console.log("  ✗ global safeRe failed to neutralize "+pat+" ("+ms+"ms, "+r.length+" hits)");rc=1;}
}
const P=[{task_class:"p",owner:"y",owner_kind:"app",message:"",signals:{bash:["(a+)+$"],paths:[]},origin:"project"}];
const t1=Date.now(); const rp=matchOwners(P,{command:big},5); const msp=Date.now()-t1;
if(msp>=500||rp.length!==0){console.log("  ✗ project literal match hung or wrongly matched ("+msp+"ms)");rc=1;}
if(rc===0) console.log("  ✓ global safeRe neutralizes (a+)+$ / (a?)+$ / (a|aa)+$; project literals never ReDoS (<500ms, no match)");
process.exit(rc);
' && pass "F2: ReDoS-proof — global safeRe rejects quantified-group patterns; project signals are literal" || fail "F2: ReDoS guard failed"

# ---- Codex G6 F3: a project row SHADOWS the global of same task_class BEFORE
# ---- signal filtering — a narrowed project signal must not let the global fire.
TMPF="$(mktemp -d)"; mkdir -p "$TMPF/.svc"
cat > "$TMPF/skills-manifest.json" <<'JSON'
{"ownersRegistry":{"entries":[{"task_class":"deploy","owner":"global-owner","owner_kind":"skill","message":"g","signals":{"bash":["\\bvercel\\b"]}}]}}
JSON
cat > "$TMPF/.svc/task-owners.json" <<'JSON'
[{"task_class":"deploy","owner":"project-owner","owner_kind":"app","message":"p","signals":{"bash":["base44"]}}]
JSON
printf '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"vercel deploy"},"session_id":"f3","cwd":"%s"}' "$TMPF" > "$TMPF/payload.json"
F3OUT=$(node "$REPO_ROOT/$HOOK" < "$TMPF/payload.json" 2>/dev/null)
[ -z "$F3OUT" ] && pass "F3: project shadow drops the global owner of same task_class — narrowed project signal blocks the broad global (no fire on vercel)" || fail "F3: global owner fired despite project shadow"
rm -rf "$TMPF"

# ---- wired into a PreToolUse event -------------------------------------------
if node -e 'const h=JSON.parse(require("fs").readFileSync("hooks/hooks.json","utf8")).hooks||{};process.exit(/svc-owner-inject/.test(JSON.stringify(h))?0:1)'; then
  pass "svc-owner-inject wired in hooks.json"
else fail "svc-owner-inject NOT wired into any hook event"; fi

echo "owner injection: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
