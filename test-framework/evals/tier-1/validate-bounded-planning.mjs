#!/usr/bin/env node
/** Tier 1: bounded planning holds together end to end (review of PR #127).
 * - A bounded graph passes the task-graph lane validator: the brief stands in for
 *   write-spec, and only in bounded mode.
 * - Raising risk into an irreversible zone reopens completed light reviews instead of
 *   relabelling them; promotion to a contract plan reopens the brief and light reviews
 *   and clears the bounded metadata.
 * - The compiler's command line honours --delivery-profile. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileDeliveryGraph } from "../../../scripts/compile-delivery-graph.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const input = { wi: "WI-BP-1", lane: "greenfield", change_type: "feature", user_intent: "Prototype a browser game", delivery_profile: "prototype", planned_files: ["src/game.js"], risk_flags: ["user-facing"] };
const bySkill = (g, s) => g.tasks.filter((t) => t.metadata.skill === s);
const laneCheck = (graph) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bp-")), "g.json");
  fs.writeFileSync(f, JSON.stringify(graph));
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/validate-task-graph-lane.mjs"), f], { encoding: "utf8" });
  return { status: r.status, out: JSON.parse(r.stdout || "{}") };
};

test("a bounded graph passes the lane validator; the brief stands in for write-spec only in bounded mode", () => {
  const g = compileDeliveryGraph(input);
  const ok = laneCheck(g);
  assert.equal(ok.status, 0, JSON.stringify(ok.out.laneValidation?.missing));
  assert.deepEqual(ok.out.laneValidation.substituted.map((x) => x.skill), ["write-spec"]);
  const contract = structuredClone(g);
  contract.delivery_graph.planning.mode = "contract";
  assert.equal(laneCheck(contract).status, 1, "a contract graph without write-spec still fails");
  const noBrief = structuredClone(g);
  for (const t of bySkill(noBrief, "plan-changeset")) delete t.metadata.plan_mode;
  assert.equal(laneCheck(noBrief).status, 1, "bounded without a brief-mode plan still needs write-spec");
});

test("touching an irreversible zone reopens completed light reviews instead of relabelling them", () => {
  const done = compileDeliveryGraph(input);
  for (const t of done.tasks) t.status = "completed";
  const again = compileDeliveryGraph({ ...input, planned_files: ["src/game.js", "src/auth.js"], existing_graph: done });
  for (const s of ["review-plan", "review-exec", "audit-implementation"]) {
    const [t] = bySkill(again, s);
    assert.equal(t.metadata.review_depth, "full", s);
    assert.equal(t.status, "pending", `${s} is reopened, not marked completed at full depth`);
    assert.equal(t.metadata.reopened.previous.startsWith("single"), true);
  }
  assert.equal(bySkill(again, "execute-changeset")[0].status, "completed", "stages whose depth did not change stay done");
  assert.ok(again.delivery_graph.mutation_history.some((m) => m.action === "reopen_for_depth"));
});

test("promotion to a contract plan reopens the brief and light reviews and clears bounded metadata", () => {
  const done = compileDeliveryGraph(input);
  for (const t of done.tasks) t.status = "completed";
  const prod = compileDeliveryGraph({ ...input, delivery_profile: "production", existing_graph: done });
  assert.equal(prod.delivery_graph.planning.mode, "contract");
  for (const s of ["plan-changeset", "review-plan", "review-exec", "audit-implementation"]) {
    const t = bySkill(prod, s)[0];
    assert.equal(t.status, "pending", s);
    for (const k of ["plan_mode", "review_depth", "execution"]) assert.equal(t.metadata[k], undefined, `${s}.${k} cleared`);
  }
});

test("the command line honours --delivery-profile", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/compile-delivery-graph.mjs"), "--wi", "WI-TEST", "--lane", "greenfield", "--change-type", "feature", "--intent", "demo", "--delivery-profile", "prototype"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).delivery_graph.planning.mode, "bounded");
});
