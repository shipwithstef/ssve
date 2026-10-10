# parseDuration

Create `solution.mjs` exporting `parseDuration(text)`, which converts a duration string to an integer number of milliseconds.

Grammar:
- An optional leading `-` makes the result negative. No `+`, no whitespace anywhere.
- One or more components, each a number followed by a unit: `d` (86400000 ms), `h` (3600000), `m` (60000), `s` (1000), `ms` (1).
- Units appear in strictly descending order (d, h, m, s, ms) and each at most once: `1h30m` is valid, `30m1h` and `1m1m` are not.
- Numbers are digits with an optional fractional part (`1.5h`). Only the LAST component may have a fractional part. `.5h` and `1.h` are invalid.
- The result is rounded to the nearest integer millisecond, halves away from zero.
- `0` alone (no unit) is valid and returns 0. Any other number without a unit is invalid.

Throw a `RangeError` for any invalid input, including the empty string and non-strings.
