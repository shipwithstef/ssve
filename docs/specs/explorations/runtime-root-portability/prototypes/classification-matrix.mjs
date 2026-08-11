#!/usr/bin/env node

// Design-only prototype: compare three finalist classification policies over
// the same host states. It does not create SVC production paths or import code.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-wi506-explore-"));
const home = path.join(temp, "home");
const missing = path.join(temp, "missing-xdg");
const valid = path.join(temp, "valid-xdg");
const unsafe = path.join(temp, "unsafe-xdg");
fs.mkdirSync(home, { mode: 0o700 });
fs.mkdirSync(valid, { mode: 0o700 });
fs.mkdirSync(unsafe, { mode: 0o755 });

const states = [
  { name: "unset", xdg: "" },
  { name: "missing", xdg: missing },
  { name: "valid", xdg: valid },
  { name: "unsafe", xdg: unsafe },
];

function strictResolver(state) {
  if (!state.xdg) return { result: "fallback", root: path.join(home, ".cache", "svc-runtime") };
  let stat;
  try { stat = fs.lstatSync(state.xdg); }
  catch (error) {
    if (error.code === "ENOENT") return { result: "fallback", root: path.join(home, ".cache", "svc-runtime") };
    return { result: "deny", reason: error.code };
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700) {
    return { result: "deny", reason: "unsafe-existing" };
  }
  return { result: "xdg", root: state.xdg };
}

function universalTemp() {
  return { result: "temp", root: os.tmpdir() };
}

function repoLocal() {
  return { result: "repo", root: ".svc/runtime" };
}

const expected = {
  unset: "fallback",
  missing: "fallback",
  valid: "xdg",
  unsafe: "deny",
};

let failed = false;
console.log("state\texpected\tstrict\ttemp\trepo");
for (const state of states) {
  const strict = strictResolver(state);
  const tempPolicy = universalTemp(state);
  const repoPolicy = repoLocal(state);
  console.log(`${state.name}\t${expected[state.name]}\t${strict.result}\t${tempPolicy.result}\t${repoPolicy.result}`);
  if (strict.result !== expected[state.name]) failed = true;
}

fs.rmSync(temp, { recursive: true, force: true });
if (failed) process.exit(1);
