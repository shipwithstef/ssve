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

const script="scripts/ci/run-free-checks.sh";
/** A Node launcher test double records selection, then executes the actual Node binary. */
function wrapper(dir,name,version) {
  const value=version?`#!/bin/sh\nprintf '%s\\n' '${version}'\n`:`#!/bin/sh\nprintf '%s\\n' '${name}' >> "$TRACE"\nexec "$REAL_NODE" "$@"\n`;
  const file=put(dir,"bin/"+name,value);fs.chmodSync(file,0o700);return file;
}
/** The real entrypoint uses labeled lint/eval fixtures, never the actual full suite. */
function setup(t) {
  const dir=fixture(t);put(dir,script,fs.readFileSync(path.join(ROOT,script),"utf8"));fs.mkdirSync(path.join(dir,"tmp"));
  const producer=`import fs from 'node:fs'; fs.appendFileSync(process.env.RECORD,JSON.stringify({evals:process.env.EVALS,node:process.env.NODE_BIN,first:process.env.PATH.split(':')[0]})+'\\n'); if(process.env.FAIL_LINT==='1')process.exit(7);`;
  put(dir,"scripts/lint-skills-manifest.mjs",producer);put(dir,"test-framework/evals/run-all-evals.sh","#!/bin/sh\nnode scripts/lint-skills-manifest.mjs\n");
  wrapper(dir,"node");const custom=wrapper(dir,"selected-node");
  const env={...process.env,EVALS:"0",GITHUB_ACTIONS:"false",NODE_BIN:"",REAL_NODE:process.execPath,TRACE:path.join(dir,"trace"),RECORD:path.join(dir,"record"),TMPDIR:path.join(dir,"tmp"),PATH:path.join(dir,"bin")+path.delimiter+process.env.PATH,FAIL_LINT:"0"};
  const run=(extra={})=>spawnSync("bash",[path.join(dir,script)],{cwd:dir,env:{...env,...extra},encoding:"utf8",timeout:10000});
  return {dir,custom,env,run};
}
/** Validate both descendant records and cleanup after an entrypoint run. */
function records(c,expected) {
  const rows=fs.readFileSync(c.env.RECORD,"utf8").trim().split("\n").map(JSON.parse);assert.equal(rows.length,2);
  for(const row of rows){assert.equal(row.evals,"0");assert.equal(row.node,expected);assert.equal(fs.existsSync(row.first),false);}
  assert.deepEqual(fs.readdirSync(c.env.TMPDIR),[]);
}
test("PATH selection is used by both linter and descendant checks",(t)=>{
  const c=setup(t);const out=c.run();assert.equal(out.status,0,out.stderr);records(c,path.join(c.dir,"bin/node"));
  assert.equal(fs.readFileSync(c.env.TRACE,"utf8").trim().split("\n").length,3);
});
test("an explicit executable not named node overrides competing PATH runtimes",(t)=>{
  const c=setup(t);const out=c.run({NODE_BIN:c.custom});assert.equal(out.status,0,out.stderr);records(c,c.custom);
  assert.deepEqual(fs.readFileSync(c.env.TRACE,"utf8").trim().split("\n"),["selected-node","selected-node","selected-node"]);
});
test("missing or unsupported runtimes fail before any checks",(t)=>{
  for(const version of [null,"v21.9.0","not-a-version"]){const c=setup(t);const node=version?wrapper(c.dir,"old-node",version):path.join(c.dir,"missing");const out=c.run({NODE_BIN:node});assert.equal(out.status,2,out.stderr);assert.equal(fs.existsSync(c.env.RECORD),false);assert.deepEqual(fs.readdirSync(c.env.TMPDIR),[]);}
});
test("EVALS=1 is refused before runtime discovery and creates no state",(t)=>{
  const c=setup(t);const out=c.run({EVALS:"1",NODE_BIN:path.join(c.dir,"missing")});assert.equal(out.status,2);assert.match(out.stderr,/EVALS=1/);assert.equal(fs.existsSync(c.env.TRACE),false);assert.equal(fs.existsSync(c.env.RECORD),false);assert.deepEqual(fs.readdirSync(c.env.TMPDIR),[]);
});
test("linter failures propagate and remove the runtime shim",(t)=>{
  const c=setup(t);const out=c.run({FAIL_LINT:"1",NODE_BIN:c.custom});assert.equal(out.status,7,out.stderr);assert.equal(fs.readFileSync(c.env.RECORD,"utf8").trim().split("\n").length,1);assert.deepEqual(fs.readdirSync(c.env.TMPDIR),[]);
});
test("hosted preparation retains selected runtime and existing Git operations",(t)=>{
  const c=setup(t);
  // Git/rg are explicit preparation test doubles; this test never accesses the network.
  const git=put(c.dir,"bin/git","#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$GIT_TRACE\"\ncase \"$*\" in *refs/heads/main*) exit 1;; esac\nexit 0\n");fs.chmodSync(git,0o700);
  const rg=put(c.dir,"bin/rg","#!/bin/sh\nexit 0\n");fs.chmodSync(rg,0o700);
  const trace=path.join(c.dir,"git-trace");const out=c.run({GITHUB_ACTIONS:"true",NODE_BIN:c.custom,GIT_TRACE:trace});assert.equal(out.status,0,out.stderr);records(c,c.custom);
  const calls=fs.readFileSync(trace,"utf8");assert.match(calls,/fetch origin/);assert.match(calls,/branch main origin\/main/);
});
