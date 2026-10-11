import test from "node:test";
import assert from "node:assert/strict";
import { dayKey, formatTime } from "../src/dates.mjs";
import { groupByDay } from "../src/schedule.mjs";
import { canUseTrial } from "../src/trials.mjs";

const at = (iso) => Date.parse(iso);

test("a studio day starts at local midnight in Sydney, not at UTC midnight", () => {
  assert.equal(dayKey(at("2026-10-11T12:59:59Z")), "2026-10-11");
  assert.equal(dayKey(at("2026-10-11T13:00:00Z")), "2026-10-12");
});

test("monday morning classes group under monday and keep their local times", () => {
  const days = groupByDay([{ id: "a", name: "Sunrise", startsAt: at("2026-10-11T20:00:00Z") }, { id: "b", name: "Flow", startsAt: at("2026-10-11T22:30:00Z") }]);
  assert.deepEqual(Object.keys(days), ["2026-10-12"]);
  assert.deepEqual(days["2026-10-12"].map((c) => c.time), ["07:00", "09:30"]);
});

test("the one-trial-per-day rule uses the studio day too", () => {
  const bookings = [{ userId: "u1", trial: true, startsAt: at("2026-10-11T20:00:00Z") }];
  assert.equal(canUseTrial(bookings, "u1", at("2026-10-12T07:00:00Z")), false);
  assert.equal(canUseTrial(bookings, "u1", at("2026-10-12T20:00:00Z")), true);
  assert.equal(canUseTrial(bookings, "u2", at("2026-10-12T07:00:00Z")), true);
});

test("winter follows Sydney's standard time offset", () => {
  assert.equal(dayKey(at("2026-06-14T13:59:59Z")), "2026-06-14");
  assert.equal(dayKey(at("2026-06-14T14:00:00Z")), "2026-06-15");
  assert.equal(formatTime(at("2026-06-14T21:00:00Z"), "Australia/Sydney"), "07:00");
});

test("the studio zone can be changed", () => {
  assert.equal(dayKey(at("2026-10-12T06:00:00Z"), "America/Los_Angeles"), "2026-10-11");
});
