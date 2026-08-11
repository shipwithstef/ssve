#!/usr/bin/env bash
# validate-tier1-pre-push-gate.sh — Tier-1 validator for WI-358.
# Structural checks for the local pre-push tier-1 gate slot.
# Promotion note: see docs/plans/2026-06-06-wi-358-tier1-pre-push-gate/manifest.md
# (failure_class: silent decay of the local CI-equivalent gate; signal 3 hot-path).

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

GATE="hooks/git/pre-push.d/15-tier1-gate"
PASS=0
FAIL=0

check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label"; FAIL=$((FAIL+1))
  fi
}

echo "=== Tier 1: pre-push tier-1 gate (WI-358) ==="

check "gate slot exists" test -f "$GATE"
check "gate slot is executable" test -x "$GATE"
check "gate bash syntax valid" bash -n "$GATE"
check "gate reads chain-policy mode" grep -q 'chain-policy.json' "$GATE"
check "gate has hot-path pattern" grep -q 'HOT_PATTERN=' "$GATE"
check "hot-path pattern covers hooks/" grep -q '\^hooks/' "$GATE"
check "hot-path pattern covers scripts/" grep -q '\^scripts/' "$GATE"
check "hot-path pattern covers tier-1 dir" grep -q 'test-framework/evals/tier-1/' "$GATE"
check "hot-path pattern covers manifest" grep -q 'skills-manifest' "$GATE"
check "hot-path pattern covers SKILL.md" grep -q 'SKILL\\.md' "$GATE"
check "hot-path pattern covers provision/" grep -q 'provision/' "$GATE"
check "gate has logged bypass env" grep -q 'SVC_SKIP_TIER1_GATE' "$GATE"
check "bypass writes canonical audit record" grep -q 'pipeline-decisions.jsonl' "$GATE"
check "dispatcher replays stdin to slots" grep -q 'STDIN_CAPTURE' "scripts/install-git-hooks.mjs"
check "gate runs tier-1 suite" grep -q 'run-all-evals.sh --tier1' "$GATE"
check "gate pins EVALS=0 (no LLM tiers on push)" grep -q 'EVALS=0 timeout' "$GATE"
check "gate sanitizes git hook env (LF-001)" grep -q 'env -u GIT_DIR' "$GATE"
check "gate has outer timeout" grep -q 'SVC_TIER1_GATE_TIMEOUT_SEC' "$GATE"
check "gate skips notes refs" grep -q 'refs/notes' "$GATE"
check "gate engages on lint-only pushes" grep -q 'LINT_HITS' "$GATE"
check "new-branch range uses merge-base (three-dot)" grep -q 'MAIN_REF\.\.\.' "$GATE"
check "bypass creates .svc parent dir" grep -q 'mkdir -p .svc' "$GATE"
check "dispatcher installer versioned" test -f "scripts/install-git-hooks.mjs"
check "slot ordering: receipts(10) before gate(15)" test -f "hooks/git/pre-push.d/10-receipts-complete"

# Local-install presence is NOT a tier-1 failure (hermetic: a fresh clone that
# has not run install-git-hooks.mjs is a valid tree). Warn-only drift signal.
if [ ! -x ".git/hooks/pre-push" ]; then
  echo "  ⚠ dispatcher not installed in this clone (node scripts/install-git-hooks.mjs) — warn-only, not counted"
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS gate structural checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
