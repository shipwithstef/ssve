# Decision: Candidate Reservoir

## Selected approach

**A1 — native SQLite operational store + deterministic JSON mirror + transactional decision outbox.**

## Confidence

High: primary documentation, repository patterns, AC trade-off analysis, and two focused prototypes agree.

## Evidence chain

- Problem framing: `PROBLEM_BRIEF.md`
- Alternatives explored: `SOLUTION_MAP.md` (3 paradigms, 6 concrete approaches)
- Analysis: `ANALYSIS.md` (all five AC groups)
- Prototyping: `COMPARISON.md` (outbox healing versus file-only lost update)

## Why this approach

It is the only candidate that satisfies ISOLATE-04's native SQLite requirement, ISOLATE-06/07's scoped concurrent state, TRIAGE-04/05's idempotent terminal audit, and the Git-readable mirror requirement together. Node and SQLite supply the transactional core; the small deterministic outbox addresses the unavoidable cross-storage seam explicitly.

## Why not the alternatives

- **A2 on-demand mirror:** terminal commands can leave Git state stale.
- **B1 locked JSON:** fails the native SQLite AC and requires one lock spanning every future mirror/ledger writer.
- **B2 event replay:** attractive audit semantics, but compaction/versioning are accidental complexity at v1 volume and it still fails the SQLite AC.
- **C1 Git cards:** pollutes repository state with high-volume files and cannot atomically protect uncommitted local transitions.
- **C2 remote service:** violates local-only grounding, zero credentials, and customer/storage isolation.

## Runner-up

**B1 locked JSON** would be the choice only if the native SQLite, high-volume cross-project, and concurrent mutation requirements were removed. **B2** becomes worth revisiting only after a separately authorized cross-repository synchronization requirement appears.

## Impact on tech design

- [x] No changes needed; the BASELINED design is confirmed.
- [ ] Tech design revised.
