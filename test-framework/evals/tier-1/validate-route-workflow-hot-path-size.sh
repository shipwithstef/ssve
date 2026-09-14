#!/usr/bin/env bash
# Tier 1: route-workflow must remain a compact hot-path router.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"
DETAIL="$REPO_ROOT/skills/route-workflow/references/hot-path-operational-details.md"
WRITE_SPEC="$REPO_ROOT/skills/write-spec/SKILL.md"
AUTO_DRIVE="$REPO_ROOT/scripts/svc-auto-drive.mjs"
OPT_PLAN="$REPO_ROOT/docs/specs/plans/FRAMEWORK_OPTIMIZATION_PLAN.md"

total_lines="$(wc -l < "$SKILL" | tr -d ' ')"
failures=0

echo "=== Tier 1: route-workflow hot-path size ==="

if (( total_lines <= 220 )); then
  echo "  PASS - skills/route-workflow/SKILL.md is compact ($total_lines lines <= 220)"
else
  echo "  FAIL - skills/route-workflow/SKILL.md is too large ($total_lines lines > 220)"
  failures=$((failures + 1))
fi

if [[ -f "$DETAIL" ]]; then
  echo "  PASS - hot-path details reference exists"
else
  echo "  FAIL - hot-path details reference missing"
  failures=$((failures + 1))
fi

for ref in \
  "references/hot-path-operational-details.md" \
  "references/intent-normalization.md" \
  "references/intent-classification.md" \
  "references/lane-model.md" \
  "references/routing-rules.md" \
  "references/task-graph-protocol.md" \
  "references/decision-log.md" \
  "references/autorun-orchestrator.md"
do
  if grep -Fq "$ref" "$SKILL"; then
    echo "  PASS - SKILL.md references $ref"
  else
    echo "  FAIL - SKILL.md missing $ref"
    failures=$((failures + 1))
  fi
done

if grep -Fq 'Derived-at: HEAD' "$WRITE_SPEC"; then
  echo "  FAIL - write-spec still permits a symbolic genesis SHA"
  failures=$((failures + 1))
else
  echo "  PASS - write-spec requires a resolved genesis SHA"
fi

if grep -Fq 'git merge-base HEAD origin/main' "$SKILL"; then
  echo "  PASS - route activation command derives an executable diff base"
else
  echo "  FAIL - route activation command still uses an abbreviated diff range"
  failures=$((failures + 1))
fi

AUTO_DRIVE="$AUTO_DRIVE" node <<'NODE' || failures=$((failures + 1))
const source=require('fs').readFileSync(process.env.AUTO_DRIVE,'utf8');
const start=source.indexOf('function findStoryReceiptSha256');
const end=source.indexOf('\nfunction ',start+1);
const body=source.slice(start,end);
if(body.includes('execSync(')||!body.includes('execFileSync(')) {
  console.error('  FAIL - story receipt Git reads are not argument-array based'); process.exit(1);
}
console.log('  PASS - story receipt Git reads use argument arrays');
NODE

if sed -n '/^| \*\*OPT-01\*\*/p' "$OPT_PLAN" | head -n 1 | grep -q 'Auto-parse'; then
  echo "  FAIL - refuted OPT-01 remains in the active optimization table"
  failures=$((failures + 1))
else
  echo "  PASS - refuted OPT-01 is absent from the active table"
fi

if (( failures > 0 )); then
  exit 1
fi
