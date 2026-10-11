#!/usr/bin/env node
/** Tier 1: the live cockpit tells the truth. Statuses, progress, estimates from measured
 * stage history, capacity counting only live agents, stalled goals detected from the
 * times written inside the graph (not the file time, which copies reset), the page's
 * script parses, and the server pushes a new state when a graph changes. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildState } from "../../../scripts/cockpit-state.mjs";
import { startCockpit } from "../../../scripts/cockpit-serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
function repo() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "cockpit-")); fs.mkdirSync(path.join(r, ".svc"));
  const put = (wi, tasks) => fs.writeFileSync(path.join(r, ".svc", `lane-tasks-${wi}.json`), JSON.stringify({ wi, title: wi + " goal", lane: "feature", tasks }));
  // History: plan-changeset took 20 and 40 minutes before (median 40 of [20,40] -> index 1 = 40).
  put("WI-DONE", [{ id: 1, skill: "plan-changeset", status: "completed", skill_receipt: { loaded_at: iso(300), completed_at: iso(280) } }, { id: 2, skill: "plan-changeset", status: "completed", skill_receipt: { loaded_at: iso(260), completed_at: iso(220) } }]);
  put("WI-LIVE", [{ id: 1, skill: "plan-changeset", status: "completed", skill_receipt: { loaded_at: iso(90), completed_at: iso(70) } }, { id: 2, skill: "execute-changeset", status: "in_progress", skill_receipt: { loaded_at: iso(5) } }, { id: 3, skill: "plan-changeset", status: "pending" }]);
  put("WI-OLD", [{ id: 1, skill: "execute-changeset", status: "in_progress", skill_receipt: { loaded_at: iso(60 * 30) } }]);
  return { r, put };
}

test("statuses, progress, estimates and capacity come from the graphs", () => {
  const { r } = repo();
  const s = buildState([r]);
  const g = Object.fromEntries(s.goals.map((x) => [x.id, x]));
  assert.equal(g["WI-DONE"].status, "done");
  assert.equal(g["WI-LIVE"].status, "active");
  assert.equal(g["WI-LIVE"].done, 1); assert.equal(g["WI-LIVE"].total, 3);
  assert.equal(g["WI-OLD"].status, "stalled", "an active stage untouched for 30 h is stalled");
  assert.equal(g["WI-OLD"].agents, 0, "a stalled goal uses no slot");
  assert.equal(s.orchestrator.capacity.in_use, 1);
  assert.equal(s.orchestrator.capacity.free, Math.max(0, s.orchestrator.capacity.slots - 1));
  // Remaining for WI-LIVE: plan-changeset (median 40 min, 3 runs) + execute-changeset with no
  // finished history (overall median).
  assert.ok(g["WI-LIVE"].estimate.basis_runs >= 3);
  assert.equal(g["WI-LIVE"].estimate.stages_without_history, 1);
});

test("a fresh copy of an old graph is still stalled: activity comes from the times inside it", () => {
  const { r } = repo();
  const f = path.join(r, ".svc", "lane-tasks-WI-OLD.json");
  fs.utimesSync(f, new Date(), new Date());
  assert.equal(buildState([r]).goals.find((x) => x.id === "WI-OLD").status, "stalled");
});

test("the page's script parses", () => {
  const html = fs.readFileSync(path.join(ROOT, "templates/cockpit/live.html"), "utf8");
  assert.doesNotThrow(() => new Function(html.split("<script>")[1].split("</script>")[0]));
});

test("the server pushes the new state when a graph changes", async () => {
  const { r, put } = repo();
  const c = startCockpit({ repos: [r], port: 0 });
  await new Promise((ok) => c.server.on("listening", ok));
  const base = `http://127.0.0.1:${c.server.address().port}`;
  try {
    const first = await (await fetch(base + "/api/state")).json();
    assert.equal(first.totals.goals, 3);
    const res = await fetch(base + "/api/events");
    const reader = res.body.getReader();
    const events = [];
    const read = (async () => { let buf = ""; for (;;) { const { value, done } = await reader.read(); if (done) return; buf += new TextDecoder().decode(value); let i; while ((i = buf.indexOf("\n\n")) >= 0) { events.push(JSON.parse(buf.slice(6, i))); buf = buf.slice(i + 2); } } })();
    await new Promise((ok) => setTimeout(ok, 200));
    put("WI-NEW", [{ id: 1, skill: "plan-changeset", status: "in_progress", skill_receipt: { loaded_at: iso(1) } }]);
    const t0 = Date.now();
    while (!events.some((e) => e.totals.goals === 4) && Date.now() - t0 < 5000) await new Promise((ok) => setTimeout(ok, 50));
    assert.ok(events.some((e) => e.totals.goals === 4), "a new goal reaches the open page without a reload");
    await reader.cancel(); await read.catch(() => {});
    assert.match(await (await fetch(base + "/")).text(), /<title>Orchestration Cockpit<\/title>/);
  } finally { c.close(); }
});
