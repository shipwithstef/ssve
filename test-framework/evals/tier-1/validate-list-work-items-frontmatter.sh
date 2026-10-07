#!/usr/bin/env bash
# Tier 1: list-work-items must classify both YAML-frontmatter and legacy
# markdown status fields. Regression for YAML `status: verified` items being
# shown as open backlog.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/docs/specs/work-items"
WI_DIR="$TMP_DIR/docs/specs/work-items"

cat > "$WI_DIR/WI-001.md" <<'EOF'
---
id: WI-001
title: "frontmatter done"
status: verified
severity: critical
filed: 2026-05-10
closed: 2026-05-10
---

# WI-001: frontmatter done
EOF

cat > "$WI_DIR/WI-002.md" <<'EOF'
# WI-002: legacy open

**Status:** backlog
**Severity:** high
EOF

cat > "$WI_DIR/WI-003.md" <<'EOF'
# WI-003: downgraded severity

**Status:** OPEN
**Severity:** ~~CRITICAL~~ -> HIGH
EOF

cat > "$WI_DIR/WI-004.md" <<'EOF'
# WI-004: hyphenated progress

**Status:** in-progress
**Severity:** medium
EOF

cat > "$WI_DIR/WI-005.md" <<'EOF'
# WI-005: approved changeset

**Status:** change-set-approved; execution verification in progress
**Severity:** medium
EOF

cat > "$WI_DIR/WI-006.md" <<'EOF'
# WI-006: held by directive

**Status:** pending (BY USER DIRECTIVE — do not auto-dispatch)
**Severity:** low
EOF

cat > "$WI_DIR/WI-007.md" <<'EOF'
# WI-007: confidence suffix

**Status:** VERIFIED-L3
**Severity:** low
EOF

cat > "$WI_DIR/WI-008.md" <<'EOF'
# WI-008: deployed awaiting verification

**Status:** DEPLOYED-UNVERIFIED
**Severity:** high
EOF

cat > "$WI_DIR/WI-009.md" <<'EOF'
# WI-009: closed duplicate

**Status:** closed-duplicate
**Severity:** low
EOF

cat > "$WI_DIR/WI-010.md" <<'EOF'
# WI-010: advisory validation

**Status:** validated-advisory
**Severity:** low
EOF

cat > "$WI_DIR/WI-011.md" <<'EOF'
# WI-011: nested paren remainder

**Status:** pending (outer (inner) note) still blocked)
**Severity:** low
EOF

cat > "$WI_DIR/WI-012.md" <<'EOF'
# WI-012: in-progress hold

**Status:** in-progress
**Hold:** owner review
**Severity:** medium
EOF

cat > "$WI_DIR/WI-013.md" <<'EOF'
# WI-013: closed hold

**Status:** done
**Hold:** should-not-show-in-next
**Severity:** low
**Closed:** 2026-05-11
EOF

cat > "$WI_DIR/WI-014.md" <<'EOF'
# WI-014: progress aside

**Status:** in-progress (worktree note)
**Severity:** low
EOF

JSON_OUT="$(SVC_WORK_ITEMS_DIR="$WI_DIR" node "$REPO_ROOT/skills/list-work-items/scripts/list_work_items.mjs" --json)"

field() {
  local id="$1" key="$2"
  printf '%s' "$JSON_OUT" | node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync(0,'utf8')); const row=a.find(x=>x.id===process.argv[1]); console.log(row?row[process.argv[2]]:'')" "$id" "$key"
}

DONE="$(field WI-001 isDone)"
OPEN="$(field WI-002 isDone)"
PRI="$(field WI-001 priority)"
DOWNGRADED_PRI="$(field WI-003 priority)"
PROGRESS_KEY="$(field WI-004 statusKey)"
PROGRESS_DONE="$(field WI-004 isDone)"
APPROVED_KEY="$(field WI-005 statusKey)"
APPROVED_DONE="$(field WI-005 isDone)"
PENDING_KEY="$(field WI-006 statusKey)"
L3_KEY="$(field WI-007 statusKey)"
L3_DONE="$(field WI-007 isDone)"
DEPLOYED_KEY="$(field WI-008 statusKey)"
DEPLOYED_DONE="$(field WI-008 isDone)"
DUP_DONE="$(field WI-009 isDone)"
ADVISORY_KEY="$(field WI-010 statusKey)"

if [[ "$DONE" != "true" ]]; then
  echo "FAIL: YAML frontmatter status: verified was not classified as done" >&2
  exit 1
fi

if [[ "$OPEN" != "false" ]]; then
  echo "FAIL: legacy backlog status was not classified as open" >&2
  exit 1
fi

if [[ "$PRI" != "critical" ]]; then
  echo "FAIL: YAML frontmatter severity was not parsed as priority" >&2
  exit 1
fi

if [[ "$DOWNGRADED_PRI" != "high" ]]; then
  echo "FAIL: struck-through severity downgrade was not parsed as the active priority" >&2
  exit 1
fi

if [[ "$PROGRESS_KEY" != "in-progress" || "$PROGRESS_DONE" != "false" ]]; then
  echo "FAIL: in-progress was truncated or rebucketed (statusKey=$PROGRESS_KEY isDone=$PROGRESS_DONE)" >&2
  exit 1
