# Solution Map: WI-510 Phase-Receipt Skip Integrity

## Paradigm A: Broaden local acceptance predicates

**Core bet:** The old validator is almost right and needs only another accepted receipt field.

### A1: Accept any non-empty `phases_executed`

- **How:** Add `Array.isArray(phases_executed) && length > 0` to the existing Python predicate.
- **Gains:** Smallest patch; WI-498 passes.
- **Gives up:** Malformed phase entries, empty artifacts, unsafe paths, mismatched skills, and missing required phases can pass.
- **Complexity:** Low.

### A2: Patch phase shape inline in each shell validator

- **How:** Reimplement allowed phase IDs, artifact types, and safe paths in both embedded Python snippets.
- **Gains:** Stronger than A1 without a new runtime module.
- **Gives up:** Duplicates Phase-D and delivery-graph semantics; drift remains likely.
- **Complexity:** Medium and repeated.

## Paradigm B: Canonical semantic classifier

**Core bet:** Completion evidence is a state-classification problem and should have one pure authority.

### B1: Shared Node classifier with thin validator consumers

- **How:** A dependency-free module/CLI classifies each completed task as `executed`, `authorized-skip`, `legacy-compatible`, or `invalid`, returning structured diagnostics. Shell validators invoke the same classifier.
- **Gains:** One state model, testable mutations, safe path handling, reusable by future guards.
- **Gives up:** Adds one internal module/CLI boundary.
- **Complexity:** Medium, bounded.

### B2: Shared JSON result protocol generated once per graph

- **How:** One CLI emits classifications for every task; consumers read cached JSON.
- **Gains:** Efficient for many consumers and auditable output.
- **Gives up:** Adds cache lifecycle, freshness, and write-order questions that WI-510 does not need.
- **Complexity:** Medium-high.

## Paradigm C: Compose existing validators

**Core bet:** Existing receipt-shape and delivery-graph tools already own the rules; orchestration can combine their exit codes.

### C1: Focused shell orchestrator calls both validators

- **How:** Run `validate-skill-receipt-shape.sh` and `validate-delivery-graph.mjs`, then apply a small executed/skip decision.
- **Gains:** Reuses current sources.
- **Gives up:** Whole-graph validators do not expose per-task structured results; WI-498 already fails delivery-graph validation for an independent missing graph, so composition cannot isolate the target semantics.
- **Complexity:** Medium with ambiguous attribution.

### C2: Export functions from existing validators

- **How:** Refactor delivery-graph and receipt-shape code into reusable libraries, then compose.
- **Gains:** Strong long-term deduplication.
- **Gives up:** Broadens WI-510 into two existing validator refactors and increases regression surface.
- **Complexity:** High.

## Paradigm D: Normalize history instead of validator semantics

**Core bet:** Current rules are correct; old graph data should be made to fit.

### D1: Rewrite WI-498 receipt summaries or delivery graph

- **How:** Add missing legacy summary fields or a delivery graph to WI-498.
- **Gains:** Existing validator passes.
- **Gives up:** Rewrites promoted audit history, fabricates fields after execution, and violates the task boundary.
- **Complexity:** Low code, unacceptable governance cost.

### D2: Keep or expand the main-green allowlist

- **How:** Preserve the known-red row indefinitely.
- **Gains:** No code change.
- **Gives up:** The false red persists and aggregate green is never real.
- **Complexity:** Low, unacceptable outcome.

## Non-obvious option

Use final chain receipts alone as execution proof. This is attractive for promoted commits, but active task graphs do not yet have final-SHA receipts and the task-to-commit mapping is not one-to-one. It is a future evidence-authenticity enhancement, not a replacement for task-level phase receipts.

## Eliminated early

- D1 and D2 violate explicit user constraints.
- A1 fails the mutation-red security boundary.
- C1 cannot isolate WI-510 because WI-498 has an independent delivery-graph omission.
