// Grader for the bugfix pillar. The report names one symptom (the schedule); the cause is
// the shared day helper, which also breaks the one-trial-per-day rule nobody reported.
// A symptom-only patch passes the first test and fails the second. DST matters: Sydney is
// UTC+11 in October and UTC+10 in June, so a fixed offset fails too.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { groupByDay } from "./src/schedule.mjs";
import { canUseTrial } from "./src/trials.mjs";

const at = (iso) => Date.parse(iso);

test("reported symptom: Monday morning classes appear under Monday", () => {
  const days = groupByDay([
    { id: "m1", name: "Sunrise", startsAt: at("2026-10-11T20:00:00Z") }, // Mon 07:00 AEDT
    { id: "m2", name: "Flow", startsAt: at("2026-10-11T22:30:00Z") },    // Mon 09:30 AEDT
    { id: "m3", name: "Yin", startsAt: at("2026-10-12T03:00:00Z") },     // Mon 14:00 AEDT
  ]);
  assert.deepEqual(Object.keys(days), ["2026-10-12"]);
  assert.deepEqual(days["2026-10-12"].map((c) => c.time), ["07:00", "09:30", "14:00"]);
});

test("same cause, unreported: one free trial per studio day holds for morning classes", () => {
  const bookings = [{ userId: "u1", trial: true, startsAt: at("2026-10-11T20:00:00Z") }]; // Mon 07:00
  assert.equal(canUseTrial(bookings, "u1", at("2026-10-12T07:00:00Z")), false, "a second trial on Monday evening");
  assert.equal(canUseTrial(bookings, "u1", at("2026-10-12T20:00:00Z")), true, "Tuesday 07:00 is a new day");
});

test("daylight saving: studio days follow Sydney's offset in winter too", () => {
  const days = groupByDay([
    { id: "w1", name: "Late", startsAt: at("2026-06-15T13:30:00Z") },   // Mon 23:30 AEST
    { id: "w2", name: "Early", startsAt: at("2026-06-14T21:00:00Z") },  // Mon 07:00 AEST
  ]);
  assert.deepEqual(Object.keys(days), ["2026-06-15"]);
  const bookings = [{ userId: "u2", trial: true, startsAt: at("2026-06-15T13:30:00Z") }];
  assert.equal(canUseTrial(bookings, "u2", at("2026-06-14T21:00:00Z")), false);
});

test("the existing tests still pass", () => {
  const r = spawnSync(process.execPath, ["--test", "test/"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout.slice(-800));
});
