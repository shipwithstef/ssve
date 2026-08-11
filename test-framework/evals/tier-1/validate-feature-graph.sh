#!/usr/bin/env bash
# Tier 1: feature graph — relational product-artifact store (WI-390).
#
# Proves the graph stores POINTERS not prose (AC1 — a prose-copy AC node is
# REJECTED), an orphan @AC tag is an ERROR (AC2), the coverage matrix is a
# RENDERED view with --check drift detection (AC3), and the builder is
# FAIL-CLOSED (a spec with no AC table → non-zero, never an empty clean graph).
# Hermetic; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
echo "=== Tier 1: Feature Graph (WI-390) ==="

BFG="scripts/build-feature-graph.mjs"; RCM="scripts/render-coverage-matrix.mjs"
SCH="schemas/feature-graph.schema.json"
[ -s "$BFG" ] && pass "build-feature-graph present" || fail "builder missing"
[ -s "$RCM" ] && pass "render-coverage-matrix present" || fail "renderer missing"
node --check "$BFG" 2>/dev/null && pass "builder parses" || fail "builder syntax error"
node --check "$RCM" 2>/dev/null && pass "renderer parses" || fail "renderer syntax error"
node -e 'JSON.parse(require("fs").readFileSync("schemas/feature-graph.schema.json","utf8"))' 2>/dev/null && pass "schema valid JSON" || fail "schema not valid JSON"

# ---- AC1 + AC2 (pure): pointer-not-prose + orphan-tag ------------------------
node --input-type=module -e '
import { buildGraph, validateGraph } from "./scripts/build-feature-graph.mjs";
const spec={path:"f.md",text:"| AC | Description | QA | E2E | Test |\n|--|--|--|--|--|\n| DISC-01 | x | Y | Y | unit |\n| DISC-02 | y | Y | | e2e |\n"};
const journeys=[{path:"J1.feature.md",text:"@DISC-01 @DISC-99"}];
const g=buildGraph(spec,journeys,[]); let rc=0;
const acs=g.nodes.filter(n=>n.type==="ac");
if(!(acs.length===2 && /:\d+$/.test(acs[0].file_anchor) && !acs[0].description && !acs[0].text)){console.log("  ✗ AC nodes not pointer-only");rc=1;}
if(!(g.orphans.length===1 && g.orphans[0].tag==="DISC-99")){console.log("  ✗ orphan not detected");rc=1;}
if(!validateGraph(g).some(e=>/DISC-99/.test(e))){console.log("  ✗ validate missed orphan (AC2)");rc=1;}
if(!validateGraph({nodes:[{id:"A-1",type:"ac",file_anchor:"x:1",description:"prose"}],orphans:[]}).some(e=>/prose copy/.test(e))){console.log("  ✗ prose-copy AC not rejected (AC1)");rc=1;}
// idempotent / deterministic build
if(JSON.stringify(buildGraph(spec,journeys,[]))!==JSON.stringify(g)){console.log("  ✗ build not deterministic");rc=1;}
process.exit(rc);
' && pass "AC1 pointer-not-prose + AC2 orphan-tag + deterministic build" || fail "graph invariants wrong"

# ---- fail-closed: no AC table → non-zero ------------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
printf '# spec with no AC table\nsome prose\n' > "$TMP/nospec.md"
node "$BFG" build --spec "$TMP/nospec.md" --out "$TMP/g.json" >/dev/null 2>&1 && fail "no-AC-table spec produced a graph (must fail-closed)" || pass "no AC table → non-zero exit (fail-closed, no empty clean graph)"

# ---- builder CLI roundtrip + orphan makes build fail ------------------------
mkdir -p "$TMP/feat" "$TMP/j"
printf '## ACs\n| AC | Description | QA | E2E | Test |\n|--|--|--|--|--|\n| DISC-01 | a | Y | Y | unit |\n' > "$TMP/feat/x.md"
printf 'Scenario one @DISC-01\n' > "$TMP/j/J1.feature.md"
node "$BFG" build --spec "$TMP/feat/x.md" --journeys "$TMP/j/*.md" --out "$TMP/g.json" >/dev/null 2>&1 && pass "build with all tags resolved → exit 0 + graph written" || fail "clean build failed"
node "$BFG" validate --graph "$TMP/g.json" >/dev/null 2>&1 && pass "validate clean graph → exit 0" || fail "validate rejected a clean graph"
printf 'Scenario two @DISC-99\n' > "$TMP/j/J2.feature.md"
node "$BFG" build --spec "$TMP/feat/x.md" --journeys "$TMP/j/*.md" --out "$TMP/g2.json" >/dev/null 2>&1 && fail "orphan @DISC-99 did NOT fail the build" || pass "orphan @AC tag fails the build (AC2 → tier-1 error)"

