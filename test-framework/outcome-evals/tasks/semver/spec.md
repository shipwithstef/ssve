# compareSemver

Create `solution.mjs` exporting `compareSemver(a, b)`, which returns -1, 0 or 1 by Semantic Versioning 2.0.0 precedence.

- A version is `MAJOR.MINOR.PATCH`, optionally followed by `-PRERELEASE` and then optionally `+BUILD`.
- MAJOR, MINOR and PATCH are non-negative integers without leading zeros (`0` is fine, `01` is not).
- PRERELEASE is dot-separated identifiers of `[0-9A-Za-z-]`, none empty; a purely numeric identifier must not have leading zeros.
- BUILD is dot-separated identifiers of `[0-9A-Za-z-]`, none empty (leading zeros allowed). Build metadata is ignored for precedence.
- Precedence: compare MAJOR, MINOR, PATCH numerically. A version with a prerelease has lower precedence than the same version without one. Prerelease identifiers compare left to right: numeric identifiers numerically, alphanumeric ones in ASCII order, numeric lower than alphanumeric, and a shorter set of identifiers is lower when all preceding identifiers are equal.
- Numbers may exceed 2^53; compare them exactly.
- No `v` prefix and no surrounding whitespace.

Throw a `TypeError` if either argument is not a valid version string.
