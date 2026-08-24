#!/usr/bin/env bash
# WI-562 IP-H1: parallel merge-back ground truth. Proves the validator rejects
# worker-authored evidence and trusts only git-recomputed state.
# Promotion note: see docs/plans/2026-08-24-wi562-multi-agent-handoff-and-graph-engineering.md Appendix P.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap '[[ ${KEEP_TMP:-0} == 1 ]] || rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { local label="$1"; shift; if "$@" >"$TMP/out" 2>&1; then echo "  ✓ $label"; pass=$((pass+1)); else echo "  ✗ $label"; cat "$TMP/out"; fail=$((fail+1)); fi; }
check_fail() { local label="$1"; shift; if "$@" >"$TMP/out" 2>&1; then echo "  ✗ $label"; cat "$TMP/out"; fail=$((fail+1)); else echo "  ✓ $label"; pass=$((pass+1)); fi; }

FIX="$TMP/fix"
mkdir -p "$FIX/src" "$FIX/.svc/dispatch"
git -C "$FIX" init --quiet -b main 2>/dev/null || git -C "$FIX" init --quiet
git -C "$FIX" config user.email t1@invalid
git -C "$FIX" config user.name t1
echo "export const a = 1;" >"$FIX/src/a.ts"
git -C "$FIX" add -A && git -C "$FIX" commit --quiet -m baseline
BASE="$(git -C "$FIX" rev-parse HEAD)"

cat >"$FIX/.svc/wave-plan.json" <<EOF
{"waves":[{"id":"w1","tasks":[
  {"wi":"WI-900","transport":"headless-worker","ownership":{"write_scope":["src/b.ts"]},
   "validation_commands":["node scripts/validate-parallel-merge-back.mjs --selfcheck"]}
]}]}
EOF

result() { # $1=status $2=extra json
cat >"$FIX/.svc/dispatch/WI-900.result.json" <<EOF
{
  "wi": "WI-900", "status": "$1", "worker_summary": "x",
  "worktree": "$FIX", "base_sha": "$BASE",
  "validation_evidence": [{"command": "node scripts/validate-parallel-merge-back.mjs --selfcheck"}],
  "parent_graph_mutation": {"updated": false, "forbidden": true, "path": ".svc/lane-tasks-WI-900.json"}$2
}
EOF
}

V() { SVC_PARALLEL_LEGACY_VALIDATION=1 node "$ROOT/scripts/validate-parallel-merge-back.mjs" --plan "$FIX/.svc/wave-plan.json" --results "$FIX/.svc/dispatch/WI-900.result.json" --no-replay; }

# Committed work in scope passes.
printf 'export const b = 2;\n' >"$FIX/src/b.ts"
git -C "$FIX" add src/b.ts && git -C "$FIX" commit --quiet -m "worker(WI-900): src/b.ts"
result success ',"changed_files":["src/b.ts"]'
[[ ${KEEP_TMP:-0} == 1 ]] && cp "$FIX/.svc/dispatch/WI-900.result.json" "$TMP/first-result.json"
check "committed in-scope worker result passes" V

# Forged PASS with a dirty tree fails.
printf 'x\n' >"$FIX/src/dirty.txt"
check_fail "PASS with dirty tree rejected" V
rm -f "$FIX/src/dirty.txt"

# Worker claiming a file absent from the diff fails.
result success ',"changed_files":["src/b.ts","src/ghost.ts"]'
check_fail "superset file claim rejected" V

# Undeclared validation command fails.
result success ',"changed_files":["src/b.ts"],"validation_evidence":[{"command":"echo ok"}]'
check_fail "undeclared evidence command rejected" V

# Declared command coverage: omitting the declared command fails.
result success ',"changed_files":["src/b.ts"],"validation_evidence":[]'
check_fail "missing declared-command coverage rejected" V

# Non-git worktree cannot verify success.
NONIT="$TMP/nonit"; mkdir -p "$NONIT"
cat >"$FIX/.svc/dispatch/WI-900.result.json" <<EOF
{"wi":"WI-900","status":"success","worker_summary":"x","worktree":"$NONIT","base_sha":"$BASE","validation_evidence":[],"parent_graph_mutation":{"updated":false,"forbidden":true,"path":".svc/x.json"}}
EOF
check_fail "non-git worktree cannot verify success" V

echo "validate-parallel-ground-truth: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
