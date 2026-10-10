import crypto from "node:crypto";

export function createStore() { return new Map(); }

export function issue(store, balanceCents, now = Date.now()) {
  if (!Number.isInteger(balanceCents) || balanceCents <= 0) throw new Error("invalid balance");
  let code;
  do code = crypto.randomBytes(6).toString("hex").toUpperCase(); while (store.has(code));
  store.set(code, { code, balanceCents, issuedAt: now });
  return code;
}

export async function redeem(store, code, priceCents, ledger, now = Date.now()) {
  const card = store.get(code);
  if (!card) throw new Error("unknown gift card");
  const used = Math.min(card.balanceCents, priceCents);
  await ledger.record(code, used);
  card.balanceCents -= used;
  return priceCents - used;
}
