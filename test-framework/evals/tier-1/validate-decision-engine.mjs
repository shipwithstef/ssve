#!/usr/bin/env node
/** Tier 1: decision engine computes decisions correctly (closed-form checks), deterministically, and refuses bad models. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluate, evaluateProfiles, validateModel, toMarkdown, cholesky, phi, SCHEMA } from "../../../scripts/decision-engine.mjs";
import { compile } from "../../../scripts/lib/decision-expr.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = path.join(root, "scripts/decision-engine.mjs");
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
// x ~ U(0,1) vs a sure 0.4. Closed form: A wins (0.5 > 0.4), P(A best) = 0.6,
// EVPI = ∫₀^0.4 (0.4 − x) dx = 0.08, all of it attributable to x, break-even at x = 0.4.
const coin = (extra = {}) => ({ schema: SCHEMA, question: "x or the sure thing?", samples: 100000, seed: 3,
  variables: { x: { dist: "uniform", low: 0, high: 1, question: "What is x?" }, sure: { dist: "const", value: 0.4 } },
  options: [{ id: "risky", value: "x" }, { id: "safe", value: "sure" }], ...extra });

test("closed-form check: winner, P(best), EVPI, EVPPI and break-even", () => {
  const r = evaluate(coin());
  assert.equal(r.winner.id, "risky");
  near(r.winner.mean, 0.5, 0.005, "mean");
  near(r.winner.p_best, 0.6, 0.006, "P(best)");
  near(r.evpi, 0.08, 0.002, "EVPI");
  const x = r.value_of_information.find((v) => v.variable === "x");
  near(x.evppi, 0.08, 0.003, "EVPPI(x)");
  near(x.break_even.at, 0.4, 0.03, "break-even");
  assert.equal(x.break_even.below, "safe"); assert.equal(x.break_even.above, "risky");
  assert.equal(r.verdict, "ask-first");
  assert.equal(r.next_question.variable, "x");
});

test("a decision no information can change is 'clear' and asks nothing", () => {
  const r = evaluate(coin({ variables: { x: { dist: "uniform", low: 0.5, high: 1 }, sure: { dist: "const", value: 0.4 } } }));
  assert.equal(r.verdict, "clear"); assert.equal(r.next_question, null); assert.equal(r.evpi, 0);
  assert.equal(r.winner.p_best, 1);
});

test("unaskable variables are never the next question", () => {
  const r = evaluate(coin({ variables: { x: { dist: "uniform", low: 0, high: 1, askable: false }, sure: { dist: "const", value: 0.4 } } }));
  assert.equal(r.next_question, null); assert.equal(r.verdict, "decide-and-monitor");
});

test("minimize objectives pick the lowest value", () => {
  const r = evaluate(coin({ objective: { metric: "cost", direction: "min" } }));
  assert.equal(r.winner.id, "safe"); near(r.winner.p_best, 0.6, 0.006, "P(best) when minimizing: safe beats x whenever x > 0.4");
});

test("HARD gates eliminate by probability of violation, not by the base case", () => {
  const m = coin({ options: [{ id: "risky", value: "x", gates: [{ label: "x below 0.9", expr: "x < 0.9", tolerance: 0.05 }] }, { id: "safe", value: "sure" }] });
  const r = evaluate(m);
  const risky = r.options.find((o) => o.id === "risky");
  assert.equal(risky.eliminated, true); near(risky.gates[0].p_fail, 0.1, 0.005, "P(fail)");
  assert.equal(r.winner.id, "safe");
  m.options[0].gates[0].tolerance = 0.2;
  assert.equal(evaluate(m).winner.id, "risky", "a looser tolerance keeps the option");
  const none = evaluate(coin({ gates: [{ label: "impossible", expr: "0" }] }));
  assert.equal(none.verdict, "no-survivor"); assert.equal(none.winner, null);
});

test("correlations are honoured and inconsistent ones are rejected", () => {
  const m = { schema: SCHEMA, question: "corr", samples: 50000, seed: 11,
    variables: { a: { dist: "normal", mean: 0, sd: 1 }, b: { dist: "normal", mean: 0, sd: 1 } },
    correlations: [{ a: "a", b: "b", rho: 0.7 }], derived: { prod: "a * b" },
    options: [{ id: "p", value: "prod" }, { id: "z", value: 0 }] };
  // E[a·b] = rho for standard normals
  near(evaluate(m).options.find((o) => o.id === "p").mean, 0.7, 0.03, "E[ab]");
  const bad = { ...m, variables: { ...m.variables, c: { dist: "normal", mean: 0, sd: 1 } },
    correlations: [{ a: "a", b: "b", rho: 0.95 }, { a: "a", b: "c", rho: 0.95 }, { a: "b", b: "c", rho: -0.95 }] };
  assert.throws(() => evaluate(bad), /not positive definite/);
  assert.throws(() => cholesky([[1, 2], [2, 1]]), /positive definite/);
});

test("distributions land where they should", () => {
  const m = { schema: SCHEMA, question: "dists", samples: 60000, seed: 5,
    variables: { t: { dist: "triangular", low: 0, mode: 3, high: 6 }, l: { dist: "lognormal", p10: 10, p90: 40 }, d: { dist: "discrete", values: [0, 10], weights: [3, 1] } },
    options: [{ id: "t", value: "t" }, { id: "l", value: "l" }, { id: "d", value: "d" }] };
  const o = Object.fromEntries(evaluate(m).options.map((x) => [x.id, x]));
  near(o.t.mean, 3, 0.03, "triangular mean"); near(o.l.p10, 10, 0.4, "lognormal p10"); near(o.l.p90, 40, 1.5, "lognormal p90");
  near(o.d.mean, 2.5, 0.08, "discrete mean");
  near(phi(0), 0.5, 1e-7, "phi(0)"); near(phi(1.96), 0.975, 1e-4, "phi(1.96)");
});

test("profiles re-run the model and report where the winner flips", () => {
  const r = evaluateProfiles(coin({ profiles: { cautious: { variables: { sure: { dist: "const", value: 0.6 } } } } }));
  assert.equal(r.winner.id, "risky");
  assert.equal(r.profiles[0].winner, "safe"); assert.equal(r.winner_flips_by_profile, true);
});

test("seeded runs are byte-identical; a different seed still agrees on the answer", () => {
  const a = JSON.stringify(evaluate(coin())), b = JSON.stringify(evaluate(coin()));
  assert.equal(a, b);
  assert.equal(evaluate(coin({ seed: 99 })).winner.id, "risky");
});

test("expression language: precedence, functions, and no escape hatch", () => {
  const env = { a: 2, b: 3 }; const s = new Set(["a", "b"]);
  assert.equal(compile("a + b * 2 ^ 2", s).fn(env), 14);
  assert.equal(compile("-a ^ 2", s).fn(env), -4);
  assert.equal(compile("max(a, b) - min(a, b) + clamp(10, 0, 5)", s).fn(env), 6);
  assert.equal(compile("a < b && b <= 3 ? 1 : 0", s).fn(env), 1);
  assert.equal(compile("if(a > b, 1, 2)", s).fn(env), 2);
  assert.throws(() => compile("process.exit(1)", s), /unknown function/);
  assert.throws(() => compile("constructor", s), /unknown identifier/);
  assert.throws(() => compile("a +", s), /unexpected end/);
  assert.throws(() => compile("a ; b", s), /unexpected character/);
});

test("validation names every problem", () => {
  const errs = validateModel({ schema: SCHEMA, question: "q", variables: { x: { dist: "triangular", low: 2, mode: 1, high: 3 }, y: { dist: "weird" } },
    options: [{ id: "a", value: "x + nope" }], correlations: [{ a: "x", b: "zz", rho: 2 }] });
  const text = errs.join("\n");
  for (const want of ["low <= mode <= high", "dist must be one of", "at least 2 options", "both must be declared", "rho must be in"]) assert.ok(text.includes(want), `missing: ${want}`);
  assert.match(validateModel({ ...coin(), options: [{ id: "a", value: "x + nope" }, { id: "b", value: 1 }] }).join("\n"), /unknown identifier 'nope'/);
});

test("markdown carries the verdict, the VOI table and computed revisit triggers", () => {
  const md = toMarkdown(evaluateProfiles(coin()));
  assert.match(md, /\*\*Verdict:\*\* ask-first/);
  assert.match(md, /## What would change the decision/);
  assert.match(md, /Re-run if `x` turns out below 0\.\d+, safe becomes the better option\./);
});

test("CLI: example model evaluates; bad input is a usage error", () => {
  const ex = path.join(root, "examples/decisions/launch-channel.model.json");
  const ok = spawnSync(process.execPath, [cli, "evaluate", ex, "--json", "--samples", "5000"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const r = JSON.parse(ok.stdout); assert.ok(r.winner && r.profiles.length === 2);
  assert.equal(spawnSync(process.execPath, [cli, "validate", ex], { encoding: "utf8" }).status, 0);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-de-"));
  try {
    const bad = path.join(tmp, "bad.json"); fs.writeFileSync(bad, JSON.stringify({ schema: SCHEMA, question: "q", options: [] }));
    for (const args of [["evaluate", bad], ["validate", bad], ["nope"], ["evaluate", ex, "--bogus"], ["evaluate", ex, "--samples", "5"]]) {
      const res = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
      assert.equal(res.status, 2, `${args.join(" ")}: ${res.stderr}`);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("a variable no option depends on is never asked about (EVPPI noise floor removed)", () => {
  const m = { schema: SCHEMA, question: "near tie", samples: 20000, seed: 21,
    variables: { a: { dist: "normal", mean: 0, sd: 1 }, b: { dist: "normal", mean: 0.01, sd: 1 }, unused: { dist: "uniform", low: 0, high: 1, question: "irrelevant?" } },
    options: [{ id: "A", value: "a" }, { id: "B", value: "b" }] };
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = evaluate({ ...m, seed });
    const u = r.value_of_information.find((v) => v.variable === "unused");
    assert.ok(u.evppi <= r.voi_threshold, `seed ${seed}: unused evppi ${u.evppi} > threshold ${r.voi_threshold}`);
    assert.notEqual(r.next_question?.variable, "unused", `seed ${seed}`);
    assert.equal(u.break_even, null, `seed ${seed}: no break-even printed for noise`);
  }
});

test("profile overrides are validated like base variables", () => {
  const errs = validateModel(coin({ profiles: { p: { variables: { x: { dist: "uniform", low: 5 } } } } })).join("\n");
  assert.ok(errs.includes("profile 'p' variable 'x': uniform needs numeric high"), errs);
});

test("Object prototype members are not functions", () => {
  for (const f of ["toString", "valueOf", "constructor", "hasOwnProperty"]) assert.throws(() => compile(`${f}(1)`, new Set()), /unknown function/);
});
