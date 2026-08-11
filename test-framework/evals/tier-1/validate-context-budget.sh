#!/usr/bin/env bash
# Tier 1: context-budget regression net (WI-397).
# Locks the WI-361/365/366 context-economy wins (Dim 12, the worst baseline
# dimension) so they cannot silently re-bloat — the scar-tissue accumulation
# WI-369 only *measures*, made fail-closed here. Hermetic + deterministic:
# sums (a) always-on rule bytes and (b) skill-catalog description chars, and
# fails if either exceeds the ceiling in .svc/perf-baseline.json (ceilings sit
# above current, so a real justified increase means bumping the baseline in the
# same change — a deliberate, reviewed act).
#
# Always-on rules are DERIVED dynamically from skills-manifest.json
# rulesRegistry entries with auto_inject:"always" (Gemini G6 #2 — a new
# always-on rule is then automatically counted, not silently missed).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
BASELINE=".svc/perf-baseline.json"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Context Budget (WI-397) ==="
[ -f "$BASELINE" ] || { echo "  FAIL: $BASELINE missing"; exit 1; }

node -e '
const fs=require("fs");
const base=JSON.parse(fs.readFileSync(".svc/perf-baseline.json","utf8")).context_budget;
const m=JSON.parse(fs.readFileSync("skills-manifest.json","utf8"));
let rc=0;

// (a) always-on rule bytes — DERIVED from the registry (auto_inject:"always"),
// not a hardcoded list, so a new always-on rule is automatically in budget.
const reg=(m.rulesRegistry&&m.rulesRegistry.entries)||{};
const alwaysOn=Object.values(reg).filter(e=>e&&e.auto_inject==="always"&&e.path).map(e=>e.path);
if (alwaysOn.length===0) { console.log("  ✗ no always-on rules derived from registry (auto_inject:always) — derivation broken"); rc=1; }
let rb=0, missing=[];
for (const p of alwaysOn) { try { rb += fs.statSync(p).size; } catch { missing.push(p); } }
if (missing.length) { console.log("  ✗ always-on rule path(s) missing: "+missing.join(", ")); rc=1; }
else if (alwaysOn.length>0 && rb > base.always_on_rules_bytes_max) {
  console.log(`  ✗ always-on rules ${rb}B (${alwaysOn.length} rules) exceed budget ${base.always_on_rules_bytes_max}B (re-bloat — diet or bump baseline deliberately)`); rc=1;
} else if (alwaysOn.length>0) {
  console.log(`  ✓ always-on rules ${rb}B (${alwaysOn.length} rules) within budget ${base.always_on_rules_bytes_max}B`);
}

// (b) skill-catalog description chars (native description budget proxy, WI-365).
// Regex stops at the next frontmatter key OR the closing --- (Gemini G6 #1: a
// description that is the LAST frontmatter field would otherwise read as 0 chars
// and let an oversized description false-pass the gate).
let cc=0, n=0;
for (const s of m.includedSkills) {
  try {
    const t=fs.readFileSync(s+"/SKILL.md","utf8");
    const fm=t.split(/^---$/m)[1]||"";
    const d=(fm.match(/description:([\s\S]*?)(?:\n\w[\w-]*:|\n*$)/)||[])[1]||"";
    cc+=d.length; n++;
  } catch {}
}
if (cc > base.catalog_desc_chars_max) {
  console.log(`  ✗ catalog desc ${cc} chars (${n} skills) exceed budget ${base.catalog_desc_chars_max} (re-bloat — trim descriptions or bump baseline)`); rc=1;
} else {
  console.log(`  ✓ catalog desc ${cc} chars (${n} skills) within budget ${base.catalog_desc_chars_max}`);
}
process.exit(rc);
' && pass "context budget within ceilings" || fail "context budget exceeded (re-bloat)"

echo "context budget: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
