# nextCronRun

Create `solution.mjs` exporting `nextCronRun(expr, from)`. It returns the first `Date` strictly after `from` (a `Date`) that matches the cron expression, in UTC, at second 0 and millisecond 0.

Expression: exactly five fields separated by single spaces: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-7, where both 0 and 7 mean Sunday).

Each field is a comma-separated list of items. An item is:
- `*` (every value), a number, or a range `a-b` with a ≤ b;
- any of those followed by `/n` (step n ≥ 1): `*/15`, `10-30/5`, and `5/20` meaning 5 to the field maximum in steps of 20.

Day matching follows classic cron: if both day of month and day of week are restricted (neither is `*`), a day matches when EITHER matches. If only one is restricted, only that one applies. A `*/n` field counts as restricted.

Throw a `RangeError` for any invalid expression:
- the wrong number of fields;
- out-of-range values, `a > b`, or a step of 0;
- empty items, names (`MON`, `JAN`) or any other syntax;
- a non-Date or invalid `from`.

Also throw a `RangeError` when nothing matches within 5 years after `from` (for example `0 0 30 2 *`).
