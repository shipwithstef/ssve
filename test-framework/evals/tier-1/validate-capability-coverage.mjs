#!/usr/bin/env node
/** Tier 1: every skill, agent, engine and hook the framework ships has a coverage row
 * that says how its value is measured, with evidence that exists, and nothing marked
 * unmeasured lacks a next evaluation. This is the guard against shipping a capability
 * that no evaluation knows about. Hermetic; no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import { load, check, build, discoverUnits, OUTCOME_STATUSES } from "../../../scripts/capability-coverage.mjs";

test("the committed coverage map is complete and every citation resolves", () => {
  assert.deepEqual(check(), []);
});

test("rebuilding keeps every hand-entered field", () => {
  const data = load();
  const rebuilt = build(data);
  // Engine and hook status is derived from tests on every build; the rest is hand-entered.
  const hand = (rows) => Object.fromEntries(rows.filter((r) => !["engine", "hook"].includes(r.kind)).map((r) => [r.id, JSON.stringify([r.status, r.evidence, r.next_eval, r.mechanism, r.note, r.claim])]));
  assert.deepEqual(hand(rebuilt.rows), hand(data.rows));
});

test("every shipped unit is discovered: all manifest skills, agents and hook ids", () => {
  const units = discoverUnits();
  const kinds = (k) => units.filter((u) => u.kind === k).length;
  assert.ok(kinds("skill") >= 100 && kinds("agent") >= 20 && kinds("engine") >= 100 && kinds("hook") >= 20);
  assert.ok(units.some((u) => u.id === "skill:blind-control-plan"), "Two-Box planning is a tracked unit");
});

test("negative: a unit without a row, an unmeasured row without a next step and a dead citation all fail", () => {
  const data = load();
  const missing = { ...data, rows: data.rows.filter((r) => r.id !== "skill:blind-control-plan") };
  assert.ok(check(missing).some((p) => p.startsWith("skill:blind-control-plan: no row")));
  const row = data.rows.find((r) => r.kind === "skill" && r.status === "unmeasured");
  const noNext = { ...data, rows: data.rows.map((r) => (r === row ? { ...r, next_eval: undefined } : r)) };
  assert.ok(check(noNext).some((p) => p.includes("without next_eval")));
  const dead = { ...data, rows: data.rows.map((r) => (r === row ? { ...r, status: "ceiling", evidence: ["no/such/file.json"] } : r)) };
  assert.ok(check(dead).some((p) => p.includes("does not exist")));
  const badClaim = { ...data, rows: data.rows.map((r) => (r === row ? { ...r, status: "ceiling", evidence: ["claim:no-such-claim"] } : r)) };
  assert.ok(check(badClaim).some((p) => p.includes("unknown claim")));
  const measuredNoEvidence = { ...data, rows: data.rows.map((r) => (r === row ? { ...r, status: "gain-measured", evidence: [] } : r)) };
  assert.ok(check(measuredNoEvidence).some((p) => p.includes("without evidence")));
  assert.ok(OUTCOME_STATUSES.includes("ceiling"));
});
