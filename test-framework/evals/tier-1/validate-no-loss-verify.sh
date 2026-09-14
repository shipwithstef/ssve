#!/usr/bin/env bash
# Tier-1 promotion note (rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-no-loss-verify.sh
#   failure_class: undisciplined no-loss verification loops (wrong-cwd + no-baseline-first,
#     ~11/17 wasted runs in the 2026-06-29 audit) + harness false-confidence (swallowed
#     non-validator failures; same-tree baseline hiding regressions).
#   promotion_signal: #1 (observed — the dominant measured sink, audit 2026-06-29) +
#     #3 (guards a hot path — the verification ritual runs on every framework change).
#   expected_runtime_budget: < 3s, hermetic (mktemp git fixture + node CLI; no network/LLM/creds).
#   why_tier_2_or_targeted_is_insufficient: the guard/harness must stay correct on every lint;
#     a silent regression here re-opens the false-confidence path the harness exists to close.
#
# Tier-1: WI-462/463 no-loss-verify preflight guard + harness.
# Proves the discipline guard BLOCKS the two audited traps (wrong cwd, no baseline-first)
# and PASSES when disciplined. Hermetic: builds a throwaway git-repo fixture, no network.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0
fail=0
ck() { # ck "label" "command (exit 0 = pass)"
  if eval "$2" >/dev/null 2>&1; then echo "  ✓ $1"; pass=$((pass + 1)); else echo "  ✗ $1"; fail=$((fail + 1)); fi
}

echo "=== Tier 1: no-loss-verify guard + harness (WI-462/463) ==="

GUARD="$ROOT/scripts/lib/no-loss-preflight.mjs"
HARNESS="$ROOT/scripts/no-loss-verify.mjs"

ck "preflight module exists" "test -f '$GUARD'"
ck "harness exists" "test -f '$HARNESS'"
ck "preflight module syntax OK" "node --check '$GUARD'"
ck "harness syntax OK" "node --check '$HARNESS'"

# Fixture git repo (preflight resolves the root via git rev-parse --show-toplevel)
FIX="$TMP/repo"
mkdir -p "$FIX/scripts/lib" "$FIX/.svc"
git -C "$FIX" init -q
cp "$GUARD" "$FIX/scripts/lib/no-loss-preflight.mjs"
PF="$FIX/scripts/lib/no-loss-preflight.mjs"

# 1. wrong cwd (a subdir) MUST be blocked (exit non-zero) even with baseline not required
ck "wrong-cwd blocked" "! ( cd '$FIX/scripts' && node '$PF' --no-baseline )"
# 2. repo root, no baseline recorded -> blocked (baseline required by default)
ck "no-baseline blocked" "! ( cd '$FIX' && node '$PF' )"
# 3. repo root, baseline-not-required -> passes
ck "root + --no-baseline passes" "( cd '$FIX' && node '$PF' --no-baseline )"
# 4. repo root, well-formed baseline present -> passes
printf '%s' '{"schema":1,"baseline_failures":[]}' > "$FIX/.svc/verify-baseline.json"
ck "root + baseline present passes" "( cd '$FIX' && node '$PF' )"
# 5. malformed baseline -> blocked
printf '%s' '{"schema":1}' > "$FIX/.svc/verify-baseline.json"
ck "malformed baseline blocked" "! ( cd '$FIX' && node '$PF' )"

# --- harness (WI-463) checks: lock the Codex-found false-confidence fixes ---
git -C "$FIX" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init  # HEAD = tree A
cp "$HARNESS" "$FIX/scripts/no-loss-verify.mjs"
HV="$FIX/scripts/no-loss-verify.mjs"
rm -f "$FIX/.svc/verify-baseline.json"
# fixture runner scripts (avoid inline bash -c quoting): both emit non-validator failures
printf 'printf "Tier 2 [integration]: FAIL\\nRESULT: FAIL\\n"; exit 1\n' > "$FIX/fail1.sh"
printf 'printf "Tier 2 [integration]: FAIL\\nRESULT: FAIL\\n"; exit 2\n' > "$FIX/fail2.sh"
# Fix 1 (Codex P1): non-validator (tier/RESULT) failures captured in the baseline, not swallowed
ck "harness captures tier/RESULT failures" "( cd '$FIX' && node '$HV' --record-baseline --runner 'bash $FIX/fail1.sh' ) && grep -q 'RESULT:FAIL' '$FIX/.svc/verify-baseline.json'"
# Fix 2 (Codex P1): baseline recorded on the CURRENT tree is rejected on verify
ck "verify rejects same-tree baseline" "! ( cd '$FIX' && node '$HV' --verify --runner 'bash $FIX/fail1.sh' )"
# advance to tree B so the verify diff path actually runs
echo x > "$FIX/f.txt"; git -C "$FIX" add -A >/dev/null 2>&1; git -C "$FIX" -c user.email=t@t -c user.name=t commit -q -m treeB
# NEW == baseline (same tokens + same exit) on a different tree -> NO-LOSS
ck "verify NO-LOSS when NEW == baseline" "( cd '$FIX' && node '$HV' --verify --runner 'bash $FIX/fail1.sh' )"
# Fix 1b (codeWorse): worsened exit (1->2), same tokens -> REGRESSION
ck "verify flags worsened exit code (1->2)" "! ( cd '$FIX' && node '$HV' --verify --runner 'bash $FIX/fail2.sh' )"

echo ""
echo "no-loss-verify guard: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
