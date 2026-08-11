#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

node --input-type=module - <<'NODE'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readJsonAtomic, writeJsonAtomic } from "./scripts/state-io.mjs";

const ROOT = process.cwd();
const SCAN_DIRS = ["scripts", "hooks"];
const SKILL_SCRIPT_RE = /^[^/.][^/]*\/scripts\/.*\.(mjs|js)$/;
const JS_RE = /\.(mjs|js)$/;
const RAW_WRITE_RE = /\b(?:fs\.)?(?:writeFileSync|writeFile|appendFileSync|appendFile)\b/;
const STATE_HINT_RE = /(?:\.svc|pipeline-decisions\.jsonl|concern-hits\.jsonl|framework-gaps\.jsonl|knowledge-recall\.jsonl|lane-tasks|orchestrator-state\.json|capability-registry\.json|svc-edited-files\.json|spec-index\.json|session-contract\.jsonl)/;
const ALLOW = new Set([
  "scripts/state-io.mjs",
  "scripts/state-lock.mjs",
  "hooks/svc-lane-tasks-validate-content.mjs",
  "hooks/svc-lane-tasks-validate-edit.mjs",
  // Writes human-readable markdown lint reports under
  // docs/specs/reviews/proposal-lints/ or .svc/proposal-lints/.
  // Not JSON state; writeJsonAtomic doesn't apply.
  "scripts/lint-proposal-authorship.mjs",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (JS_RE.test(entry.name)) out.push(full);
  }
  return out;
}

function collectFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) files.push(...walk(dir));
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const scriptsDir = path.join(entry.name, "scripts");
    if (fs.existsSync(scriptsDir)) files.push(...walk(scriptsDir));
  }
  return [...new Set(files.map((file) => path.relative(ROOT, file).replace(/\\/g, "/")))]
    .filter((file) => !ALLOW.has(file));
}

function analyzeText(text, file = "<fixture>") {
  const usesStateIo = /state-io\.mjs/.test(text);
  const issues = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (!RAW_WRITE_RE.test(line)) return;
    const nearby = lines.slice(Math.max(0, index - 3), index + 2).join("\n");
    if (!STATE_HINT_RE.test(nearby)) return;
    if (/state-io\.mjs|writeJsonAtomic|appendJsonlLine|withStateLock|updateJsonAtomic/.test(line)) return;
    if (usesStateIo) return;
    issues.push(`${file}:${index + 1}: raw state write should use writeJsonAtomic/appendJsonlLine`);
  });

  return issues;
}

const badFixture = `
  import fs from "node:fs";
  import path from "node:path";
  const p = path.join(process.cwd(), ".svc", "lane-tasks-WI-999.json");
  fs.writeFileSync(p, "{}\\n");
`;
const goodFixture = `
  import { writeJsonAtomic, appendJsonlLine } from "./scripts/state-io.mjs";
  writeJsonAtomic(".svc/lane-tasks-WI-999.json", { tasks: [] });
  appendJsonlLine(".svc/pipeline-decisions.jsonl", { ok: true });
`;
if (analyzeText(badFixture).length === 0) {
  throw new Error("self-test failed: bad direct .svc writer was not detected");
}
if (analyzeText(goodFixture).length !== 0) {
  throw new Error("self-test failed: state-io writer fixture was rejected");
}

const issues = [];
for (const file of collectFiles()) {
  const text = fs.readFileSync(file, "utf8");
  issues.push(...analyzeText(text, file));
}

if (issues.length > 0) {
  console.error("FAIL: direct svc state writes found outside scripts/state-io.mjs");
  for (const issue of issues) console.error(` - ${issue}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-state-io-"));
const statePath = path.join(tmp, ".svc", "concurrent.json");
writeJsonAtomic(statePath, { count: 0, events: [] });
const stateIoUrl = pathToFileURL(path.join(ROOT, "scripts", "state-io.mjs")).href;
const worker = path.join(tmp, "worker.mjs");
fs.writeFileSync(worker, `
  import { updateJsonAtomic } from ${JSON.stringify(stateIoUrl)};
  const [file, id, delay] = process.argv.slice(2);
  function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(ms)); }
  updateJsonAtomic(file, (current) => {
    sleep(delay);
    const next = current || { count: 0, events: [] };
    next.count += 1;
    next.events.push(id);
    return next;
  }, { count: 0, events: [] }, { timeoutMs: 5000, staleMs: 60000 });
`);

const a = spawnSync(process.execPath, [worker, statePath, "a", "120"], { encoding: "utf8" });
const b = spawnSync(process.execPath, [worker, statePath, "b", "0"], { encoding: "utf8" });
if (a.status !== 0 || b.status !== 0) {
  console.error(a.stderr || a.stdout);
  console.error(b.stderr || b.stdout);
  throw new Error("concurrency replay workers failed");
}

const finalState = readJsonAtomic(statePath);
if (finalState.count !== 2 || finalState.events.length !== 2) {
  throw new Error(`concurrency replay lost an update: ${JSON.stringify(finalState)}`);
}

console.log(`PASS: state-io discipline validated (${collectFiles().length} files scanned, concurrency count=${finalState.count})`);
NODE
