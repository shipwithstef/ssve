#!/usr/bin/env node
/** Tier 1: framework scripts run when invoked through the install symlinks, as they are in
 * every user project (~/.claude/skills/scripts -> <repo>/scripts). A main-module check that
 * compares import.meta.url with process.argv[1] without resolving symlinks makes the script
 * exit 0 having done nothing; 64 files did this until 2026-10-11 (compile-delivery-graph
 * among them). Every check must go through scripts/lib/is-main.mjs (real paths). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BROKEN = [
  /import\.meta\.url === `file:\/\/\$\{process\.argv\[1\]\}`/,
  /path\.resolve\(process\.argv\[1\][^)]*\) === (?:path\.resolve\()?fileURLToPath\(import\.meta\.url\)/,
  /process\.argv\[1\] === (?:fileURLToPath\(import\.meta\.url\)|new URL\(import\.meta\.url\)\.pathname)/,
  /import\.meta\.url\.endsWith\(process\.argv\[1\]\)/,
];

test("no script decides it is the main module without resolving symlinks", () => {
  const files = spawnSync("git", ["ls-files", "scripts", "hooks", "bin"], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n").filter((f) => /\.(mjs|js)$/.test(f));
  const bad = files.filter((f) => { const t = fs.readFileSync(path.join(ROOT, f), "utf8"); return BROKEN.some((rx) => rx.test(t)); });
  assert.deepEqual(bad, [], "use isMain(import.meta.url) from scripts/lib/is-main.mjs");
});

test("a core script run through a symlinked install does its work", () => {
  const install = fs.mkdtempSync(path.join(os.tmpdir(), "svc-install-"));
  fs.symlinkSync(path.join(ROOT, "scripts"), path.join(install, "scripts"));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "svc-project-"));
  const r = spawnSync(process.execPath, [path.join(install, "scripts", "compile-delivery-graph.mjs")], { cwd: project, encoding: "utf8" });
  assert.notEqual(r.status, 0, "missing arguments are an error, not a silent success");
  assert.match(r.stderr, /compile-delivery-graph: Missing required wi/);
});
