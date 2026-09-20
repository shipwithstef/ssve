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

const script = "scripts/resolve-host-paths.mjs";
const host = { host: "alpha", skills_path: "~/skills", rules_path: "rules", hook_quirks: { config_file: "~/config.json" }, capabilities: { hooks: true }, extra: "preserved" };
/** Copy the real module to exercise its default checkout discovery. */
function copied(t, spaced = false) {
  const dir = fixture(t); const base = spaced ? path.join(dir, "checkout with spaces") : dir;
  put(base, script, fs.readFileSync(path.join(ROOT, script), "utf8"));
  put(base, "provision/hosts/alpha.json", host); return base;
}
test("list discovers sorted real manifests and stays read-only", (t) => {
  const dir = copied(t); put(dir, "provision/hosts/zeta.json", { ...host, host: "zeta" });
  put(dir, "provision/hosts/README.md", "not a host"); fs.mkdirSync(path.join(dir,"provision/hosts/directory.json"));
  const before = fs.readFileSync(path.join(dir,"provision/hosts/alpha.json"));
  assert.deepEqual(json(cli(script,["--list","--root",dir],dir)),["alpha","zeta"]);
  assert.deepEqual(fs.readFileSync(path.join(dir,"provision/hosts/alpha.json")),before);
});
test("exported resolver retains path expansion, metadata, and capabilities", async (t) => {
  const dir = copied(t); const api = await import(pathToFileURL(path.join(ROOT,script)));
  const actual = api.resolveHostPaths("alpha", { repoRoot: dir, home: "/fixture-home" });
  assert.deepEqual(actual, { host:"alpha", skillsPath:"/fixture-home/skills", rulesPath:path.join(dir,"rules"), configFile:"/fixture-home/config.json", hooksSupported:true, manifestPath:path.join(dir,"provision/hosts/alpha.json"), manifest:host });
  assert.equal(api.expandPath("~",{home:"/fixture-home"}),"/fixture-home");
  assert.equal(api.expandPath("",{repoRoot:dir}),"");
});
test("unknown hosts show real choices without a stack trace", (t) => {
  const dir = copied(t); const out = cli(script,["unknown","--root",dir],dir);
  assert.equal(out.status,1); assert.match(out.stderr,/available hosts: alpha/); assert.doesNotMatch(out.stderr,/\n\s+at /);
});
test("help succeeds and malformed options never resolve a host", (t) => {
  const dir = copied(t); assert.equal(cli(script,["--help"],dir).status,0);
  for (const args of [[],["--root"],["--list","alpha"],["--list","--list"],["alpha","beta"],["--unknown"]]) {
    const out=cli(script,args,dir); assert.equal(out.status,2,JSON.stringify(args)); assert.equal(out.stdout,"");
  }
});
test("default resolution still works when the actual CLI path contains spaces", (t) => {
  const dir = copied(t,true);
  const out = spawnSync(process.execPath,[path.join(dir,script),"alpha"],{cwd:dir,env:{...process.env,HOME:"/fixture-home"},encoding:"utf8",timeout:10000});
  const actual=json(out); assert.equal(actual.host,"alpha"); assert.equal(actual.skillsPath,"/fixture-home/skills"); assert.deepEqual(actual.manifest,host);
});
test("installed directory and file symlinks run the CLI using the source checkout", (t) => {
  const dir = copied(t, true); const install = fixture(t);
  const linkedScripts = path.join(install, "installed scripts");
  const linkedFile = path.join(install, "host resolver.mjs");
  fs.symlinkSync(path.join(dir, "scripts"), linkedScripts, "dir");
  fs.symlinkSync(path.join(dir, script), linkedFile, "file");
  const manifest = path.join(dir, "provision/hosts/alpha.json");
  const before = fs.readFileSync(manifest); const mtime = fs.statSync(manifest).mtimeMs;
  for (const entry of [path.join(linkedScripts, "resolve-host-paths.mjs"), linkedFile]) {
    const invoke = (args) => spawnSync(process.execPath, [entry, ...args], {
      cwd: install, env: { ...process.env, HOME: "/fixture-home" }, encoding: "utf8", timeout: 10000,
    });
    assert.deepEqual(json(invoke(["--list"])), ["alpha"]);
    assert.equal(json(invoke(["alpha"])).skillsPath, "/fixture-home/skills");
    const help = invoke(["--help"]); assert.equal(help.status, 0); assert.match(help.stdout, /Usage:/);
    const invalid = invoke(["--unknown"]); assert.equal(invalid.status, 2); assert.equal(invalid.stdout, "");
  }
  assert.deepEqual(fs.readFileSync(manifest), before); assert.equal(fs.statSync(manifest).mtimeMs, mtime);
});
test("stdin imports preserve library use without resolving the dash as a file", (t) => {
  const dir = copied(t); const url = pathToFileURL(path.join(dir, script)).href;
  const input = `const api = await import(${JSON.stringify(url)}); console.log(api.expandPath("~", {home:"/fixture-home"}));`;
  const out = spawnSync(process.execPath, ["--input-type=module", "-", "--list"], {
    cwd: dir, input, encoding: "utf8", timeout: 10000,
  });
  assert.equal(out.status, 0, out.stderr); assert.equal(out.stdout, "/fixture-home\n"); assert.equal(out.stderr, "");
});
test("ordinary imports never dispatch resolver options supplied to another program", (t) => {
  const dir = copied(t); const url = pathToFileURL(path.join(dir, script)).href;
  const caller = put(dir, "caller.mjs", `const api = await import(${JSON.stringify(url)}); console.log(typeof api.resolveHostPaths);\n`);
  const out = spawnSync(process.execPath, [caller, "--unknown"], { cwd: dir, encoding: "utf8", timeout: 10000 });
  assert.equal(out.status, 0, out.stderr); assert.equal(out.stdout, "function\n"); assert.equal(out.stderr, "");
});
