# Add holds to the ledger

This repository has a small ledger: `src/ledger.mjs`, `src/report.mjs`, `src/money.mjs`, and tests in `test/`. Add **holds** (reserved funds) without changing any existing behaviour; every existing test must keep passing.

1. `ledger.hold({ account, amount_cents, at, until })` reserves a positive integer `amount_cents` for `account`. The hold is active for instants `t` with `at <= t < until`. It returns a hold id (a positive integer, unique within the ledger). Throw a `TypeError` for an empty account, a non-positive or non-integer amount, a non-Date `at`/`until`, or `until <= at`.
2. `ledger.release(holdId, at)` ends the hold early: from `at` on, it is no longer active. Releasing an unknown id throws a `RangeError`. Releasing a hold that is already inactive at `at` does nothing.
3. `ledger.available(account, at)` returns `balance(account, at)` minus the sum of holds active at `at`.
4. A debit posting (negative `amount_cents`) must throw an `Error` with `name === "InsufficientFunds"` when, at its `at`, the account has at least one active hold AND the debit would make `available` negative. Debits on accounts with no active hold at that instant still overdraw freely, as before. Credits are never rejected. A rejected debit is not recorded.
5. `monthlySummary` rows gain a `held` field: the sum of holds active at the month's last millisecond (`end`). All other fields stay exactly as they are.
6. `formatSummary` output is unchanged.
