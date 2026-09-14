# Problem Brief: WI-510 Phase-Receipt Skip Integrity

## Problem statement

The promoted WI-498 graph contains completed `review-plan` and `execute-changeset` tasks with matching loaded skill receipts and complete `phases_executed` arrays. The skip-registry validator rejects them because it recognizes only `skip_reason` or legacy receipt summary fields. The framework needs a deterministic distinction between executed completion, authorized skip, supported historical compatibility, and invalid/ghost completion.

## Upstream context

- Source: `docs/specs/work-items/WI-510.md`
- Requirements: `docs/specs/features/wi-510-phase-receipt-skip-integrity.md`
- Protected replay: `.svc/lane-tasks-WI-498.json`
- Current false red: `test-framework/evals/tier-1/validate-skip-conditions-registry.sh`
- Related consumer: `test-framework/evals/tier-1/validate-lane-tasks-integrity.sh`
- Current normative authorities: Phase-D receipt schema, delivery-graph validator, task-graph protocol, task-state compatibility classifier

## Success criteria

### Must

- PSR-01–07: recognize valid execution while rejecting malformed current receipts and unsafe evidence references.
- PSR-08–13: accept only explicitly authorized, registry-backed current skips.
- PSR-14–18: preserve canonical historical compatibility and replay WI-498 unchanged.
- PSR-19–22: mutation-red fixtures, coherent consumers, aggregate Tier-1, and allowlist removal.

### Should

- One semantic implementation, not copied predicates.
- Deterministic diagnostics naming task, skill, and failed proof branch.
- Pure, fixture-friendly logic with no network or customer database access.

### Nice

- Reusable by future task-completion guards without coupling them to shell parsing.

## Baseline approach

The current baseline is duplicated local predicates:

- the skip-registry validator requires `skip_reason` or loaded receipt plus `output_artifact` / `validation_output`;
- the lane-tasks integrity validator treats any loaded receipt as execution;
- the receipt-shape validator separately checks phase shape and required phase IDs;
- the delivery-graph validator separately checks registry-backed skip authorization.

## Assumptions to challenge

1. A validator must choose between `skip_reason` and receipt evidence in one binary predicate.
2. Existing validators can be patched independently without future drift.
3. Phase evidence must mean permanently retained bytes rather than a safe evidence reference plus separate durable chain evidence.
4. Historical compatibility requires a WI-specific exception.
5. Shell is the best place for multi-document semantic classification.

## Constraints

- WI-498 bytes and Git notes are immutable.
- No allowlist waiver may remain.
- New current malformed or unauthorized state fails closed.
- Existing canonical cutoffs and markers own legacy classification.
- No external service, dependency, database, or provider.
- Planning and implementation must remain separate; exploration cannot pre-implement the fix.
