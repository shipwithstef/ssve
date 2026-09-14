Derived-at: 41ff0c713116d13402c4dd219cd5898d57154678
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
