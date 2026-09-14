# Framework Improvement: Retrospective Closure Completeness Guard

**Status:** DRAFT
**Date:** 2026-05-10
**Source:** Example Marketplace WI-233 AI content/image generation closure audit
**Scope:** one framework gap

## Gap

`route-workflow` can currently allow a corrective or retrospective WI to become "framework-complete" with a partial evidence graph.

In the Example Marketplace WI-233 corrective closure, the task graph recorded `write-e2e`, `review-gate`, `verify-promotion`, and closeout. That repaired the runtime evidence trail and landed post-merge verification, but the closure record still lacked:

- full `route-workflow` P1-P6 phase receipts
- `.svc/pipeline-decisions.jsonl` entries for the WI route and pre-dispatch decisions
- an explicit skip ledger for omitted upstream phases such as `validate-feature`, `write-spec`, `plan-changeset`, and `execute-changeset`
- an `audit-implementation` mode selection before the user separately requested this audit
- a durable distinction between "runtime accepted", "corrective closure complete", and "original lane was properly executed"

This creates a repeatable failure mode: after a user challenges an incomplete closeout, the framework can gather strong evidence without mechanically proving that every skipped lane step was intentionally waived and logged.

## Why This Matters

The whole purpose of `route-workflow` is to invoke the proper full flow of actions, or to leave explicit evidence explaining why a step was skipped.

Without a retrospective closure guard, agents can treat a late E2E/review bundle as equivalent to a full framework lane. It is not equivalent. It can verify current behavior, but it cannot retroactively prove that spec, plan, review, audit, and landing order were followed.

## Evidence

Example Marketplace WI-233 AI content/image closure:

- product/fix commits landed first on `main`
- corrective WI added focused E2E, review, verify-promotion, and post-merge evidence
- `.svc/lane-tasks-WI-233.json` contained only corrective tasks
- `.svc/pipeline-decisions.jsonl` had no WI-233 route decision entries
- `audit-implementation` was invoked only after the user explicitly asked whether the framework flow had been proper

The product was fixed, but the original run was not full-framework compliant.

## Proposed Fix

Add a retrospective-closure completeness guard to `route-workflow` and closeout validation.

When a WI is classified as corrective, retrospective, closeout-repair, or "framework closure after runtime proof", require a `retrospective_closure` block in the lane task graph:

```json
{
  "retrospective_closure": {
    "original_runtime_status": "runtime-accepted|failed|unknown",
    "original_framework_status": "complete|incomplete|unknown",
    "required_phase_receipts": ["P1", "P2", "P3", "P4", "P5", "P6"],
    "skipped_lane_steps": [
      {
        "skill": "write-spec",
        "reason": "already existing spec covers behavior|not applicable|cannot be reconstructed",
        "waiver": "accepted|rejected",
        "evidence": "path or command"
      }
    ],
    "audit_implementation_mode": "full|light|skipped",
    "post_merge_verification": "required|not_required",
    "classification": "runtime-accepted|corrective-closure-complete|framework-complete"
  }
}
```

Rules:

1. `framework-complete` is forbidden unless required route-workflow phase receipts and decision-log entries exist.
2. Missing upstream skills require explicit skip entries with evidence.
3. External integration/backend changes require `audit-implementation` mode selection. If skipped, the skip must be justified.
4. Corrective closure may be marked `corrective-closure-complete` even when original execution was incomplete, but the closeout must not claim the original lane was proper.
5. `verify-promotion` should surface the distinction in its final evidence summary.

## Acceptance Criteria

- `route-workflow` documents the retrospective closure classification and required receipts.
- A validator fails a corrective closeout when `.svc/pipeline-decisions.jsonl` has no matching route decision for the WI.
- A validator fails a corrective closeout when upstream lane steps are absent and no skip ledger exists.
- A validator fails external integration/backend corrective closeout when `audit-implementation` mode is absent.
- A corrective WI can explicitly pass as `corrective-closure-complete` without falsely claiming `framework-complete`.
- A replay fixture modeled on Example Marketplace WI-233 fails before the guard and passes after the guard with explicit skip reasons.

## File Impact

Likely files:

- `route-workflow/SKILL.md`
- `route-workflow/references/task-graph-protocol.md`
- `verify-promotion/SKILL.md`
- `test-framework/evals/tier-1/` new validator or existing closeout validator
- `test-framework/fixtures/` new retrospective closure fixture

## Rollback

Remove the new validator and the `retrospective_closure` requirement. Existing task graphs remain readable because the block is additive.
