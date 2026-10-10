#!/usr/bin/env node
/** Tier 1: planning signals — over-engineering index, delivery profiles, and stage activation from a plan manifest. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { score, acIds, checkProfile, loadPlan } from "../../../scripts/overengineering-index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "plan-signals-"));
const lean = {
  scope: { included: ["src/components/Pricing.tsx", "locales/en.json"], excluded: [] },
  changeset_blueprints: [
    { file: "src/components/Pricing.tsx", action: "MODIFY", blueprint: "Show the annual toggle (AC-1)." },
    { file: "locales/en.json", action: "MODIFY", blueprint: "Add the toggle label (AC-2)." },
  ],
  ac_digests: { entries: [{ ac_id: "AC-1" }, { ac_id: "AC-2" }] },
};
const heavy = {
  scope: { included: ["src/a.ts"], excluded: [] },
  changeset_blueprints: [
    { file: "src/plugins/registry.ts", action: "CREATE", blueprint: "A pluggable registry so later we can add providers." },
    { file: "src/plugins/factory.ts", action: "CREATE", blueprint: "Generic factory, future-proof." },
    { file: "src/plugins/base.ts", action: "CREATE", blueprint: "Abstraction layer." },
    { file: "src/export.ts", action: "CREATE", blueprint: "CSV export (AC-1). Add a new dependency papaparse." },
  ],
  ac_digests: { entries: [{ ac_id: "AC-1" }] },
};

test("AC ids come from ac_digests.entries[].ac_id", () => {
  assert.deepEqual([...acIds(lean)].sort(), ["AC-1", "AC-2"]);
});

test("a lean, AC-anchored plan scores lean; a speculative one scores over-engineered with the offenders named", () => {
  const l = score(lean);
  assert.equal(l.band, "lean");
  const h = score(heavy);
  assert.equal(h.band, "over-engineered");
  assert.deepEqual(h.components.unanchored.items, ["src/plugins/registry.ts", "src/plugins/factory.ts", "src/plugins/base.ts"]);
  assert.ok(h.components.speculative.items.includes("pluggable"));
  assert.deepEqual(h.components.deps.items, ["src/export.ts"]);
});

test("task_graph plans that never cite AC ids are not penalised for it", () => {
  const r = score({ task_graph: [{ id: "T01", purpose: "x" }], ac_digests: { entries: [{ ac_id: "AC-1" }] } });
  assert.equal(r.components.unanchored, undefined);
  assert.match(r.notes.join(" "), /cite no AC ids/);
});

test("delivery profiles: prototype is strictest, every profile names tests, chain, review and receipts", () => {
  const p = JSON.parse(fs.readFileSync(path.join(root, "references/delivery-profiles.json"), "utf8"));
  assert.ok(p.profiles[p.default]);
  for (const [name, prof] of Object.entries(p.profiles)) for (const k of ["goal", "tests", "chain", "review", "receipts", "max_index"]) assert.ok(prof[k] !== undefined, `${name}.${k}`);
  assert.ok(p.profiles.prototype.max_index <= p.profiles.mvp.max_index);
  assert.equal(checkProfile(score(heavy), "prototype").over, true);
  assert.equal(checkProfile(score(lean), "prototype").over, false);
  assert.throws(() => checkProfile(score(lean), "enterprise"), /unknown profile/);
});

test("CLI: --profile exits 1 when over, reads SVC_PLAN_BODY markdown, and stage activation runs on a manifest", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "heavy.json"), JSON.stringify(heavy));
  fs.writeFileSync(path.join(dir, "lean.md"), "# Plan\n\n<!-- SVC_PLAN_BODY -->\n```json\n" + JSON.stringify(lean) + "\n```\n");
  const oei = (...a) => spawnSync(process.execPath, [path.join(root, "scripts/overengineering-index.mjs"), ...a], { encoding: "utf8" });
  assert.equal(oei(path.join(dir, "heavy.json"), "--profile", "prototype").status, 1);
  assert.equal(loadPlan(path.join(dir, "lean.md")).ac_digests.entries.length, 2);
  fs.writeFileSync(path.join(dir, "lean.json"), JSON.stringify(lean));
  const act = spawnSync(process.execPath, [path.join(root, "scripts/stage-activation.mjs"), "--manifest", path.join(dir, "lean.json")], { cwd: root, encoding: "utf8" });
  assert.equal(act.status, 0, act.stderr);
  const stages = Object.fromEntries(JSON.parse(act.stdout).map((s) => [s.stage, s.result]));
  assert.equal(stages.plan, "active");
  assert.equal(stages.translations, "active");
  assert.equal(stages.perf, "na");
  const chained = oei(path.join(dir, "lean.json"), "--json", "--chain", "/dev/stdin");
  assert.equal(chained.status, 2, "an unreadable --chain is an input error, not a silent pass");
  const both = spawnSync(process.execPath, [path.join(root, "scripts/stage-activation.mjs"), "--manifest", "x.json", "--staged"], { cwd: root, encoding: "utf8" });
  assert.equal(both.status, 2);
});
