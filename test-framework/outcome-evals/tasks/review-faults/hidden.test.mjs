// Grader for the review-exec pillar: did the review find each planted defect, without noise?
// A finding counts when it names the file, a line within 3 of the defect and words that
// describe it. Each planted defect is one test; one more test caps unmatched findings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const FAULTS = [
  { id: "capacity check lets one booking too many in (AC1)", file: "bookings.mjs", line: 15, words: /capacit|full|>=|off.by|overbook|one (too )?many|exceed/i },
  { id: "concurrent refunds pay out more than once (AC2)", file: "bookings.mjs", line: 26, words: /concurr|race|twice|double|same time|parallel|idempot|more than once|multiple/i },
  { id: "invalid or expired token grants owner access (AC3)", file: "auth.mjs", line: 25, words: /fail.?open|catch|any (invalid|malformed|token)|true|expired|forg|bypass|invalid/i },
  { id: "receipt path escapes the receipts directory (AC4)", file: "receipts.mjs", line: 8, words: /travers|\.\.|escape|outside|arbitrary|any file|path/i },
];

function findings() {
  try {
    const j = JSON.parse(fs.readFileSync("REVIEW.json", "utf8"));
    return Array.isArray(j) ? j : Array.isArray(j.findings) ? j.findings : null;
  } catch { return null; }
}
const matches = (f, x) => String(x.file || "").endsWith(f.file) && Math.abs(Number(x.line) - f.line) <= 3 && f.words.test(`${x.issue || ""} ${x.repro || ""} ${x.title || ""}`);

for (const f of FAULTS) {
  test(`finds: ${f.id}`, () => {
    const all = findings();
    assert.ok(all, "REVIEW.json is a JSON array of findings");
    assert.ok(all.some((x) => matches(f, x)), `no finding at ${f.file}:${f.line}`);
  });
}

test("at most 3 findings that match no real defect", () => {
  const all = findings() || [];
  const noise = all.filter((x) => !FAULTS.some((f) => matches(f, x)));
  assert.ok(noise.length <= 3, `${noise.length} unmatched findings`);
});
