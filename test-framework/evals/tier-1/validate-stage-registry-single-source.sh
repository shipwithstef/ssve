#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROOT="$ROOT" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.env.ROOT;
const mod=await import(pathToFileURL(path.join(root,'scripts/lib/stage-registry.mjs')));
const source=JSON.parse(fs.readFileSync(path.join(root,'references/stage-registry.json'),'utf8'));
const valid=mod.validateStageRegistry(source);
if(valid.stages.length!==source.stages.length||valid.essential.length===0) throw new Error('valid registry projection failed');
const mutations=[
  {...source,stages:[]},
  {...source,stages:[...source.stages,{...source.stages[0]}]},
  {...source,stages:source.stages.map((s,i)=>i? s:{...s,class:'Essential'})},
  {...source,story_type_profiles:{...source.story_type_profiles,broken:['not-a-stage']}},
];
for(const mutation of mutations){let rejected=false;try{mod.validateStageRegistry(mutation)}catch{rejected=true}if(!rejected)throw new Error('malformed registry accepted')}
for(const consumer of ['scripts/audit-story-receipts.mjs','scripts/stage-activation.mjs','scripts/task-graph.mjs']){
  const text=fs.readFileSync(path.join(root,consumer),'utf8');
  if(!text.includes('lib/stage-registry.mjs')) throw new Error(`${consumer} does not consume shared stage registry`);
}
NODE
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/scripts/lib" "$TMP/references" "$TMP/.svc" "$TMP/hooks/lib"
cp "$ROOT/scripts/task-graph.mjs" "$ROOT/scripts/state-io.mjs" "$TMP/scripts/"
# WI-562: state-io imports the shared liveness lib — copy its dependency chain.
cp "$ROOT/hooks/lib/process-liveness.mjs" "$TMP/hooks/lib/"
cp "$ROOT/scripts/lib/stage-registry.mjs" "$TMP/scripts/lib/"
cp "$ROOT/references/stage-registry.json" "$TMP/references/"
printf '%s\n' '{"wi":"WI-T","lane":"framework","status":"pending","tasks":[{"id":1,"subject":"fixture","status":"pending","metadata":{"skill":"improve-framework"}}]}' > "$TMP/.svc/lane-tasks-WI-T.json"
(cd "$TMP" && node scripts/task-graph.mjs validate .svc/lane-tasks-WI-T.json >/dev/null)
grep -q 'stage-registry.mjs' "$ROOT/scripts/kimi-e2e-test.mjs"
grep -q 'stage-registry.mjs' "$ROOT/scripts/scenario-runner.mjs"
echo 'PASS: stage registry validation is single-sourced and reduced-copy consumers remain executable'
