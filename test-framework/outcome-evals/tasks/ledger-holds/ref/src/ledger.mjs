// An append-only ledger of postings. Balances may go negative (overdraft is allowed).
export class Ledger {
  constructor() { this.postings = []; this.holds = []; }
  post({ account, amount_cents, at }) {
    if (typeof account !== "string" || !account) throw new TypeError("account");
    if (!Number.isInteger(amount_cents) || amount_cents === 0) throw new TypeError("amount_cents");
    if (!(at instanceof Date)) throw new TypeError("at");
    if (amount_cents < 0 && this.activeHolds(account, at).length && this.available(account, at) + amount_cents < 0) {
      const e = new Error("insufficient funds"); e.name = "InsufficientFunds"; throw e;
    }
    const p = { id: this.postings.length + 1, account, amount_cents, at: new Date(at) };
    this.postings.push(p);
    return p.id;
  }
  balance(account, asOf = null) {
    return this.postings
      .filter((p) => p.account === account && (asOf === null || p.at <= asOf))
      .reduce((sum, p) => sum + p.amount_cents, 0);
  }
  postingsFor(account) { return this.postings.filter((p) => p.account === account); }
  hold({ account, amount_cents, at, until }) {
    if (typeof account !== "string" || !account) throw new TypeError("account");
    if (!Number.isInteger(amount_cents) || amount_cents <= 0) throw new TypeError("amount_cents");
    if (!(at instanceof Date) || !(until instanceof Date) || until <= at) throw new TypeError("window");
    const h = { id: this.holds.length + 1, account, amount_cents, at: new Date(at), until: new Date(until) };
    this.holds.push(h);
    return h.id;
  }
  release(holdId, at) {
    const h = this.holds.find((x) => x.id === holdId);
    if (!h) throw new RangeError("unknown hold");
    if (at < h.until) h.until = new Date(Math.max(at.getTime(), h.at.getTime()));
  }
  activeHolds(account, t) { return this.holds.filter((h) => h.account === account && h.at <= t && t < h.until); }
  available(account, at) { return this.balance(account, at) - this.activeHolds(account, at).reduce((s, h) => s + h.amount_cents, 0); }
}
