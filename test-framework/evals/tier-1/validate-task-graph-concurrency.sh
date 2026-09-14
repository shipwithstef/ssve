#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for iteration in $(seq 1 25); do
  graph="$TMP/graph-$iteration.json"
  node - "$graph" <<'NODE'
const fs=require('fs');
fs.writeFileSync(process.argv[2],JSON.stringify({wi:'WI-ATOMIC',lane:'framework',status:'pending',tasks:[
  {id:1,subject:'one',status:'pending',blocked_by:[],metadata:{skill:'one'},skill_receipt:{skill:'one',loaded_at:new Date().toISOString(),loaded_via:'fixture'}},
  {id:2,subject:'two',status:'pending',blocked_by:[],metadata:{skill:'two'},skill_receipt:{skill:'two',loaded_at:new Date().toISOString(),loaded_via:'fixture'}}
]}));
NODE
  node "$ROOT/scripts/task-graph.mjs" set-status "$graph" 1 completed >/dev/null 2>&1 & first=$!
  node "$ROOT/scripts/task-graph.mjs" set-status "$graph" 2 completed >/dev/null 2>&1 & second=$!
  if wait "$first"; then first_code=0; else first_code=$?; fi
  if wait "$second"; then second_code=0; else second_code=$?; fi
  if [[ "$first_code" -ne 0 ]]; then
    node "$ROOT/scripts/task-graph.mjs" set-status "$graph" 1 completed >/dev/null
  fi
  if [[ "$second_code" -ne 0 ]]; then
    node "$ROOT/scripts/task-graph.mjs" set-status "$graph" 2 completed >/dev/null
  fi
  node - "$graph" <<'NODE'
const graph=require(process.argv[2]);
if(graph.tasks.some((task)=>task.status!=='completed')) throw new Error('concurrent status update was lost');
NODE
done

error_graph="$TMP/error.json"
node - "$error_graph" <<'NODE'
require('fs').writeFileSync(process.argv[2],JSON.stringify({wi:'WI-ATOMIC',lane:'framework',status:'pending',tasks:[{id:1,subject:'one',status:'pending',blocked_by:[],metadata:{skill:'one'}}]}));
NODE
if node "$ROOT/scripts/task-graph.mjs" set-status "$error_graph" 1 completed >/dev/null 2>&1; then
  echo 'invalid completion unexpectedly succeeded' >&2; exit 1
fi
node "$ROOT/scripts/task-graph.mjs" load-skill "$error_graph" 1 one >/dev/null
node "$ROOT/scripts/task-graph.mjs" set-status "$error_graph" 1 completed >/dev/null

node - "$ROOT/scripts/task-graph.mjs" <<'NODE'
const source=require('fs').readFileSync(process.argv[2],'utf8');
for(const command of ['set-status','load-skill','record-phase']) {
  const start=source.indexOf(`if (command === "${command}")`);
  const end=source.indexOf('\nif (command === ',start+1);
  const block=source.slice(start,end<0?source.length:end);
  if(!block.includes('updateJsonAtomic(filePath')) throw new Error(`${command} is not atomic`);
  const closureStart=block.indexOf('updateJsonAtomic(filePath');
  const closureEnd=block.indexOf('\n    });',closureStart);
  const closure=block.slice(closureStart,closureEnd);
  if(closure.includes('process.exit(')) throw new Error(`${command} exits inside atomic closure`);
}
NODE

echo 'PASS: concurrent task-graph mutations preserve updates and release locks after errors'
