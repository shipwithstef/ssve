# Roman numerals

Create `solution.mjs` exporting `toRoman(n)` and `fromRoman(text)`.

- `toRoman(n)` takes an integer from 1 to 3999 and returns its canonical Roman numeral in upper case, using subtractive pairs IV, IX, XL, XC, CD and CM. Throw a `RangeError` for anything else: 0, negatives, 4000 or more, non-integers, and non-numbers.
- `fromRoman(text)` accepts ONLY canonical numerals, exactly the strings `toRoman` can produce, and returns the integer. Reject (throw `RangeError`) lower case, empty strings, repeated symbols beyond the canonical form (`IIII`, `VV`), invalid subtractions (`IC`, `VX`, `IL`, `XD`), non-canonical orderings (`IIX`, `XM`), whitespace and non-strings.
