# Runtime v2 Migration and Rollback

Read current v2 and N-1 legacy state. Import historical `completed` tasks as `ACCEPTED` only; never
invent consumer acknowledgement, live proof, outcome evidence, or product writes. Preserve every
resolvable receipt and its original source digest. Generate legacy lane/orchestrator/receipt/decision
views from the v2 journal so rollback changes the reader, not canonical evidence history.

A legacy `completed` closeout without release/live/observation proof is intentionally different in
v2: delivery and outcome remain open. This is a correctness repair, not a differential regression.
Older-than-N-1 input fails closed and requires an explicit staged migration.

The migration report binds the immutable source, every imported task, each resolvable evidence
reference, the rollback projection and the v2 generation. Import is not merely a report: it appends
idempotent `TASK_LEGACY_ACCEPTED_IMPORTED` records to the authoritative v2 journal. Those tasks stay
`ACCEPTED`, never `CONSUMED`; freeze/release remains blocked until v2 named consumers acknowledge
their outputs. Replaying the same report appends nothing, a changed report digest fails closed, and
the legacy source bytes are never mutated.
