#!/usr/bin/env bash
# Tier-1 (WI-144, hardened in WI-145): Lane-tasks integrity — ghost-completion detection.
#
# For every active lane-tasks JSON file:
#   1. Every completed task needs a valid loaded receipt; registered skills also
#      pass the canonical executed / authorized-skip / legacy classifier.
#   2. No task may have status "in_progress" and "completed_at" simultaneously.
#   3. Task IDs must be unique within the file.
#
# Files whose name matches `.completed[-.]` are treated as legacy-archive and
# skipped. Files with top-level status=completed are STILL checked — a completed
# WI with ghost-completed tasks is a false-verification risk (WI-141).
#
# This prevents the ghost-completion failure mode where a task is marked
# completed in the JSON without the skill actually having run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FAIL=0
PASS=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

CHECK_SCRIPT="$(mktemp -t lt-integrity-XXXXXX.py)"
trap 'rm -f "$CHECK_SCRIPT"' EXIT

cat > "$CHECK_SCRIPT" <<'PY'
import json, sys

path = sys.argv[1]
with open(path) as f:
    d = json.load(f)

# Defensive repeat: only skip true legacy-archive filenames.
# Completed WIs are intentionally checked — ghost completions in verified work
# items are the exact failure mode this validator targets (WI-141).
if '.completed-' in path or '.completed.' in path:
    print('SKIP: legacy-archive')
    sys.exit(0)

tasks = d.get('tasks', [])
issues = []
seen_ids = set()

for t in tasks:
    tid = t.get('id')
    if tid in seen_ids:
        issues.append(f'duplicate task id: {tid}')
    seen_ids.add(tid)

    status = t.get('status', '')
    completed_at = t.get('completed_at')
    raw_receipt = t.get('skill_receipt')
    receipt = raw_receipt if isinstance(raw_receipt, dict) else {}

    if status == 'completed':
        loaded_at = receipt.get('loaded_at')
        loaded_via = (receipt.get('loaded_via') or '').strip()
        if loaded_via == 'legacy-backfill':
            issues.append(
                f'task {tid} ({t.get("skill")}) legacy-backfill receipt — '
                f'skill was never loaded during execution'
            )
        elif not receipt or not loaded_at:
            issues.append(
                f'task {tid} ({t.get("skill")}) ghost-completed: '
                f'no valid skill_receipt'
            )
    if status == 'in_progress' and completed_at:
        issues.append(f'task {tid} ({t.get("skill")}) contradictory: in_progress but has completed_at')

if issues:
    print('ISSUES: ' + '; '.join(issues))
    sys.exit(1)
PY

echo "=== Tier 1: Lane-Tasks Integrity Validation ==="

FILES=0
for lt in "$REPO_ROOT"/.svc/lane-tasks-*.json; do
  [ -f "$lt" ] || continue
  if basename "$lt" | grep -qE '\.completed[-.]'; then
    continue
  fi
  # Defensive skip: only legacy-archive files with `.completed[-.]` in name.
  # Completed WIs are still checked — ghost completions in verified work items
  # are exactly the failure mode this validator exists to catch (WI-141).
  FILES=$((FILES+1))
  BASENAME=$(basename "$lt")

  STRUCTURE_OK=0
  CLASSIFIER_OK=0
  if python3 "$CHECK_SCRIPT" "$lt"; then
    STRUCTURE_OK=1
  fi
  if node "$REPO_ROOT/scripts/validate-completed-task-integrity.mjs" \
      --graph "$lt" \
      --registry "$REPO_ROOT/references/skip-conditions.json" \
      --repo-root "$REPO_ROOT" \
      --registered-skills-only \
      --structured-or-skip-only \
      --phase-free-compat loaded; then
    CLASSIFIER_OK=1
  fi
  if [[ "$STRUCTURE_OK" -eq 1 && "$CLASSIFIER_OK" -eq 1 ]]; then
    pass "$BASENAME integrity OK"
  else
    fail "$BASENAME integrity failure"
  fi
done

echo ""
if [ "$FAIL" = 0 ]; then
  echo "PASS — lane-tasks integrity: $FILES files, $PASS checks passed"
  exit 0
else
  echo "FAIL — $FAIL issues across $FILES files"
  exit 1
fi
