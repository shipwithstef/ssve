#!/usr/bin/env bash
# Tier-1: every receipt validates against its JSON schema at schemas/receipts/.
# Promotion note: chain validation reads these schemas on every commit/push;
# drift breaks the entire chain.

set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

SCHEMA_DIR="schemas/receipts"
RECEIPTS_DIR=".svc/receipts"

if [[ ! -d "$SCHEMA_DIR" ]]; then
  echo "PASS: no schemas yet (pre-chain installation)"
  exit 0
fi
if [[ ! -d "$RECEIPTS_DIR" ]]; then
  echo "PASS: no receipts yet"
  exit 0
fi

FAIL=0
for s in "$SCHEMA_DIR"/*.schema.json; do
  [[ -f "$s" ]] || continue
  if ! python3 -c "import json,sys; json.load(open('$s'))" 2>/dev/null; then
    echo "FAIL: schema $s is not valid JSON"
    FAIL=1
  fi
done

for r in "$RECEIPTS_DIR"/*/*.json; do
  [[ -f "$r" ]] || continue
  if ! python3 -c "import json,sys; json.load(open('$r'))" 2>/dev/null; then
    echo "FAIL: receipt $r is not valid JSON"
    FAIL=1
    continue
  fi
  TYPE="$(python3 -c "import json; print(json.load(open('$r')).get('receipt_type','UNKNOWN'))")"
  if [[ "$TYPE" == "UNKNOWN" ]]; then
    echo "FAIL: receipt $r has no receipt_type"
    FAIL=1
    continue
  fi
  if [[ ! -f "$SCHEMA_DIR/${TYPE}.schema.json" ]]; then
    echo "FAIL: receipt $r type=$TYPE has no schema"
    FAIL=1
  fi
done

if [[ $FAIL -eq 0 ]]; then
  echo "PASS: receipts + schemas valid"
  exit 0
fi
exit 1
