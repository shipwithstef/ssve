#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

check_fail() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  else
    echo "  ✓ $label"
    pass=$((pass + 1))
  fi
}

FIX="$TMP/repo"
mkdir -p "$FIX/.svc/review-receipts" "$FIX/docs/specs/reviews"
touch "$FIX/skills-manifest.json" "$FIX/FRAMEWORK-STATE.md"

payload='{"tool_name":"Bash","tool_input":{"command":"gh pr merge 123 --squash --delete-branch"}}'

echo "=== Tier 1: Review Receipt Merge Guard ==="

check "review receipt validator syntax valid" node --check "$ROOT/scripts/validate-review-receipt.mjs"
check "review receipt merge wrapper syntax valid" node --check "$ROOT/scripts/merge-pr-with-review-receipt.mjs"
check_fail "validator rejects missing receipt" node "$ROOT/scripts/validate-review-receipt.mjs" --root "$FIX" --pr 123
check_fail "bash guard blocks gh pr merge without receipt" bash -c "cd '$FIX' && printf '%s' '$payload' | node '$ROOT/hooks/svc-workflow-guard.mjs' --bash-guard"
check_fail "codex shell wrapper blocks merge without receipt" node "$ROOT/scripts/merge-pr-with-review-receipt.mjs" --root "$FIX" --pr 123 --squash --delete-branch --dry-run

cat >"$FIX/.svc/review-receipts/pr-123.json" <<'JSON'
{
  "pr": 123,
  "review_gate_required": true,
  "review_gate_task": "G5",
  "reviewer": "plan-reviewer",
  "reviewed_at": "2026-05-12T10:00:00Z",
  "result": "PASS",
  "self_review": false,
  "evidence": ["skills/review-gate/SKILL.md"]
}
JSON

check "validator accepts valid receipt" node "$ROOT/scripts/validate-review-receipt.mjs" --root "$FIX" --pr 123
check "bash guard allows gh pr merge with receipt" bash -c "cd '$FIX' && printf '%s' '$payload' | node '$ROOT/hooks/svc-workflow-guard.mjs' --bash-guard"
check "codex shell wrapper accepts merge with receipt" node "$ROOT/scripts/merge-pr-with-review-receipt.mjs" --root "$FIX" --repo example/repo --pr 123 --squash --delete-branch --dry-run
check "codex shell wrapper dry-run uses explicit repo" bash -c "node '$ROOT/scripts/merge-pr-with-review-receipt.mjs' --root '$FIX' --repo example/repo --pr 123 --squash --delete-branch --dry-run | grep -q 'gh pr merge 123 --repo example/repo --squash --delete-branch'"

rm "$FIX/.svc/review-receipts/pr-123.json"
cat >"$FIX/.svc/pipeline-decisions.jsonl" <<'JSONL'
{"timestamp":"2026-05-12T10:00:00Z","skill":"review-gate","review_gate_bypass":true,"pr":123,"reasoning":"Emergency merge approved after out-of-band review evidence was archived.","approved_by":"human-owner"}
JSONL

check "validator accepts logged bypass" node "$ROOT/scripts/validate-review-receipt.mjs" --root "$FIX" --pr 123
check "bash guard allows logged bypass" bash -c "cd '$FIX' && printf '%s' '$payload' | node '$ROOT/hooks/svc-workflow-guard.mjs' --bash-guard"
check "codex shell wrapper accepts logged bypass" node "$ROOT/scripts/merge-pr-with-review-receipt.mjs" --root "$FIX" --repo example/repo --pr 123 --squash --delete-branch --dry-run

check "land-changeset documents wrapper instead of raw merge" bash -c "! grep -q '^gh pr merge <pr-number>' '$ROOT/skills/land-changeset/SKILL.md' && grep -q 'merge-pr-with-review-receipt.mjs --pr <pr-number>' '$ROOT/skills/land-changeset/SKILL.md'"
check "worktree promote uses wrapper for auto-merge" grep -q 'merge-pr-with-review-receipt.mjs.*--pr "$pr_number"' "$ROOT/scripts/worktree.sh"

echo ""
echo "review receipt merge guard: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
