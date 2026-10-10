#!/usr/bin/env node
/** Tier 1: every new svc CLI works when run through a symlinked path with a space, as setup installs it under ~/.claude/skills. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc symlink "));
fs.symlinkSync(path.join(root, "scripts"), path.join(dir, "scripts"));
fs.symlinkSync(path.join(root, "skills"), path.join(dir, "skills"));
const run = (rel, ...args) => spawnSync(process.execPath, [path.join(dir, rel), ...args], { encoding: "utf8", env: { ...process.env, SVC_ADDON_ROOTS: dir, SVC_MODEL_OUTCOMES: path.join(dir, "o.jsonl") } });

const cases = [
  ["scripts/route-model.mjs", ["pick", "--task-type", "exec"], 0, /model=sonnet/],
  ["scripts/svc-repo.mjs", ["bogus"], 2, null],
  ["scripts/design-tokens.mjs", [], 2, null],
  ["skills/addon-gateway/scripts/addon-index.mjs", [], 0, /No add-on packs found/],
  ["scripts/overengineering-index.mjs", [], 2, null],
  ["scripts/harness-playbook.mjs", ["list"], 0, /claude/],
  ["scripts/mirror-ledger.mjs", ["bogus"], 2, null],
  ["scripts/harness-drift.mjs", ["bogus"], 2, null],
];

for (const [rel, args, code, out] of cases) {
  test(`${rel} runs through a symlinked path`, () => {
    const r = run(rel, ...args);
    assert.equal(r.status, code, `${rel}: ${r.stderr}`);
    if (out) assert.match(r.stdout, out);
    else assert.ok(r.stderr.length > 0, "usage or error is printed, not silence");
  });
}
