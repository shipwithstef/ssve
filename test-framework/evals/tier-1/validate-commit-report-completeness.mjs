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


const script = "scripts/report-commit-ratio.mjs";
const header = (n) => `${String(n).repeat(40)}|2026-09\n`;
/** Git is a labeled log-source test double; no real repository is accessed. */
function report(t, log, args = []) {
  const dir = fixture(t); const input = put(dir,"log.txt",log); const trace = path.join(dir,"called");
  const stub = put(dir,"bin/git",`#!${process.execPath}\nconst fs=require('node:fs');fs.writeFileSync(process.env.TRACE,'called');process.stdout.write(fs.readFileSync(process.env.LOG,'utf8'));\n`);
  fs.chmodSync(stub,0o700);
  return { out: cli(script,args,dir,{PATH:path.dirname(stub)+path.delimiter+process.env.PATH,LOG:input,TRACE:trace}), trace };
}
test("EOF flushes the final commit without a trailing blank line", (t) => {
  const {out}=report(t,header(1)+"scripts/example.mjs"); assert.equal(out.status,0); assert.match(out.stdout,/\| 2026-09 \| 1 \| 1 \| 0 \| 0 \| 100% \|/);
});
test("packaged skills are framework work and mixed commits count once", (t) => {
  const {out}=report(t,header(1)+"skills/demo/SKILL.md\nsrc/app.js\n\n"+header(2)+"src/other.js");
  assert.equal(out.status,0); assert.match(out.stdout,/\| 2026-09 \| 2 \| 0 \| 1 \| 1 \| 25% \|/);
});
test("a pipe in a filename cannot invent a commit header", (t) => {
  const {out}=report(t,header(1)+"src/a|b.js\n\n"); assert.equal(out.status,0);
  assert.match(out.stdout,/\| 2026-09 \| 1 \| 0 \| 1 \| 0 \| 0% \|/);
});
test("invalid lookbacks fail before Git while empty reports stay measurement-only", (t) => {
  for(const value of ["0","-1","NaN","1.5"]) { const {out,trace}=report(t,"",["--months",value]); assert.equal(out.status,1); assert.equal(fs.existsSync(trace),false); }
  const {out}=report(t,""); assert.equal(out.status,0); assert.match(out.stdout,/MEASUREMENT ONLY/);
});
