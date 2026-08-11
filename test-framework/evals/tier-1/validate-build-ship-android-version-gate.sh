#!/usr/bin/env bash
# Tier 1: Android/Google Play release artifacts must prove versionCode freshness
# before being called upload-ready.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RULE="$REPO_ROOT/rules/build-and-ship-alignment.md"
CONCERN="$REPO_ROOT/concerns/build-ship-alignment.md"
MANIFEST="$REPO_ROOT/skills-manifest.json"
EXECUTE_SKILL="$REPO_ROOT/skills/execute-changeset/SKILL.md"
LAND_SKILL="$REPO_ROOT/skills/land-changeset/SKILL.md"
VERIFY_SKILL="$REPO_ROOT/skills/verify-promotion/SKILL.md"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

require_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: Android Play versionCode release gate ==="

test -f "$RULE" && pass "build-and-ship-alignment rule exists" || fail "build-and-ship-alignment rule exists"
test -f "$CONCERN" && pass "build-ship-alignment concern exists" || fail "build-ship-alignment concern exists"

require_contains "$RULE" "Never call a build artifact upload-ready from a successful local build alone." "rule rejects local-build-only upload-ready claims"
require_contains "$RULE" "Inspect \`android/app/build.gradle\` before building." "rule requires build.gradle inspection"
require_contains "$RULE" "greater than the latest code already uploaded to any" "rule requires Play versionCode floor"
require_contains "$RULE" "<App>-<versionName>-vc<versionCode>.aab" "rule requires versioned artifact filename"
require_contains "$RULE" "built manifest or bundle metadata contains the same" "rule requires embedded-version verification"
require_contains "$RULE" "A repo ledger is evidence, not authority." "rule treats ledger as non-authoritative"
require_contains "$RULE" "upload error says the \`versionCode\` has already been used" "rule handles stale ledger Play rejection"
require_contains "$RULE" "Local overwrite flags such as" "rule rejects local overwrite as version freshness proof"
require_contains "$RULE" "Gradle succeeded, so the AAB is upload-ready" "rule names forbidden Gradle-only claim"
require_contains "$RULE" "because the project ledger is behind Play" "rule forbids ledger-drift reuse"
require_contains "$RULE" "CFBundleVersion" "rule covers iOS build-number analogue"
require_contains "$RULE" "Development epoch codes are non-release codes." "rule separates development codes from releases"
require_contains "$RULE" "must never edit canonical version fields" "rule protects canonical version fields during development"
require_contains "$RULE" "The remote store is authority" "rule preserves remote store authority"
require_contains "$RULE" "allocation happen exactly once" "rule requires exactly-one canonical allocation"
require_contains "$RULE" "inspected artifact metadata" "rule requires release metadata inspection"

require_contains "$CONCERN" "Android / Google Play hard gate" "concern has Android Play hard gate section"
require_contains "$CONCERN" "\`versionCode\` is a store-global monotonic counter" "concern states monotonic versionCode"
require_contains "$CONCERN" "latest code already uploaded to any Play" "concern requires latest Play track check"
require_contains "$CONCERN" "built manifest or bundle metadata" "concern requires built artifact version proof"
require_contains "$CONCERN" "The ledger is evidence, not authority." "concern treats ledger as non-authoritative"
require_contains "$CONCERN" "overwriting one locally does not make its \`versionCode\`" "concern rejects local overwrite as Play proof"
require_contains "$CONCERN" "Google Play rejected it" "concern records real failure mode"
require_contains "$CONCERN" "Example Marketplace repeat failure" "concern records stale-ledger repeat failure"
require_contains "$CONCERN" "Mobile worktree development identity" "concern separates mobile worktree identity"
require_contains "$CONCERN" "development receipt is never promotion evidence" "concern rejects development promotion evidence"
require_contains "$CONCERN" "Allocate it exactly once" "concern requires one canonical release allocation"
require_contains "$CONCERN" "remote store remains authority" "concern preserves store authority"

require_contains "$EXECUTE_SKILL" "schemas/mobile-build-contract.json" "execute conditionally detects the consumer mobile contract"
require_contains "$EXECUTE_SKILL" "Never edit canonical version fields" "execute forbids canonical version mutation"
require_contains "$LAND_SKILL" "call \`allocate-release\` exactly once" "land allocates one canonical release code"
require_contains "$LAND_SKILL" "failed reservation remains consumed" "land prevents failed-code reuse"
require_contains "$VERIFY_SKILL" "Reject a development receipt" "verify rejects development receipts"
require_contains "$VERIFY_SKILL" "above both the recorded remote floor and ledger floor" "verify proves the canonical code clears floors"

python3 - "$MANIFEST" <<'PY' >/tmp/svc-build-ship-rule-path.txt
import json, sys
m = json.load(open(sys.argv[1]))
paths = [e.get("path") for e in m.get("rulesRegistry", {}).get("entries", [])]
print("present" if "rules/build-and-ship-alignment.md" in paths else "missing")
PY
if grep -Fxq present /tmp/svc-build-ship-rule-path.txt; then
  pass "rules registry includes build-and-ship-alignment rule"
else
  fail "rules registry includes build-and-ship-alignment rule"
fi

echo
echo "android play version gate: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
