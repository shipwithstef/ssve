#!/usr/bin/env node
/** Regression coverage for the functional improvement; fixtures never use live project state. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Create a disposable project and remove it after the test. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssve-functional-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
/** Write a fixture file, creating only fixture-owned parents. */
function put(dir, name, value) {
  const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return file;
}
/** Execute the real CLI with bounded runtime and isolated project state. */
function cli(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd, env: { ...process.env, SVC_PROJECT_DIR: cwd, ...env }, encoding: "utf8", timeout: 10000,
  });
}
/** Require successful machine-readable output. */
function json(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }


const script = "scripts/prompt-element-extract.mjs";
/** Execute actual coverage against fixture requirements. */
function check(t, requirements, text = "hello world") {
  const dir = fixture(t); const output = put(dir, "out.txt", text); const reqs = put(dir, "reqs.json", { requirements });
  return cli(script, ["--output", output, "--requirements", reqs], dir);
}
test("valid requirement types retain deterministic present-or-absent scoring", (t) => {
  const out = json(check(t, [{key:"z",type:"max-words",value:2},{key:"a",type:"present",pattern:"hello"},{key:"b",type:"forbidden-absent",pattern:"bad"},{key:"c",type:"min-words",value:3}]));
  assert.deepEqual(out.elements.map((e) => e.key), ["a","b","z"]);
});
test("missing patterns and invalid bounds cannot produce a grade", (t) => {
  for (const r of [{key:"x",type:"present"},{key:"x",type:"max-words",value:null},{key:"x",type:"min-words",value:-1},{key:"x",type:"max-words",value:1.5}]) {
    const out = check(t, [r]); assert.equal(out.status, 2); assert.equal(out.stdout, "");
  }
});
test("duplicate or empty keys fail rather than duplicating coverage elements", (t) => {
  const r = { key:"x", type:"present", pattern:"hello" };
  assert.equal(check(t, [r,r]).status, 2); assert.equal(check(t, [{...r,key:""}]).status, 2);
});
test("zero bounds and malformed regex behavior remain explicit", (t) => {
  assert.equal(json(check(t, [{key:"empty",type:"max-words",value:0}], "")).elements.length, 1);
  const out = check(t, [{key:"x",type:"present",pattern:"["}]); assert.equal(out.status, 2); assert.match(out.stderr, /invalid regex/);
});
test("library errors are catchable and CLI paths with spaces execute", async (t) => {
  const dir = fixture(t); const file = put(dir, "with space/adapter.mjs", fs.readFileSync(path.join(root,script), "utf8"));
  const code = `import {coverage} from ${JSON.stringify(pathToFileURL(file).href)}; try { coverage('x',[{key:'x',type:'present',pattern:'['}]); process.exitCode=9; } catch { console.log('caught'); }`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding:"utf8", timeout:10000 });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /caught/);
  const output = put(dir,"output.txt","hello"); const req = put(dir,"req.json",{requirements:[{key:"x",type:"present",pattern:"hello"}]});
  const run = spawnSync(process.execPath,[file,"--output",output,"--requirements",req],{encoding:"utf8",timeout:10000});
  assert.equal(json(run).elements.length,1);
});
