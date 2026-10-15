# Improvement claim evidence

Copy these when a change claims to improve UX, visuals or animation, copy, performance, conversion, or reliability. Replace every placeholder. Delete a claim you are not making. Leave a metric blank only by removing the row.

Landing-page scores against a predecessor stay in `benchmark-landing`. Acceptance-critical command classification stays in `references/pre-post-validation-loop.md`. Review rounds and rechecks stay in `review-cross-model`.

## Declaration

Write this before the change. If the change is already in the tree, write it against the pre-change revision. Thresholds come from the claim.

```markdown
# Improvement claim

- Claim:
- Target metric:
- Instrument (script, command, or panel; identical for before and after):
- Seeds, viewports, and phase or simulation-time samples:
- Success threshold:
- Guard budgets:
  - bundle size:
  - frame time or CPU:
  - test pass count:
  - accessibility violations:
- Lighter device tier, if one exists:
- Shipped locales, if copy changed:
```

## Evidence table

| Metric | Instrument | Before | After | Threshold | Guard budget | Result |
|---|---|---|---|---|---|---|
| | | | | | | pass / fail / unmeasured |

`unmeasured` blocks `keep`. Workload counts (meshes, triangles, shader keys) stay workload. Frame time is its own row. A device class that was not run stays `unmeasured`.

Side-by-side captures share one viewport, seed, and phase or simulation time. Put those in the filename. Drive animation by phase, not wall clock.

Interactive claims add rows for mouse, touch, keyboard, and reduced motion. Reduced motion keeps the outcome without the motion clock. A lighter device tier is its own row. A copy claim names each shipped locale.

## Stage test kit

Give this to the human on the staged build of the reviewed commit. One pass or fail per item.

| # | Check | How the human can tell | Pass/fail |
|---|---|---|---|
| 1 | | | |

Receipts:

- reviewed commit SHA
- deploy receipt (environment, build id, time)
- probe results (commands and exit codes)

The staged tree is that commit. Production waits for a pass on every row.

## Verdict

```markdown
# Verdict: keep | iterate | revert

- Claim result:
- Guard results:
- Unmeasured:
- Human kit:
- Why this verdict:
```

`keep` requires every target metric measured and inside its threshold, every guard inside budget, and a human pass on the staged commit. Otherwise `iterate` or `revert`.
