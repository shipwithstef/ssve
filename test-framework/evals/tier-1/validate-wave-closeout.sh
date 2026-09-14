#!/usr/bin/env bash
# Tier 1: batch WI closeout must reconcile docs, index, task graphs, evidence, and worktrees.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

expect_pass() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass "$label"
  else
    "$@" || true
    fail "$label"
  fi
}

expect_fail() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    fail "$label"
  else
    pass "$label"
  fi
}

make_wave_repo() {
  local root="$1"
  mkdir -p "$root/docs/specs/work-items" "$root/docs/specs/features/test-evidence" "$root/.svc"
  git -C "$root" init -q
  git -C "$root" config user.email "svc@example.test"
  git -C "$root" config user.name "svc"
  cat > "$root/docs/specs/work-items/INDEX.md" <<'EOF'
# Work Items Index

- [WI-100](WI-100.md) — Fixture wave item 100 — status:verified
- [WI-101](WI-101.md) — Fixture wave item 101 — status:verified
EOF

  for wi in WI-100 WI-101; do
    cat > "$root/docs/specs/work-items/$wi.md" <<EOF
---
id: $wi
title: "Fixture wave item"
status: verified
---

# $wi

## Verification

- \`node scripts/validate-wave-closeout.mjs\` fixture evidence.
EOF
    mkdir -p "$root/docs/specs/features/test-evidence/$wi"
    cat > "$root/docs/specs/features/test-evidence/$wi/result.json" <<'JSON'
{
  "stats": {
    "passed": 2,
    "failed": 0
  }
}
JSON
    cat > "$root/.svc/lane-tasks-$wi.json" <<EOF
{
  "wi": "$wi",
  "lane": "framework",
  "status": "completed",
  "tasks": [
    {
      "id": 1,
      "subject": "Fixture task",
      "status": "completed",
      "completed_at": "2026-05-17T12:00:00Z"
    }
  ]
}
EOF
  done

  git -C "$root" add .
  git -C "$root" commit -q -m baseline
}

echo "=== Tier 1: Wave Closeout Validation ==="

node --check "$REPO_ROOT/scripts/validate-wave-closeout.mjs" >/dev/null
pass "validator syntax valid"

if grep -Fq "## Wave Closeout Validation" "$REPO_ROOT/skills/route-workflow/SKILL.md"; then
  pass "route-workflow documents wave closeout validation"
else
  fail "route-workflow documents wave closeout validation"
fi

if grep -Fq "## Wave Closeout Gate" "$REPO_ROOT/skills/dispatch-waves/SKILL.md"; then
  pass "dispatch-waves documents wave closeout gate"
else
  fail "dispatch-waves documents wave closeout gate"
fi

if grep -Fq "latest zero-fail runtime evidence" "$REPO_ROOT/skills/route-workflow/SKILL.md"; then
  pass "route-workflow names latest zero-fail runtime evidence"
else
  fail "route-workflow names latest zero-fail runtime evidence"
fi

GOOD="$TMP/good"
make_wave_repo "$GOOD"
expect_pass "complete two-WI wave passes" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$GOOD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 2

COUNT_BAD="$TMP/count-bad"
make_wave_repo "$COUNT_BAD"
expect_fail "expected count mismatch fails" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$COUNT_BAD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 3

INDEX_BAD="$TMP/index-bad"
make_wave_repo "$INDEX_BAD"
sed -i '/WI-101/d' "$INDEX_BAD/docs/specs/work-items/INDEX.md"
expect_fail "missing INDEX row fails" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$INDEX_BAD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 2

GRAPH_BAD="$TMP/graph-bad"
make_wave_repo "$GRAPH_BAD"
rm "$GRAPH_BAD/.svc/lane-tasks-WI-101.json"
expect_fail "missing lane graph fails" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$GRAPH_BAD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 2

EVIDENCE_BAD="$TMP/evidence-bad"
make_wave_repo "$EVIDENCE_BAD"
rm -rf "$EVIDENCE_BAD/docs/specs/features/test-evidence/WI-101"
expect_fail "missing evidence directory fails" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$EVIDENCE_BAD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 2

LATEST_BAD="$TMP/latest-bad"
make_wave_repo "$LATEST_BAD"
cat > "$LATEST_BAD/docs/specs/features/test-evidence/WI-101/failing.json" <<'JSON'
{
  "stats": {
    "passed": 1,
    "failed": 1
  }
}
JSON
touch -t 202605171200 "$LATEST_BAD/docs/specs/features/test-evidence/WI-101/result.json"
touch -t 202605171201 "$LATEST_BAD/docs/specs/features/test-evidence/WI-101/failing.json"
expect_fail "latest failing evidence fails even if older passing evidence exists" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$LATEST_BAD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 2

WORKTREE_BAD="$TMP/worktree-bad"
make_wave_repo "$WORKTREE_BAD"
mkdir -p "$WORKTREE_BAD/.worktrees"
git -C "$WORKTREE_BAD" worktree add "$WORKTREE_BAD/.worktrees/WI-100-leftover" -b WI-100-leftover >/dev/null 2>&1
expect_fail "scoped residual worktree fails" \
  node "$REPO_ROOT/scripts/validate-wave-closeout.mjs" \
    --root "$WORKTREE_BAD" \
    --from WI-100 \
    --to WI-101 \
    --expect-count 2

echo
echo "wave closeout validation: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
