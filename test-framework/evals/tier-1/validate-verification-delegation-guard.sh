#!/usr/bin/env bash
# Tier 1: Stop hook hard-blocks verification delegation and V0 bundle-grep
# closeouts while allowing closeouts with runtime evidence.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-verification-delegation-guard.sh"
SCRIPT="$REPO_ROOT/scripts/verification-stop-guard.mjs"
HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"
WIRE="$REPO_ROOT/scripts/wire-hooks.mjs"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

# WI-399 A9: the hard gate is artifact-grounded — it blocks only when a
# browser-visible WI is active AND no recent runtime-evidence artifact exists.
# The fixture sandbox provides exactly that precondition so the prose-engine
# block path stays testable; repo-root runs would downgrade to advisory.
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/.svc"
cat > "$SANDBOX/.svc/lane-tasks-WI-vis.json" <<'JSON'
{"wi":"WI-vis","lane":"brownfield-feature","delivery_graph":{"lane":"brownfield-feature","risk_flags":["browser-visible"]},"tasks":[{"id":"t1","skill":"execute-changeset","status":"in_progress"}]}
JSON

run_hook() {
  local text="$1"
  local out="$2"
  local payload
  payload="$(node -e 'console.log(JSON.stringify({last_assistant_message: process.argv[1]}))' "$text")"
  (cd "$SANDBOX" && printf '%s' "$payload" | SVC_REPO_ROOT="$REPO_ROOT" bash "$HOOK" >"$out" 2>&1)
}

echo "=== Tier 1: Verification Delegation Stop Guard ==="

if bash -n "$HOOK" && node --check "$SCRIPT" >/dev/null; then
  pass "hook wrapper and Node guard parse"
else
  fail "hook wrapper or Node guard syntax invalid"
fi

delegation_text="Marked WI-197 as VERIFIED. Please open the page after deploy and manually verify the toast appears. Let me know if it works on your machine."
if run_hook "$delegation_text" /tmp/svc-delegation-guard-delegation.out; then
  if grep -q '"decision":"block"' /tmp/svc-delegation-guard-delegation.out && grep -q 'WI-197' /tmp/svc-delegation-guard-delegation.out; then
    pass "delegated verification closeout blocks"
  else
    fail "delegated verification closeout did not emit expected block JSON"
  fi
else
  fail "delegated verification hook invocation failed"
fi

bundle_text="WI-199 closeout. Verified the new copy ships: the Submit label appears in dist/main-abc123.js. Grepped the production bundle and confirmed the new error class is present."
if run_hook "$bundle_text" /tmp/svc-delegation-guard-bundle.out; then
  if grep -q '"decision":"block"' /tmp/svc-delegation-guard-bundle.out && grep -q 'WI-199' /tmp/svc-delegation-guard-bundle.out; then
    pass "V0 bundle-grep closeout blocks"
  else
    fail "V0 bundle-grep closeout did not emit expected block JSON"
  fi
else
  fail "bundle-grep hook invocation failed"
fi

evidence_text="WI-199 closeout. Evidence: e2e/test-results/wi-199/page.png — Playwright run id 28471 — V2. Playwright assertion getByRole button Submit toBeVisible passed."
if run_hook "$evidence_text" /tmp/svc-delegation-guard-good.out; then
  if [[ ! -s /tmp/svc-delegation-guard-good.out ]]; then
    pass "runtime-evidence closeout exits cleanly"
  else
    fail "runtime-evidence closeout should not block"
  fi
else
  fail "runtime-evidence hook invocation failed"
fi

if node -e '
const fs = require("fs");
const hooks = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const entry = hooks.hooks.Stop.find((h) => h.id === "svc-verification-delegation-guard");
if (!entry) process.exit(1);
if (!/HARD BLOCK/.test(entry.description)) process.exit(2);
if (!/svc-verification-delegation-guard\.sh/.test(entry.command)) process.exit(3);
' "$HOOKS_JSON"; then
  pass "hooks manifest wires hard-block Stop guard"
else
  fail "hooks manifest missing hard-block Stop guard"
fi

if grep -q 'svc-verification-delegation-guard.sh' "$WIRE" && grep -q 'svc-verification-delegation-guard' "$WIRE"; then
  pass "wire-hooks installs Stop guard"
else
  fail "wire-hooks does not install Stop guard"
fi

rm -f /tmp/svc-delegation-guard-delegation.out /tmp/svc-delegation-guard-bundle.out /tmp/svc-delegation-guard-good.out

echo ""
echo "verification delegation Stop guard: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
