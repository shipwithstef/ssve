# J-FW-03: Land Segment Merges, Re-Binds Receipts, And Deploys Live

**Journey ID:** J-FW-03
**Persona:** S1 — Framework Orchestrator (spec-extracted system persona)
**Covers:** mandatory-chain seg-3-land (land-changeset → verify-promotion + live deploy)
**Priority:** Critical

## Why This Journey Matters

Squash merges create NEW SHAs — receipts are per-SHA, so an un-re-bound
envelope orphans the chain evidence (rebase-orphans-tree-bound-notes learning).
And for framework hooks, merging is not deploying: the live host runs the main
CHECKOUT, which must be fast-forwarded with local ledger preservation.

## User Motivation

The orchestrator wants the merge to leave behind a fully verifiable squash
commit (envelope complete), a clean worktree/branch state, and — for hook
changes — the fixes actually LIVE on the machine.

## Behavior Specification

# Feature: Landing re-binds the envelope to the squash and deploys hook changes live

  # Background:
  - Given review-exec and audit-implementation receipts exist with verdict pass
  - And a review-gate receipt for the PR cites the real G6 evidence

  Scenario: FW03-S1 Merge only through the receipt-validating wrapper
    Given the PR is open with the pushed branch
    When the merge runs via scripts/merge-pr-with-review-receipt.mjs --squash --delete-branch
    Then validate-review-receipt.mjs passes BEFORE any gh merge call
    And a direct gh pr merge --admin is never used
    # Maps to: svc-pr-merge-review-receipt guard (workflow-guard); merge wrapper contract

  Scenario: FW03-S2 Envelope re-bound to the squash SHA
    Given the squash commit's tree equals the branch tip's tree
    When the five receipts are re-emitted with --sha <squash> and the quick-fix entry is recomputed honestly
    Then check-chain-receipts reports type:complete for the squash SHA
    And a stale eligible:true quick-fix entry never survives on a non-exempt squash
    # Maps to: rebase-orphans-tree-bound-notes learning; live-hit 2026-06-10 (run1 quick-fix mismatch)

  Scenario: FW03-S3 Notes-ref contention is bounded, never a wedge
    Given a parallel session races refs/notes/svc-receipts pushes
    When the push is attempted with at most 3 fetch+cat_sort_uniq-merge retries
    Then on continued rejection the closeout records "locally durable, reconciles"
    And the merge outcome is unaffected (the squash is already on origin/main)
    # Maps to: project_notes_ref_push_contention memory; svc-state-janitor checklist item 4

  Scenario: FW03-S4 Hook changes deploy to the live checkout with ledger preservation
    Given the squash touches hooks/ and the live host symlinks resolve into the main checkout
    When the main checkout is fast-forwarded
    Then dirty append-only ledgers are preserved via save → checkout → pull → set-union re-append IN ONE step
    And live-appended ledgers (learning-fires) are included in the preserved set
    And worktree removal happens BEFORE branch-ref deletion
    # Maps to: live-hits 2026-06-10 (run2 deploy pull-abort loop; run1 orphaned-HEAD worktree)

  Scenario: FW03-S5 Post-deploy measurement closes the AC
    Given an AC promises a measured improvement (e.g. hook-chain latency)
    When the measurement re-runs against the LIVE deployed state
    Then the delta is recorded in the run record with before/after values
    And an unmeasured "should be faster" claim never closes the AC
    # Maps to: WI-399 AC-A1 (≥15% measured: 333→248ms); pre-post-validation-loop reference
