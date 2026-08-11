#!/usr/bin/env bash
# Tier 1: hooks resolve .svc runtime state against the repo root, never seeding
# .svc in an arbitrary cwd (WI-452). Two layers:
#   (A) resolveSvcStateDir unit: null outside an svc repo (incl. stray-.git /tmp),
#       the repo-root .svc inside one.
#   (B) seeder integration: svc-loop-guard (writes state on every call) creates NO
#       .svc when cwd has .git-but-no-.svc (the /tmp+codex-sandbox case), and STILL
#       writes state inside a real svc repo (no regression).
# Hermetic; <3s.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
LIB="$REPO_ROOT/hooks/lib/svc-state-dir.mjs"
LOOPGUARD="$REPO_ROOT/hooks/svc-loop-guard.mjs"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: .svc state-dir resolution / no /tmp pollution (WI-452) ==="

# ---- (A) resolveSvcStateDir unit ----
mkdir -p "$TMP/bare"                                  # no .git, no .svc
mkdir -p "$TMP/straygit" && : > "$TMP/straygit/.git"  # .git (file/dir) but NO .svc  ← the /tmp case
mkdir -p "$TMP/repo/.svc/sub" && : > "$TMP/repo/.git" # real svc repo
unit() { # $1 label  $2 startdir  $3 expected(null|<abs .svc>)
  local got
  got="$(node --input-type=module -e "import r from '$LIB'; const v=r(process.argv[1]); process.stdout.write(v===null?'null':v)" "$2" 2>/dev/null)"
  if [ "$got" = "$3" ]; then pass "$1"; else fail "$1 — expected '$3' got '$got'"; fi
}
unit "bare dir (no .git/.svc) → null"          "$TMP/bare"          "null"
unit "stray .git, no .svc (the /tmp case) → null" "$TMP/straygit"   "null"
unit "real svc repo → repo/.svc"               "$TMP/repo"          "$TMP/repo/.svc"
unit "subdir of svc repo → repo/.svc"          "$TMP/repo/.svc/sub" "$TMP/repo/.svc"

# temp-root skip (Codex P1): an ALREADY-polluted .svc AT the system temp root must
# NOT be treated as authoritative (self-heal). Override TMPDIR so the resolver's
# TEMP_ROOTS includes our controlled fake temp root (hermetic).
FAKETMP="$TMP/faketmp"; mkdir -p "$FAKETMP/.svc" "$FAKETMP/proj/.svc"
g_root="$(TMPDIR="$FAKETMP" node --input-type=module -e "import r from '$LIB'; const v=r(process.argv[1]); process.stdout.write(v===null?'null':v)" "$FAKETMP" 2>/dev/null)"
[ "$g_root" = "null" ] && pass "polluted .svc AT temp root is skipped (self-heal)" || fail "temp-root .svc NOT skipped — got '$g_root'"
g_sub="$(TMPDIR="$FAKETMP" node --input-type=module -e "import r from '$LIB'; const v=r(process.argv[1]); process.stdout.write(v===null?'null':v)" "$FAKETMP/proj" 2>/dev/null)"
[ "$g_sub" = "$FAKETMP/proj/.svc" ] && pass "subdir of temp root still resolves (fixtures unaffected)" || fail "subdir of temp root not resolved — got '$g_sub'"

# ---- (B) svc-loop-guard integration ----
PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"echo hi"},"session_id":"wi452-test"}'

# out-of-repo: cwd has .git but no .svc → MUST NOT create .svc
OUT="$TMP/straygit"
( cd "$OUT" && echo "$PAYLOAD" | node "$LOOPGUARD" >/dev/null 2>&1 || true )
if [ -e "$OUT/.svc" ]; then fail "loop-guard seeded .svc in a stray-.git dir (WI-452 bug)"; else pass "loop-guard creates NO .svc in stray-.git/no-.svc cwd"; fi

# in-repo: real svc repo → state IS written (no regression)
IN="$TMP/repo"
( cd "$IN" && echo "$PAYLOAD" | node "$LOOPGUARD" >/dev/null 2>&1 || true )
if ls "$IN/.svc"/loop-guard-state*.json >/dev/null 2>&1; then pass "loop-guard still writes state inside a real svc repo"; else fail "loop-guard stopped writing state in-repo (regression)"; fi

# ---- (C) svc-stop-quality (its findSvcDir previously fell back to CREATING cwd/.svc) ----
SQ="$REPO_ROOT/hooks/svc-stop-quality.js"
( cd "$OUT" && node "$SQ" --accumulate '{"file_path":"/x/y.js"}' >/dev/null 2>&1 || true )
if [ -e "$OUT/.svc" ]; then fail "stop-quality seeded .svc in a stray-.git dir (WI-452 fallback bug)"; else pass "stop-quality creates NO .svc out-of-repo"; fi
( cd "$IN" && node "$SQ" --accumulate '{"file_path":"/x/y.js"}' >/dev/null 2>&1 || true )
if ls "$IN/.svc"/svc-edited-files*.json >/dev/null 2>&1; then pass "stop-quality still accumulates inside a real svc repo"; else fail "stop-quality stopped accumulating in-repo (regression)"; fi

# ---- (D) Claude-host .mjs seeder surface ----
# NOTE: Kimi shell hooks (hooks/kimi/*.sh) write cwd-relative .svc too but are a SEPARATE
# host surface (Kimi out-of-scope as orchestrator per CLAUDE.md) — documented WI-452
# follow-up, NOT covered here.
#
# (D1) BEHAVIORAL: each unconditional/event .mjs seeder run out-of-repo (stray .git, no
# .svc) creates NO .svc. (auto-capture is excluded here: its write path is gated by a
# git-diff candidate detector capped at 100ms git calls — NOT hermetic — so an out-of-repo
# behavioral assertion would be false-green; it is covered by the static check in D2.)
GENERIC='{"tool_name":"Edit","tool_input":{"file_path":"app/x.ts","content":"y"},"session_id":"t","cwd":"PH"}'
for h in svc-loop-guard svc-rule-injector svc-owner-inject svc-learning-inject \
         svc-subagent-start svc-subagent-stop svc-notification-surface \
         svc-session-end-log svc-pre-compact-snapshot; do
  d="$TMP/seed-$h"; mkdir -p "$d"; : > "$d/.git"   # stray .git, no .svc
  ( cd "$d" && printf '%s' "${GENERIC/PH/$d}" | node "$REPO_ROOT/hooks/$h.mjs" >/dev/null 2>&1 || true )
  [ -e "$d/.svc" ] && fail "$h seeded .svc out-of-repo" || pass "$h: no .svc out-of-repo"
done
# (D2) STATIC guard-wiring (deterministic): every .mjs seeder must reference
# resolveSvcStateDir AND skip when it is null. The resolver itself is proven correct in
# (A) and proven effective end-to-end in (B)/(C) — so wiring each seeder to it is the
# hermetic proof for the git-timing-dependent ones (auto-capture) without flakiness.
for h in svc-loop-guard svc-rule-injector svc-owner-inject svc-learning-inject \
         svc-subagent-start svc-subagent-stop svc-notification-surface \
         svc-session-end-log svc-pre-compact-snapshot svc-auto-capture-learnings; do
  f="$REPO_ROOT/hooks/$h.mjs"
  if grep -q 'resolveSvcStateDir' "$f" && grep -qE 'if \(!(svcDir|stateDir)\)' "$f"; then
    pass "$h: wired to resolveSvcStateDir + skips when null"
  else
    fail "$h: missing resolveSvcStateDir guard"
  fi
done

echo ".svc state-dir: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
