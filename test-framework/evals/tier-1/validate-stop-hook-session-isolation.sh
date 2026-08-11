#!/usr/bin/env bash
#
# Tier-1 regression test: WI-scoped stop hook session isolation.
# Tests accumulator isolation by WI, role-aware guard skip, and
# worktree .svc/ init.
#
set -euo pipefail

echo "=== Tier 1: Stop hook WI-scoped session isolation ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC_DIR="${ROOT}/.svc"
mkdir -p "$SVC_DIR"

# Clean up any leftover test accumulators
rm -f "$SVC_DIR"/svc-edited-files-WI-TEST-*.json

# 1. Test WI-scoped accumulator isolation
echo "--- Test 1: WI-scoped accumulator isolation ---"
echo '{"tool_name":"Edit","tool_input":{"file_path":"scripts/state-io.mjs"}}' | \
  env -u CODEX_THREAD_ID -u SVC_SESSION_ID -u CLAUDE_SESSION_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID \
  SVC_WORKER_WI=WI-TEST-A node "$ROOT/hooks/svc-stop-quality.js" --accumulate
echo '{"tool_name":"Edit","tool_input":{"file_path":"hooks/svc-stop-quality.js"}}' | \
  env -u CODEX_THREAD_ID -u SVC_SESSION_ID -u CLAUDE_SESSION_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID \
  SVC_WORKER_WI=WI-TEST-B node "$ROOT/hooks/svc-stop-quality.js" --accumulate

if [ ! -f "$SVC_DIR/svc-edited-files-WI-TEST-A.json" ]; then
  echo "FAIL: WI-TEST-A accumulator not created" >&2; exit 1
fi
if [ ! -f "$SVC_DIR/svc-edited-files-WI-TEST-B.json" ]; then
  echo "FAIL: WI-TEST-B accumulator not created" >&2; exit 1
fi

A_CONTENT=$(cat "$SVC_DIR/svc-edited-files-WI-TEST-A.json")
B_CONTENT=$(cat "$SVC_DIR/svc-edited-files-WI-TEST-B.json")

if [[ ! "$A_CONTENT" =~ "state-io.mjs" ]] || [[ "$A_CONTENT" =~ "svc-stop-quality.js" ]]; then
  echo "FAIL: WI-TEST-A accumulator crosstalk: $A_CONTENT" >&2; exit 1
fi
if [[ ! "$B_CONTENT" =~ "svc-stop-quality.js" ]] || [[ "$B_CONTENT" =~ "state-io.mjs" ]]; then
  echo "FAIL: WI-TEST-B accumulator crosstalk: $B_CONTENT" >&2; exit 1
fi
echo "  WI-scoped accumulator isolation: PASS"

# 2. Test that resolve-wi.mjs exports work
echo "--- Test 2: resolve-wi.mjs module loads ---"
node -e "
  import('$ROOT/hooks/lib/resolve-wi.mjs').then(m => {
    if (typeof m.resolveWI !== 'function') { console.error('FAIL: resolveWI not a function'); process.exit(1); }
    if (typeof m.findSvcDir !== 'function') { console.error('FAIL: findSvcDir not a function'); process.exit(1); }
    if (typeof m.isNonExecutionRole !== 'function') { console.error('FAIL: isNonExecutionRole not a function'); process.exit(1); }
    console.log('  resolve-wi.mjs module: PASS');
  }).catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
"

# 3. Test SVC_WORKER_WI takes priority in resolution
echo "--- Test 3: SVC_WORKER_WI priority ---"
env -u CODEX_THREAD_ID -u SVC_SESSION_ID -u CLAUDE_SESSION_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID \
SVC_WORKER_WI=WI-PRIORITY node -e "
  import('$ROOT/hooks/lib/resolve-wi.mjs').then(m => {
    const { wi, source } = m.resolveWI({});
    if (wi !== 'WI-PRIORITY') { console.error('FAIL: expected WI-PRIORITY, got ' + wi); process.exit(1); }
    if (source !== 'SVC_WORKER_WI') { console.error('FAIL: expected source SVC_WORKER_WI, got ' + source); process.exit(1); }
    console.log('  SVC_WORKER_WI priority: PASS');
  });
"

# 4. Test role-aware skip
echo "--- Test 4: Non-execution role detection ---"
node -e "
  import('$ROOT/hooks/lib/resolve-wi.mjs').then(m => {
    if (!m.isNonExecutionRole({ session_role: 'reviewer' })) { console.error('FAIL: reviewer should be non-execution'); process.exit(1); }
    if (!m.isNonExecutionRole({ role: 'adversarial' })) { console.error('FAIL: adversarial should be non-execution'); process.exit(1); }
    if (m.isNonExecutionRole({ role: 'executor' })) { console.error('FAIL: executor should NOT be non-execution'); process.exit(1); }
    if (m.isNonExecutionRole({})) { console.error('FAIL: empty role should NOT be non-execution'); process.exit(1); }
    console.log('  Role-aware detection: PASS');
  });
"

# 5. Test claim lifecycle
echo "--- Test 5: WI Claim lifecycle ---"
node -e "
  import('$ROOT/hooks/lib/wi-claim.mjs').then(m => {
    // 1. Claim a WI
    const r1 = m.claimWI('WI-TEST-C', { host: 'test-harness', session_token: 'sess-token-c' });
    if (!r1.ok) { console.error('FAIL: claimWI failed: ' + r1.warning); process.exit(1); }
    
    // 2. Try to double-claim
    const r2 = m.claimWI('WI-TEST-C', { host: 'other-harness', session_token: 'sess-token-d' });
    if (r2.ok) { console.error('FAIL: double-claim should have been blocked'); process.exit(1); }
    if (!r2.warning.includes('already claimed')) { console.error('FAIL: warning should mention already claimed, got: ' + r2.warning); process.exit(1); }
    
    // 3. Release claim
    m.releaseClaim('WI-TEST-C');
    
    // 4. Check if we can claim it again after release
    const r3 = m.claimWI('WI-TEST-C', { host: 'test-harness', session_token: 'sess-token-c' });
    if (!r3.ok) { console.error('FAIL: re-claim after release failed: ' + r3.warning); process.exit(1); }
    
    m.releaseClaim('WI-TEST-C');
    console.log('  WI Claim lifecycle: PASS');
  }).catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
"

# Clean up test accumulators
rm -f "$SVC_DIR"/svc-edited-files-WI-TEST-*.json

echo "Stop hook WI-scoped session isolation: passed"
exit 0
