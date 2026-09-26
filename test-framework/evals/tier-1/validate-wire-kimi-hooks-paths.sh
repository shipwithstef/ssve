#!/bin/bash
# validate-wire-kimi-hooks-paths.sh — Tier 1 validation for wire-kimi-hooks.mjs
# path handling and deduplication.
#
# COST: $0 — no LLM calls.
#
# Tests:
#   - --skills-path with absolute path produces ~-prefixed commands
#   - --skills-path with tilde path (~/.kimi/skills) does NOT produce garbage
#   - dry-run against a freshly wired config detects no duplicates
#
# Exit 0: all checks pass
# Exit 1: one or more checks fail

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WIRE_SCRIPT="$REPO_ROOT/scripts/wire-kimi-hooks.mjs"
ERRORS=0

fail() {
  echo "  ✗ $1"
  ERRORS=$((ERRORS + 1))
}

pass() {
  echo "  ✓ $1"
}

echo "=== Tier 1: wire-kimi-hooks.mjs Path Handling ==="

delegated_contains() {
  node -e '
    const fs=require("fs");
    const text=fs.readFileSync(0,"utf8");
    const expected=process.argv[1];
    for(const match of text.matchAll(/--spec ([A-Za-z0-9_-]+)/g)) {
      const spec=JSON.parse(Buffer.from(match[1],"base64url").toString("utf8"));
      if(spec.command.includes(expected)) process.exit(0);
    }
    process.exit(1);
  ' "$1"
}

# Use a temp empty config so dry-run always shows the generated commands
TMP_CONFIG="$(mktemp)"
TAIL_CONFIG="$(mktemp)"
trap 'rm -f "$TMP_CONFIG" "$TAIL_CONFIG"' EXIT
cat > "$TMP_CONFIG" <<'EOF'
EOF

# =============================================================================
# 1. Absolute path input should produce ~-prefixed output
# =============================================================================
ABS_DRYRUN=$(node "$WIRE_SCRIPT" --skills-path "$HOME/.kimi/skills" --config "$TMP_CONFIG" --dry-run 2>&1 || true)
if delegated_contains "~/.kimi/skills/hooks/kimi/" <<< "$ABS_DRYRUN"; then
  pass "absolute path input produces ~-prefixed commands"
else
  fail "absolute path should produce ~-prefixed commands (output missing ~/.kimi/skills/)"
fi

if delegated_contains "$HOME/.kimi/skills/hooks/kimi/" <<< "$ABS_DRYRUN"; then
  fail "absolute path should NOT produce hardcoded absolute commands"
else
  pass "absolute path does not produce hardcoded absolute commands"
fi

# =============================================================================
# 2. Tilde path input should NOT produce garbage paths
# =============================================================================
TILDE_DRYRUN=$(node "$WIRE_SCRIPT" --skills-path '~/.kimi/skills' --config "$TMP_CONFIG" --dry-run 2>&1 || true)
if grep -q "$(pwd)/~/.kimi/skills" <<< "$TILDE_DRYRUN"; then
  fail "tilde path should NOT produce garbage paths like $(pwd)/~/.kimi/skills"
else
  pass "tilde path does not produce garbage cwd-prefixed paths"
fi

if delegated_contains "~/.kimi/skills/hooks/kimi/" <<< "$TILDE_DRYRUN"; then
  pass "tilde path input produces correct ~-prefixed commands"
else
  fail "tilde path should produce correct ~-prefixed commands"
fi

# =============================================================================
# 3. Against a freshly wired config: no duplicates detected
# =============================================================================
node "$WIRE_SCRIPT" --skills-path '~/.kimi/skills' --config "$TMP_CONFIG" >/dev/null
DUP_DRYRUN=$(node "$WIRE_SCRIPT" --skills-path '~/.kimi/skills' --config "$TMP_CONFIG" --dry-run 2>&1 || true)
if grep -q "No changes needed" <<< "$DUP_DRYRUN"; then
  pass "dry-run against freshly wired config detects no duplicates"
else
  fail "dry-run should detect no duplicates against freshly wired config (output: $DUP_DRYRUN)"
fi

# =============================================================================
# 4. Duplicate last svc hook must not delete following user TOML tables
# =============================================================================
node "$WIRE_SCRIPT" --skills-path '~/.kimi/skills' --config "$TAIL_CONFIG" >/dev/null
node - "$TAIL_CONFIG" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const text = fs.readFileSync(file, "utf8");
const blocks = text.split(/\n(?=\[\[hooks\]\])/);
const stop = blocks.find((block) => block.includes("svc-kimi-task-completion-guard"));
if (!stop) throw new Error("missing completion guard fixture");
fs.writeFileSync(file, `${text.trimEnd()}\n\n${stop.trim()}\n\n[[hooks]]\nevent = "Stop"\ncommand = "bash /opt/user/svc-custom.sh"\n\n[[hooks]]\nevent = "SessionEnd"\ncommand = "echo svc-worktree-isolation-guard.mjs"\n\n[settings]\nmodel = "user-owned"\n\n[providers.custom]\nendpoint = "https://user.invalid"\n`);
NODE
node "$WIRE_SCRIPT" --skills-path '~/.kimi/skills' --config "$TAIL_CONFIG" >/dev/null
if grep -q '^model = "user-owned"$' "$TAIL_CONFIG" \
  && grep -q '^endpoint = "https://user.invalid"$' "$TAIL_CONFIG" \
  && grep -q '^command = "bash /opt/user/svc-custom.sh"$' "$TAIL_CONFIG" \
  && grep -q '^command = "echo svc-worktree-isolation-guard.mjs"$' "$TAIL_CONFIG" \
  && [ "$(grep -c 'svc-kimi-task-completion-guard' "$TAIL_CONFIG")" -eq 1 ]; then
  pass "duplicate tail pruning preserves following user TOML tables byte-for-byte"
else
  fail "duplicate tail pruning removed or altered following user TOML tables"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "  PASS — all wire-kimi-hooks path assertions passed"
  exit 0
else
  echo "  $ERRORS failed"
  exit 1
fi
