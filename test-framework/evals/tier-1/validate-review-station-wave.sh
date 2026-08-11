#!/usr/bin/env bash
# Tier 1: post-exec parallel review station — mechanical merge gate (WI-382).
#
# Proves the barrier-merge (scripts/review-station-merge.mjs) is MECHANICAL and
# DETERMINISTIC — dedup-by-file:line, keep-highest-severity, attribute-to-lens,
# order-stable (AC3); the keyed re-review map names the ORIGINATING lens and
# always keys NEVER_GATE locations (AC1); and per-lens iteration caps are
# INDEPENDENT, never one merged counter (AC2). Hermetic; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "=== Tier 1: Post-exec Parallel Review Station merge (WI-382) ==="

MERGE="scripts/review-station-merge.mjs"
SCHEMA="schemas/review-lens-finding.schema.json"
[ -s "$MERGE" ] && pass "merge script present" || fail "merge script missing"
[ -s "$SCHEMA" ] && pass "lens-finding schema present" || fail "schema missing"
node --check "$MERGE" 2>/dev/null && pass "merge script parses" || fail "merge script syntax error"
node -e 'JSON.parse(require("fs").readFileSync("schemas/review-lens-finding.schema.json","utf8"))' 2>/dev/null && pass "schema is valid JSON" || fail "schema not valid JSON"

# ---- AC3 + AC1 + AC2: in-process golden over a synthetic 3-lens set ----------
node --input-type=module -e '
import { mergeLensFindings, keyedReReviewMap, perLensCaps } from "./scripts/review-station-merge.mjs";
const lenses=[
  {lens_id:"codex-adversarial", findings:[{file:"a.mjs",line:10,severity:"MEDIUM",finding:"m"},{file:"b.mjs",line:5,severity:"HIGH",finding:"h"}]},
  {lens_id:"audit-security", never_gate:true, findings:[{file:"a.mjs",line:10,severity:"CRITICAL",finding:"crit"},{file:"c.mjs",line:1,severity:"LOW",finding:"sec-low"}]},
  {lens_id:"audit-testing", findings:[{file:"b.mjs",line:5,severity:"INFO",finding:"dup"}]},
];
const m1=mergeLensFindings(lenses), m2=mergeLensFindings(lenses);
let rc=0;
const a=m1.find(e=>e.file==="a.mjs"&&e.line==="10");
if(a.severity!=="CRITICAL"){console.log("  ✗ collision did not keep highest");rc=1;}
if(a.originating_lens!=="audit-security"){console.log("  ✗ wrong originating lens");rc=1;}
if(JSON.stringify(a.contributing_lenses)!==JSON.stringify(["audit-security","codex-adversarial"])){console.log("  ✗ attribution wrong");rc=1;}
const b=m1.find(e=>e.file==="b.mjs"&&e.line==="5");
if(b.severity!=="HIGH"){console.log("  ✗ HIGH downgraded by later INFO dup");rc=1;}
if(JSON.stringify(m1)!==JSON.stringify(m2)){console.log("  ✗ not deterministic");rc=1;}
if(m1[0].severity!=="CRITICAL"){console.log("  ✗ order not severity-desc");rc=1;}
const km=keyedReReviewMap(m1);
if(!(km["a.mjs:10"]==="audit-security"&&km["b.mjs:5"]==="codex-adversarial"&&km["c.mjs:1"]==="audit-security")){console.log("  ✗ keyed re-review map wrong (NEVER_GATE low-sev must key)");rc=1;}
const caps=perLensCaps(lenses);
if(!(Object.keys(caps).length===3&&caps["audit-testing"].cap===3&&caps["audit-security"].cap===3)){console.log("  ✗ per-lens caps not independent");rc=1;}
process.exit(rc);
' && pass "merge: dedup+keep-highest+attribute (AC3), keyed-originating-lens incl NEVER_GATE (AC1), independent per-lens caps (AC2), deterministic" || fail "merge golden failed"

# ---- CLI: stdin JSON -> merged ledger JSON -----------------------------------
CLIOUT=$(printf '[{"lens_id":"x","findings":[{"file":"f.ts","line":3,"severity":"HIGH","finding":"y"}]}]' | node "$MERGE" 2>/dev/null)
if echo "$CLIOUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.exit(j.merged&&j.merged[0]&&j.merged[0].severity==="HIGH"&&j.keyed_rereview["f.ts:3"]==="x"?0:1)})'; then
  pass "CLI stdin → merged ledger + keyed map"
else fail "CLI merge invocation broken"; fi

# ---- malformed input → fail-closed (non-zero), never a silent empty merge ----
echo 'not json' | node "$MERGE" >/dev/null 2>&1 && fail "malformed input silently succeeded (must fail-closed)" || pass "malformed input → non-zero exit (fail-closed, no silent empty ledger)"

# ---- Gemini G6 #1: HALLUCINATED valid JSON (schema-violating) → fail-CLOSED ----
echo '{"summary":"all clear, no issues"}' | node "$MERGE" >/dev/null 2>&1 && fail "G6#1: hallucinated valid-JSON object coasted as a clean ledger (fail-OPEN!)" || pass "G6#1: schema-violating valid JSON → non-zero (fail-closed, not silent-clean)"
echo '[{"findings":[{"file":"a","line":1,"severity":"HIGH","finding":"x"}]}]' | node "$MERGE" >/dev/null 2>&1 && fail "G6#1: lens missing lens_id accepted" || pass "G6#1: lens missing lens_id → fail-closed"

# ---- Gemini G6 #2 + #3: deterministic, order-independent tie resolution -------
node --input-type=module -e '
import { mergeLensFindings, keyedReReviewMap } from "./scripts/review-station-merge.mjs";
// same loc, same HIGH severity: a never_gate (security) lens and a generic lens
const ng={lens_id:"audit-security",never_gate:true,findings:[{file:"auth.ts",line:42,severity:"HIGH",finding:"sec"}]};
const gen={lens_id:"codex-adversarial",findings:[{file:"auth.ts",line:42,severity:"HIGH",finding:"adv"}]};
let rc=0;
for(const order of [[gen,ng],[ng,gen]]){            // BOTH arrival orders
  const m=mergeLensFindings(order);
  const km=keyedReReviewMap(m);
  if(km["auth.ts:42"]!=="audit-security"){console.log("  ✗ G6#2: never_gate did NOT win the tie (order "+order.map(o=>o.lens_id)+"): "+km["auth.ts:42"]);rc=1;}
}
// order-independence: shuffle a 3-lens set, ledger must be byte-identical
const A={lens_id:"z-lens",findings:[{file:"f",line:1,severity:"MEDIUM",finding:"a"}]};
const B={lens_id:"a-lens",findings:[{file:"f",line:1,severity:"MEDIUM",finding:"b"}]};
const m1=JSON.stringify(mergeLensFindings([A,B])), m2=JSON.stringify(mergeLensFindings([B,A]));
if(m1!==m2){console.log("  ✗ G6#3: ledger flapped on input order");rc=1;}
// the alphabetically-smaller lens_id must own the tie deterministically
const own=JSON.parse(m1)[0].originating_lens;
if(own!=="a-lens"){console.log("  ✗ G6#3: tie winner not lexicographic ("+own+")");rc=1;}
if(rc===0) console.log("  ✓ tie: never_gate wins regardless of order (AC1); equal-status tie → lexicographic lens_id; order-independent");
process.exit(rc);
' && pass "G6#2/#3: never_gate wins ties + order-independent deterministic merge" || fail "G6#2/#3: tie resolution non-deterministic or NEVER_GATE dropped"

echo "review-station-wave: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
