#!/usr/bin/env node
/** Tier 1: route-model picks model+effort by expected cost per completed task, escalates effort before model, stops after 3 rungs, and learns from recorded outcomes. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadIntel, pick, classify, checkIntel, expectedCosts, tally } from "../../../scripts/route-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(root, "scripts/route-model.mjs");
const intel = loadIntel();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "route-model-"));
const cli = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, SVC_ROUTE_ALLOW_FABLE: "", ...env } });
const rows = (taskType, model, effort, pass, fail) => [
  ...Array.from({ length: pass }, () => ({ task_type: taskType, model, effort, outcome: "pass" })),
  ...Array.from({ length: fail }, () => ({ task_type: taskType, model, effort, outcome: "fail", failure_kind: "verify_fail" })),
];

test("committed intel is valid: known models and efforts, <=3 rungs, cost rises per rung, mapped skills exist", () => {
  assert.deepEqual(checkIntel(intel, new Date(intel.models.updated)), []);
  for (const skill of Object.keys(intel.priors.skill_task_types)) {
    assert.ok(fs.existsSync(path.join(root, "skills", skill)) || fs.existsSync(path.join(root, "agents", `${skill}.md`)), skill);
  }
  assert.match(checkIntel(intel, new Date(Date.parse(intel.models.updated) + 400 * 86400000)).join("\n"), /days old/);
});

test("classification: explicit, then skill, then request text, then exec", () => {
  assert.equal(classify({ taskType: "plan" }, intel.priors).taskType, "plan");
  assert.equal(classify({ skill: "review-exec" }, intel.priors).taskType, "review");
  assert.equal(classify({ text: "the checkout page crashes on submit" }, intel.priors).taskType, "debug");
  assert.equal(classify({ text: "rename the helper to parseRow" }, intel.priors).taskType, "mechanical");
  assert.equal(classify({ text: "audit the auth token refresh for injection" }, intel.priors).taskType, "security");
  assert.equal(classify({ text: "implement the CSV export endpoint per the plan" }, intel.priors).taskType, "exec");
  assert.equal(classify({ text: "plan how to implement billing" }, intel.priors).taskType, "plan");
  assert.equal(classify({ text: "review the plan for the importer" }, intel.priors).taskType, "review");
  assert.equal(classify({}, intel.priors).taskType, "exec");
});

test("expected cost counts escalation: E(i) = c(i) + (1-p(i)) * (penalty + E(i+1))", () => {
  const e = expectedCosts([{ cost: 10, mean: 0.5 }, { cost: 20, mean: 0.9 }], 10);
  assert.deepEqual(e, [25, 20]);
});

test("first pick starts cheap when retry is cheap, and higher for high risk or large work", () => {
  assert.deepEqual([pick({ taskType: "exec" }, intel).model, pick({ taskType: "exec" }, intel).effort], ["sonnet", "medium"]);
  assert.equal(pick({ taskType: "mechanical" }, intel).model, "haiku");
  const hi = pick({ taskType: "plan", risk: "high" }, intel);
  assert.ok(hi.rung >= 1, "high risk starts above rung 0");
  assert.ok(pick({ taskType: "writing", size: "L" }, intel).rung >= 1);
});

test("escalation: verify_fail raises effort on the same model first; capability switches model; refusal/infra retry", () => {
  const v = pick({ taskType: "exec", rung: 0, lastFailure: "verify_fail" }, intel);
  assert.deepEqual([v.model, v.effort, v.rung], ["sonnet", "high", 1]);
  assert.equal(v.advisor, "opus");
  const c = pick({ taskType: "exec", rung: 0, lastFailure: "capability" }, intel);
  assert.equal(c.model, "opus");
  assert.equal(pick({ taskType: "exec", rung: 1, lastFailure: "infra" }, intel).rung, 1);
  assert.equal(pick({ taskType: "exec", rung: 1, lastFailure: "refusal" }, intel).rung, 1);
});

test("the ladder stops after the last rung instead of looping", () => {
  const r = pick({ taskType: "exec", rung: 2, lastFailure: "verify_fail" }, intel);
  assert.equal(r.exhausted, true);
  assert.match(r.next, /Stop retrying/);
  const out = cli(["pick", "--task-type", "exec", "--rung", "2", "--last-failure", "verify_fail"]);
  assert.equal(out.status, 3);
});

test("fable rungs are skipped unless allowed", () => {
  const off = pick({ taskType: "plan", risk: "high" }, intel);
  assert.notEqual(off.model, "fable");
  assert.match(off.note, /fable rung skipped/);
  assert.equal(pick({ taskType: "plan", risk: "high", allowFable: true }, intel).model, "fable");
});

test("outcomes move the start: a failing cheap arm is skipped, a proven cheap arm is used", () => {
  const bad = rows("exec", "sonnet", "medium", 2, 18);
  assert.ok(pick({ taskType: "exec" }, intel, bad).rung >= 1, "sonnet/medium failing 90% is no longer the start");
  const good = rows("debug", "opus", "medium", 30, 0);
  const d = pick({ taskType: "debug" }, intel, good);
  assert.deepEqual([d.rung, d.informed], [0, true]);
  assert.ok(d.estimate > 0.9);
});

test("refusal and infra outcomes are not capability evidence", () => {
  const t = tally([
    { task_type: "exec", model: "sonnet", effort: "medium", outcome: "fail", failure_kind: "infra" },
    { task_type: "exec", model: "sonnet", effort: "medium", outcome: "fail", failure_kind: "refusal" },
    { task_type: "exec", model: "sonnet", effort: "medium", outcome: "pass" },
  ]);
  assert.deepEqual(t.get("exec|sonnet|medium"), { n: 1, pass: 1 });
});

test("record appends a valid row and rejects an invalid one; stats reads it back", () => {
  const dir = tmp();
  const file = path.join(dir, "outcomes.jsonl");
  const env = { SVC_MODEL_OUTCOMES: file };
  const ok = cli(["record", "--task-type", "exec", "--model", "sonnet", "--effort", "medium", "--outcome", "fail", "--failure-kind", "verify_fail", "--signal", "tests", "--rung", "0"], env);
  assert.equal(ok.status, 0, ok.stderr);
  const row = JSON.parse(fs.readFileSync(file, "utf8").trim());
  assert.equal(row.signal, "tests");
  assert.equal(row.rung, 0);
  const bad = cli(["record", "--task-type", "exec", "--model", "gpt", "--effort", "medium", "--outcome", "pass"], env);
  assert.equal(bad.status, 2);
  const stats = cli(["stats", "--task-type", "exec", "--json"], env);
  const s = JSON.parse(stats.stdout).find((r) => r.model === "sonnet" && r.effort === "medium");
  assert.equal(s.samples, 1);
});
