#!/usr/bin/env bash
# Tier-1: receipt emission correctly pins to --sha under checkout HEAD shifts.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# Create an unreferenced child commit without moving HEAD. This proves explicit
# SHA pinning even in a repository whose canonical history intentionally has one
# root commit.
TARGET_COMMIT="$(printf '%s\n' 'receipt pinning fixture' | env \
  GIT_AUTHOR_NAME='SVC Fixture' GIT_AUTHOR_EMAIL='fixture@example.invalid' \
  GIT_COMMITTER_NAME='SVC Fixture' GIT_COMMITTER_EMAIL='fixture@example.invalid' \
  git commit-tree "$(git rev-parse 'HEAD^{tree}')" -p HEAD)"

INJECTION_PROBE="$(mktemp -u /tmp/svc-emit-receipt-injection.XXXXXX)"
if printf '%s\n' '{"receipt_type":"quick-fix","schema_version":1,"tree_hash":"x","eligible":true,"reasons":["fixture"],"files":[]}' | \
  node scripts/emit-receipt.mjs --type quick-fix --wi WI-349 --sha "HEAD;touch $INJECTION_PROBE" --no-note >/dev/null 2>&1; then
  echo "FAIL: malicious --sha unexpectedly accepted" >&2; exit 1
fi
test ! -e "$INJECTION_PROBE"

SHORT_TARGET="${TARGET_COMMIT:0:7}"
MIRROR_FILE=".svc/receipts/${SHORT_TARGET}/quick-fix.json"

# Clean up any existing receipt for the target commit
rm -f "$MIRROR_FILE"

# Run emit-receipt.mjs with explicit --sha
echo '{
  "receipt_type": "quick-fix",
  "schema_version": 1,
  "tree_hash": "abcdef0123456789",
  "eligible": true,
  "reasons": ["testing sha pinning"],
  "files": ["test.js"],
  "timestamp": "2026-05-29T08:03:19Z"
}' | node scripts/emit-receipt.mjs --type quick-fix --wi WI-349 --sha "$TARGET_COMMIT" --no-note > /dev/null

# Assert that the receipt was written to the specified SHA's directory
if [[ ! -f "$MIRROR_FILE" ]]; then
  echo "FAIL: Receipt was not written to target --sha directory: $MIRROR_FILE"
  exit 1
fi

# Clean up
rm -f "$MIRROR_FILE"

echo "PASS: Receipt correctly pinned to --sha target commit"
exit 0
