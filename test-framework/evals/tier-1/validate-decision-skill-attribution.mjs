#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const writer = fileURLToPath(new URL("../../../scripts/write-decision.mjs", import.meta.url));
function run(root, args) {
  return spawnSync(process.execPath, [writer, ...args], { encoding: "utf8", env: { ...process.env, SVC_PROJECT_DIR: root } });
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ssve-decision-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
const decision = ["--type", "decision", "--decision_point", "implementation", "--choice", "simple"];

test("decision records retain optional skill attribution and zero confidence", (t) => {
  const root = fixture(t);
  const result = run(root, [...decision, "--skill", "review-gate", "--confidence", "0"]);
  assert.equal(result.status, 0, result.stderr);
  const entry = JSON.parse(result.stdout);
  assert.equal(entry.skill, "review-gate");
  assert.equal(entry.confidence, 0);
  assert.equal(entry.type, "decision");
  const persisted = JSON.parse(fs.readFileSync(path.join(root, ".svc/agent-decisions.jsonl"), "utf8"));
  assert.deepEqual(persisted, entry);
});

test("legacy callers need no skill and meta-learning normalizes applicability", (t) => {
  const root = fixture(t);
  const legacy = JSON.parse(run(root, decision).stdout);
  assert.equal(Object.hasOwn(legacy, "skill"), false);
  assert.equal(legacy.confidence, null);
  const result = run(root, [
    "--type", "meta-learning", "--category", "verification", "--observation", "cross-review helps",
    "--skill", "review-gate", "--applies_to", "review-gate, review-exec, ,review-gate"
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).applies_to, ["review-gate", "review-exec"]);
  assert.equal(fs.readFileSync(path.join(root, ".svc/agent-decisions.jsonl"), "utf8").trim().split("\n").length, 2);
});

test("invalid confidence or missing option values never append state", (t) => {
  for (const extra of [["--confidence", "oops"], ["--confidence", "2"], ["--confidence", ""], ["--skill"], ["--skill", "--confidence", "0.5"]]) {
    const root = fixture(t);
    const result = run(root, [...decision, ...extra]);
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(path.join(root, ".svc/agent-decisions.jsonl")), false);
    assert.notEqual(result.stderr.trim(), "");
  }
});

for (const [field, value] of [
  ["choice", "--dry-run"], ["reasoning", "--dry-run avoids writes"],
  ["decision_point", "--output format"], ["choice", "--dry-run=preview"],
  ["choice", "--skill"], ["reasoning", "--confidence=0"],
]) {
  test(`literal ${field} text beginning with -- is preserved`, (t) => {
    const root = fixture(t);
    const result = run(root, [...decision, `--${field}`, value]);
    assert.equal(result.status, 0, result.stderr);
    const entry = JSON.parse(result.stdout);
    assert.equal(entry[field], value);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".svc/agent-decisions.jsonl"), "utf8")), entry);
  });
}

test("meta-learning observation preserves literal flags and Unicode", (t) => {
  const root = fixture(t);
  const text = "--dry-run preserves café data\nwithout writes";
  const result = run(root, ["--type", "meta-learning", "--category", "verification", "--observation", text]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).observation, text);
});

test("equals syntax disambiguates known option names without losing embedded equals", (t) => {
  const root = fixture(t);
  const result = run(root, [
    "--type=decision", "--decision_point=CLI", "--choice=--skill", "--reasoning=--confidence=0",
    "--skill=review-gate", "--confidence=0",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const entry = JSON.parse(result.stdout);
  assert.equal(entry.choice, "--skill");
  assert.equal(entry.reasoning, "--confidence=0");
  assert.equal(entry.confidence, 0);
  assert.equal(entry.skill, "review-gate");
});

test("missing known-option values cannot modify an existing ledger", (t) => {
  const root = fixture(t);
  assert.equal(run(root, decision).status, 0);
  const ledger = path.join(root, ".svc/agent-decisions.jsonl");
  const original = fs.readFileSync(ledger);
  const mtime = fs.statSync(ledger).mtimeMs;
  for (const extra of [
    ["--choice", "--skill", "review-gate"], ["--reasoning"], ["--skill", "--confidence=0"],
    ["--skill", "--confidence", "0"], ["--choice="], ["--confidence=NaN"], ["--"],
  ]) {
    const result = run(root, [...decision, ...extra]);
    assert.equal(result.status, 1, JSON.stringify(extra));
    assert.equal(result.stdout, "");
    assert.notEqual(result.stderr.trim(), "");
    assert.deepEqual(fs.readFileSync(ledger), original);
    assert.equal(fs.statSync(ledger).mtimeMs, mtime);
  }
});
