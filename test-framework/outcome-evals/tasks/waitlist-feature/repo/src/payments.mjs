// Payment gateway interface; charge() rejects when the card is declined.
export function fakeGateway() {
  let n = 0; const declined = new Set();
  return { declined, async charge(userId, cents) { if (declined.has(userId)) throw new Error("declined"); return { id: `ch${++n}`, userId, cents }; } };
}
