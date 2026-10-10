// Grader for the review-plan pillar: did the review find each planted plan defect?
// A finding counts when its kind matches and it points at the right step (or, for an
// uncovered criterion, the right AC). One more test caps findings that match nothing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const num = (v) => Number(String(v ?? "").replace(/\D/g, "")) || null;
const DEFECTS = [
  { id: "AC3 (retry the next customer when a charge fails) has no step", ok: (x) => x.kind === "uncovered-ac" && num(x.ac) === 3 },
  { id: "step 2 imports src/billing.mjs, which does not exist (payments.mjs has charge)", ok: (x) => x.kind === "missing-file" && num(x.step) === 2 },
  { id: "step 4 uses waitlistView, which step 5 only creates", ok: (x) => x.kind === "bad-order" && [4, 5].includes(num(x.step)) },
  { id: "step 5 has no executable verification", ok: (x) => x.kind === "no-verification" && num(x.step) === 5 },
  { id: "step 6 (email) is not in the feature", ok: (x) => x.kind === "scope-creep" && num(x.step) === 6 },
];

function findings() {
  try {
    const j = JSON.parse(fs.readFileSync("PLAN-REVIEW.json", "utf8"));
    return Array.isArray(j) ? j : Array.isArray(j.findings) ? j.findings : null;
  } catch { return null; }
}

for (const d of DEFECTS) {
  test(`finds: ${d.id}`, () => {
    const all = findings();
    assert.ok(all, "PLAN-REVIEW.json is a JSON array");
    assert.ok(all.some(d.ok), "not found");
  });
}

test("at most 3 findings that match no planted defect", () => {
  const noise = (findings() || []).filter((x) => !DEFECTS.some((d) => d.ok(x)));
  assert.ok(noise.length <= 3, `${noise.length} unmatched findings`);
});
