#!/usr/bin/env bash
# Tier 1 — honest-diagnosis (WI-108).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/honest-diagnosis.mjs"
REG_SCRIPT="$REPO_ROOT/scripts/builder-capability-registry.mjs"
CROSS_SCRIPT="$REPO_ROOT/scripts/cross-project-state.mjs"

PASS=0
FAIL=0
ERRORS=""

[[ -f "$SCRIPT" ]] && PASS=$((PASS+1)) || { ERRORS+="  FAIL: missing\n"; FAIL=$((FAIL+1)); }
node --check "$SCRIPT" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: syntax\n"; FAIL=$((FAIL+1)); }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export SVC_BUILDER_CAPABILITY_REGISTRY="$TMP/registry.json"
export SVC_STATE_SNAPSHOT="$TMP/snapshot.json"
export SVC_DECISIONS_LOG="$TMP/decisions.jsonl"
export SVC_REPO_ROOT="$TMP/repo"
mkdir -p "$TMP/repo"

# Precondition refusal: registry missing
OUT_NO_REG=$(node "$SCRIPT" --out "$TMP/out.md" 2>&1 || true)
echo "$OUT_NO_REG" | grep -q '"verdict": "refused"' && PASS=$((PASS+1)) \
  || { ERRORS+="  FAIL: did not refuse on missing registry\n"; FAIL=$((FAIL+1)); }

# Seed registry
SVC_REPO_ROOT="$REPO_ROOT" node "$REG_SCRIPT" seed >/dev/null

# Missing snapshot → still refused
OUT_NO_SNAP=$(node "$SCRIPT" --out "$TMP/out.md" 2>&1 || true)
echo "$OUT_NO_SNAP" | grep -q '"verdict": "refused"' && PASS=$((PASS+1)) \
  || { ERRORS+="  FAIL: did not refuse on missing snapshot\n"; FAIL=$((FAIL+1)); }

# Build snapshot with 1 stale project
mkdir -p "$TMP/proj-stale"
cd "$TMP/proj-stale"
G375() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$TMP/proj-stale" "$@"; }
G375 init -q 2>&1 >/dev/null
G375 config user.email "t@t"
G375 config user.name "t"
GIT_COMMITTER_DATE="2025-10-01T00:00:00" G375 commit --allow-empty -m "ancient" --date "2025-10-01T00:00:00" >/dev/null 2>&1
mkdir -p docs/specs/work-items
cat > docs/specs/work-items/INDEX.md <<EOF
- [WI-001](WI-001.md) — fake — status:backlog
- [WI-002](WI-002.md) — fake2 — status:in-progress
EOF
cd "$REPO_ROOT"
cat > "$TMP/projects.json" <<EOF
{"projects":[{"id":"stale","path":"$TMP/proj-stale"}]}
EOF
HOME="$TMP/home" SVC_STATE_SNAPSHOT="$TMP/snapshot.json" SVC_REPO_ROOT="$REPO_ROOT" \
  node "$CROSS_SCRIPT" --out "$TMP/snapshot.json" --projects-file "$TMP/projects.json" >/dev/null

# Seed a decisions log with a premature-completion pattern
cat > "$TMP/decisions.jsonl" <<EOF
{"timestamp":"2026-04-01T00:00:00Z","run_id":"WI-999","skill":"land-changeset","decision":"merged"}
EOF

# Happy path
OUT=$(node "$SCRIPT" --out "$TMP/diagnosis.md" 2>&1)
echo "$OUT" | grep -q '"verdict": "diagnosis-written"' && PASS=$((PASS+1)) \
  || { ERRORS+="  FAIL: diagnosis not written. got: $OUT\n"; FAIL=$((FAIL+1)); }

# Verify blocker_count ≥ 3
BC=$(echo "$OUT" | grep '"blocker_count":' | head -1 | grep -oE '[0-9]+')
[[ $BC -ge 3 ]] && PASS=$((PASS+1)) \
  || { ERRORS+="  FAIL: blocker_count=$BC (expected ≥3)\n"; FAIL=$((FAIL+1)); }

# Verify report contains 3 ### B sections
if [[ -f "$TMP/diagnosis.md" ]]; then
  SECTIONS=$(grep -c '^### B[0-9]' "$TMP/diagnosis.md" || true)
  [[ $SECTIONS -ge 3 ]] && PASS=$((PASS+1)) \
    || { ERRORS+="  FAIL: found $SECTIONS ### B sections (expected ≥3)\n"; FAIL=$((FAIL+1)); }
else
  ERRORS+="  FAIL: diagnosis report missing\n"; FAIL=$((FAIL+1))
fi

# No platitudes check (script enforces; here we double-check externally)
if ! grep -qiE 'grind harder|stay focused|hustle' "$TMP/diagnosis.md"; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: platitude phrase slipped through\n"; FAIL=$((FAIL+1))
fi

# Every blocker has an Evidence: line
EV_COUNT=$(grep -c '^\- \*\*Evidence:\*\*' "$TMP/diagnosis.md" || true)
[[ $EV_COUNT -ge 3 ]] && PASS=$((PASS+1)) \
  || { ERRORS+="  FAIL: Evidence lines: $EV_COUNT (expected ≥3)\n"; FAIL=$((FAIL+1)); }

echo ""
echo "  honest-diagnosis: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
