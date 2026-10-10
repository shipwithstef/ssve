## Test Quality Audit

After confirming tests pass, audit test QUALITY. A passing test that proves nothing is worse than a missing test — it creates false confidence.

| Check | What to look for | Severity |
|---|---|---|
| Disabled/skipped tests | `.skip()`, `@Disabled`, `xit(`, `xdescribe(` on requirement-linked tests | BLOCKER |
| Circular test patterns | System generates its own expected values (test compares output to output) | BLOCKER |
| Assertion strength | `toBeDefined()` or `!= null` where value/behavioral assertion is needed | WARNING |
| Expected value provenance | Expected value came from the system under test, not from the spec or AC | BLOCKER |

**Rule:** Test quality blockers override an otherwise passing verification. A green CI with circular tests is a false green.
