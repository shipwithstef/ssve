#!/usr/bin/env bash
# Tier-1: validate G-4 (svc-skill-artifact-authenticity hook).
# Verifies: writes to canonical skill-output paths require a recent skill
# invocation in .svc/pipeline-decisions.jsonl, exit 2 otherwise.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-skill-artifact-authenticity.mjs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0; FAIL=0; ERRORS=""
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); ERRORS+="    ✗ $1\n"; echo "  ✗ $1"; }

cd "$TMP"
mkdir -p hooks/lib hooks/codex/lib .svc docs/specs/features docs/specs/decisions
cp "$REPO_ROOT/hooks/lib/hook-payload.mjs" hooks/lib/
cp "$REPO_ROOT/hooks/lib/operation-scope.mjs" hooks/lib/
cp "$REPO_ROOT/hooks/lib/bash-mutation-targets.mjs" hooks/lib/
cp "$REPO_ROOT/hooks/codex/lib/argv-lex.mjs" hooks/codex/lib/
cp "$HOOK" hooks/

invoke() {
  local file_path="$1"
  local extra_env="${2:-}"
  local payload="{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$file_path\"}}"
  if [ -n "$extra_env" ]; then
    echo "$payload" | env $extra_env node hooks/svc-skill-artifact-authenticity.mjs >/dev/null 2>&1
  else
    echo "$payload" | node hooks/svc-skill-artifact-authenticity.mjs >/dev/null 2>&1
  fi
  echo $?
}

# T1: write to docs/specs/features/* with NO pipeline-decisions.jsonl → BLOCK
EXIT=$(invoke "docs/specs/features/foo.md")
[ "$EXIT" = "2" ] && pass "T1 BLOCK: features/* without any decisions log" || fail "T1 expected 2, got $EXIT"

# T2: with stale decision (>90 min ago) → BLOCK
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OLD_TS=$(date -u -d "3 hours ago" +%Y-%m-%dT%H:%M:%SZ)
echo "{\"timestamp\":\"$OLD_TS\",\"skill\":\"validate-feature\",\"decision\":\"x\"}" > .svc/pipeline-decisions.jsonl
EXIT=$(invoke "docs/specs/features/foo.md")
[ "$EXIT" = "2" ] && pass "T2 BLOCK: stale receipt (>window)" || fail "T2 expected 2, got $EXIT"

# T3: with recent matching skill → PASS
echo "{\"timestamp\":\"$NOW\",\"skill\":\"validate-feature\",\"decision\":\"start\"}" >> .svc/pipeline-decisions.jsonl
EXIT=$(invoke "docs/specs/features/foo.md")
[ "$EXIT" = "0" ] && pass "T3 PASS: recent matching receipt" || fail "T3 expected 0, got $EXIT"

# T4: alternative matching skill (write-spec satisfies docs/specs/features/*)
echo "{\"timestamp\":\"$NOW\",\"skill\":\"write-spec\",\"decision\":\"start\"}" >> .svc/pipeline-decisions.jsonl
EXIT=$(invoke "docs/specs/features/bar.md")
[ "$EXIT" = "0" ] && pass "T4 PASS: write-spec also satisfies features/" || fail "T4 expected 0, got $EXIT"

# T5: unrelated skill receipt does not satisfy
echo "{}" > .svc/pipeline-decisions.jsonl
echo "{\"timestamp\":\"$NOW\",\"skill\":\"audit-coverage\",\"decision\":\"x\"}" >> .svc/pipeline-decisions.jsonl
EXIT=$(invoke "docs/specs/features/baz.md")
[ "$EXIT" = "2" ] && pass "T5 BLOCK: unrelated skill receipt does not satisfy" || fail "T5 expected 2, got $EXIT"

# T6: SVC_SKILL_ARTIFACT_ALLOW=1 bypass
EXIT=$(invoke "docs/specs/features/baz.md" "SVC_SKILL_ARTIFACT_ALLOW=1")
[ "$EXIT" = "0" ] && pass "T6 PASS: SVC_SKILL_ARTIFACT_ALLOW=1 bypasses" || fail "T6 expected 0, got $EXIT"

# T7: non-protected path → PASS regardless
EXIT=$(invoke "docs/drafts/anything.md")
[ "$EXIT" = "0" ] && pass "T7 PASS: non-protected path always allowed" || fail "T7 expected 0, got $EXIT"

# T8: exact-match path (capability-plan.md)
EXIT=$(invoke "docs/specs/capability-plan.md")
[ "$EXIT" = "2" ] && pass "T8 BLOCK: exact-match path docs/specs/capability-plan.md" || fail "T8 expected 2, got $EXIT"

# Missing/malformed timestamps cannot become immortal invocation receipts.
printf '%s\n' '{"timestamp":"not-a-time","skill":"write-spec"}' > .svc/pipeline-decisions.jsonl
EXIT=$(invoke "docs/specs/features/malformed-time.md")
[ "$EXIT" = "2" ] && pass "T9 BLOCK: malformed timestamp cannot satisfy freshness" || fail "T9 expected 2, got $EXIT"

echo ""
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "FAIL"
  printf "$ERRORS"
  exit 1
fi
echo "PASS"
exit 0
