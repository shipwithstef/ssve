#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ROOT="$ROOT" TMP="$TMP" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.ROOT;
const tmp = process.env.TMP;
const chainModule = await import(pathToFileURL(path.join(root, 'scripts/lib/mandatory-delivery-chain.mjs')));
const compiler = await import(pathToFileURL(path.join(root, 'scripts/compile-delivery-graph.mjs')));
const expected = [
  'plan-changeset', 'review-plan', 'execute-changeset', 'review-gate',
  'review-exec', 'audit-implementation', 'land-changeset', 'verify-promotion',
];
if (JSON.stringify(chainModule.MANDATORY_DELIVERY_CHAIN) !== JSON.stringify(expected)) {
  throw new Error('shared mandatory chain differs from the contract');
}

const lanes = ['greenfield', 'brownfield-conversion', 'brownfield-feature', 'bugfix', 'drift', 'refactor', 'framework'];
for (const lane of lanes) {
  for (const riskFlags of [[], ['browser-visible']]) {
    const graph = compiler.compileDeliveryGraph({
      wi: `WI-${900 + lanes.indexOf(lane)}`,
      lane,
      change_type: lane === 'framework' ? 'framework' : 'feature',
      user_intent: `exercise ${lane}`,
      risk_flags: riskFlags,
      platform_contracts: [],
    });
    const skills = graph.tasks.map((task) => task.metadata.skill);
    const result = chainModule.validateMandatoryDeliveryChain(skills);
    if (!result.pass) throw new Error(`${lane}/${riskFlags.join(',') || 'no-risk'}: ${result.errors.join('; ')}`);
    if (riskFlags.length) {
      const baseline = graph.tasks.findIndex((task) => task.metadata.skill === 'track-visuals' && task.metadata.mode === 'baseline');
      const execute = graph.tasks.find((task) => task.metadata.skill === 'execute-changeset');
      const diff = execute?.metadata?.required_process_steps?.some((step) => step.skill === 'track-visuals' && step.mode === 'diff' && step.before === 'review-gate');
      if (!(baseline < result.positions[0] && diff)) throw new Error(`${lane}: visual baseline/diff do not bind the correct mandatory boundary`);
    }
    fs.writeFileSync(path.join(tmp, `${lane}${riskFlags.length ? '-browser' : ''}.json`), JSON.stringify(graph));
  }
}

for (const [name, mutate] of Object.entries({
  omitted: (skills) => skills.filter((skill) => skill !== 'review-plan'),
  duplicated: (skills) => [...skills.slice(0, 2), 'review-exec', ...skills.slice(2)],
  substituted: (skills) => skills.map((skill) => skill === 'review-exec' ? 'review-gate' : skill),
  reordered: (skills) => skills.map((skill, index, all) => index === 1 ? all[2] : index === 2 ? all[1] : skill),
})) {
  const mutated = mutate([...expected]);
  const result = chainModule.validateMandatoryDeliveryChain(mutated);
  if (result.pass) throw new Error(`${name} mutation passed`);
}
NODE

for graph in "$TMP"/*.json; do
  node "$ROOT/scripts/validate-task-graph-lane.mjs" "$graph" >/dev/null
done

node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import fs from 'node:fs';
const [root, tmp] = process.argv.slice(2);
const source = JSON.parse(fs.readFileSync(`${tmp}/framework.json`, 'utf8'));
const cases = {
  omitted: (tasks) => tasks.filter((task) => task.metadata.skill !== 'review-plan'),
  duplicated: (tasks) => [...tasks, structuredClone(tasks.find((task) => task.metadata.skill === 'review-exec'))],
  substituted: (tasks) => tasks.map((task) => task.metadata.skill === 'review-exec' ? {...task, metadata:{...task.metadata, skill:'review-gate'}} : task),
  reordered: (tasks) => {
    const copy=structuredClone(tasks); const a=copy.findIndex((task)=>task.metadata.skill==='review-plan'); const b=copy.findIndex((task)=>task.metadata.skill==='execute-changeset'); [copy[a],copy[b]]=[copy[b],copy[a]]; return copy;
  },
};
for (const [name, mutate] of Object.entries(cases)) {
  const graph={...source,tasks:mutate(structuredClone(source.tasks))};
  fs.writeFileSync(`${tmp}/negative-${name}.json`,JSON.stringify(graph));
}
NODE

for graph in "$TMP"/negative-*.json; do
  if node "$ROOT/scripts/validate-task-graph-lane.mjs" "$graph" >/dev/null 2>&1; then
    echo "FAIL: validator accepted $(basename "$graph")" >&2
    exit 1
  fi
done

printf '%s\n' '{"tasks":[{"id":1,"subject":"execute","status":"pending","blocked_by":[],"metadata":{"skill":"execute-changeset","required_process_steps":[{"skill":"track-visuals","mode":"diff","before":"review-gate","evidence_required":true}]}},{"id":2,"subject":"review","status":"pending","blocked_by":[1],"metadata":{"skill":"review-gate"}}]}' > "$TMP/runtime.json"
node "$ROOT/scripts/task-graph.mjs" load-skill "$TMP/runtime.json" 1 execute-changeset >/dev/null
if node "$ROOT/scripts/task-graph.mjs" set-status "$TMP/runtime.json" 1 completed >/dev/null 2>&1; then echo "FAIL: execute completed without visual process evidence" >&2; exit 1; fi
printf 'visual diff receipt\n' > "$TMP/visual.log"
node "$ROOT/scripts/task-graph.mjs" record-process "$TMP/runtime.json" 1 track-visuals --mode diff --evidence command_output:"$TMP/visual.log" >/dev/null
node "$ROOT/scripts/task-graph.mjs" set-status "$TMP/runtime.json" 1 completed >/dev/null
node "$ROOT/scripts/task-graph.mjs" load-skill "$TMP/runtime.json" 2 review-gate >/dev/null
if node "$ROOT/scripts/task-graph.mjs" set-status "$TMP/runtime.json" 2 completed --skip-reason arbitrary >/dev/null 2>&1; then echo "FAIL: mandatory task accepted arbitrary skip" >&2; exit 1; fi
if node "$ROOT/scripts/task-graph.mjs" set-status "$TMP/runtime.json" 2 skipped >/dev/null 2>&1; then echo "FAIL: mandatory task accepted direct skipped status" >&2; exit 1; fi

echo "PASS: mandatory delivery chain is single-sourced, ordered at runtime, and process evidence is digest-bound"
