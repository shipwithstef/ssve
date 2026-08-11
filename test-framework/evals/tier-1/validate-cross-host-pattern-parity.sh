#!/usr/bin/env bash
# validate-cross-host-pattern-parity.sh — tier-1 validator.
#
# OpenCode has its own TypeScript plugin (hooks/opencode/svc-opencode-plugin.ts)
# that re-implements the workflow-guard logic for OpenCode's plugin API. Unlike
# Kimi (which has an adapter shim that delegates to the canonical
# svc-workflow-guard.mjs), OpenCode's plugin is a parallel implementation. If
# the protected-config-files pattern list drifts between the two implementations,
# OpenCode users silently get different protection than Claude users.
#
# This validator extracts the regex pattern lists from both files and compares
# them. Drift = fail.
#
# Specifically:
#   - hooks/svc-workflow-guard.mjs            → PROTECTED_CONFIG_PATTERNS array
#   - hooks/opencode/svc-opencode-plugin.ts   → PROTECTED_CONFIG_PATTERNS array
#
# Both arrays should contain the same set of regex literals (order may differ).
#
# Exit 0 if pattern sets are identical (modulo order).
# Exit 1 with a diff if they differ.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_GUARD="$REPO_ROOT/hooks/svc-workflow-guard.mjs"
OPENCODE_PLUGIN="$REPO_ROOT/hooks/opencode/svc-opencode-plugin.ts"

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: cross-host pattern parity (Claude .mjs vs OpenCode .ts) ==="

if [ ! -f "$CLAUDE_GUARD" ]; then
  fail "Claude guard missing at $CLAUDE_GUARD"
  exit 1
fi
if [ ! -f "$OPENCODE_PLUGIN" ]; then
  fail "OpenCode plugin missing at $OPENCODE_PLUGIN"
  exit 1
fi

# Extract regex literals from PROTECTED_CONFIG_PATTERNS in each file.
# Format in both: /pattern$/ on its own line (TS) or with trailing comma (JS).
# We sed out the leading whitespace and trailing comma, then sort.
extract_patterns() {
  # WI-399 A4: the Claude guard split its list into HARD_DENY (lock/env) +
  # PROTECTED (ask-class). Parity contract = the UNION protects the same file
  # set as the OpenCode single deny-list (UX differs per host capability).
  # Line-anchored extraction so comment prose containing slashes is skipped.
  local file="$1"
  awk '/(HARD_DENY_CONFIG_PATTERNS|PROTECTED_CONFIG_PATTERNS)[[:space:]]*[:=]/,/\];?$/' "$file" \
    | grep -E '^[[:space:]]*/.*/[a-z]*,?[[:space:]]*$' \
    | grep -oE '/[^/]+/[a-z]*' \
    | sort -u
}

CLAUDE_PATTERNS=$(extract_patterns "$CLAUDE_GUARD")
OPENCODE_PATTERNS=$(extract_patterns "$OPENCODE_PLUGIN")

CLAUDE_COUNT=$(printf '%s\n' "$CLAUDE_PATTERNS" | grep -c . || true)
OPENCODE_COUNT=$(printf '%s\n' "$OPENCODE_PATTERNS" | grep -c . || true)

pass "extracted $CLAUDE_COUNT patterns from claude .mjs"
pass "extracted $OPENCODE_COUNT patterns from opencode .ts"

if [ "$CLAUDE_COUNT" -eq 0 ]; then
  fail "Claude pattern extraction yielded 0 patterns — extraction logic broken or file structure changed"
  echo "  See: $CLAUDE_GUARD line 79–110 (PROTECTED_CONFIG_PATTERNS)"
fi
if [ "$OPENCODE_COUNT" -eq 0 ]; then
  fail "OpenCode pattern extraction yielded 0 patterns — extraction logic broken or file structure changed"
  echo "  See: $OPENCODE_PLUGIN line 60–80 (PROTECTED_CONFIG_PATTERNS)"
fi

# Diff the sorted, deduped lists
ONLY_CLAUDE=$(comm -23 <(echo "$CLAUDE_PATTERNS") <(echo "$OPENCODE_PATTERNS") | grep -v '^$' || true)
ONLY_OPENCODE=$(comm -13 <(echo "$CLAUDE_PATTERNS") <(echo "$OPENCODE_PATTERNS") | grep -v '^$' || true)

if [ -z "$ONLY_CLAUDE" ] && [ -z "$ONLY_OPENCODE" ]; then
  pass "pattern sets are identical ($CLAUDE_COUNT patterns each)"
else
  fail "PATTERN DRIFT detected — Claude and OpenCode protect different files"
  if [ -n "$ONLY_CLAUDE" ]; then
    echo "  Only in Claude (.mjs):"
    while IFS= read -r p; do echo "    + $p"; done <<< "$ONLY_CLAUDE"
  fi
  if [ -n "$ONLY_OPENCODE" ]; then
    echo "  Only in OpenCode (.ts):"
    while IFS= read -r p; do echo "    + $p"; done <<< "$ONLY_OPENCODE"
  fi
fi

echo
echo "PASS: $PASS, FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Recovery:"
  echo "  Sync the PROTECTED_CONFIG_PATTERNS arrays in:"
  echo "    $CLAUDE_GUARD"
  echo "    $OPENCODE_PLUGIN"
  echo "  Add the missing pattern(s) to whichever file is short. If a pattern"
  echo "  is intentionally Claude-only or OpenCode-only, document the rationale"
  echo "  in a comment alongside the pattern and update this validator's"
  echo "  expected-divergence allowlist."
  exit 1
fi

exit 0
