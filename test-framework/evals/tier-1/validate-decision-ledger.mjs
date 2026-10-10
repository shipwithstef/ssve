#!/usr/bin/env node
/** Tier 1: decision ledger records predictions, replays them with observed values, and measures range calibration. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { calibration, review, predictionRow, readLedger } from "../../../scripts/decision-ledger.mjs";
import { evaluate, rangeOf, SCHEMA } from "../../../scripts/decision-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = path.join(root, "scripts/decision-ledger.mjs");
const model = { schema: SCHEMA, question: "x or the sure thing?", samples: 20000, seed: 3,
  objective: { metric: "value", unit: "pts" },
  variables: { x: { dist: "uniform", low: 0, high: 1 }, sure: { dist: "const", value: 0.4 } },
  options: [{ id: "risky", value: "x" }, { id: "safe", value: "sure" }] };

function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ledger-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "m.json"), JSON.stringify(model));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args, "--ledger", path.join(dir, "l.jsonl")], { cwd: dir, encoding: "utf8" });
  return { dir, run, rows: () => readLedger(path.join(dir, "l.jsonl")) };
}

test("record → observe → review replays the model with observed values pinned", (t) => {
  const w = workspace(t);
  assert.equal(w.run("record", "--model", "m.json", "--id", "d1").status, 0);
  const pred = w.rows()[0];
  assert.equal(pred.type, "prediction"); assert.equal(pred.winner, "risky"); assert.equal(pred.model_path, "m.json");
  assert.ok(Math.abs(pred.variables.x.p10 - 0.1) < 1e-9 && Math.abs(pred.variables.x.p90 - 0.9) < 1e-9);
  assert.equal(pred.variables.sure, undefined, "constants are not calibrated");
  assert.equal(w.run("observe", "--id", "d1", "--var", "x=0.2").status, 0);
  const r = review(w.rows(), "d1", { root: w.dir });
  assert.equal(r.hindsight.still_right, false); assert.equal(r.hindsight.winner, "safe");
  assert.deepEqual(r.triggers_fired, ["x"]);
  assert.match(w.run("review", "--id", "d1").stdout, /safe would win; revisit triggers fired: x/);
});

test("calibration reports hit rate against the 80% range and the direction of misses", () => {
  const rows = [];
  const res = evaluate(model);
  for (let i = 0; i < 5; i++) rows.push(predictionRow(model, res, { id: `p${i}` }));
  // reality keeps landing above the declared range → shift up and widen
  [0.95, 0.97, 0.99, 0.5, 0.92].forEach((x, i) => rows.push({ type: "observation", id: `p${i}`, variables: { x } }));
  rows.push({ type: "observation", id: "p0", metric: 0.5 }, { type: "observation", id: "p1", metric: 0.99 });
  const c = calibration(rows);
  assert.equal(c.predictions, 5); assert.equal(c.outcomes_observed, 2); assert.equal(c.outcome_hit_rate, 0.5);
  const x = c.variables.find((v) => v.variable === "x");
  assert.equal(x.observations, 5); assert.equal(x.hit_rate, 0.2); assert.equal(x.misses_above, 4);
  assert.match(x.advice, /shift up and widen/);
});

test("rangeOf matches the closed-form quantiles", () => {
  const tri = rangeOf({ dist: "triangular", low: 0, mode: 0, high: 1 }); // CDF 1-(1-x)^2
  assert.ok(Math.abs(tri.p10 - (1 - Math.sqrt(0.9))) < 1e-9 && Math.abs(tri.p90 - (1 - Math.sqrt(0.1))) < 1e-9);
  const ln = rangeOf({ dist: "lognormal", p10: 10, p90: 40 });
  assert.ok(Math.abs(ln.p10 - 10) < 1e-6 && Math.abs(ln.p90 - 40) < 1e-6 && Math.abs(ln.p50 - 20) < 1e-6);
});

test("usage errors: duplicate record, unknown id, malformed --var, empty observe", (t) => {
  const w = workspace(t);
  assert.equal(w.run("record", "--model", "m.json", "--id", "d1").status, 0);
  for (const args of [["record", "--model", "m.json", "--id", "d1"], ["observe", "--id", "nope", "--metric", "1"], ["observe", "--id", "d1", "--var", "x=abc"],
    ["observe", "--id", "d1"], ["review", "--id", "nope"], ["bogus"], ["record"]]) {
    assert.equal(w.run(...args).status, 2, args.join(" "));
  }
  assert.equal(w.rows().length, 1, "failed commands append nothing");
});

test("review pins observations over profile overrides and drops their correlations", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ledger-corr-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const m = { schema: SCHEMA, question: "budget or not", samples: 5000, seed: 2,
    variables: { budget: { dist: "uniform", low: 0, high: 10 }, gain: { dist: "uniform", low: 0, high: 10 } },
    correlations: [{ a: "budget", b: "gain", rho: 0.5 }],
    options: [{ id: "spend", value: "gain - budget / 2" }, { id: "hold", value: 3 }],
    profiles: { tight: { variables: { budget: { dist: "const", value: 0 } } } } };
  fs.writeFileSync(path.join(dir, "m.json"), JSON.stringify(m));
  const res = evaluate(m, { profile: "tight" });
  const rows = [predictionRow(m, res, { id: "c1", modelPath: "m.json", profile: "tight" }),
    { type: "observation", id: "c1", variables: { budget: 10, gain: 4 } }];
  const r = review(rows, "c1", { root: dir });
  // observed budget 10 must win over the profile's 0: spend = 4 - 5 = -1 < hold 3
  assert.equal(r.hindsight.winner, "hold");
});

test("review says the model file is missing instead of 'no observations'", (t) => {
  const w = workspace(t);
  assert.equal(w.run("record", "--model", "m.json", "--id", "d1").status, 0);
  assert.equal(w.run("observe", "--id", "d1", "--var", "x=0.2").status, 0);
  fs.rmSync(path.join(w.dir, "m.json"));
  assert.match(w.run("review", "--id", "d1").stdout, /model file not found at/);
});
