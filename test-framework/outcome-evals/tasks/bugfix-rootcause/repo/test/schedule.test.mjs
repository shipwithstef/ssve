import test from "node:test";
import assert from "node:assert/strict";
import { groupByDay } from "../src/schedule.mjs";
import { canUseTrial } from "../src/trials.mjs";

const at = (iso) => Date.parse(iso);
test("afternoon classes group under their day", () => {
  const days = groupByDay([{ id: "a", name: "Flow", startsAt: at("2026-10-12T03:00:00Z") }, { id: "b", name: "Yin", startsAt: at("2026-10-13T04:00:00Z") }]);
  assert.deepEqual(Object.keys(days), ["2026-10-12", "2026-10-13"]);
  assert.equal(days["2026-10-12"][0].time, "14:00");
});
test("one trial per day", () => {
  const bookings = [{ userId: "u1", trial: true, startsAt: at("2026-10-12T03:00:00Z") }];
  assert.equal(canUseTrial(bookings, "u1", at("2026-10-12T05:00:00Z")), false);
  assert.equal(canUseTrial(bookings, "u1", at("2026-10-13T05:00:00Z")), true);
});
