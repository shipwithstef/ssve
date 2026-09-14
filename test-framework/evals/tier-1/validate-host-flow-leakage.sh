#!/bin/bash
# validate-host-flow-leakage.sh — Tier-1 validator for WI-127 Phase 4.
# Catches `/flow:*` references that leak into host-agnostic paths without
# being conditionalized on Kimi.
#
# /flow:<name> is a Kimi CLI primitive only. References to it in
# Claude/Codex/Gemini code paths or in shipped hooks that fire on
# non-Kimi hosts produce noise and bad recommendations.
#
# Allowed references: those that explicitly mention Kimi nearby (within
# the same line or the previous line of context). Examples:
#   "Kimi CLI: `/flow:strategic-decision`"
#   "(Kimi-only) /flow:svc-lane-executor"
#
# Disallowed: bare references with no Kimi context, e.g. trailers like
#   "To auto-resume: /flow:svc-lane-executor"

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

echo "=== Tier 1: Host /flow: Leakage Validation ==="

# Scan SKILL.md files + shipped hooks (excluding hooks/kimi/ which is
# legitimately kimi-only and now self-guarded).
SCAN_PATHS=()
while IFS= read -r f; do SCAN_PATHS+=("$f"); done < <(
  find . -type f \( -name "SKILL.md" -o -name "*.mjs" -o -name "*.sh" \) \
    \( -path "./hooks/*" -o -path "./scripts/*" -o -path "./*/SKILL.md" \) \
    ! -path "./hooks/kimi/*" \
    ! -path "./node_modules/*" \
    ! -path "./.worktrees/*" \
    ! -path "./test-framework/*" \
    2>/dev/null
)

LEAKS=0
LEAK_LINES=()
KIMI_RE='[Kk]imi'

for f in "${SCAN_PATHS[@]}"; do
  while IFS=: read -r lineno content; do
    [ -z "$lineno" ] && continue
    # Allowed: Kimi mentioned on the same line
    if echo "$content" | grep -qE "$KIMI_RE"; then continue; fi
    # Allowed: Kimi mentioned on the previous line
    prev=$((lineno - 1))
    if [ "$prev" -gt 0 ]; then
      prev_line=$(sed -n "${prev}p" "$f" 2>/dev/null)
      if echo "$prev_line" | grep -qE "$KIMI_RE"; then continue; fi
    fi
    LEAKS=$((LEAKS + 1))
    LEAK_LINES+=("$f:$lineno: $content")
  done < <(grep -nE '/flow:' "$f" 2>/dev/null || true)
done

if [ "$LEAKS" -eq 0 ]; then
  echo "  PASS — no unguarded /flow: references in host-agnostic paths"
  echo "  scanned ${#SCAN_PATHS[@]} files"
  exit 0
else
  echo "  FAIL — $LEAKS unguarded /flow: reference(s) found:"
  for l in "${LEAK_LINES[@]}"; do echo "    $l"; done
  echo ""
  echo "  /flow:* is Kimi-only. Either remove the reference, conditionalize"
  echo "  it (mention 'Kimi' on the same line or previous line), or move it"
  echo "  into hooks/kimi/ which is excluded from this scan."
  exit 1
fi
