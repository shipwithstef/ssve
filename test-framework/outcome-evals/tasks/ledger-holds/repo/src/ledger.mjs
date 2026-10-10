// An append-only ledger of postings. Balances may go negative (overdraft is allowed).
export class Ledger {
  constructor() { this.postings = []; }
  post({ account, amount_cents, at }) {
    if (typeof account !== "string" || !account) throw new TypeError("account");
    if (!Number.isInteger(amount_cents) || amount_cents === 0) throw new TypeError("amount_cents");
    if (!(at instanceof Date)) throw new TypeError("at");
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
}