fi

if [[ "$APPROVED_KEY" != "change-set-approved" || "$APPROVED_DONE" != "false" ]]; then
  echo "FAIL: change-set-approved was truncated or rebucketed (statusKey=$APPROVED_KEY isDone=$APPROVED_DONE)" >&2
  exit 1
fi

if [[ "$PENDING_KEY" != "pending" ]]; then
  echo "FAIL: parenthetical pending status token changed (statusKey=$PENDING_KEY)" >&2
  exit 1
fi

if [[ "$L3_KEY" != "verified-l3" || "$L3_DONE" != "true" ]]; then
  echo "FAIL: VERIFIED-L3 must stay closed with its full token (statusKey=$L3_KEY isDone=$L3_DONE)" >&2
  exit 1
fi

if [[ "$DEPLOYED_KEY" != "deployed-unverified" || "$DEPLOYED_DONE" != "false" ]]; then
  echo "FAIL: DEPLOYED-UNVERIFIED must stay open with its full token (statusKey=$DEPLOYED_KEY isDone=$DEPLOYED_DONE)" >&2
  exit 1
fi

if [[ "$DUP_DONE" != "true" ]]; then
  echo "FAIL: closed-duplicate must stay in the done bucket" >&2
  exit 1
fi

if [[ "$ADVISORY_KEY" != "validated-advisory" ]]; then
  echo "FAIL: validated-advisory was truncated (statusKey=$ADVISORY_KEY)" >&2
  exit 1
fi

SVC_WORK_ITEMS_DIR="$WI_DIR" node "$REPO_ROOT/skills/list-work-items/scripts/list_work_items.mjs" >/tmp/list-work-items-frontmatter.out
if ! grep -q '\[WI-001\]' "$WI_DIR/DONE.md"; then
  echo "FAIL: DONE.md did not include YAML-frontmatter verified WI" >&2
  exit 1
fi
if grep -q 'WI-001' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: YAML-frontmatter verified WI appeared in open backlog output" >&2
  exit 1
fi
if ! grep -q '| WI-004 | in-progress |' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: open table did not print the full in-progress token" >&2
  exit 1
fi
if grep -q '| WI-004 | in |' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: open table truncated in-progress to in" >&2
  exit 1
fi
if ! grep -q '| WI-005 | change-set-approved |' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: open table did not print the full change-set-approved token" >&2
  exit 1
fi
if grep -q '| WI-005 | change |' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: open table truncated change-set-approved to change" >&2
  exit 1
fi
if ! grep -q '| WI-008 | deployed-unverified |' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: open table did not keep DEPLOYED-UNVERIFIED visible" >&2
  exit 1
fi
if grep -q 'WI-007' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: VERIFIED-L3 appeared in the open backlog" >&2
  exit 1
fi
next_of() {
  local file="$1" id="$2"
  awk -F'|' -v id="$id" '$0 ~ "\\| " id " \\|" { gsub(/^[ \t]+|[ \t]+$/, "", $5); print $5; exit }' "$file"
}

NEXT="$(next_of /tmp/list-work-items-frontmatter.out WI-006)"
if [[ "$NEXT" != "BY USER DIRECTIVE — do not auto-dispatch" ]]; then
  echo "FAIL: pending remainder kept stray punctuation (next=$(printf '%s' "$NEXT" | cat -A))" >&2
  exit 1
fi

NESTED="$(next_of /tmp/list-work-items-frontmatter.out WI-011)"
if [[ "$NESTED" != "outer (inner) note still blocked" ]]; then
  echo "FAIL: nested paren remainder kept an orphan closer (next=$(printf '%s' "$NESTED" | cat -A))" >&2
  exit 1
fi

HOLD_NEXT="$(next_of /tmp/list-work-items-frontmatter.out WI-012)"
if [[ "$HOLD_NEXT" != "owner review" ]]; then
  echo "FAIL: Hold on in-progress was not shown in Next (next=$(printf '%s' "$HOLD_NEXT" | cat -A))" >&2
  exit 1
fi

ASIDE="$(next_of /tmp/list-work-items-frontmatter.out WI-014)"
if [[ "$ASIDE" != "—" ]]; then
  echo "FAIL: in-progress status remainder was promoted into Next (next=$(printf '%s' "$ASIDE" | cat -A))" >&2
  exit 1
fi

if grep -q 'WI-013' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: done row with Hold appeared in the open backlog" >&2
  exit 1
fi

SVC_WORK_ITEMS_DIR="$WI_DIR" node "$REPO_ROOT/skills/list-work-items/scripts/list_work_items.mjs" --all >/tmp/list-work-items-frontmatter-all.out
CLOSED_NEXT="$(next_of /tmp/list-work-items-frontmatter-all.out WI-013)"
if [[ "$CLOSED_NEXT" != "—" ]]; then
  echo "FAIL: Hold on a done row was copied into Next (next=$(printf '%s' "$CLOSED_NEXT" | cat -A))" >&2
  exit 1
fi
if grep -q 'should-not-show-in-next' /tmp/list-work-items-frontmatter-all.out; then
  echo "FAIL: done-row Hold text leaked into the table" >&2
  exit 1
fi

echo "PASS: validate-list-work-items-frontmatter"
