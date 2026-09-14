#!/usr/bin/env bash
# Tier 1: svc-wi-pillars-check blocks malformed VERIFIED WI files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-wi-pillars-check.sh"
HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"
WIRE="$REPO_ROOT/scripts/wire-hooks.mjs"
FIXTURE="$REPO_ROOT/docs/specs/work-items/WI-PILLAR-FIXTURE.md"
trap 'rm -f "$FIXTURE" /tmp/wi-pillars-frontmatter.out /tmp/wi-pillars-body.out /tmp/wi-pillars-draft.out' EXIT

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

echo "=== Tier 1: WI pillars hard block ==="

if bash -n "$HOOK"; then
  pass "hook wrapper syntax valid"
else
  fail "hook wrapper syntax invalid"
fi

cat > "$FIXTURE" <<'MD'
---
id: WI-PILLAR-FIXTURE
status: verified
---

# WI-PILLAR-FIXTURE

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|--------|-----------|----------------------|
| 1 | Product fit | [UNCHANGED — VERIFIED] | docs/specs/work-items/WI-PILLAR-FIXTURE.md |
MD

bad_payload='{"tool_input":{"file_path":"docs/specs/work-items/WI-PILLAR-FIXTURE.md"}}'
if (cd "$REPO_ROOT" && printf '%s' "$bad_payload" | HOME="$(mktemp -d)" bash "$HOOK" >/tmp/wi-pillars-frontmatter.out 2>&1); then
  fail "malformed frontmatter VERIFIED WI unexpectedly passed"
else
  if grep -q 'missing 7 pillar' /tmp/wi-pillars-frontmatter.out; then
    pass "malformed frontmatter VERIFIED WI blocks with missing-pillar output"
  else
    fail "malformed frontmatter VERIFIED WI blocked without expected diagnostic"
  fi
fi

cat > "$FIXTURE" <<'MD'
---
id: WI-PILLAR-FIXTURE
---

# WI-PILLAR-FIXTURE

**Status:** VERIFIED

## Pillar Revisit Audit

| # | Pillar | Affected? | Evidence / follow-up |
|---|--------|-----------|----------------------|
| 1 | Product fit | [UNCHANGED — VERIFIED] | docs/specs/work-items/WI-PILLAR-FIXTURE.md |
MD

if (cd "$REPO_ROOT" && printf '%s' "$bad_payload" | HOME="$(mktemp -d)" bash "$HOOK" >/tmp/wi-pillars-body.out 2>&1); then
  fail "malformed body-status VERIFIED WI unexpectedly passed"
else
  if grep -q 'missing 7 pillar' /tmp/wi-pillars-body.out; then
    pass "malformed body-status VERIFIED WI blocks with missing-pillar output"
  else
    fail "malformed body-status VERIFIED WI blocked without expected diagnostic"
  fi
fi

cat > "$FIXTURE" <<'MD'
---
id: WI-PILLAR-FIXTURE
status: open
---

# WI-PILLAR-FIXTURE

**Status:** DRAFT
MD

if (cd "$REPO_ROOT" && printf '%s' "$bad_payload" | bash "$HOOK" >/tmp/wi-pillars-draft.out 2>&1); then
  pass "draft/in-progress WI exits 0"
else
  fail "draft/in-progress WI should not block"
fi

if node -e '
const fs = require("fs");
const hooks = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const entry = hooks.hooks.PostToolUse.find((h) => h.id === "svc-wi-pillars-check");
if (!entry) process.exit(1);
if (!/HARD BLOCK/.test(entry.description)) process.exit(2);
if (!/svc-wi-pillars-check\.sh/.test(entry.command)) process.exit(3);
if (/\|\| true/.test(entry.command)) process.exit(4);
' "$HOOKS_JSON"; then
  pass "hooks manifest wires hard-block wrapper without fail-open suffix"
else
  fail "hooks manifest does not wire hard-block wrapper correctly"
fi

if grep -q 'svc-wi-pillars-check.sh' "$WIRE" && ! grep -q 'verify-wi-pillars.mjs.*|| true' "$WIRE"; then
  pass "wire-hooks installs the same hard-block wrapper"
else
  fail "wire-hooks still installs soft warning behavior"
fi

echo ""
echo "WI pillars hard block: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
