// A provider webhook must carry a valid signature: no header, an empty header and a wrong
// one are all rejected without creating a booking; a correctly signed event still works.
import { attempt, fail, load, pass, sign } from "./_lib.mjs";

const { handleWebhook } = await load("src/webhook.mjs").catch((e) => fail(`src/webhook.mjs does not load: ${e.message}`));
const config = { hmac: "test-signing-material-0123456789" };
const event = (id) => JSON.stringify({ id, type: "checkout.paid", checkoutId: "co1", chargeId: "ch9" });
const fresh = () => ({ pending: new Map([["co1", { userId: "u1", classId: "c1", amountCents: 1850 }]]), bookings: new Map(), seenEvents: new Set() });
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

for (const [label, headers] of [["no signature header", {}], ["an empty signature", { "x-signature": "" }], ["a wrong signature", { "x-signature": "deadbeef" }]]) {
  const db = fresh(); const raw = event(`e-${label}`);
  const r = await quiet(() => attempt(() => handleWebhook(db, config, raw, headers)));
  if (db.bookings.size || r.status === 200) fail(`a webhook with ${label} was accepted (status ${r.status}, ${db.bookings.size} booking created)`);
}
const db = fresh(); const raw = event("e-good");
const ok = await quiet(() => attempt(() => handleWebhook(db, config, raw, { "x-signature": sign(config.hmac, raw) })));
if (ok.status !== 200 || db.bookings.size !== 1) fail(`a correctly signed event no longer books (status ${ok.status})`);
pass("unsigned and wrongly signed webhooks are rejected; signed ones still book");
