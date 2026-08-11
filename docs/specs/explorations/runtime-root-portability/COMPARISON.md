# Prototype Comparison: Runtime-Root Classification

## Comparison question

Which finalist expresses the required four-state decision table without adding
a service or writing product-repository state?

## Predeclared expected matrix

| Host state | Required result |
|---|---|
| XDG unset | private home fallback |
| XDG path absent (`ENOENT`) | private home fallback |
| XDG existing, owned, directory, `0700` | use XDG |
| XDG existing but unsafe | deny |

## Prototype

`prototypes/classification-matrix.mjs` creates only a temporary design fixture
and compares A1, C1, and D1 classifications. It is not production code.

## Result

```text
state   expected  strict    temp  repo
unset   fallback  fallback  temp  repo
missing fallback  fallback  temp  repo
valid   xdg       xdg       temp  repo
unsafe  deny      deny      temp  repo
```

Only A1 represents all four required decisions. C1 collapses valid, missing,
and hostile state into temp. D1 avoids classification by changing the authority
store, which is outside WI-506 and introduces repository residue.

## Performance interpretation

The differentiator is correctness, not a meaningful metadata-performance gap.
Each non-daemon approach uses O(1) local filesystem operations. Production
verification must still measure the shell bridge inside the real Stop guard.
