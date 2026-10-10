# mergeIntervals

Create `solution.mjs` exporting `mergeIntervals(list)`. Each interval is a two-element array `[start, end]` of finite numbers describing the half-open range start ≤ x < end.

- Return a new array of non-overlapping intervals, sorted by start, that covers exactly the same points as the input.
- Intervals that overlap or touch merge: `[1,3]` and `[3,5]` become `[1,5]`.
- Empty intervals (`start === end`) cover nothing and are dropped; they never bridge a gap.
- The input may be unsorted and may be empty. Do not modify the input or its inner arrays.

Throw a `RangeError` if any interval has `start > end`, a non-finite number (NaN, Infinity), a length other than 2, or is not an array. Throw a `TypeError` if `list` is not an array.
