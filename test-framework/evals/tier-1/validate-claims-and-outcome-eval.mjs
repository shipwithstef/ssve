#!/usr/bin/env node
/** Tier 1: the claims register is well formed and judged correctly; outcome-eval parses grader output and summarizes without counting errors as scores. Hermetic; no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { judge, pick } from "../../../scripts/verify-claims.mjs";
import { parseTap, summarize, ARMS, listTasks, parseJudge } from "../../../scripts/outcome-eval.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("every claim names a source, a command and exactly one kind of bound", () => {
  const { claims } = JSON.parse(fs.readFileSync(path.join(root, "references/claims.json"), "utf8"));
  const ids = new Set();
  for (const c of claims) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    assert.ok(c.claim && c.source && Array.isArray(c.command) && c.command.length, c.id);
    assert.ok(fs.existsSync(path.join(root, c.source)), `${c.id}: source ${c.source} exists`);
    assert.ok(c.exit !== undefined || (c.json && (c.max !== undefined || c.min !== undefined)), `${c.id} has a bound`);
  }
});

test("judge checks exit codes and JSON bounds, and fails closed on bad output", () => {
  assert.equal(pick({ a: { b: 3 } }, "a.b"), 3);
  assert.equal(judge({ exit: 0 }, { status: 1, stdout: "" }).ok, false);
  assert.equal(judge({ json: "a.b", max: 5 }, { status: 0, stdout: '{"a":{"b":5}}' }).ok, true);
  assert.equal(judge({ json: "a.b", max: 5 }, { status: 0, stdout: '{"a":{"b":6}}' }).ok, false);
  assert.equal(judge({ json: "a.b", min: 1 }, { status: 0, stdout: "not json" }).ok, false);
  assert.equal(judge({ json: "a.c", max: 1 }, { status: 0, stdout: '{"a":{}}' }).ok, false);
});

test("outcome-eval: TAP parsing, error rows excluded from scores, arms differ only in instruction", () => {
  assert.deepEqual(parseTap("ok 1\n# pass 3\n# fail 1\n"), { pass: 3, fail: 1 });
  assert.equal(parseTap("crashed"), null);
  assert.deepEqual(parseTap("# pass 1\n# fail 0\n# cancelled 1\n"), { pass: 1, fail: 1 }, "a timed-out test counts as failed");
  const s = summarize([
    { arm: "plain", solved: true, score: 1, cost_usd: 0.01, turns: 4 },
    { arm: "plain", error: "timeout" },
    { arm: "blueprint", solved: false, score: 0.5, cost_usd: 0.03, turns: 10 },
  ]);
  const plain = s.find((x) => x.arm === "plain");
  assert.equal(plain.errors, 1);
  assert.equal(plain.solved, "1/1");
  assert.equal(plain.mean_hidden_score, 1);
  assert.deepEqual(Object.keys(ARMS).sort(), ["blueprint", "brief", "lean", "plain", "production"]);
  assert.equal(parseJudge('here: {"scores":{"a":2},"total":2,"notes":"x"}').total, 2);
  assert.equal(parseJudge("no verdict"), null);
  assert.ok(listTasks().length >= 5);
  for (const t of listTasks()) {
    const dir = path.join(root, "test-framework/outcome-evals/tasks", t);
    for (const f of ["spec.md", "hidden.test.mjs"]) assert.ok(fs.existsSync(path.join(dir, f)), `${t}/${f}`);
    assert.ok(fs.existsSync(path.join(dir, "ref.mjs")) || (fs.existsSync(path.join(dir, "repo")) && fs.existsSync(path.join(dir, "ref"))), `${t} has a reference`);
  }
});
