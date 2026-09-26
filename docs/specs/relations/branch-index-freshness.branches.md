Derived-at: aef570d3a2d3f8a7a2cf53b508bfe9576c438fda
Scope-paths:
  - scripts/branch-index-freshness.mjs
  - scripts/check-branch-index.mjs
  - test-framework/evals/tier-1/validate-branch-index-import-shape.mjs

## Entry points and callers
- `scripts/branch-index-freshness.mjs:59` — `branchIndexFresh` checks committed cited-file changes and recorded import shape.
- `scripts/check-branch-index.mjs:34` — CLI checks one index or all tracked indexes, returning failure for stale or unresolved evidence.

## State and behavior
- `scripts/branch-index-freshness.mjs:30` — parse the source commit and scope paths from the index header.
- `scripts/branch-index-freshness.mjs:312` — discover static default, named and namespace imports across legal line breaks, plus existing require calls. Comment stripping remains best-effort; this is not a JavaScript parser.
- `scripts/branch-index-freshness.mjs:349` — resolve citations against tracked files; ambiguous paths remain visible.
- `scripts/branch-index-freshness.mjs:414` — stamp cited import sets into a tracked sidecar.
- `scripts/branch-index-freshness.mjs:453` — missing stamps produce a warning; changed recorded imports make the index stale. Uncited in-scope changes remain advisory.

## Verification
- `test-framework/evals/tier-1/validate-branch-index-import-shape.mjs:1` — multiline imports, neighboring statements/comments, and actual Two-Box/worktree dependencies.
- Run `node scripts/check-branch-index.mjs --all` after refreshing an index. The recorded source commit must also exist in a fresh consumer clone.
