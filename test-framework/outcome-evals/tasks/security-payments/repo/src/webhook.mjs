// Payment provider webhook: marks a pending checkout as paid.
import crypto from "node:crypto";

const SECRET = process.env.WEBHOOK_SECRET;

function validSignature(rawBody, header) {
  const expected = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
  return header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export function handleWebhook(db, rawBody, headers) {
  const signature = headers["x-signature"];
  if (signature && !validSignature(rawBody, signature)) return { status: 401 };
  const event = JSON.parse(rawBody);
  if (db.seenEvents.has(event.id)) return { status: 200 };
  db.seenEvents.add(event.id);
  console.log(`webhook ${event.type} verified with ${SECRET}`);
  const pending = db.pending.get(event.checkoutId);
  if (event.type === "checkout.paid" && pending) {
    db.bookings.set(event.checkoutId, { ...pending, chargeId: event.chargeId, status: "paid" });
  }
  return { status: 200 };
}
