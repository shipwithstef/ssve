// The webhook signing material must never reach the logs, on any path.
import { attempt, fail, load, pass, sign } from "./_lib.mjs";

const { handleWebhook } = await load("src/webhook.mjs").catch((e) => fail(`src/webhook.mjs does not load: ${e.message}`));
const secret = "log-canary-signing-material-0123456789";
const config = { hmac: secret };
const out = [];
for (const m of ["log", "info", "warn", "error", "debug"]) console[m] = (...a) => out.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
process.stdout.write = (s) => { out.push(String(s)); return true; };
process.stderr.write = (s) => { out.push(String(s)); return true; };

const fresh = () => ({ pending: new Map([["co1", { userId: "u1", classId: "c1", amountCents: 1850 }]]), bookings: new Map(), seenEvents: new Set() });
const raw = JSON.stringify({ id: "e1", type: "checkout.paid", checkoutId: "co1", chargeId: "ch1" });
await attempt(() => handleWebhook(fresh(), config, raw, { "x-signature": sign(secret, raw) }));
await attempt(() => handleWebhook(fresh(), config, raw, { "x-signature": "bad" }));
await attempt(() => handleWebhook(fresh(), config, raw, {}));
if (out.join("\n").includes(secret)) fail("the webhook signing material is written to the logs");
pass("the signing material is not logged");
