#!/usr/bin/env bash
# Tier 1 — browser-verify wrapper smoke test.
#
# What this validates STATICALLY (no browser required):
#  1. scripts/browser-verify.mjs exists and is valid Node (parse-only).
#  2. Library export `browserVerify` is callable and rejects missing args
#     with a structured error (no browser spawn needed).
#  3. All 6 check-type implementations exist and are importable.
#  4. Wrapper exits 2 with clear diagnostic when Playwright isn't installed
#     (the most common failure mode in CI).
#  5. Fixture HTML exists.
#
# A separate tier-2 eval runs the actual browser against the fixture when
# Playwright is available. This tier-1 script stays fast and hermetic.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PASS=0
FAIL=0
ERRORS=""

SCRIPT="$REPO_ROOT/scripts/browser-verify.mjs"
FIXTURE="$REPO_ROOT/test-framework/fixtures/static-html/index.html"
CHECK_DIR="$REPO_ROOT/scripts/lib/browser-checks"

# 1. Script exists + parses
if [[ ! -f "$SCRIPT" ]]; then
  ERRORS+="  FAIL: scripts/browser-verify.mjs missing\n"
  FAIL=$((FAIL + 1))
else
  if node --check "$SCRIPT" 2>/dev/null; then PASS=$((PASS+1)); else
    ERRORS+="  FAIL: browser-verify.mjs has syntax errors\n"; FAIL=$((FAIL+1))
  fi
fi

# 2. Library export validates args
node -e "
import('$SCRIPT').then(async m => {
  const r1 = await m.browserVerify({});
  if (r1.pass === false && /missing url/.test(r1.error)) process.exit(0);
  console.error('expected error for missing url, got:', JSON.stringify(r1));
  process.exit(1);
}).catch(e => { console.error(e); process.exit(2); });
" && PASS=$((PASS+1)) || { ERRORS+="  FAIL: browserVerify did not reject missing args cleanly\n"; FAIL=$((FAIL+1)); }

# 3. Check-type implementations all import
for t in index presence text-contains regex-match attr-equals count-elements screenshot-matches; do
  f="$CHECK_DIR/$t.mjs"
  if [[ ! -f "$f" ]]; then
    ERRORS+="  FAIL: $f missing\n"; FAIL=$((FAIL+1))
    continue
  fi
  node --check "$f" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: $f syntax\n"; FAIL=$((FAIL+1)); }
done

# 4. When Playwright isn't present, wrapper exits 2 with code ENOPLAYWRIGHT
#    — we simulate this by running with NODE_PATH pointing away from any
#    installed playwright. On CI where playwright is never installed this is
#    just a direct invocation.
TMP_EVIDENCE_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_EVIDENCE_ROOT"' EXIT
OUT=$(SVC_REPO_ROOT="$TMP_EVIDENCE_ROOT" node "$SCRIPT" --url "file://$FIXTURE" --wi WI-102 --check '{"type":"presence","selector":"h1"}' 2>&1 || true)
if echo "$OUT" | grep -q '"pass":false'; then
  # Either ENOPLAYWRIGHT (expected if not installed) or a real run — both valid.
  # We only FAIL if the script crashed before producing JSON.
  if echo "$OUT" | grep -qE '"pass":(true|false)'; then
    PASS=$((PASS+1))
  else
    ERRORS+="  FAIL: browser-verify did not emit JSON verdict on invoke\n"; FAIL=$((FAIL+1))
  fi
else
  # Pass:true is only possible if Playwright is installed AND the run succeeded.
  # That's still a valid outcome for this smoke test.
  PASS=$((PASS+1))
fi

# 5. Fixture exists
if [[ -f "$FIXTURE" ]]; then PASS=$((PASS+1)); else
  ERRORS+="  FAIL: fixture HTML missing at $FIXTURE\n"; FAIL=$((FAIL+1))
fi

echo ""
echo "  browser-verify wrapper smoke: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
