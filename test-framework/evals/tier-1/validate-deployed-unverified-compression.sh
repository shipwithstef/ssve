#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass+1)); }
bad() { echo "  FAIL - $1"; fail=$((fail+1)); }

echo "=== Tier 1: deployed-unverified compression guard ==="

node --check scripts/compile-delivery-graph.mjs >/dev/null && ok "compiler syntax valid" || bad "compiler syntax invalid"
node --check scripts/validate-delivery-graph.mjs >/dev/null && ok "delivery graph validator syntax valid" || bad "delivery graph validator syntax invalid"
node --check scripts/classify-delivery-graph-closeout.mjs >/dev/null && ok "closeout classifier syntax valid" || bad "closeout classifier syntax invalid"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

node scripts/compile-delivery-graph.mjs \
  --wi WI-TMP \
  --lane brownfield-feature \
  --change-type feature \
  --intent "compressed feature lane" \
  --risk-flags user-facing \
  --compression-ratio 3 \
  --compression-threshold 2 \
  --compression-rationale "User explicitly approved compressed validation scope." \
  --out "$tmp/good.json" >/dev/null

node -e 'const fs=require("fs"); const f=process.argv[1]; const g=JSON.parse(fs.readFileSync(f,"utf8")); g.status="deployed-unverified"; fs.writeFileSync(f, JSON.stringify(g,null,2)+"\n");' "$tmp/good.json"

node scripts/validate-delivery-graph.mjs "$tmp/good.json" >/dev/null && ok "high-compression deployed-unverified graph validates with rationale and audit before land" || bad "valid high-compression graph rejected"

cp "$tmp/good.json" "$tmp/no-rationale.json"
node -e 'const fs=require("fs"); const f=process.argv[1]; const g=JSON.parse(fs.readFileSync(f,"utf8")); delete g.delivery_graph.compression.rationale; fs.writeFileSync(f, JSON.stringify(g,null,2)+"\n");' "$tmp/no-rationale.json"
if node scripts/validate-delivery-graph.mjs "$tmp/no-rationale.json" >/dev/null 2>&1; then bad "missing compression rationale accepted"; else ok "missing compression rationale fails"; fi

cp "$tmp/good.json" "$tmp/bad-status.json"
node -e 'const fs=require("fs"); const f=process.argv[1]; const g=JSON.parse(fs.readFileSync(f,"utf8")); g.status="pending"; fs.writeFileSync(f, JSON.stringify(g,null,2)+"\n");' "$tmp/bad-status.json"
if node scripts/validate-delivery-graph.mjs "$tmp/bad-status.json" >/dev/null 2>&1; then bad "high-compression pending status accepted"; else ok "high-compression lane requires deployed-unverified status"; fi

node -e 'const fs=require("fs"); const f=process.argv[1]; const g=JSON.parse(fs.readFileSync(f,"utf8")); g.delivery_graph.evidence_families.promotion="required"; fs.writeFileSync(f, JSON.stringify(g,null,2)+"\n");' "$tmp/good.json"
node scripts/classify-delivery-graph-closeout.mjs "$tmp/good.json" | grep -q "deployed-unverified" && ok "classifier keeps deployed-unverified runtime-accepted" || bad "classifier did not preserve deployed-unverified"

grep -q "DEPLOYED-UNVERIFIED" references/work-item-schema.md && ok "work item schema defines DEPLOYED-UNVERIFIED" || bad "schema missing DEPLOYED-UNVERIFIED"
grep -q "DEPLOYED-UNVERIFIED" skills/list-work-items/SKILL.md && ok "list-work-items documents deployed-unverified as open" || bad "list-work-items missing deployed-unverified open bucket"

echo "deployed-unverified compression: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
