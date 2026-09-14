#!/usr/bin/env bash
# Tier-1 promotion note (rules/tier-1-promotion.md):
#   validator_path: test-framework/evals/tier-1/validate-merge-gate-permission.sh
#   failure_class: merge-gate friction — auto-mode self-merge blocks looped/tool-shopped
#     (observed ~6x in the 2026-06-29 session, PRs #109-#115). The fix (WI-464) is a doc
#     contract: the standing merge-helper permission + the blocked-on-user halt protocol,
#     wired into land-changeset. This validator keeps that contract from rotting.
#   promotion_signal: #1 (observed repeatedly, same session) + #3 (guards the land/merge hot path).
#   expected_runtime_budget: < 1s, hermetic (grep over repo docs; no network/LLM/creds).
#   why_tier_2_or_targeted_is_insufficient: the doc<->skill wiring must stay intact on every
#     lint; a silent unwiring re-opens the looped-merge friction the protocol exists to stop.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DOC="$ROOT/references/merge-gate-permission.md"
LAND="$ROOT/skills/land-changeset/SKILL.md"
pass=0; fail=0
ck() { if eval "$2" >/dev/null 2>&1; then echo "  ✓ $1"; pass=$((pass + 1)); else echo "  ✗ $1"; fail=$((fail + 1)); fi; }

echo "=== Tier 1: merge-gate permission + blocked-on-user contract (WI-464) ==="
ck "doc exists" "test -f '$DOC'"
ck "doc names the standing merge-helper permission" "grep -q 'Bash(node scripts/merge-pr-with-review-receipt.mjs:\*)' '$DOC'"
ck "doc defines the blocked-on-user marker" "grep -q '.svc/merge-blocked-on-user.json' '$DOC'"
ck "doc states STOP retrying (no loop / no tool-shop)" "grep -qiE 'STOP retrying' '$DOC'"
ck "doc states the HONEST tradeoff (not a 'no-downside' claim)" "grep -qiE 'tradeoff' '$DOC' && grep -qiE 'agent-authored' '$DOC' && grep -qiE 'honesty' '$DOC'"
ck "doc's gate claim is grounded in validate-review-receipt.mjs (self_review+evidence)" "grep -q 'self_review' '$ROOT/scripts/validate-review-receipt.mjs' && grep -q 'evidence' '$ROOT/scripts/validate-review-receipt.mjs'"
ck "land-changeset references the doc (not orphaned)" "grep -q 'references/merge-gate-permission.md' '$LAND'"
ck "permission string consistent (full node-scripts form) in doc+land+INDEX" "for f in '$DOC' '$LAND' '$ROOT/docs/specs/work-items/INDEX.md'; do grep -q 'Bash(node scripts/merge-pr-with-review-receipt.mjs:\*)' \"\$f\" || exit 1; done"

echo ""
echo "merge-gate permission: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
