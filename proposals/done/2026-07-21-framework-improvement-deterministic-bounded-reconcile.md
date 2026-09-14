# Framework Improvement: Deterministic bounded reconcile

**Status:** IMPLEMENTED AND VERIFIED
**accepted_wi:** WI-472
**Promoted:** 2026-07-21 via PR 161

## Gap

The mandatory receipt reconcile path could wait indefinitely, fan out one validator per historical commit, and advance its watcher checkpoint without a matching successful detached result. The portable notes-authoritative interval also contained 78 unaccounted historical commits.

## Implemented correction

- Bound synchronous child processes and emit explicit degraded outcomes.
- Batch existing-checkpoint receipt validation onto one range call.
- Run verification drives detached behind generation-owned locks and durable outcomes.
- Advance watcher state only when GitHub and every candidate outcome permit it.
- Preserve the legacy human-visible projection through five golden states.
- Repair the exact historical set with a distinct tracked, tree-bound `retroactive-attestation` contract and independent 78-row certification; add no waiver path.

## Verification replay

- Promoted tree equals the final G6-reviewed tree.
- Six mapped Tier-1 validators pass post-merge, including mutation-red and forgery negatives.
- Five live post-merge runs have p95 2652 ms and zero unaccounted commits.
- Canonical and fresh mirror-empty worktrees agree on the 78-row zero-unaccounted result.
- Final evidence: `docs/specs/test-evidence/WI-472/post-promotion-verification.md`.

## Protected boundaries

WI-473 notes synchronization remains separate. Unrelated default-checkout, WI-498, and WI-504 state was not modified to manufacture a green result.
