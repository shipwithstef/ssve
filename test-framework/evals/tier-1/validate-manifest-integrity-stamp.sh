#!/usr/bin/env bash
# validate-manifest-integrity-stamp.sh — E2 manifest digest sidecar contract.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
# Stamp and corruption probes must not race other validators on real source.
STAMP_FIXTURE="$(mktemp -d)"
trap 'rm -rf -- "$STAMP_FIXTURE"' EXIT
for directory in scripts skills rules provision references concerns agents; do
  cp -a "$ROOT/$directory" "$STAMP_FIXTURE/$directory"
done
cp "$ROOT/"*.md "$ROOT/skills-manifest.json" "$STAMP_FIXTURE/"
mkdir -p "$STAMP_FIXTURE/.svc"
cd "$STAMP_FIXTURE"
PASS=0; FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: manifest integrity stamp ==="

node scripts/lint-skills-manifest.mjs --stamp >/dev/null \
  && pass "stamp writes sidecar" \
  || fail "stamp failed"

node scripts/lint-skills-manifest.mjs >/dev/null 2>&1 \
  && pass "verify passes on stamped manifest" \
  || fail "verify failed on stamped manifest"

MANIFEST_BAK="$(mktemp)"
DIGEST_BAK="$(mktemp)"
cp skills-manifest.json "$MANIFEST_BAK"
cp .svc/manifest-digest.json "$DIGEST_BAK"
printf ' ' >> skills-manifest.json
if node scripts/lint-skills-manifest.mjs >/dev/null 2>&1; then
  fail "byte-flipped manifest should fail digest verify"
else
  pass "byte-flipped manifest fails digest verify"
fi
cp "$MANIFEST_BAK" skills-manifest.json
cp "$DIGEST_BAK" .svc/manifest-digest.json

rm -f .svc/manifest-digest.json
if node scripts/lint-skills-manifest.mjs >/dev/null 2>&1; then
  fail "missing digest with schema_version should fail"
else
  pass "missing digest with schema_version fails closed"
fi
cp "$DIGEST_BAK" .svc/manifest-digest.json

node scripts/lint-skills-manifest.mjs >/dev/null 2>&1 \
  && pass "digest restored and verifies" \
  || fail "digest restore verify failed"

rm -f "$MANIFEST_BAK" "$DIGEST_BAK"

echo ""
echo "validate-manifest-integrity-stamp: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
