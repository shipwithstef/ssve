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

const script="scripts/extract-inline-plan-contract.mjs";
const intro="The contract artifact content is fixed NOW by this inline block";
const body='{\n  "schema_version": 1,\n  "tasks": []\n}\n';
const manifest=(bytes=body,eol="\n")=>`# Plan${eol}${intro}${eol}\`\`\`json${eol}${bytes}\`\`\`${eol}`;
/** Copy the real script so legacy defaults stay inside a disposable checkout. */
function copied(t) {const dir=fixture(t);put(dir,script,fs.readFileSync(path.join(ROOT,script),"utf8"));return dir;}
/** Execute the actual module copy, not a replacement extractor. */
function run(dir,args=[]) {return spawnSync(process.execPath,[path.join(dir,script),...args],{cwd:dir,encoding:"utf8",timeout:10000});}
test("historical no-argument extraction retains exact content and success fields",(t)=>{
  const dir=copied(t);const rel="docs/plans/2026-08-25-wi-fw-swarm-coordination/";put(dir,rel+"manifest.md",manifest());
  const out=json(run(dir));assert.equal(out.ok,true);assert.equal(out.wrote,rel+"plan-contract.json");assert.equal(out.bytes,Buffer.byteLength(body));assert.equal(fs.readFileSync(path.join(dir,out.wrote),"utf8"),body);
});
test("custom input/output preserve CRLF and original manifest bytes",(t)=>{
  const dir=copied(t);const bytes=body.replaceAll("\n","\r\n");const source=manifest(bytes,"\r\n");const input=put(dir,"custom/plan.md",source);const output=path.join(dir,"artifact.json");
  assert.equal(json(run(dir,["--manifest",input,"--output",output])).ok,true);assert.equal(fs.readFileSync(output,"utf8"),bytes);assert.equal(fs.readFileSync(input,"utf8"),source);
});
test("adjacent default output and repeated extraction/checks preserve existing mtime",(t)=>{
  const dir=copied(t);const input=put(dir,"custom/manifest.md",manifest());const output=path.join(dir,"custom/plan-contract.json");
  assert.equal(run(dir,["--manifest",input]).status,0);fs.utimesSync(output,1000000000,1000000000);const before=fs.statSync(output).mtimeMs;
  assert.equal(json(run(dir,["--manifest",input])).changed,false);assert.equal(json(run(dir,["--manifest",input,"--check"])).changed,false);
  assert.equal(fs.statSync(output).mtimeMs,before);assert.equal(fs.readFileSync(output,"utf8"),body);
});
test("check mode rejects missing/drifted artifacts without creating or changing them",(t)=>{
  const dir=copied(t);const input=put(dir,"plan.md",manifest());const output=path.join(dir,"plan-contract.json");
  assert.equal(run(dir,["--manifest",input,"--check"]).status,1);assert.equal(fs.existsSync(output),false);
  put(dir,"plan-contract.json","original");fs.utimesSync(output,1000000000,1000000000);
  assert.equal(run(dir,["--manifest",input,"--check"]).status,1);assert.equal(fs.readFileSync(output,"utf8"),"original");assert.equal(fs.statSync(output).mtimeMs,1000000000000);
});
test("bad inline data cannot overwrite an artifact or its source",(t)=>{
  for(const source of ["missing intro",`${intro}\nno fence`,`${intro}\n\`\`\`json\n{}`,manifest("invalid json\n")]){
    const dir=copied(t);const input=put(dir,"plan.md",source);const output=put(dir,"out.json","original");
    assert.equal(run(dir,["--manifest",input,"--output",output]).status,1);assert.equal(fs.readFileSync(output,"utf8"),"original");assert.equal(fs.readFileSync(input,"utf8"),source);
  }
  const dir=copied(t);const input=put(dir,"plan.md",manifest());assert.equal(run(dir,["--manifest",input,"--output",input]).status,1);assert.equal(fs.readFileSync(input,"utf8"),manifest());
});
test("help and malformed arguments do not need or mutate historical project state",(t)=>{
  const dir=copied(t);assert.equal(run(dir,["--help"]).status,0);
  for(const args of [["--manifest"],["--check","--check"],["--unknown"]]){const out=run(dir,args);assert.equal(out.status,1);assert.equal(out.stdout,"");assert.doesNotMatch(out.stderr,/\n\s+at /);}
});
