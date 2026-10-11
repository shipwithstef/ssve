#!/usr/bin/env node
// Runs every node:test file under test-framework/tests/ that carries the
// `@organism-suite` marker (organism plan, Program 0 onward), so each item's unit tests
// gate CI without the items sharing a list file. A marked file that fails, or a marker
// with no runnable test, fails this validator.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DIR = path.join(ROOT, "test-framework", "tests");
const files = fs.readdirSync(DIR)
  .filter((f) => f.endsWith(".test.mjs"))
  .filter((f) => fs.readFileSync(path.join(DIR, f), "utf8").includes("@organism-suite"))
  .sort();

// Node reports a file with no tests as one passing test, so a marked file must declare at
// least one test itself.
const empty = files.filter((f) => !/\b(?:test|it|describe|suite)(?:\.\w+)?\s*\(/.test(fs.readFileSync(path.join(DIR, f), "utf8")));
if (empty.length) {
  console.error(`FAIL validate-organism-suite: marked file(s) declare no tests: ${empty.join(", ")}`);
  process.exit(1);
}
if (!files.length) {
  console.log("PASS validate-organism-suite: no marked test files yet");
  process.exit(0);
}
const env = { ...process.env };
delete env.NODE_TEST_CONTEXT;
const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "--test-concurrency=1", ...files.map((f) => path.join(DIR, f))], { cwd: ROOT, encoding: "utf8", env, timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
const out = `${r.stdout || ""}\n${r.stderr || ""}`;
const pass = Number(/^# pass (\d+)/m.exec(out)?.[1] ?? 0);
const fail = Number(/^# fail (\d+)/m.exec(out)?.[1] ?? 0) + Number(/^# cancelled (\d+)/m.exec(out)?.[1] ?? 0);
if (r.status !== 0 || fail > 0 || pass === 0) {
  const failing = out.split("\n").filter((l) => /^\s*not ok /.test(l)).slice(0, 20).join("\n");
  console.error(`FAIL validate-organism-suite: ${files.length} file(s), ${pass} passed, ${fail} failed (exit ${r.status})\n${failing}`);
  process.exit(1);
}
console.log(`PASS validate-organism-suite: ${files.length} file(s), ${pass} tests`);
