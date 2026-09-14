#!/usr/bin/env bash
# Tier 1: intra-changeset parallel task-graph partition fence (WI-388 core).
#
# The single disjoint-file validator is the difference between "fenced" and
# "vibes" for parallel mutating task execution. This proves the partition
# ESCALATES TO SEQUENTIAL on any file overlap (AC1), maps dependencies onto stage
# order (AC2), is FAIL-CLOSED on cycles/unknown deps, and reuses the shared
# closed-loop disjoint primitive. Hermetic; no network/LLM.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
echo "=== Tier 1: Task-Graph Parallel Partition fence (WI-388) ==="

P="scripts/partition-task-graph.mjs"; LIB="scripts/lib/disjoint-scopes.mjs"
[ -s "$P" ] && pass "partitioner present" || fail "partitioner missing"
[ -s "$LIB" ] && pass "shared disjoint-scopes lib present" || fail "shared lib missing"
node --check "$P" 2>/dev/null && pass "partitioner parses" || fail "partitioner syntax error"
node --check "$LIB" 2>/dev/null && pass "shared lib parses" || fail "shared lib syntax error"
node -e 'JSON.parse(require("fs").readFileSync("schemas/task-node-result.schema.json","utf8"))' 2>/dev/null && pass "task-node-result schema valid JSON (AC4)" || fail "schema invalid"
[ -s "references/task-graph-parallel-exec.md" ] && pass "protocol present" || fail "protocol missing"

# ---- AC1 + AC2 + fail-closed (pure) -----------------------------------------
node --input-type=module -e '
import { partitionTaskGraph } from "./scripts/partition-task-graph.mjs";
let rc=0; const ok=(c,m)=>{if(!c){console.log("  ✗ "+m);rc=1;}};
let r=partitionTaskGraph([{id:"a",files:["src/a.ts"]},{id:"b",files:["src/b.ts"]}]);
ok(r.ok&&r.waves.length===1&&r.waves[0].parallel===true,"2 disjoint independent tasks → 1 PARALLEL wave");
r=partitionTaskGraph([{id:"a",files:["src/x.ts"]},{id:"b",files:["src/x.ts"]}]);
ok(r.ok&&r.waves[0].parallel===false&&r.waves[0].escalated_to_sequential===true,"AC1: file overlap → ESCALATE-TO-SEQUENTIAL");
r=partitionTaskGraph([{id:"a",files:["src/auth/"]},{id:"b",files:["src/auth/login.ts"]}]);
ok(r.waves[0].escalated_to_sequential===true,"AC1: dir-parent overlap → escalate (shared hardened primitive)");
r=partitionTaskGraph([{id:"a",files:["a.ts"]},{id:"b",files:["b.ts"],deps:["a"]}]);
ok(r.ok&&r.waves.length===2&&r.waves[0].tasks[0]==="a"&&r.waves[1].tasks[0]==="b","AC2: dependency → pipeline STAGE ORDER (not parallel across the edge)");
r=partitionTaskGraph([{id:"a",deps:["b"]},{id:"b",deps:["a"]}]);
ok(!r.ok&&/cycle/.test(r.reason),"cycle → fail-closed (REFUSE)");
r=partitionTaskGraph([{id:"a",deps:["ghost"]}]);
ok(!r.ok&&/unknown/.test(r.reason),"unknown dependency → fail-closed");
r=partitionTaskGraph([]);
ok(!r.ok,"empty graph → fail-closed");
// determinism
ok(JSON.stringify(partitionTaskGraph([{id:"a",files:["x"]},{id:"b",files:["y"]}]))===JSON.stringify(partitionTaskGraph([{id:"a",files:["x"]},{id:"b",files:["y"]}])),"deterministic");
process.exit(rc);
' && pass "AC1 escalate-on-overlap + AC2 deps→stage-order + fail-closed (cycle/unknown/empty) + deterministic" || fail "partition logic wrong"

# ---- CLI: a real graph file -------------------------------------------------
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
printf '{"tasks":[{"id":"t1","files":["src/a.ts"]},{"id":"t2","files":["src/b.ts"]}]}' > "$TMP/g.json"
node "$P" --graph "$TMP/g.json" >/dev/null 2>&1 && pass "CLI: disjoint graph → exit 0" || fail "CLI rejected a valid disjoint graph"
printf '{"tasks":[{"id":"t1","deps":["t2"]},{"id":"t2","deps":["t1"]}]}' > "$TMP/cycle.json"
node "$P" --graph "$TMP/cycle.json" >/dev/null 2>&1 && fail "CLI: cycle passed (must fail-closed)" || pass "CLI: cyclic graph → non-zero (fail-closed)"

# ---- the disjoint primitive is SHARED (WI-387 fence re-exports it) -----------
node -e 'const s=require("fs").readFileSync("scripts/discovery-wave-fence.mjs","utf8");process.exit(/lib\/disjoint-scopes\.mjs/.test(s)?0:1)' && pass "WI-387 discovery fence reuses the shared scripts/lib/disjoint-scopes.mjs (DRY, one audit point)" || fail "discovery fence not re-pointed to the shared lib"

echo "task-graph-partition: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
