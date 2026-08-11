# WI-489 Implementation Validation

## Corrective pre/post loop

- Clean-base full Tier-1 baseline: 242 passed, 2 failed.
- Dirty planning-tree baseline: 242 passed, 2 failed, with the documented
  dirty-tree identity replacing the session-freshness identity.
- Fixture-first RED: 97 passed, 9 failed, using fake provider CLIs only.
- Current full targeted launcher replay: 137 passed, 0 failed (incl. 8 phase-to-review-kind guard fixtures).
- Final full Tier-1 candidate: 245 scripts passed, 0 failed, 0 timed out.
- Paid model calls made by these tests: zero.
- Production review timeout: 1,200 seconds; production stale-lock reclaim
  default: 2,460 seconds. Concurrency fixtures use explicit short test-only
  bounds and do not inherit production timing.

The first real review preflight made zero provider calls and exposed a
help-surface false negative for the officially documented `--max-turns` flag.
The configured-argv parser probe now proves that flag, while a negative fixture
proves true parser absence remains an actionable capability hard failure.

The authorized unchanged-package real retry then reached Claude's separate `$5`
dollar ceiling after 424.98 seconds and two turns. Its preserved receipt proves
one Fable process, no fallback, and `$5.519469` reported usage. The launcher now
classifies the structured `error_max_budget_usd` / `budget_exhausted` terminal
as `budget_exhausted` rather than `unknown_provider`, keeps it fallback-ineligible,
and requires explicit owner authority before a higher spend ceiling is used.

The owner subsequently authorized a `$50` limit per complete review. The
launcher now makes that the production default, records it in receipt protocol
evidence, and subtracts the primary's reported cost before setting a fallback
process ceiling. The aggregate-budget fixture proves `$7.25 + $42.75 = $50`.

Independent review then exposed two vacuous fixtures, route-effort
normalization, executable-mode drift, provenance vocabulary drift, unreported
cost handling, missing content proof, stale evidence, a prose fragment, and
receipt-semantic gaps. All ten are fixed or mechanically tightened in the next
candidate; the first findings receipt remains preserved.

The pre-existing failures and the intermediate proposal-triage failure remain
recorded in the plan progress and pre-change baseline evidence; they are not
represented as launcher regressions or as passing runs.

## Supporting checks

- Review-plan read-only replay: 22 passed, 0 failed.
- Markdown AST: 2157 passed, 0 failed.
- Frontmatter AST: 2679 passed, 0 failed.
- Skill structure: 1035 passed, 0 failed.
- Proposal triage: 7 passed, 0 failed.
- Pipeline decision schema: 720 passed, 0 failed.
- Task graph and framework-lane validation: passed.
- Work-item metadata validation: passed.
- Pre/post evidence validation: passed.
- `git diff --check`: passed.

## Runtime contract proved by fixtures

- Fable 5/high is scheduled through 2026-07-19T20:59:59.999Z.
- Opus 4.8/high is scheduled from 2026-07-19T21:00:00Z, which is midnight
  2026-07-20 in Europe/Sofia.
- An owner can select and clear the versioned `fable-high` profile with a
  durable receipt and secure local selection state.
- Fable safeguard routing to Opus is accepted only as a same-process provider
  route with runtime model-usage evidence; it never triggers a second paid Opus
  invocation.
- Availability fallback remains separate, classified, bounded, and limited to
  the accepted Fable availability classes.
- Structured turn-budget exhaustion, authentication, quota, network, timeout,
  and schema failures do not trigger Opus fallback.
