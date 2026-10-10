// Grader for the drift pillar: each claim's status, against what the code really does.
// Three claims drifted (session lifetime, refund window, money unit) and three hold.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const TRUTH = { C1: "matches", C2: "drifted", C3: "matches", C4: "drifted", C5: "matches", C6: "drifted" };
function verdicts() {
  try {
    const j = JSON.parse(fs.readFileSync("DRIFT.json", "utf8"));
    const rows = Array.isArray(j) ? j : j.claims;
    return Object.fromEntries(rows.map((r) => [String(r.claim).toUpperCase().match(/C\d/)?.[0], String(r.status).toLowerCase()]));
  } catch { return null; }
}
for (const [claim, status] of Object.entries(TRUTH)) {
  test(`${claim} ${status}`, () => {
    const v = verdicts();
    assert.ok(v, "DRIFT.json is a JSON array of claims");
    assert.equal(v[claim], status);
  });
}
