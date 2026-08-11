#!/usr/bin/env bash
# WI-497 tier-1: the canonical WI-id validator is ONE source, both bindings agree,
# the accepted LANGUAGE (corpus, not the pattern) is the contract, and no
# Category-A governance file still hardcodes a numeric-only WI literal.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: WI-497 canonical WI-id validator ==="

# --- (a) LANGUAGE corpus, both bindings must give identical verdicts ---
ACCEPT=(WI-9 WI-494 WI-013 WI-SOCIAL-01 WI-LOC-UX-01 WI-013-DAYONE WI-AI-GOLIVE-01 WI-SPINE-001 WI-UXV20 WI-RECEIPT-2GATE-01)
REJECT=("wi-low" "WI-" "WI-A-" "-WI-1" "WI--X" "WI-../etc" "WI-A;rm" "WI- x" "WI-a1" "WIX-1" "W1-1" "")
# shellcheck source=/dev/null
source "$ROOT/hooks/lib/wi-id.sh"
js_valid(){ node --input-type=module -e 'import {isValidWiId} from "'"$ROOT"'/hooks/lib/wi-id.mjs"; process.exit(isValidWiId(process.argv[1]||"")?0:1)' "$1"; }
for w in "${ACCEPT[@]}"; do
  js_valid "$w" && j=1 || j=0
  svc_is_valid_wi_id "$w" && s=1 || s=0
  { [ "$j" = 1 ] && [ "$s" = 1 ]; } && ok "accept: $w (mjs+sh agree)" || bad "accept FAILED or bindings disagree: $w (mjs=$j sh=$s)"
done
for w in "${REJECT[@]}"; do
  js_valid "$w" && j=1 || j=0
  svc_is_valid_wi_id "$w" && s=1 || s=0
  { [ "$j" = 0 ] && [ "$s" = 0 ]; } && ok "reject: '${w}' (mjs+sh agree)" || bad "reject FAILED or bindings disagree: '${w}' (mjs=$j sh=$s)"
done

# --- (b) canonical-identity guard: the pattern body is byte-identical in both files ---
MJS_PAT="$(grep -oE "WI_ID_RE = /\^.*\\\$/" "$ROOT/hooks/lib/wi-id.mjs" | sed -E 's#WI_ID_RE = /\^##; s#\$/$##')"
SH_PAT="$(grep -oE "SVC_WI_ID_RE='\^.*\\\$'" "$ROOT/hooks/lib/wi-id.sh" | sed -E "s#SVC_WI_ID_RE='\^##; s#\\\$'\$##")"
[ -n "$MJS_PAT" ] && [ "$MJS_PAT" = "$SH_PAT" ] && ok "canonical-identity: mjs pattern == sh pattern ($MJS_PAT)" || bad "canonical-identity: mjs='$MJS_PAT' != sh='$SH_PAT'"

# --- (c) no-hardcode guard: no Category-A file holds a residual numeric-only WI literal ---
CAT_A="hooks/codex/svc-codex-stop-firewall.mjs hooks/lib/resolve-wi.mjs hooks/lib/wi-claim.mjs \
hooks/codex/svc-codex-skill-load-enforcer.mjs hooks/svc-worktree-isolation-guard.mjs scripts/task-graph.mjs \
scripts/svc-ensure-worktree.mjs hooks/svc-impact-triad-guard.mjs scripts/run-external-review.mjs \
scripts/log-decision.mjs scripts/validate-capability-blocker-ledger.mjs scripts/validate-blocking-discovery.mjs \
hooks/codex/lib/codex-hook-context.mjs scripts/svc-migrate-install.mjs scripts/svc-migrate-task-state.mjs \
scripts/cross-project-state.mjs scripts/eval-gate.mjs"
RESIDUE=0
for f in $CAT_A; do
  if grep -nE '/\^WI-\\d\+\$/|/\^WI-\[0-9\]\+\$/|\\bWI-\\d|WI-\\d\+' "$ROOT/$f" 2>/dev/null | grep -v "canonical:" >/dev/null; then
    bad "no-hardcode: residual numeric-only WI literal in $f"; RESIDUE=1
  fi
done
[ "$RESIDUE" = 0 ] && ok "no-hardcode: no Category-A file holds a numeric-only WI literal"

# --- (d) inlined-copy identity: standalone CLIs that inline the pattern (run from
#     reduced source, cannot import) must use the named grammar + cite canonical (F006) ---
for f in scripts/task-graph.mjs scripts/svc-migrate-install.mjs; do
  if grep -Eq 'WI-\[A-Z0-9\]\+' "$ROOT/$f" && grep -q "canonical: hooks/lib/wi-id.mjs" "$ROOT/$f"; then
    ok "inlined-copy uses named grammar + cites canonical: $f"
  else bad "inlined-copy not canonical-conformant: $f"; fi
done

echo "wi-id validator: $PASS passed, $FAIL failed"
test "$FAIL" -eq 0
