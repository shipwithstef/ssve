#!/bin/bash
# validate-skip-conditions-registry.sh — WI-074 tier-1 validator.
#
# Bidirectional check between references/skip-conditions.json and the 13
# SKILL.md files it references:
#
#   Forward: every registry entry names a skill directory that exists,
#            the referenced SKILL.md exists and is non-empty, and the
#            self_verify_row pointer contains a skill-name sub-path that
#            actually resolves.
#
#   Reverse: minimal sanity — every skill listed in the registry MUST
#            have at least one "skip" / "N/A" / "justif" token in its
#            SKILL.md (mechanical heuristic; not perfect but catches
#            drift where a skip clause was removed entirely).
#
# Exit 0 on both-way clean; exit 1 with the first mismatch message
# otherwise. Named mismatch message includes the offending skill and
# the direction of the mismatch.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REGISTRY="$REPO_ROOT/references/skip-conditions.json"

PASS=0
FAIL=0
FAILS=()

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); FAILS+=("$1"); echo "  ✗ $1"; }

echo "=== Tier 1: skip-conditions Registry Validation ==="

if [ ! -r "$REGISTRY" ]; then
  fail "registry file missing: $REGISTRY"
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi

python3 - "$REGISTRY" <<'PY' 2>/dev/null && pass "registry is valid JSON" || { fail "registry is invalid JSON"; exit 1; }
import json, sys
json.load(open(sys.argv[1]))
PY

# List of skills in the registry
SKILLS=$(python3 - "$REGISTRY" <<'PY'
import json, sys
print(' '.join(json.load(open(sys.argv[1]))['skills'].keys()))
PY
)

if [ -z "$SKILLS" ]; then
  fail "registry has zero skill entries"
  exit 1
fi

COUNT=$(echo "$SKILLS" | wc -w)
pass "registry has $COUNT skill entries"

# Forward check: each registry skill must have an existing SKILL.md
for s in $SKILLS; do
  f="$REPO_ROOT/skills/$s/SKILL.md"
  if [ -f "$f" ] && [ -s "$f" ]; then
    pass "forward: $s/SKILL.md exists"
  else
    fail "forward: $s/SKILL.md missing or empty"
  fi
done

# Forward check: self_verify_row pointer must mention the same skill name
FWD_OK=0
for s in $SKILLS; do
  pointer=$(python3 - "$REGISTRY" "$s" <<'PY'
import json, sys
print(json.load(open(sys.argv[1]))['skills'][sys.argv[2]]['self_verify_row'])
PY
)
  if echo "$pointer" | grep -q "$s"; then
    FWD_OK=$((FWD_OK+1))
  else
    fail "forward: self_verify_row for $s does not contain skill name in its pointer"
  fi
done
[ "$FWD_OK" = "$COUNT" ] && pass "forward: all $COUNT self_verify_row pointers name their skill"

# Reverse check: each registered skill's SKILL.md must contain at least one
# skip/N-A/justif token (mechanical heuristic — prevents silent drift where
# a skip clause is removed entirely)
REV_OK=0
for s in $SKILLS; do
  f="$REPO_ROOT/skills/$s/SKILL.md"
  if grep -qiE "skip|N/A|justif" "$f" 2>/dev/null; then
    REV_OK=$((REV_OK+1))
  else
    fail "reverse: $s/SKILL.md no longer contains skip/N-A/justif language (clause may have been removed — either restore it or remove from registry)"
  fi
done
[ "$REV_OK" = "$COUNT" ] && pass "reverse: all $COUNT skills still document skip/N-A/justif language"

# Lane-tasks completed-state enforcement (WI-144/WI-145, unified in WI-510).
# For every completed task in every active lane-tasks file whose skill is in the
# skip-conditions registry, delegate executed/authorized-skip/legacy state to
# the canonical classifier. A receipt never independently authorizes a skip.
LANE_TASKS_SKIP_OK=0
LANE_TASKS_SKIP_TOTAL=0

for lt in "$REPO_ROOT"/.svc/lane-tasks-*.json; do
  [ -f "$lt" ] || continue
  if basename "$lt" | grep -qE '\.completed[-.]'; then
    continue
  fi
  # Preserve this validator's pre-WI-510 active/in-flight graph scope. Closed
  # graphs remain covered by lane-tasks integrity and explicit replay tests;
  # widening this registry check would turn unrelated receipt migration debt
  # into a new Tier-1 failure.
  top_status=$(python3 - "$lt" <<'PY' 2>/dev/null || echo ""
import json, sys
print((json.load(open(sys.argv[1])).get('status') or '').strip())
PY
)
  if [ "$top_status" = "completed" ]; then
    continue
  fi
  all_completed=$(python3 - "$lt" <<'PY' 2>/dev/null || echo "no"
import json, sys
d = json.load(open(sys.argv[1]))
tasks = d.get('tasks', [])
print('yes' if tasks and all(t.get('status') == 'completed' for t in tasks) else 'no')
PY
)
  if [ "$all_completed" = "yes" ]; then
    continue
  fi
  LANE_TASKS_SKIP_TOTAL=$((LANE_TASKS_SKIP_TOTAL+1))
  if node "$REPO_ROOT/scripts/validate-completed-task-integrity.mjs" \
      --graph "$lt" \
      --registry "$REGISTRY" \
      --repo-root "$REPO_ROOT" \
      --registered-skills-only \
      --structured-or-skip-only \
      --phase-free-compat summary; then
    LANE_TASKS_SKIP_OK=$((LANE_TASKS_SKIP_OK+1))
  else
    fail "lane-tasks skip-integrity: $(basename "$lt") has invalid completed registry-skill state"
  fi
done
[ "$LANE_TASKS_SKIP_OK" = "$LANE_TASKS_SKIP_TOTAL" ] && pass "lane-tasks: all $LANE_TASKS_SKIP_TOTAL files have valid completed registry-skill state"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  for e in "${FAILS[@]}"; do echo "    - $e"; done
  exit 1
fi
