#!/usr/bin/env bash
# WI-562 IP-R2: fail-closed schema drill — renaming a receipt schema away must
# disable the EMITTER loudly (nonzero + "schema unavailable"), never pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

VICTIM="$ROOT/schemas/receipts/verify-promotion.schema.json"
test -f "$VICTIM" || { echo "  ✗ victim schema missing"; exit 1; }

echo "=== Tier 1: rename-a-schema drill (fail-closed) ==="

mv "$VICTIM" "$TMP/schema.bak"

BODY="$TMP/body.json"
cat >"$BODY" <<'EOF'
{"receipt_type":"verify-promotion","schema_version":1,"wi":"WI-562","verdict":"approved"}
EOF

set +e
OUT=$(printf '%s' "$(cat "$BODY")" | node "$ROOT/scripts/emit-receipt.mjs" --type verify-promotion --wi WI-562 --no-note 2>&1)
RC=$?
set -e

if [[ $RC -eq 0 ]]; then
  echo "  ✗ emitter accepted receipt while its schema was missing (soft-fail hole)"
  mv "$TMP/schema.bak" "$VICTIM"
  exit 1
fi
if ! grep -qi "schema unavailable" <<<"$OUT"; then
  echo "  ✗ emitter failed but without 'schema unavailable' reason"
  echo "$OUT" | head -5
  mv "$TMP/schema.bak" "$VICTIM"
  exit 1
fi
echo "  ✓ missing schema ⇒ emitter refuses citing 'schema unavailable'"

mv "$TMP/schema.bak" "$VICTIM"
test -f "$VICTIM"
echo "  ✓ schema restored after drill"

echo "validate-rename-schema-drill: PASS"
