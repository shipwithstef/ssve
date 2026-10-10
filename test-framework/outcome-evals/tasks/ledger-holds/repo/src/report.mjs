import { formatCents } from "./money.mjs";
// Month-by-month totals for one account in one UTC year.
export function monthlySummary(ledger, account, year) {
  const rows = [];
  for (let month = 1; month <= 12; month++) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1) - 1);
    let credits = 0, debits = 0;
    for (const p of ledger.postingsFor(account)) {
      if (p.at < start || p.at > end) continue;
      if (p.amount_cents > 0) credits += p.amount_cents; else debits += -p.amount_cents;
    }
    rows.push({ month, credits, debits, closing: ledger.balance(account, end) });
  }
  return rows;
}
export function formatSummary(rows) {
  return rows.map((r) => `${String(r.month).padStart(2, "0")} +${formatCents(r.credits)} -${formatCents(r.debits)} = ${formatCents(r.closing)}`).join("\n");
}