# ---- AC3: render-coverage-matrix --check drift detection --------------------
printf 'pre\n<!-- svc:generated:begin feature-coverage-matrix -->\nSTALE\n<!-- svc:generated:end feature-coverage-matrix -->\npost\n' > "$TMP/cov.md"
node "$RCM" --graph "$TMP/g.json" --target "$TMP/cov.md" --check >/dev/null 2>&1 && fail "stale matrix passed --check (drift not caught)" || pass "AC3: stale matrix → --check exits 1 (graph↔matrix drift caught)"
node "$RCM" --graph "$TMP/g.json" --target "$TMP/cov.md" --write >/dev/null 2>&1 && pass "--write rewrites the matrix block" || fail "--write failed"
node "$RCM" --graph "$TMP/g.json" --target "$TMP/cov.md" --check >/dev/null 2>&1 && pass "AC3: after --write, --check passes (rendered view matches graph)" || fail "matrix still drifts after write"
# rendered matrix carries the AC id but NOT the prose description (pointer discipline)
grep -q "DISC-01" "$TMP/cov.md" && ! grep -q "| a |" "$TMP/cov.md" && pass "rendered matrix carries AC id + status columns, not the prose description" || fail "matrix leaked prose"

# ---- Gemini G6 regression: tag/emphasis/prose-leak/CRLF/determinism ----------
node --input-type=module -e '
import { buildGraph, validateGraph } from "./scripts/build-feature-graph.mjs";
const spec={path:"f.md",text:"| AC | Description | QA | E2E | Test |\n|--|--|--|--|--|\n| DISC-01 | a | Y | Y | u |\n| **DISC-02** | b | Y | | e |\n"};
const g=buildGraph(spec,[{path:"J1.md",text:"@DISC-01 @DISC-011"}],[{path:"e2e/t.ts",text:"@AC-DISC-02"}]);
let rc=0; const acs=g.nodes.filter(n=>n.type==="ac").map(n=>n.id);
if(!acs.includes("DISC-02")){console.log("  ✗ G6#2: bold **DISC-02** silently dropped (parser fail-open)");rc=1;}
if(!g.orphans.map(o=>o.tag).includes("DISC-011")){console.log("  ✗ G6#1: @DISC-011 falsely matched DISC-01 (no word boundary)");rc=1;}
if(!g.edges.some(e=>e.type==="test-covers-ac"&&e.to==="DISC-02")){console.log("  ✗ G6#1: @AC- test tag not resolved");rc=1;}
if(!validateGraph({nodes:[{id:"A-1",type:"ac",file_anchor:"x:1",summary:"prose"}],orphans:[]}).some(e=>/unapproved field/.test(e))){console.log("  ✗ G6#3: prose leaked via an unwhitelisted field");rc=1;}
process.exit(rc);
' && pass "G6 #1/#2/#3: @AC- test tags + word-boundary orphans + bold-cell parse + prose-leak whitelist" || fail "G6 tag/emphasis/prose-leak regression"

# G6 #4: CRLF in the matrix block must NOT false-fail --check
node "$BFG" build --spec "$TMP/feat/x.md" --journeys "$TMP/j/J1.feature.md" --out "$TMP/g3.json" >/dev/null 2>&1
node "$RCM" --graph "$TMP/g3.json" > "$TMP/m.txt" 2>/dev/null
{ printf 'pre\n<!-- svc:generated:begin feature-coverage-matrix -->\r\n'; sed 's/$/\r/' "$TMP/m.txt"; printf '\r\n<!-- svc:generated:end feature-coverage-matrix -->\npost\n'; } > "$TMP/covcrlf.md"
node "$RCM" --graph "$TMP/g3.json" --target "$TMP/covcrlf.md" --check >/dev/null 2>&1 && pass "G6#4: CRLF line endings in the matrix block → --check still passes (no false drift)" || fail "G6#4: CRLF false-failed the drift check"

echo "feature-graph: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
