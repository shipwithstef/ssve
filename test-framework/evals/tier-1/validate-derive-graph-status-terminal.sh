#!/usr/bin/env bash
# Tier 1: deriveGraphStatus terminal-state correctness (WI-446).
# A `skipped` task is a terminal disposition, NOT open work. A graph with no
# in_progress/pending/blocked task must derive "skipped" (all tasks skipped) or
# "completed" (>=1 completed), never the bare "pending" fallthrough. Regression net
# for the 18 real terminal graphs that mis-derived pre-fix: 12 completed+skipped
# graphs store "completed" but derived "pending" (would throw in validateGraph), and
# 6 all-skipped graphs (WI-CLN-11..15, WI-MIMO-B1) derived "pending". Hermetic.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
TG="$REPO_ROOT/scripts/task-graph.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: deriveGraphStatus terminal-state (WI-446) ==="

# assert the DERIVED status of a tasks-only graph (no stored graph.status, so the CLI
# prints `graph.status ?? deriveGraphStatus(tasks)` = the derived value).
assert_derive(){ # $1 label  $2 expected  $3 tasks-json
  local f="$TMP/g-$1.json" out st
  printf '{"wi":"WI-T","lane":"bugfix","tasks":%s}\n' "$3" > "$f"
  if ! out="$(node "$TG" graph-status "$f" 2>&1)"; then fail "$1 (cmd errored: $out)"; return; fi
  st="$(printf '%s' "$out" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(String(JSON.parse(d).status))}catch(e){process.stdout.write("PARSE_ERR")}})')"
  if [ "$st" = "$2" ]; then pass "$1 → $st"; else fail "$1 expected $2 got '$st'"; fi
}

# NEW terminal cases the fix repairs
assert_derive "all-skipped"       skipped     '[{"id":1,"subject":"a","status":"skipped","blocked_by":[]},{"id":2,"subject":"b","status":"skipped","blocked_by":[]}]'
assert_derive "completed-skipped" completed   '[{"id":1,"subject":"a","status":"completed","blocked_by":[]},{"id":2,"subject":"b","status":"skipped","blocked_by":[]}]'
# regression guards — earlier branches must be UNCHANGED
assert_derive "all-completed"     completed   '[{"id":1,"subject":"a","status":"completed","blocked_by":[]}]'
assert_derive "has-in_progress"   in_progress '[{"id":1,"subject":"a","status":"in_progress","blocked_by":[]},{"id":2,"subject":"b","status":"skipped","blocked_by":[]}]'
assert_derive "has-pending"       pending     '[{"id":1,"subject":"a","status":"pending","blocked_by":[]},{"id":2,"subject":"b","status":"completed","blocked_by":[]}]'
assert_derive "has-blocked"       blocked     '[{"id":1,"subject":"a","status":"completed","blocked_by":[]},{"id":2,"subject":"b","status":"blocked","blocked_by":[]}]'
assert_derive "empty"             pending     '[]'

# validateGraph round-trip: a completed+skipped graph that STORES "completed" (the 12
# real graphs) must validate. Pre-fix this throws "status completed does not match
# task-derived status pending"; post-fix derived=="completed" → passes.
REPRO="$TMP/repro.json"
printf '{"wi":"WI-T","lane":"bugfix","status":"completed","tasks":[{"id":1,"subject":"a","status":"completed","blocked_by":[]},{"id":2,"subject":"b","status":"skipped","blocked_by":[]}]}\n' > "$REPRO"
if node "$TG" validate "$REPRO" >/dev/null 2>&1; then pass "mixed graph storing 'completed' validates (round-trip)"; else fail "mixed graph storing 'completed' failed validateGraph (WI-446 bug)"; fi

echo "deriveGraphStatus terminal-state: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
