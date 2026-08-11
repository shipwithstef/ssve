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

JSON_OUT="$(SVC_WORK_ITEMS_DIR="$WI_DIR" node "$REPO_ROOT/skills/list-work-items/scripts/list_work_items.mjs" --json)"

DONE="$(printf '%s' "$JSON_OUT" | node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync(0,'utf8')); console.log(a.find(x=>x.id==='WI-001')?.isDone)")"
OPEN="$(printf '%s' "$JSON_OUT" | node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync(0,'utf8')); console.log(a.find(x=>x.id==='WI-002')?.isDone)")"
PRI="$(printf '%s' "$JSON_OUT" | node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync(0,'utf8')); console.log(a.find(x=>x.id==='WI-001')?.priority)")"
DOWNGRADED_PRI="$(printf '%s' "$JSON_OUT" | node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync(0,'utf8')); console.log(a.find(x=>x.id==='WI-003')?.priority)")"

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

SVC_WORK_ITEMS_DIR="$WI_DIR" node "$REPO_ROOT/skills/list-work-items/scripts/list_work_items.mjs" >/tmp/list-work-items-frontmatter.out
if ! grep -q '\[WI-001\]' "$WI_DIR/DONE.md"; then
  echo "FAIL: DONE.md did not include YAML-frontmatter verified WI" >&2
  exit 1
fi
if grep -q 'WI-001' /tmp/list-work-items-frontmatter.out; then
  echo "FAIL: YAML-frontmatter verified WI appeared in open backlog output" >&2
  exit 1
fi

echo "PASS: validate-list-work-items-frontmatter"
