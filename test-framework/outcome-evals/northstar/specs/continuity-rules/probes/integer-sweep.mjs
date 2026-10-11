// Standing rule from session 1: all money is integer cents. Sweep every class type, member
// and non-member, and cancellation lead times from after the start to two days before it
// (including the exact 24 h and 6 h boundaries); every refund must be a whole number of
// cents, never negative, never more than was paid.
import { fail, load, pass } from "../../../graders/sk-probe.mjs";

const H = 3600000;
const start = Date.parse("2026-11-02T08:00:00Z");
const { refundFor } = await load("src/refunds.mjs").catch((e) => fail(`src/refunds.mjs does not load: ${e.message}`));
const list = [];
for (const classType of ["flow", "yin", "private"]) {
  for (const member of [false, true]) {
    for (let lead = -2; lead <= 48; lead += 0.25) {
      const v = await refundFor({ classType, startsAt: start, member }, start - lead * H);
      if (!Number.isInteger(v) || v < 0) list.push(`${classType}${member ? "/member" : ""} at ${lead} h gives ${v}`);
    }
  }
}
if (list.length) fail(`not whole non-negative cents: ${list.slice(0, 3).join("; ")}`);
pass("every refund in the sweep is a whole number of cents");
