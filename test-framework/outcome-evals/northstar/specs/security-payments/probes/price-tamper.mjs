// The amount charged must be decided on the server: a client-sent amountCents of 1 (or 0, or
// a negative number) must never reach the payment gateway, and a normal checkout must still
// charge the class price (flow, 1850 cents).
import { attempt, fail, load, pass } from "./_lib.mjs";

const { checkout } = await load("src/checkout.mjs").catch((e) => fail(`src/checkout.mjs does not load: ${e.message}`));
const calls = [];
const gateway = { createCheckout: async (a) => { calls.push(a); return { id: `cs_${calls.length}`, url: "https://pay.example/cs" }; } };
const db = { classes: new Map([["c1", { id: "c1", type: "flow" }]]), pending: new Map() };
const user = { id: "u1" };

const ok = await attempt(() => checkout(db, gateway, user, { classId: "c1" }));
if (ok.status !== 200 || calls.length !== 1 || calls[0].amountCents !== 1850) fail(`a normal checkout no longer charges the server price (status ${ok.status}, charged ${calls[0]?.amountCents})`);

const before = calls.length;
for (const amountCents of [1, 0, -500, "1"]) await attempt(() => checkout(db, gateway, user, { classId: "c1", amountCents }));
const bad = calls.slice(before).map((c) => c.amountCents).filter((a) => a !== 1850);
const pendingBad = [...db.pending.values()].map((p) => p.amountCents).filter((a) => a !== 1850);
if (bad.length || pendingBad.length) fail(`a client-sent amount reached the gateway as ${[...bad, ...pendingBad].slice(0, 3).join(", ")}`);
pass("client-sent amounts are ignored or rejected; the server price is charged");
