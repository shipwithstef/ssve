# Decision: feature-discussion-phase

## Selected approach

**A1: Dedicated phase + markdown artifact + helper** — keep `discuss-phase` as
an explicit workflow phase, make `docs/specs/discussions/<topic>.md` the
canonical topic record, and use one thin helper for validation and machine-safe
reads.

## Confidence

Medium. This decision is researched and analyzed against the current AC set and
repo conventions. No prototype was needed because the differentiator is artifact
shape and contract fit, not runtime behavior.

## Exploration mode

Abbreviated. Full prototyping was unnecessary because Phase 3 analysis was
decisive once the alternatives were scored against the existing ACs and the
repo's artifact doctrine.

## Evidence chain

- Problem framing: `PROBLEM_BRIEF.md`
- Alternatives explored: `SOLUTION_MAP.md` (4 paradigms, 7 approaches)
- Analysis: `ANALYSIS.md` (tradeoff matrix against AC-derived criteria)
- Prototyping: not required

## Why this approach

- It is the cleanest fit to `DISC-14`, `DISC-15`, `DISC-16`, and `DISC-25`
  because the required discussion artifact is the canonical source of truth,
  not a mirror or generated view.
- It satisfies `DISC-20`, `DISC-21`, and `DISC-24` with the smallest reliable
  enforcement surface: one file for humans, one helper for deterministic reads.
- It preserves `DISC-ZERO` cleanly because the topic can exist before any
  feature spec exists.
- It aligns with current repo practice: markdown-first artifacts, append-only
  `pipeline-decisions.jsonl` for audit, and thin Node helpers for contract
  enforcement.

## Why not the alternatives

- **A2:** lighter at first, but too much contract risk. `write-spec`,
  `design-ux`, `design-tech`, and `review-gate` would each grow their own
  parser and drift on what counts as settled.
- **B1:** the best "reuse existing patterns" option, but it introduces two
  artifact homes per topic. Operators and downstream skills would need to join
  rationale in `decisions/` with live state in `discussions/`.
- **B2:** pushes gray-area handling too close to spec authoring and performs
  badly on `DISC-ZERO`.
- **C1:** technically strong, especially for future aggregation, but it is
  overbuilt for today's need and creates generator/sync complexity in a
  markdown-first repo.
- **C2:** asks an append-only audit log to behave like a mutable workspace,
  which conflicts with current doctrine and weakens `DISC-15`, `DISC-17`, and
  `DISC-18`.
- **D1:** resolves ambiguity too late. It fails the core reason this feature
  exists: early routing and durable continuity before downstream design work.

## Runner-up

**C1: Canonical structured registry + generated discussion markdown** — this
would become the better choice if svc starts needing cross-topic analytics,
bulk automation over many simultaneous discussion artifacts, or non-human
consumers that exceed what one thin helper can safely provide.

## Impact on tech design

- [x] No changes needed (baseline confirmed)
- [ ] Tech design revised — see updated Implementation Notes in feature spec
