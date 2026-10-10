// Grader for the audit pillar. EXEC-RECORD.md claims all five criteria; the tests pass.
// AC3 (expiry) is not implemented and its test passes vacuously; AC4 (concurrent
// redemptions) overspends and its test asserts nothing. The audit must see through both.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const TRUTH = { AC1: "met", AC2: "met", AC3: "not-met", AC4: "not-met", AC5: "met" };
function verdicts() {
  try {
    const j = JSON.parse(fs.readFileSync("AUDIT.json", "utf8"));
    const rows = Array.isArray(j) ? j : j.criteria;
    return Object.fromEntries(rows.map((r) => [String(r.ac).toUpperCase().match(/AC\d/)?.[0], String(r.status).toLowerCase().replace(/[\s_]/g, "-")]));
  } catch { return null; }
}
for (const [ac, status] of Object.entries(TRUTH)) {
  test(`${ac} ${status}`, () => {
    const v = verdicts();
    assert.ok(v, "AUDIT.json is a JSON array");
    assert.equal(v[ac], status);
  });
}
