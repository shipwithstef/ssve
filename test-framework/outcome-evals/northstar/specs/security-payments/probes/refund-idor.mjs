// A customer must not be able to refund another customer's booking; the owner still can.
import { attempt, fail, load, pass } from "./_lib.mjs";

const { refundBooking } = await load("src/checkout.mjs").catch((e) => fail(`src/checkout.mjs does not load: ${e.message}`));
const refunds = [];
const gateway = { refund: async (chargeId) => { refunds.push(chargeId); } };
const mk = () => ({ bookings: new Map([["b1", { userId: "victim", classId: "c1", chargeId: "ch_victim", status: "paid" }], ["b2", { userId: "u2", classId: "c1", chargeId: "ch_u2", status: "paid" }]]) });

const db = mk();
await attempt(() => refundBooking(db, gateway, { id: "attacker" }, "b1"));
if (refunds.includes("ch_victim") || db.bookings.get("b1").status !== "paid") fail("a customer refunded another customer's booking");

const own = await attempt(() => refundBooking(mk(), gateway, { id: "u2" }, "b2"));
if (own.status !== 200 || !refunds.includes("ch_u2")) fail(`a customer can no longer refund their own booking (status ${own.status})`);
pass("refunds are limited to the booking's owner");
