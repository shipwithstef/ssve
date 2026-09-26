#!/usr/bin/env node
/** Functional regression fixtures; no installed hosts or live project state are used. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Create fixture-owned state and remove it after the test. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssve-functional-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
/** Write only fixture data, creating missing fixture parents. */
function put(dir, name, value) {
  const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return file;
}
/** Execute the production CLI with a bounded runtime and explicit fixture working directory. */
function cli(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd, env: { ...process.env, ...env }, encoding: "utf8", timeout: 10000,
  });
}
/** Assert successful machine-readable output. */
function json(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }

const script="scripts/tier3-coverage-plan.mjs";
/** Create the existing offline input schema, not a model evaluation. */
function inputs(t, count=35) {
  const dir=fixture(t); const evals={tiers:{"tier-2":{scenarios:Array.from({length:count},(_,i)=>({name:`scenario-${i}`,path:`cases/${i}`,skill_under_test:"demo"}))}}};
  const baseline={dimensions:["completeness","actionability","consistency"],max_judgments:200,estimated_tokens_per_judgment:100,default_min_score:7,skills:{demo:{consistency:8}}};
  const save=()=>{put(dir,"test-framework/evals/evals.json",evals);put(dir,"test-framework/evals/tier-3/skill-baselines.json",baseline);}; save();
  return {dir,evals,baseline,save};
}
/** A rejected plan must not look like successful JSON output. */
function refused(ctx) {ctx.save();const out=cli(script,["--json"],ctx.dir);assert.equal(out.status,1,out.stdout);assert.equal(out.stdout,"");assert.match(out.stderr,/ERROR:/);}
test("valid plans preserve dimensions, overrides, order, totals, and source bytes", (t)=>{
  const c=inputs(t); const file=path.join(c.dir,"test-framework/evals/evals.json");const before=fs.readFileSync(file);
  const plan=json(cli(script,["--json"],c.dir));assert.equal(plan.scenario_count,35);assert.equal(plan.judgments.length,105);assert.equal(plan.estimated_max_tokens,10500);
  assert.deepEqual(plan.dimensions,c.baseline.dimensions);assert.deepEqual(plan.judgments.slice(0,3).map(x=>x.min_score),[7,7,8]);
  assert.equal(plan.scenarios[0].path,"cases/0");assert.deepEqual(fs.readFileSync(file),before);
  delete c.baseline.dimensions;c.save();assert.equal(json(cli(script,["--json"],c.dir)).judgments.length,105);
});
test("missing and malformed numeric budgets cannot disable comparisons", (t)=>{
  for(const key of ["max_judgments","estimated_tokens_per_judgment"])for(const value of [undefined,null,0,-1,1.5,"200",Number.MAX_SAFE_INTEGER+1]){
    const c=inputs(t);c.baseline[key]=value;refused(c);
  }
});
test("empty or duplicate identities cannot inflate coverage", (t)=>{
  for(const mutate of [c=>c.baseline.dimensions.push("completeness"),c=>c.baseline.dimensions.push(" completeness "),c=>c.baseline.dimensions.push(""),c=>c.evals.tiers["tier-2"].scenarios[1].name="scenario-0",c=>c.evals.tiers["tier-2"].scenarios[1].name=" "]){const c=inputs(t);mutate(c);refused(c);}
});
test("the scenario floor, required dimensions, score range and cap remain enforced", (t)=>{
  const small=inputs(t,34);refused(small);
  for(const mutate of [c=>c.baseline.dimensions.pop(),c=>c.baseline.default_min_score=0,c=>c.baseline.default_min_score=11,c=>c.baseline.default_min_score=7.5,c=>c.baseline.max_judgments=104]){const c=inputs(t);mutate(c);refused(c);}
});
test("unsafe totals and malformed scenario collections fail before output", (t)=>{
  const c=inputs(t);c.baseline.estimated_tokens_per_judgment=Number.MAX_SAFE_INTEGER;refused(c);
  const bad=inputs(t);bad.evals.tiers["tier-2"].scenarios={};refused(bad);
  const broken=inputs(t);put(broken.dir,"test-framework/evals/evals.json","{");const out=cli(script,["--json"],broken.dir);assert.equal(out.status,1);assert.equal(out.stdout,"");assert.doesNotMatch(out.stderr,/\n\s+at /);
});
