Derived-at: 3c79f6a8744d95f7516fac2bd8a7e292dc23685f
Restamped: 2026-08-26 — original Derived-at 41ff0c71 unreachable (post-squash artifact, absent from object store); scope scripts/branch-index-freshness.mjs re-verified unchanged since last real derivation and untouched by WI-FW-SKILLS-ROUTING-01; anchors branchIndexFresh:59 / importShapeNote:455 re-checked at HEAD.
Scope-paths:
  - scripts/branch-index-freshness.mjs

## Entry points
_(appended per stage)_

## Callers
- `branch-index-freshness.mjs:59` — `branchIndexFresh(path)`, the freshness check every downstream caller invokes.

## Auth
_(appended per stage)_

## State
_(appended per stage)_

## Currencies & counters
_(appended per stage)_

## Promises
_(appended per stage)_

## Outcomes
_(appended per stage)_

## Data
_(appended per stage)_

## Journeys & tests
_(appended per stage)_

## Time, retry & concurrency
- `branch-index-freshness.mjs:442` — `importShapeNote`, the sidecar-diff fallback path (soft/hard note on missing or drifted stamp).
