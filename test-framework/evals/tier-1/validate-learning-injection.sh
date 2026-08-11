#!/usr/bin/env bash
# Tier 1: action-time learning injection gate (WI-384).
#
# Proves the PreToolUse learning injector is DETERMINISTIC (same touched path →
# same learning keys, order-stable by confidence desc then key asc — AC2),
# ADDITIVE-ONLY (allow + additionalContext, never a deny — AC4), and records
# FIRES (.svc/learning-fires.jsonl, the elevation-predicate substrate — AC3).
# Hermetic + deterministic: the order test uses a synthetic in-memory learning
# set; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Action-time Learning Injection (WI-384) ==="

LIB="hooks/lib/learning-index.mjs"
HOOK="hooks/svc-learning-inject.mjs"
[ -s "$LIB" ] && pass "learning-index lib present" || fail "learning-index lib missing"
[ -s "$HOOK" ] && pass "svc-learning-inject hook present" || fail "hook missing"
node --check "$LIB" 2>/dev/null && pass "lib parses" || fail "lib syntax error"
node --check "$HOOK" 2>/dev/null && pass "hook parses" || fail "hook syntax error"

# ---- A. AC2: deterministic, order-stable match (confidence desc, key asc) ----
node --input-type=module -e '
import { matchByPath } from "./hooks/lib/learning-index.mjs";
const L = [
  { key: "z-low",  confidence: 5, files: ["scripts/foo.mjs"], insight: "", type:"x", origin:"framework" },
  { key: "a-high", confidence: 9, files: ["scripts/foo.mjs"], insight: "", type:"x", origin:"framework" },
  { key: "b-high", confidence: 9, files: ["scripts/foo.mjs"], insight: "", type:"x", origin:"framework" },
  { key: "m-mid",  confidence: 7, files: ["scripts/foo.mjs"], insight: "", type:"x", origin:"framework" },
  { key: "no-match", confidence: 10, files: ["other/bar.mjs"], insight: "", type:"x", origin:"framework" },
];
const r1 = matchByPath(L, "scripts/foo.mjs", 3).map(x=>x.key);
const r2 = matchByPath(L, "scripts/foo.mjs", 3).map(x=>x.key);
const expect = ["a-high","b-high","m-mid"];  // conf 9,9,7 → 9s tie-break key asc; cap 3 drops z-low(5)
let rc = 0;
if (JSON.stringify(r1)===JSON.stringify(r2)) console.log("  ✓ idempotent (run-twice identical keys)"); else { console.log("  ✗ NOT idempotent"); rc=1; }
if (JSON.stringify(r1)===JSON.stringify(expect)) console.log("  ✓ order-stable: confidence DESC then key ASC, capped 3 (AC2)"); else { console.log("  ✗ order wrong: "+JSON.stringify(r1)+" want "+JSON.stringify(expect)); rc=1; }
if (!r1.includes("no-match")) console.log("  ✓ only files-matching learnings returned (AC1)"); else { console.log("  ✗ matched a non-file learning"); rc=1; }
process.exit(rc);
' && pass "match is deterministic + order-stable + files-keyed" || fail "match determinism/order wrong"

# ---- B. AC4 + AC3: live hook is additive-only and records fires ------------
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT
mkdir -p "$TMPD/.svc" "$TMPD/references"
# one synthetic framework learning keyed on a path
printf '%s\n' '{"key":"k-test","insight":"test learning","confidence":9,"files":["app/widget.ts"],"type":"x"}' > "$TMPD/references/framework-learnings.jsonl"
OUT=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"app/widget.ts"},"session_id":"s1","cwd":"%s"}' "$TMPD" | node "$REPO_ROOT/$HOOK" 2>/dev/null)
if echo "$OUT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);process.exit(j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision==="allow" && /k-test/.test(j.hookSpecificOutput.additionalContext) ? 0 : 1)})'; then
  pass "live hook injects the matching learning with permissionDecision=allow (AC4 additive)"
else fail "live hook did not allow+inject"; fi
# never a deny
if echo "$OUT" | grep -q '"deny"'; then fail "hook emitted a deny (must be additive-only)"; else pass "hook never denies (AC4)"; fi
# fires ledger appended
if [ -s "$TMPD/.svc/learning-fires.jsonl" ] && node -e 'const l=require("fs").readFileSync(process.argv[1],"utf8").trim();const o=JSON.parse(l.split("\n")[0]);process.exit(o.key==="k-test"&&o.ts?0:1)' "$TMPD/.svc/learning-fires.jsonl"; then
  pass "fire recorded to .svc/learning-fires.jsonl (AC3 elevation substrate)"
else fail "fire not recorded"; fi
# second identical touch in same session → no re-fire (dedup), still exits 0 (no break)
OUT2=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"app/widget.ts"},"session_id":"s1","cwd":"%s"}' "$TMPD" | node "$REPO_ROOT/$HOOK" 2>/dev/null; echo "rc=$?")
echo "$OUT2" | grep -q "rc=0" && pass "re-touch same session: no break (dedup, exit 0)" || fail "re-touch broke the call"
LINES=$(wc -l < "$TMPD/.svc/learning-fires.jsonl")
[ "$LINES" -eq 1 ] && pass "dedup holds: fire recorded once per session" || fail "dedup failed ($LINES fires)"

# ---- C. malformed payload → fail-open (never breaks a tool call) ------------
echo 'not json' | node "$REPO_ROOT/$HOOK" >/dev/null 2>&1 && pass "malformed payload → exit 0 (fail-open)" || fail "malformed payload broke the hook"

# ---- D. wired into a PreToolUse/PostToolUse event ---------------------------
if node -e 'const h=JSON.parse(require("fs").readFileSync("hooks/hooks.json","utf8")).hooks||{};const s=JSON.stringify(h);process.exit(/svc-learning-inject/.test(s)?0:1)'; then
  pass "svc-learning-inject wired in hooks.json"
else fail "svc-learning-inject NOT wired into any hook event"; fi

echo "learning injection: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
