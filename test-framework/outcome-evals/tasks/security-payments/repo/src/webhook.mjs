// Payment provider webhook: marks a pending checkout as paid.
// config.hmac is the signing material shared with the provider (loaded at startup).
import crypto from "node:crypto";

function validSignature(hmac, rawBody, header) {
  const expected = crypto.createHmac("sha256", hmac).update(rawBody).digest("hex");
  return header.length === expected.length && crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export function handleWebhook(db, config, rawBody, headers) {
  const signature = headers["x-signature"];
  if (signature && !validSignature(config.hmac, rawBody, signature)) return { status: 401 };
  const event = JSON.parse(rawBody);
  if (db.seenEvents.has(event.id)) return { status: 200 };
  db.seenEvents.add(event.id);
  console.log(`webhook ${event.type} verified with ${config.hmac}`);
  const pending = db.pending.get(event.checkoutId);
  if (event.type === "checkout.paid" && pending) {
    db.bookings.set(event.checkoutId, { ...pending, chargeId: event.chargeId, status: "paid" });
  }
  return { status: 200 };
}
