#!/usr/bin/env bash
# WI-556 T5 (v1): skill-coverage compile/verify library + checker presence-gate.
# Hermetic: no network, no provider, no paid calls. Budget: self-enforced <=15s.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
START=$(date +%s)
fail() { echo "FAIL: $1" >&2; exit 1; }

# S-unit: lifecycle-stable canonical digest (volatile fields excluded)
node --input-type=module -e 'import("'$ROOT'/scripts/lib/skill-coverage.mjs").then(async(m)=>{
 const fs=await import("node:fs");
 const g=JSON.parse(fs.readFileSync("'$ROOT'/.svc/lane-tasks-WI-556.json","utf8"));
 const d1=m.graphDigestFromRaw(g);
 const g2=JSON.parse(JSON.stringify(g));
 for(const t of g2.tasks){t.status="completed";t.completed_at="X";t.skill_receipt={p:1};}
 if(d1!==m.graphDigestFromRaw(g2)) process.exit(3);
})' || fail "lifecycle-stable digest"

# S-matrix: happy / tampered-child-digest / pruned-inventory / unregistered-NA / slotSha-with-phase
node --input-type=module -e 'import("'$ROOT'/scripts/lib/skill-coverage.mjs").then(async(m)=>{
 const fs=await import("node:fs");
 const g=JSON.parse(fs.readFileSync("'$ROOT'/.svc/lane-tasks-WI-556.json","utf8"));
 const c=m.compileCoverage({graph:g,wi:"WI-556"});
 if(c.required.length!==5) process.exit(11);
 const T="a".repeat(40);
 const mkReceipt=(t)=>({receipt_type:t,wi:"WI-556"});
 const fake=Object.fromEntries(c.required.flatMap(e=>{ const base="slot::"+e.producer_receipt_type+"::WI-556::"+T; return [[base,mkReceipt(e.producer_receipt_type)],[base+"::P3",mkReceipt(e.producer_receipt_type)]]; }));
 const mk=()=>({...c,target_sha:T,tree_hash:"b".repeat(40),graph_source:"commit_tree",counts:{required:5,pass:5,authorized_na:0},verdict:"pass",generated_at:"2026-08-22T00:00:00Z"});
 const r1=mk(); for(const e of r1.required){const ph=e.skill==="execute-changeset"?"::P3":""; e.receipt_slot="slot::"+e.producer_receipt_type+"::WI-556::"+T+ph; e.receipt_sha256=m.sha256Hex(m.stableStringify(fake["slot::"+e.producer_receipt_type+"::WI-556::"+T]));}
 const v1=m.verifyCoverage({receipt:r1,treeGraphRaw:JSON.stringify(g),resolveChild:s=>fake[s]||null});
 if(v1.verdict!=="pass") { console.error(v1.reasons); process.exit(12); }
 const r2=mk(); Object.assign(r2,r1); r2.required[0].receipt_sha256="f".repeat(64);
 if(m.verifyCoverage({receipt:r2,treeGraphRaw:JSON.stringify(g),resolveChild:s=>fake[s]||null}).verdict!=="no") process.exit(13);
 const r3=mk(); Object.assign(r3,r1); r3.required=r3.required.slice(0,3); r3.counts={required:3,pass:3,authorized_na:0};
 if(m.verifyCoverage({receipt:r3,treeGraphRaw:JSON.stringify(g),resolveChild:s=>fake[s]||null}).verdict!=="no") process.exit(14);
 const r4=mk(); Object.assign(r4,r1); r4.required[0].status="authorized_na"; r4.counts={required:5,pass:4,authorized_na:1};
 if(m.verifyCoverage({receipt:r4,treeGraphRaw:JSON.stringify(g),resolveChild:s=>fake[s]||null}).verdict!=="no") process.exit(15);
 if(m.verifyCoverage({receipt:r1,treeGraphRaw:null,resolveChild:()=>null}).verdict!=="unknown") process.exit(16);
})' || fail "verify matrix"

# S11-unit: slot bound to a different SHA than coverage target fails closed
node --input-type=module -e 'import("'$ROOT'/scripts/lib/skill-coverage.mjs").then(async(m)=>{
 const fs=await import("node:fs");
 const g=JSON.parse(fs.readFileSync("'$ROOT'/.svc/lane-tasks-WI-556.json","utf8"));
 const c=m.compileCoverage({graph:g,wi:"WI-556"});
 const T="a".repeat(40); const OTHER="c".repeat(40);
 const fake=Object.fromEntries(c.required.map(e=>["slot::"+e.producer_receipt_type+"::WI-556::"+OTHER,{receipt_type:e.producer_receipt_type,wi:"WI-556"}]));
 const r={...c,target_sha:T,tree_hash:"b".repeat(40),graph_source:"candidate_tree_fetched",counts:{required:5,pass:5,authorized_na:0},verdict:"pass",generated_at:"2026-08-22T00:00:00Z"};
 for(const e of r.required){e.receipt_slot="slot::"+e.producer_receipt_type+"::WI-556::"+OTHER; e.receipt_sha256=m.sha256Hex(m.stableStringify(fake[e.receipt_slot]));}
 const v=m.verifyCoverage({receipt:r,treeGraphRaw:JSON.stringify(g),resolveChild:s=>fake[s]||null});
 if(v.verdict!=="no") process.exit(21);
 if(!v.reasons.some(x=>x.includes("different SHA"))) process.exit(22);
})' || fail "wrong-sha binding"

# S-presence-gate: checker --coverage on a SHA without any coverage receipt is
# clean (no table rows, exit reflects chain completeness only) and fast.
OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
SINCE=$(date +%s%N)
node "$ROOT/scripts/check-chain-receipts.mjs" --sha "$(git -C "$ROOT" rev-parse HEAD)" --coverage >"$OUT" 2>&1 || true
if grep -q "^coverage target" "$OUT"; then fail "presence-gate leaked rows on non-coverage SHA"; fi
ELAPSED_MS=$(( ($(date +%s%N)-SINCE)/1000000 ))
[ "$ELAPSED_MS" -lt 5000 ] || fail "presence-gate probe too slow (${ELAPSED_MS}ms)"

# Budget gate: full corpus scenario set is v1-scoped; deferred scenarios
# (S5 concurrent CAS race, S12 network fetch-fail) are documented in the
# manifest and tracked for T5-v2. Hard wall clock enforced here.
if [ $(date +%s) -gt $((START + 15)) ]; then fail "validator exceeded 15s budget"; fi
echo "validate-skill-coverage: PASS"
