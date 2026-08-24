#!/usr/bin/env bash
# WI-562 IP-W3/W-D: catalog parity + path quoting.
# - every wirer-owned hook id is registered in references/host-hook-catalog.json
# - host capability truth present for all 7 hook-capable hosts
# - cursor wiring succeeds with a SPACE-BEARING install prefix (quoted paths)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { local label="$1"; shift; if "$@" >"$TMP/out" 2>&1; then echo "  ✓ $label"; pass=$((pass+1)); else echo "  ✗ $label"; cat "$TMP/out"; fail=$((fail+1)); fi; }

echo "=== Tier 1: hook catalog parity + path quoting ==="

# 1. Capability truth for all 7 hook-capable hosts.
node -e '
const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const required = ["claude","kimi","codex","gemini","opencode","cursor","grok"];
for (const h of required) {
  const cap = c.hosts?.[h];
  if (!cap) throw new Error(`missing capability truth for ${h}`);
  if (!["full","skills-only","none"].includes(cap.receipts)) throw new Error(`bad receipts capability for ${h}`);
}
if (!c.hooks || !Array.isArray(c.hooks) || c.hooks.length === 0) throw new Error("no hooks registered");
' "$ROOT/references/host-hook-catalog.json"
check "capability truth for all 7 hosts + non-empty hook registry" true

# 2. Every svc-*.mjs hook script shipped in skills/hooks is represented in the catalog.
MISSING=$(SVC_HOOKS_DIR="$ROOT/hooks" node -e '
const fs = require("fs"), path = require("path");
const cat = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const ids = new Set((cat.hooks || []).map((h) => h.id));
const hooksDir = process.env.SVC_HOOKS_DIR;
let missing = [];
for (const f of fs.readdirSync(hooksDir)) {
  const m = /^svc-[a-z0-9-]+\.mjs$/.exec(f);
  if (!m) continue;
  const base = f.replace(/\.mjs$/, "");
  // catalog ids use the script stem without common suffixes
  const candidates = [base, base.replace(/-(pre|post)$/, "")];
  if (!candidates.some((cid) => ids.has(cid))) missing.push(f);
}
console.log(missing.join("\n"));
' "$ROOT/references/host-hook-catalog.json")
if [[ -z "$MISSING" ]]; then check "all skills/hooks svc scripts registered in catalog" true; else check "all skills/hooks svc scripts registered in catalog (missing: $MISSING)" false; fi

# 3. Space-bearing install prefix: cursor wiring must succeed and produce quoted commands.
SPACE_HOME="$TMP/space dir/home"
mkdir -p "$SPACE_HOME/.cursor/skills/hooks"
echo ok >"$SPACE_HOME/.cursor/skills/hooks/svc-bash-guard.mjs"
if HOME="$SPACE_HOME" node "$ROOT/scripts/wire-cursor-hooks.mjs" >/dev/null 2>&1; then
  check "cursor wires under space-bearing HOME" true
  if grep -q "\"$SPACE_HOME/.cursor/skills/hooks/" "$SPACE_HOME/.cursor/hooks.json"; then
    check "generated commands quote the interpolated path" true
  else
    check "generated commands quote the interpolated path" false
  fi
else
  check "cursor wires under space-bearing HOME" false
fi

echo "validate-catalog-generation: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
