#!/usr/bin/env node
/** Tier 1: experiment-compare decides A/B tests from counts correctly and refuses bad input. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compare } from "../../../scripts/experiment-compare.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = path.join(root, "scripts/experiment-compare.mjs");

test("identical variants split P(best) evenly and are not shipped", () => {
  const r = compare({ variants: [{ name: "A", trials: 500, successes: 25 }, { name: "B", trials: 500, successes: 25 }], threshold: 0.0005 });
  for (const v of r.variants) assert.ok(Math.abs(v.p_best - 0.5) < 0.02, `${v.name} ${v.p_best}`);
  assert.equal(r.verdict, "keep-running");
});

test("a large, well-sampled difference ships the better variant", () => {
  const r = compare({ variants: [{ name: "A", trials: 20000, successes: 400 }, { name: "B", trials: 20000, successes: 520 }] });
  assert.equal(r.verdict, "ship"); assert.equal(r.leader, "B"); assert.ok(r.variants[0].p_best > 0.999);
  // posterior mean is (1 + 520) / (2 + 20000) under the uniform prior
  assert.ok(Math.abs(r.variants[0].posterior_mean - 521 / 20002) < 1e-12);
});

test("small samples that 'look' 3x better are not decidable", () => {
  const r = compare({ variants: [{ name: "theirs", trials: 40, successes: 3 }, { name: "mine", trials: 38, successes: 1 }], threshold: 0.005 });
  assert.equal(r.verdict, "keep-running"); assert.ok(r.more_trials_per_variant > 0);
  assert.match(r.summary, /Not decidable yet/);
});

test("A/B/n: three variants, value per success, deterministic by seed", () => {
  const args = { variants: [{ name: "a", trials: 3000, successes: 60 }, { name: "b", trials: 3000, successes: 90 }, { name: "c", trials: 3000, successes: 63 }], value_per_success: 29, seed: 4 };
  const r1 = compare(args), r2 = compare(args);
  assert.deepEqual(r1, r2); assert.equal(r1.leader, "b");
  assert.ok(Math.abs(r1.variants.reduce((s, v) => s + v.p_best, 0) - 1) < 1e-9);
  assert.ok(r1.variants.every((v) => Math.abs(v.expected_loss_value - v.expected_loss * 29) < 1e-12));
});

test("bad input is a usage error", () => {
  const bad = [{ variants: [{ name: "A", trials: 10, successes: 1 }] }, { variants: [{ name: "A", trials: 10, successes: 11 }, { name: "B", trials: 1, successes: 0 }] },
    { variants: [{ name: "A", trials: 10, successes: 1 }, { name: "A", trials: 10, successes: 1 }] }, { variants: [{ name: "A", trials: 5, successes: 1 }, { name: "B", trials: 5, successes: 1 }], prior: [0, 1] }];
  for (const b of bad) assert.throws(() => compare(b), (e) => e.code === 2);
  for (const args of [["--variant", "A:10"], ["--variant", "A:10:1"], ["--bogus", "1"], ["--file", "/nonexistent.json"]]) {
    assert.equal(spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" }).status, 2, args.join(" "));
  }
});

test("CLI reads an experiment file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-exp-"));
  try {
    const f = path.join(tmp, "e.json");
    fs.writeFileSync(f, JSON.stringify({ variants: [{ name: "A", trials: 20000, successes: 400 }, { name: "B", trials: 20000, successes: 520 }] }));
    const r = spawnSync(process.execPath, [cli, "--file", f, "--json"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).verdict, "ship");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
