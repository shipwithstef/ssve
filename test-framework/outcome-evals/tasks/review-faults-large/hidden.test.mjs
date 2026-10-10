// Grader for the review-exec pillar, multi-file variant. Each planted defect crosses a file
// boundary or contradicts nearby correct-looking code; the concurrency guard in book() and
// the session code are correct and serve as decoys. A finding counts when it names the
// file, a line within 3 of the defect and words that describe it; one test caps noise.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const FAULTS = [
  { id: "any customer can cancel another's booking via body.userId (AC1)", file: "http.mjs", line: 34, words: /userId|body|another|other (user|customer)|any (user|customer)|spoof|idor|authoriz|impersonat|client/i },
  { id: "a failed waitlist charge stops promotion instead of trying the next (AC3)", file: "bookings.mjs", line: 50, words: /break|next|stop|remaining|rest of|abandon|instead of (trying|continu)|continue/i },
  { id: "seats freed after the class started are still offered and charged (AC3)", file: "bookings.mjs", line: 38, words: /start|past|already|after|began|late/i },
  { id: "revenue counts refunded bookings (AC5)", file: "reports.mjs", line: 7, words: /refund|net|cancel|status|overstat|include/i },
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

test("at most 4 findings that match no planted defect", () => {
  const noise = (findings() || []).filter((x) => !FAULTS.some((f) => matches(f, x)));
  assert.ok(noise.length <= 4, `${noise.length} unmatched findings`);
});
