// Grader for the security-review pillar: each planted exploitable defect in the payment
// path must be reported at its line with words that describe it; one test caps noise.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const FAULTS = [
  { id: "client sets the price it pays", file: "checkout.mjs", line: 7, words: /amount|price|client|tamper|any (price|amount)|pay (less|nothing|1)|trust/i },
  { id: "any customer can refund anyone's booking", file: "checkout.mjs", line: 14, words: /owner|another|other (user|customer)|idor|authoriz|belong|any booking|any user/i },
  { id: "a webhook without a signature header is accepted", file: "webhook.mjs", line: 12, words: /missing|absent|without|no signature|omit|unsigned|forg|bypass|optional/i },
  { id: "the webhook signing material is written to the logs", file: "webhook.mjs", line: 16, words: /secret|log|leak|expos/i },
];

function findings() {
  try {
    const j = JSON.parse(fs.readFileSync("SECURITY.json", "utf8"));
    return Array.isArray(j) ? j : Array.isArray(j.findings) ? j.findings : null;
  } catch { return null; }
}
const matches = (f, x) => String(x.file || "").endsWith(f.file) && Math.abs(Number(x.line) - f.line) <= 3 && f.words.test(`${x.issue || ""} ${x.title || ""}`);

for (const f of FAULTS) {
  test(`finds: ${f.id}`, () => {
    const all = findings();
    assert.ok(all, "SECURITY.json is a JSON array of findings");
    assert.ok(all.some((x) => matches(f, x)), `no finding at ${f.file}:${f.line}`);
  });
}

test("at most 3 findings that match no planted defect", () => {
  const noise = (findings() || []).filter((x) => !FAULTS.some((f) => matches(f, x)));
  assert.ok(noise.length <= 3, `${noise.length} unmatched findings`);
});
