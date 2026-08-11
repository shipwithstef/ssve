#!/usr/bin/env bash
# Tier 1 — cross-project state reader (WI-105).
#
# Smoke-tests: syntax + empty-projects case + 3-fake-projects fixture case.
# Runs in a temp HOME so it never touches real ~/.svc state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/cross-project-state.mjs"

PASS=0
FAIL=0
ERRORS=""

[[ -f "$SCRIPT" ]] && PASS=$((PASS+1)) || { ERRORS+="  FAIL: script missing\n"; FAIL=$((FAIL+1)); }
node --check "$SCRIPT" 2>/dev/null && PASS=$((PASS+1)) || { ERRORS+="  FAIL: script syntax\n"; FAIL=$((FAIL+1)); }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Case A: no projects file → framework row only
HOME="$TMPDIR/emptyhome" node "$SCRIPT" --out "$TMPDIR/snapshot-empty.json" --projects-file "$TMPDIR/nope.json" >/dev/null
if [[ -f "$TMPDIR/snapshot-empty.json" ]]; then
  if node -e "const d = JSON.parse(require('fs').readFileSync('$TMPDIR/snapshot-empty.json')); process.exit(d.rows.length === 1 && d.rows[0].id === 'framework' ? 0 : 1);"; then
    PASS=$((PASS+1))
  else
    ERRORS+="  FAIL: empty-projects snapshot did not contain exactly 1 framework row\n"; FAIL=$((FAIL+1))
  fi
else
  ERRORS+="  FAIL: empty-projects snapshot not written\n"; FAIL=$((FAIL+1))
fi

# Case B: 3 fake projects
for i in 1 2 3; do
  P="$TMPDIR/proj$i/docs/specs/work-items"
  mkdir -p "$P"
  cat > "$P/INDEX.md" <<EOF
# Work Items Index

- [WI-001](WI-001.md) — fake — status:backlog
- [WI-002](WI-002.md) — fake2 — status:in-progress
EOF
done
cat > "$TMPDIR/projects.json" <<EOF
{
  "projects": [
    {"id": "p1", "path": "$TMPDIR/proj1"},
    {"id": "p2", "path": "$TMPDIR/proj2"},
    {"id": "p3", "path": "$TMPDIR/proj3"}
  ]
}
EOF

HOME="$TMPDIR/home3" node "$SCRIPT" --out "$TMPDIR/snapshot-3.json" --projects-file "$TMPDIR/projects.json" >/dev/null

node -e "
const d = JSON.parse(require('fs').readFileSync('$TMPDIR/snapshot-3.json'));
if (d.rows.length !== 4) { console.error('expected 4 rows (3 projects + framework), got ' + d.rows.length); process.exit(1); }
const projectRows = d.rows.filter(r => r.id !== 'framework');
const totalActive = projectRows.reduce((s, r) => s + (r.active_wi_count || 0), 0);
if (totalActive !== 6) { console.error('expected 6 active WIs across 3 projects (2 each), got ' + totalActive); process.exit(1); }
" && PASS=$((PASS+1)) || { ERRORS+="  FAIL: 3-project snapshot content wrong\n"; FAIL=$((FAIL+1)); }

# Case C: aggregation time under 2s (per AC)
start=$(date +%s%N)
HOME="$TMPDIR/home3" node "$SCRIPT" --out "$TMPDIR/snapshot-timed.json" --projects-file "$TMPDIR/projects.json" >/dev/null
end=$(date +%s%N)
elapsed_ms=$(( (end - start) / 1000000 ))
if [[ $elapsed_ms -lt 2000 ]]; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: took ${elapsed_ms}ms (>2000ms cap)\n"; FAIL=$((FAIL+1))
fi

echo ""
echo "  cross-project-state: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
