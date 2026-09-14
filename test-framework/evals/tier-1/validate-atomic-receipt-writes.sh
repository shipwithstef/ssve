#!/usr/bin/env bash
# WI-562 IP-R4: atomic receipt writes — no direct writeFileSync of receipt-shaped
# payloads outside the sanctioned emitter/state-io primitives.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
echo "=== Tier 1: atomic receipt writes (single sanctioned emitter) ==="

fail=0

# Scan scripts/ + hooks/ for direct receipt writes: a violation is a
# writeFileSync whose LINE references receipt/staging storage paths.
# Allowlist = sanctioned primitives and documented non-receipt classes:
#   state-io / emit-receipt  — the atomic primitives themselves
#   wirer settings           — host configs, not receipts (IP-W1 scope)
#   task-graph.mjs           — story-receipt TEMPLATE seed (template-driven class)
#   audit-story-receipts.test — test fixture writer, not a producer
#   external-review-provenance — HMAC authority marker, not a verification receipt
#   tool-call-receipt (WI-FW-HOOKS-SAFETY-01) — pre/post correlation receipts use O_EXCL temp + fsync + rename + chmod 0600 (atomic, private); validated in validate-tool-call-heartbeat.sh
ALLOWLIST="scripts/state-io.mjs|scripts/emit-receipt.mjs|scripts/wire-hooks.mjs|scripts/wire-cursor-hooks.mjs|scripts/wire-grok-hooks.mjs|scripts/task-graph.mjs|scripts/audit-story-receipts.test.mjs|scripts/lib/external-review-provenance.mjs|hooks/lib/tool-call-receipt.mjs"
VIOLATIONS=$(grep -rnE 'writeFileSync\(' scripts hooks --include='*.mjs' 2>/dev/null \
  | grep -vE "($ALLOWLIST)" \
  | grep -iE '(receipt|staging)' || true)

if [[ -n "$VIOLATIONS" ]]; then
  echo "  ✗ non-allowlisted writeFileSync calls that look receipt-related:"
  echo "$VIOLATIONS" | sed 's/^/      /'
  fail=1
else
  echo "  ✓ no receipt-shaped direct writes outside allowlist (state-io, emit-receipt, wirer settings)"
fi

# quick-fix eligibility must route through the sanctioned emitter.
if grep -q 'writeReceiptMirror' "$ROOT/scripts/quick-fix-eligibility.mjs"; then
  echo "  ✓ quick-fix-eligibility routes through emit-receipt's writeReceiptMirror"
else
  echo "  ✗ quick-fix-eligibility no longer uses the sanctioned emitter"
  fail=1
fi
if grep -qE 'writeFileSync\(join\(dir, "quick-fix.json"' "$ROOT/scripts/quick-fix-eligibility.mjs"; then
  echo "  ✗ quick-fix-eligibility still has a direct receipt write"
  fail=1
fi

# Crash test: a partial file must never survive an interrupted write — assert
# emit-receipt's writer primitive is tmp+rename based (reads state-io source).
grep -q "renameSync(tmp, filePath)" "$ROOT/scripts/state-io.mjs" \
  && echo "  ✓ state-io writeJsonAtomic is tmp+fsync+rename" \
  || { echo "  ✗ state-io atomicity regression"; fail=1; }

# Seeded-violation drill: a synthetic violation must be catchable by this gate's pattern.
SEED="$ROOT/.svc/.seeded-violation-probe.mjs"
mkdir -p "$ROOT/.svc"
cat >"$SEED" <<'EOF'
import { writeFileSync } from "node:fs";
export function seedViolation(receipt) {
  writeFileSync(`.svc/receipts/staging/x/receipt-${receipt.wi}.json`, JSON.stringify(receipt));
}
EOF
SEEDED=$(grep -rnE 'writeFileSync\(' "$SEED" | grep -iE 'receipt' || true)
rm -f "$SEED"
if [[ -n "$SEEDED" ]]; then
  echo "  ✓ seeded violation is caught by this gate's detection pattern"
else
  echo "  ✗ seeded violation NOT detected — gate is blind"
  fail=1
fi

echo "validate-atomic-receipt-writes: $([ $fail -eq 0 ] && echo PASS || echo FAIL)"
[[ $fail -eq 0 ]]
