# Important Rules — detail

Moved verbatim from SKILL.md (progressive disclosure).

## Important Rules

1. **Never generate journeys without reading specs first.** The whole point is
   traceability. Every scenario step must trace to a real AC ID.

2. **Iterate, don't dump (unless auto mode).** In interactive mode: 2-3 journeys per
   iteration, get user approval between iterations. In auto mode: generate all journeys
   without pausing, present the full set at the end for review. The PM still owns the
   narrative — auto mode just defers the review to the end.

3. **Critical first.** New user activation, core loop, conversion. Always
   start with these three. Everything else comes later.

4. **Standalone interactions are NOT journeys.** Theme toggle, password change,
   notification preferences — these are feature-level ACs. Don't force them
   into journeys.

5. **Scenarios describe user behavior, not system internals.** "When I click"
   not "When the API processes." PMs should be able to read every scenario.

6. **Flag, don't fabricate.** If an AC is missing for a step that clearly
   needs one, flag it in the Coverage Gaps section. Don't invent AC IDs.

7. **Legacy migration is opt-in.** Don't delete old docs without explicit
   user approval. Archive, don't destroy.

8. **Journey docs are source of truth for E2E test scope.** The write-e2e
   skill should read journey docs to understand what cross-feature flows to test.
   Make sure journey docs are written clearly enough for an agent to generate
   tests from them.

9. **E2E-ready journeys must pass the bridge validator.** Before handing a journey
   to `write-e2e`, run `node scripts/verify-journey-e2e-bridge.mjs <journey-file>`.
   The validator requires parseable scenarios, AC/chrome/capability trace tags,
   `## E2E Coverage`, specific UI labels or context instead of generic "primary CTA"
   language, and no scenario longer than 7 Given/When/Then steps.

9. **Every Background must be grounded.** When writing a journey's Background or
   Given preconditions that assume data exists (entities created, flags set, states
   reached), trace backwards: who creates that data? Does another journey cover
   that creation? Does the UI even support it? This is the supply-side check.
   A consumer journey with an ungrounded Background is hiding a product gap —
   the feature looks complete on paper but may be impossible to use because nobody
   can produce what it assumes. This is especially critical for multi-role products
   where Role A produces data that Role B consumes. If you write "Given a seller
   has posted a flash deal" and no seller journey covers posting deals, flag it
   in the Journey Analysis as an Ungrounded Precondition. Don't silently assume
   the producer side exists just because the consumer side works.

---
