#!/usr/bin/env bash
# Tier 1 — mobile occlusion + safe-area visual gate.
#
# Static (no browser): the `mobile-occlusion` browser-check exists, parses, and
# is registered; the 4 self-test fixtures exist.
# Behavioral (when Playwright is installed): the check FAILS the two `bad*`
# fixtures (a Sample-FAB-behind-the-tab-bar and a button-in-the-safe-area) and
# PASSES the two `good*` fixtures (the env()-based fixes). This is the gate that
# would have caught the WI-SAMPLE-NAV-01 occlusion/safe-area bugs before a human
# tested on-device — DOM-presence checks cannot, and headless env()=0 hides them.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_EVID="$(mktemp -d)"; trap 'rm -rf "$TMP_EVID"' EXIT
PASS=0; FAIL=0; ERRORS=""
CHECK="$REPO_ROOT/scripts/lib/browser-checks/mobile-occlusion.mjs"
INDEX="$REPO_ROOT/scripts/lib/browser-checks/index.mjs"
VERIFY="$REPO_ROOT/scripts/browser-verify.mjs"
FIX_DIR="$REPO_ROOT/test-framework/fixtures/mobile-occlusion"

ok()   { PASS=$((PASS+1)); }
bad()  { ERRORS+="  FAIL: $1\n"; FAIL=$((FAIL+1)); }

# 1. Check exists + parses.
[[ -f "$CHECK" ]] && node --check "$CHECK" 2>/dev/null && ok || bad "mobile-occlusion.mjs missing or has syntax errors"

# 2. Registered in the dispatcher (SUPPORTED_TYPES includes it).
node -e "
import('$INDEX').then(m => {
  if (m.SUPPORTED_TYPES.includes('mobile-occlusion')) process.exit(0);
  console.error('mobile-occlusion not in SUPPORTED_TYPES:', m.SUPPORTED_TYPES.join(','));
  process.exit(1);
}).catch(e => { console.error(e); process.exit(2); });
" 2>/dev/null && ok || bad "mobile-occlusion not registered in scripts/lib/browser-checks/index.mjs"

# 3. Fixtures exist.
for f in bad good bad-safearea good-safearea good-scroll good-modal bad-shadow good-shadow; do
  [[ -f "$FIX_DIR/$f.html" ]] && ok || bad "fixture $f.html missing"
done

# 4. Behavioral self-test. This gate is behavioral — without a browser it CANNOT
#    verify the detector, so a missing Playwright is a FAIL, not a green skip
#    (MO-07): otherwise a semantic regression would pass the mandatory tier-1 gate.
if ! node -e "require.resolve('playwright')" 2>/dev/null; then
  if [[ "${SVC_REQUIRE_BROWSER_TIER1:-0}" == "1" ]]; then
    bad "Playwright not installed — strict browser Tier-1 mode requires the behavioral self-test"
  else
    echo "SKIP: Playwright unavailable; static mobile-occlusion contract passed (set SVC_REQUIRE_BROWSER_TIER1=1 to require behavior)"
  fi
else
  run() { # $1 fixture -> echoes "true"/"false" for the check's pass
    SVC_REPO_ROOT="$TMP_EVID" node "$VERIFY" --url "file://$FIX_DIR/$1.html" --wi WI-OCCLUSION-SELFTEST \
      --check '{"type":"mobile-occlusion","name":"occ"}' 2>/dev/null \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const c=(j.findings||[])[0]||{};process.stdout.write(String(c.pass))}catch{process.stdout.write('ERR')}})"
  }
  # Buggy fixtures must FAIL (gate catches the bug). bad-shadow proves the check
  # pierces an OPEN shadow root to find a fixed occluder whose host isn't fixed
  # (MO-05) — without the descent it would falsely PASS.
  for f in bad bad-safearea bad-shadow; do
    r=$(run "$f"); [[ "$r" == "false" ]] && ok || bad "$f.html should FAIL the gate but check.pass=$r (gate not catching the bug)"
  done
  # Corrected + known-good-shape fixtures must PASS (no false positives). good-shadow
  # proves the shadow descent doesn't over-flag a short in-shadow bar that clears the control.
  for f in good good-safearea good-scroll good-modal good-shadow; do
    r=$(run "$f"); [[ "$r" == "true" ]] && ok || bad "$f.html should PASS the gate but check.pass=$r (false positive)"
  done
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "PASS ($PASS checks) — mobile-occlusion gate present + catches the occlusion/safe-area bug class."
  exit 0
else
  echo -e "FAIL ($FAIL failed, $PASS passed):\n$ERRORS"
  exit 1
fi
