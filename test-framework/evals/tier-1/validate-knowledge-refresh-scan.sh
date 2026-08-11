#!/usr/bin/env bash
# Tier-1: the staleness→refresh closure (WI-432). `expertise.mjs refresh-scan` scans every registered SME
# bank and emits ONE idempotent, propose-only refresh trigger per STALE bank (never auto-refreshes).
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1
EX="scripts/expertise.mjs"; DOM="references/knowledge/domains/startup-saas-finance"
pass=0; fail=0
ok(){ pass=$((pass+1)); echo "  ✓ $1"; }
no(){ fail=$((fail+1)); echo "  ✗ $1"; }

# 1. scan emits a trigger for the known-stale bank (startup-saas-finance, .version 2026-03-01)
T="$(mktemp)"
node "$EX" refresh-scan --out "$T" >/dev/null 2>&1
grep -q '"domain":"startup-saas-finance"' "$T" 2>/dev/null && ok "refresh-scan emits a trigger for the STALE bank" || no "no trigger for the stale bank"

# 2. the trigger is well-formed (propose-only: resolved:false + an action)
node -e "const t=JSON.parse(require('fs').readFileSync('$T','utf8').trim().split('\n')[0]); process.exit((t.resolved===false && t.action && t.agent && t.knowledge)?0:1)" && ok "trigger is well-formed (resolved:false + action + agent + knowledge)" || no "malformed trigger"

# 3. idempotent — re-scan emits no new trigger for an already-open domain
before="$(wc -l < "$T")"
node "$EX" refresh-scan --out "$T" >/dev/null 2>&1
[ "$(wc -l < "$T")" = "$before" ] && ok "re-scan is idempotent (no duplicate trigger for an open domain)" || no "re-scan duplicated the trigger"

# 4. NEGATIVE — a FRESH bank yields NO trigger (temporarily make the bank fresh, scan a clean out, restore)
B="$(mktemp)"; cp "$DOM/.version" "$B"; trap 'cp "$B" "$DOM/.version"' EXIT   # restore even on interrupt/timeout
printf '%s (test)\n' "$(date -u +%Y-%m-%d)" > "$DOM/.version"
T2="$(mktemp)"; node "$EX" refresh-scan --out "$T2" >/dev/null 2>&1; rc=$?
if [ "$rc" != "0" ]; then no "refresh-scan crashed (exit $rc) on the FRESH control"
elif grep -q '"domain":"startup-saas-finance"' "$T2" 2>/dev/null; then no "FRESH bank still triggered a refresh"
else ok "FRESH bank yields no refresh trigger (negative control)"; fi
cp "$B" "$DOM/.version"; trap - EXIT

echo ""
echo "knowledge-refresh-scan: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
