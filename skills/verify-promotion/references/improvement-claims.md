# Improvement claim evidence

Copy these when a change claims to improve UX, visuals or animation, copy, performance, conversion, or reliability. Replace every placeholder. Do not add a row for a claim you are not making. Once a target or guard is declared, keep that row.

Missing evidence stays `unmeasured`. Use N/A only with a documented applicability justification. Never remove a failed or unrun row.

Landing-page scores against a predecessor stay in `benchmark-landing`. Same-proof before/after evidence stays in `execute-changeset`, `audit-implementation`, and `references/pre-post-validation-loop.md`. Reduced-motion behavior stays in `design-ui`. Review rounds and rechecks stay in `review-cross-model`.

## Declaration

Write this before the change, in a traceable artifact that predates the diff. If that declaration is absent, record it missing and block the improvement claim. Do not reconstruct thresholds from an older revision and call them predeclared.

Classify each target as `guardrail` (measurable before production) or `outcome` (needs live traffic and the observation window).

```markdown
# Improvement claim

- Claim:
- Declared at (artifact path and the commit that predates the change):
- Target metric:
- Class: guardrail | outcome
- Instrument (the one already named by the pre/post owners):
- Seeds, viewports, and phase or simulation-time samples:
- Success threshold (from this declaration only):
- Guard budgets:
  - bundle size:
  - frame time or CPU:
  - test pass count:
  - accessibility violations:
- Lighter device tier, if one exists:
- Shipped locales, if copy changed:
- Applicability justification (only when a declared row is N/A):
```

## Evidence table

| Metric | Class | Instrument | Before | After | Threshold | Guard budget | Result |
|---|---|---|---|---|---|---|---|
| | guardrail or outcome | | | | | | pass / fail / unmeasured / pending |

`unmeasured` blocks `keep` for a guardrail. An outcome stays `pending` until the observation lifecycle in `schemas/release-lifecycle-v2.schema.json` has evidence. Pending is not `keep` and does not block delivery verification. Workload counts (meshes, triangles, shader keys) stay workload. Frame time is its own row. A device class that was not run stays `unmeasured`.

Side-by-side captures share one viewport, one deterministic seed, and one phase or simulation time. Put those in the filename. Drive animation by phase, not wall clock.

Interactive claims add rows for mouse, touch, and keyboard. Reduced motion: consume `design-ui` Animation and Motion. A lighter device tier is its own row. A copy claim names each shipped locale.

## Stage test kit

Run this at the authorized release boundary in `land-changeset`, on the reviewed commit, before the production release effect. This kit does not authorize a deploy, a publication, or spending. One pass or fail per item. Bind the human response to that SHA. Absent approval leaves the release task incomplete.

| # | Check | How the human can tell | Pass/fail |
|---|---|---|---|
| 1 | | | |

Receipt `verify-promotion` consumes at G7:

- reviewed commit SHA
- human response bound to that SHA
- probe results (commands and exit codes)

Live post-deploy checks stay in `verify-promotion`. They are not a substitute for this kit.

## Verdict

```markdown
# Verdict: keep | iterate | revert

- Declaration: present and pre-change | missing
- Guardrail results:
- Outcome claims: pending | observed
- Unmeasured:
- Human response (SHA-bound):
- Why this verdict:
```

`keep` requires a traceable pre-change declaration, every guardrail measured and inside its predeclared threshold, every guard inside budget, and a human pass bound to the staged SHA. A missing declaration, a removed row, `unmeasured`, or a failed guardrail is not `keep`. Outcome metrics stay pending until the observation lifecycle has evidence. They do not have to pass before production.
