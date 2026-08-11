#!/usr/bin/env bash
# Tier 1: spec-index query-tool gate (WI-389).
#
# .svc/spec-index.json is ~692KB / ~28K lines. With no query tool, the fallback
# was loading the WHOLE index (a ~170K-token worst case). This gate proves the
# bounded query tool exists + is idempotent + ≤2K tokens, and forbids any skill
# or reference from instructing a RAW full Read/cat of the index — steering every
# role to scripts/query-spec-index.mjs instead. Hermetic + deterministic.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: spec-index Query Tool (WI-389) ==="

TOOL="scripts/query-spec-index.mjs"
[ -s "$TOOL" ] && pass "query-spec-index.mjs present" || fail "query-spec-index.mjs missing"

# ---- A. AC1: idempotent + ≤2K-token bound (golden) -------------------------
if [ -f .svc/spec-index.json ] && [ -s "$TOOL" ]; then
  node --input-type=module -e '
  import { execSync } from "node:child_process";
  const run = (a) => execSync(`node scripts/query-spec-index.mjs ${a}`, { encoding: "utf8" });
  // pick a real indexed WI deterministically (lowest WI id present).
  const idx = JSON.parse(execSync("cat .svc/spec-index.json", { encoding: "utf8", maxBuffer: 1<<30 }));
  const wis = [...new Set(Object.keys(idx.sections||{}).map(a=>(a.match(/work-items\/(WI-\d+)/)||[])[1]).filter(Boolean))].sort();
  let rc = 0;
  if (!wis.length) { console.log("  ✓ (no indexed WIs to golden-test; tool present)"); process.exit(0); }
  const wi = wis[0];
  const a = run(`--wi ${wi}`), b = run(`--wi ${wi}`);
  if (a === b) console.log(`  ✓ idempotent: --wi ${wi} byte-identical run-twice (AC1)`); else { console.log("  ✗ NOT idempotent"); rc=1; }
  // ≤2K tokens: the tool caps rendered output at 6000 chars (≤2K tokens even for
  // token-dense paths). Probe a broad surface that would otherwise overflow.
  const broad = run(`--surface a`);
  if (broad.length <= 6000) console.log(`  ✓ bounded: broad query ${broad.length} chars ≤ 6000 (≤2K tokens, AC1)`); else { console.log(`  ✗ output ${broad.length} chars > 6000 (cap leak)`); rc=1; }
  // --json mode also bounded
  const j = run(`--surface a --json`);
  if (j.length <= 6000) console.log(`  ✓ --json bounded (${j.length} chars)`); else { console.log(`  ✗ --json ${j.length} chars > 6000`); rc=1; }
  process.exit(rc);
  ' && pass "query tool idempotent + ≤2K-token bounded" || fail "query tool idempotency/bound broken"
else
  fail "cannot golden-test (.svc/spec-index.json or tool missing)"
fi

# ---- B. AC2: no skill/reference instructs a RAW full Read of the index ------
node --input-type=module -e '
import { readFileSync, readdirSync } from "node:fs";
function walk(dir, out=[]) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of es) {
    const p = dir + "/" + e.name;
    if (e.isDirectory()) { if (!/(^|\/)(node_modules|\.git|\.worktrees)$/.test(p)) walk(p, out); }
    // SKILL.md anywhere; .md under references/_shared/rules; AND root-level
    // instruction files (CLAUDE.md, GEMINI.md, KIMI.md, AGENTS.md, DOCTRINE.md,
    // …) where context-spine instructions also live (Gemini G6 #2).
    else if (e.name === "SKILL.md" || (/\.md$/.test(e.name) && (dir === "." || /\/(references|_shared|rules)\//.test(p)))) out.push(p);
  }
  return out;
}
const files = walk(".");
const ALLOW = /query-spec-index|build-spec-index/;            // the tools that legitimately handle the index
// The anti-pattern: an instruction whose read action TARGETS the index itself
// (loads all 692KB). Covers host read tools (Read/read_file/view_file — G6 #1),
// shell (cat/less/head/tail — wide gap for $REPO_ROOT prefixes, G6 #3), and code
// (sync+async readFile, open — G6 #6). Order Read→path so "manual Read [of docs]
// if index missing" (path-before-Read) does not false-positive.
const RAW = [
  /\b(?:Read|read_file|view_file|open_file)\b[^\n]{0,20}spec-index\.json/i,
  /\b(?:cat|less|head|tail|bat)\b[^\n]{0,30}spec-index\.json/i,
  /\b(?:fs\.)?readFile(?:Sync)?\([^)]*spec-index\.json/i,
  /\bopen\([^)]*spec-index\.json/i,
];
const offenders = [];
for (const f of files) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  for (const line of t.split("\n")) {
    if (!/spec-index\.json/.test(line)) continue;
    if (ALLOW.test(line)) continue;
    if (RAW.some((re) => re.test(line))) offenders.push(`${f.replace("./","")}: ${line.trim().slice(0,80)}`);
  }
}
if (offenders.length) { console.log("  ✗ raw full-Read of the index instructed (use query-spec-index.mjs):\n      " + offenders.join("\n      ")); process.exit(1); }
console.log("  ✓ no skill/reference instructs a raw full Read of the index (all routed through the query tool)");
' && pass "no raw full-read of the index (AC2)" || fail "a skill/reference instructs raw-reading the index (AC2)"

echo "spec-index query tool: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
