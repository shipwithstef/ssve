#!/usr/bin/env node
/** Tier 1: chaos-probe holds a sound app to its steady state under every fault, and each
 * planted defect (state lost on restart, gold lost under concurrent earns, a crash on a
 * malformed body, refusing to serve under clock skew) fails exactly the fault that should
 * catch it. Hermetic: a local fixture server, no network beyond loopback. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probe, plannedFaults } from "../../../scripts/chaos-probe.mjs";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "chaos");

function app() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chaos-app-"));
  for (const f of ["server.mjs", "steady.mjs"]) fs.copyFileSync(path.join(FIX, f), path.join(dir, f));
  return dir;
}

const spec = (fragile) => ({
  start: `BUILT_AT=$(date +%s000) FRAGILE=${fragile} node server.mjs`,
  ready: "/",
  prepare: `for i in 1 2 3; do curl -s -X POST -d '{}' "$BASE_URL/earn" >/dev/null; done`,
  steady: "EXPECT_EARNS=3 node steady.mjs",
  endpoints: [{ method: "POST", path: "/earn" }, { method: "GET", path: "/" }],
  race: { method: "POST", path: "/earn", body: {}, times: 20 },
  flood: 100,
  latency_ms: 50,
  bots: { cmd: "node -e 'process.exit(Number({seed}) > 0 ? 0 : 1)'", seeds: 3 },
});

const verdicts = async (fragile, faults) => Object.fromEntries((await probe(app(), { ...spec(fragile), faults })).faults.map((f) => [f.fault, f.pass]));

test("a sound app survives every fault", async () => {
  const r = await probe(app(), spec(""));
  assert.equal(r.total, 7);
  assert.deepEqual(r.faults.filter((f) => !f.pass).map((f) => `${f.fault}: ${f.detail}`), []);
  assert.equal(r.survival, 1);
});

test("each planted defect fails the fault that should catch it", async () => {
  assert.equal((await verdicts("memory", ["restart"])).restart, false, "state lost on restart");
  assert.equal((await verdicts("race", ["race"])).race, false, "gold lost under concurrent earns");
  assert.equal((await verdicts("parse", ["malformed"])).malformed, false, "crash on a malformed body");
  assert.equal((await verdicts("clock", ["clock"])).clock, false, "refuses to serve under clock skew");
});

test("faults run only when the spec has their inputs", () => {
  assert.deepEqual(plannedFaults({ steady: "true" }), ["restart", "malformed", "flood", "latency", "clock"]);
  assert.deepEqual(plannedFaults({ faults: ["race", "flood"], race: { path: "/x" } }), ["race", "flood"]);
});
