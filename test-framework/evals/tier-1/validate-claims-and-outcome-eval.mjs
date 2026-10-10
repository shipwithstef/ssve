#!/usr/bin/env node
/** Tier 1: the claims register is well formed and judged correctly; outcome-eval parses grader output and summarizes without counting errors as scores. Hermetic; no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { judge, pick } from "../../../scripts/verify-claims.mjs";
import { parseTap, summarize, ARMS, listTasks, parseJudge, failureReasons, compareSamples, promotionDecision, armPrompts, taskConfig, PILLAR_ARMS } from "../../../scripts/outcome-eval.mjs";

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
  assert.deepEqual(failureReasons("ok 1 - a\nnot ok 2 - loads the page\n  ---\n  error: 'no page errors'\n"), ["loads the page: error: 'no page errors'"]);
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
  const clear = compareSamples([15, 14, 16, 15, 14], [7, 6, 8, 7, 8]);
  assert.ok(clear.ci95[0] > 0 && clear.p < 0.05, "a large gap is established");
  const noise = compareSamples([11, 12, 11], [10, 11, 11]);
  assert.ok(noise.ci95[0] <= 0 || noise.p >= 0.05, "a one-point gap on three runs is not");
  assert.deepEqual(compareSamples([1, 2], [3, 4]), compareSamples([1, 2], [3, 4]), "seeded: same input, same numbers");
  assert.ok(listTasks().length >= 5);
  for (const t of listTasks()) {
    const dir = path.join(root, "test-framework/outcome-evals/tasks", t);
    for (const f of ["spec.md", "hidden.test.mjs"]) assert.ok(fs.existsSync(path.join(dir, f)), `${t}/${f}`);
    assert.ok(fs.existsSync(path.join(dir, "ref.mjs")) || (fs.existsSync(path.join(dir, "repo")) && fs.existsSync(path.join(dir, "ref"))), `${t} has a reference`);
  }
});

test("promotion decisions re-derived from the recorded results", () => {
  const rows = (...names) => names.flatMap((n) => JSON.parse(fs.readFileSync(path.join(root, "test-framework/outcome-evals/results", `2026-10-10-${n}.json`), "utf8")).rows);
  assert.equal(promotionDecision(rows("haiku-production", "haiku-production-v2", "haiku-production-v3"), "production", "plain").promote, true, "the production method earns its cost on a one-line product request");
  assert.equal(promotionDecision(rows("haiku", "haiku-hard"), "blueprint", "plain").promote, false, "the written blueprint costs more for the same solves");
  assert.equal(promotionDecision(rows("haiku-hard", "haiku-lean", "haiku-brownfield", "haiku-fullstack"), "lean", "plain").promote, false, "the verify-loop instruction costs more for the same solves");
  assert.equal(promotionDecision(rows("haiku-vague", "haiku-vague-r2"), "lean", "plain").promote, false);
  assert.equal(promotionDecision([{ arm: "a", solved: true, cost_usd: 1 }, { arm: "b", solved: true, cost_usd: 2 }], "a", "b").promote, true, "same results, cheaper: promote");
  assert.equal(promotionDecision([{ arm: "a", solved: true }], "a", "missing").promote, false);
});

test("pillar tasks: bare gets the instruction alone, svc adds the shipped framework files verbatim, steps run in order", () => {
  const pillars = listTasks().filter((t) => taskConfig(t).pillar);
  assert.ok(pillars.length >= 5, "at least five pillar tasks");
  for (const t of pillars) {
    const { steps } = taskConfig(t);
    const bare = armPrompts(t, "bare"), svc = armPrompts(t, "svc");
    assert.equal(bare.length, steps.length, t);
    assert.equal(svc.length, steps.length, t);
    steps.forEach((s, i) => {
      assert.equal(bare[i], s.instruction, `${t} step ${i + 1}: bare is the instruction only`);
      assert.ok(svc[i].startsWith(s.instruction), `${t} step ${i + 1}: svc starts with the same instruction`);
      for (const f of s.svc || []) {
        const body = fs.readFileSync(path.join(root, f), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
        assert.ok(svc[i].includes(body), `${t}: ${f} is included verbatim`);
      }
    });
    // Framework text added to a prompt must not carry the task's answer (a leaked example
    // once made a candidate prompt look better than it was).
    const { leak_terms = [] } = JSON.parse(fs.readFileSync(path.join(root, "test-framework/outcome-evals/tasks", t, "task.json"), "utf8"));
    svc.forEach((p, i) => { for (const term of leak_terms) assert.ok(!p.slice(steps[i].instruction.length).includes(term), `${t} step ${i + 1}: framework text leaks "${term}"`); });
    for (const d of ["ref", "ref-wrong"]) assert.ok(fs.existsSync(path.join(root, "test-framework/outcome-evals/tasks", t, d)), `${t}/${d} lets check prove the grader`);
  }
  assert.deepEqual(PILLAR_ARMS, ["bare", "svc"]);
  assert.throws(() => armPrompts("duration", "svc"), /not a pillar task/);
});
