#!/usr/bin/env bash
# Tier 1 — scroll-position gate (navigation scroll-restoration).
#
# Static: the `scroll-position` browser-check exists, parses, is registered;
# fixtures exist. Behavioral (Playwright required — a behavioral gate cannot
# self-verify without a browser): after scroll-to-bottom + in-app navigation, the
# check FAILS the fixture that keeps the stale offset and PASSES the one that
# resets to top. This is the class where a shared SPA scroll container makes a
# page (e.g. Profile) open scrolled to the bottom — invisible to DOM-presence
# and single-URL-load checks.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_EVID="$(mktemp -d)"; trap 'rm -rf "$TMP_EVID"' EXIT
PASS=0; FAIL=0; ERRORS=""
CHECK="$REPO_ROOT/scripts/lib/browser-checks/scroll-position.mjs"
INDEX="$REPO_ROOT/scripts/lib/browser-checks/index.mjs"
VERIFY="$REPO_ROOT/scripts/browser-verify.mjs"
FIX_DIR="$REPO_ROOT/test-framework/fixtures/scroll-position"
CHECK_JSON='{"type":"scroll-position","container":"#scroller","expect":"top","before":[{"action":"scroll","to":"bottom"},{"action":"click","selector":"#nav"}],"name":"scroll"}'

ok()  { PASS=$((PASS+1)); }
bad() { ERRORS+="  FAIL: $1\n"; FAIL=$((FAIL+1)); }

[[ -f "$CHECK" ]] && node --check "$CHECK" 2>/dev/null && ok || bad "scroll-position.mjs missing or syntax error"
node -e "import('$INDEX').then(m=>process.exit(m.SUPPORTED_TYPES.includes('scroll-position')?0:1)).catch(()=>process.exit(2))" 2>/dev/null && ok || bad "scroll-position not registered in index.mjs"
for f in bad good; do [[ -f "$FIX_DIR/$f.html" ]] && ok || bad "fixture $f.html missing"; done

if ! node -e "require.resolve('playwright')" 2>/dev/null; then
  if [[ "${SVC_REQUIRE_BROWSER_TIER1:-0}" == "1" ]]; then
    bad "Playwright not installed — strict browser Tier-1 mode requires the behavioral self-test"
  else
    echo "SKIP: Playwright unavailable; static scroll-position contract passed (set SVC_REQUIRE_BROWSER_TIER1=1 to require behavior)"
  fi
else
  run() {
    SVC_REPO_ROOT="$TMP_EVID" node "$VERIFY" --url "file://$FIX_DIR/$1.html" --wi WI-SCROLL-SELFTEST --check "$CHECK_JSON" 2>/dev/null \
      | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const c=(j.findings||[])[0]||{};process.stdout.write(String(c.pass))}catch{process.stdout.write('ERR')}})"
  }
  r=$(run bad);  [[ "$r" == "false" ]] && ok || bad "bad.html should FAIL (stale scroll) but pass=$r"
  r=$(run good); [[ "$r" == "true"  ]] && ok || bad "good.html should PASS (reset to top) but pass=$r"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "PASS ($PASS checks) — scroll-position gate present + catches stale navigation scroll."
  exit 0
else
  echo -e "FAIL ($FAIL failed, $PASS passed):\n$ERRORS"; exit 1
fi
