#!/usr/bin/env bash
# Tier 1: hook-spawn-count regression net (WI-397).
# Locks the WI-359/370 hook-latency wins so the per-tool-event spawn count
# (the real latency driver — each wired hook is a process spawn) cannot silently
# climb back. Gates COUNT, not warm wall-clock (which is environment-flaky and
# would make a hermetic tier-1 gate intermittently red). Re-derives counts from
# hooks/hooks.json and fails if any event exceeds .svc/perf-baseline.json — so
# adding a hook forces a deliberate latency-review (bump the baseline in the same
# change). Hermetic + deterministic.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Hook Spawn Count (WI-397) ==="
[ -f .svc/perf-baseline.json ] || { echo "  FAIL: .svc/perf-baseline.json missing"; exit 1; }
[ -f hooks/hooks.json ] || { echo "  FAIL: hooks/hooks.json missing"; exit 1; }

node -e '
const fs=require("fs");
const base=JSON.parse(fs.readFileSync(".svc/perf-baseline.json","utf8")).hook_spawn;
const hooks=JSON.parse(fs.readFileSync("hooks/hooks.json","utf8")).hooks;
let rc=0;
const count=(v)=>Array.isArray(v)?v.reduce((a,x)=>a+(Array.isArray(x.hooks)?x.hooks.length:1),0):0;
for (const [ev,arr] of Object.entries(hooks)) {
  const n=count(arr);
  const max=base.max_per_event[ev];
  if (max===undefined) { console.log(`  ✗ ${ev}: ${n} hooks wired but no budget in baseline (add it, deliberately)`); rc=1; }
  else if (n>max) { console.log(`  ✗ ${ev}: ${n} hooks exceed budget ${max} (latency re-bloat — consolidate or bump baseline)`); rc=1; }
  else { console.log(`  ✓ ${ev}: ${n} <= ${max}`); }
}
process.exit(rc);
' && pass "hook spawn counts within budget" || fail "hook spawn count regression"

echo "hook spawn count: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
