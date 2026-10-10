#!/usr/bin/env node
/** Tier 1: mirror protocol — skill A/B verdicts per model become keep/slim/caught-up/review advice. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rowsFromReport, advise } from "../../../scripts/mirror-ledger.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const row = (skill, model, verdict, date, delta = 0) => ({ skill, model, verdict, date, pass_delta: delta });

test("report rows carry skill, model, verdict and deltas", () => {
  const rows = rowsFromReport({ tasks: [{ task: "t1", skill: "write-spec", verdict: "earns-keep", pass_delta: 0.4, bare: { pass_rate: 0.5 }, with_skill: { pass_rate: 0.9 }, token_delta: 1200 }] }, { model: "claude-opus-5-5", date: "2026-10-10" });
  assert.deepEqual(rows[0], { date: "2026-10-10", skill: "write-spec", task: "t1", model: "claude-opus-5-5", harness: null, verdict: "earns-keep", pass_delta: 0.4, bare_pass: 0.5, with_pass: 0.9, token_delta: 1200 });
});

test("advice: regress -> review, earned-before-ties-now -> caught-up, repeated ties -> slim, wins -> keep, single tie -> watch", () => {
  const rows = [
    row("a", "m2", "regresses", "2026-10-02", -0.3),
    row("b", "m1", "earns-keep", "2026-06-01", 0.4), row("b", "m2", "no-gain", "2026-10-01"),
    row("c", "m2", "no-gain", "2026-10-01"), row("c", "m2", "no-gain", "2026-10-03"),
    row("d", "m2", "earns-keep", "2026-10-01", 0.3),
    row("e", "m2", "no-gain", "2026-10-01"),
  ];
  const { proposals, unmeasured } = advise(rows, ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(proposals.map((p) => [p.skill, p.action]), [["a", "review"], ["b", "caught-up"], ["c", "slim"], ["e", "watch"], ["d", "keep"]]);
  assert.match(proposals[1].why, /earned its tokens on m1, ties on m2/);
  assert.deepEqual(unmeasured, ["f"]);
});

test("CLI records a report and advises from the ledger", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-"));
  const report = path.join(dir, "r.json");
  const ledger = path.join(dir, "ledger.jsonl");
  fs.writeFileSync(report, JSON.stringify({ tasks: [{ task: "t", skill: "write-spec", verdict: "regresses", pass_delta: -0.2 }] }));
  const run = (...a) => spawnSync(process.execPath, [path.join(root, "scripts/mirror-ledger.mjs"), ...a], { encoding: "utf8" });
  assert.equal(run("record", report, "--ledger", ledger).status, 2, "--model is required");
  assert.equal(run("record", report, "--model", "claude-opus-5-5", "--ledger", ledger).status, 0);
  const out = JSON.parse(run("advise", "--ledger", ledger, "--json").stdout);
  assert.equal(out.proposals[0].action, "review");
});
