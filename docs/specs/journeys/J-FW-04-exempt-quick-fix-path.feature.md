# J-FW-04: Exempt-Class Work Rides The Quick-Fix Carve-Out Honestly

**Journey ID:** J-FW-04
**Persona:** S1 — Framework Orchestrator (spec-extracted system persona)
**Covers:** quick-fix eligibility carve-out (WI-360/376) for docs/state commits
**Priority:** High

## Why This Journey Matters

The carve-out keeps docs-class intake fast — but it is the chain's softest
edge: a code file smuggled under an exempt path, or a stale eligible:true
entry on a squash, silently removes the envelope requirement (the S1
reproduced-hole class, closed by WI-396).

## User Motivation

The orchestrator wants intake-speed for analyses, WI filings, and ledger
appends without ever letting executable content ride the docs lane.

## Behavior Specification

# Feature: Quick-fix receipts cover exactly the exempt class, nothing more

  Scenario: FW04-S1 Docs-only commit auto-earns its tree-bound receipt
    Given a commit touching only docs/specs, docs/analysis, and append-only .svc ledgers
    When the commit lands
    Then quick-fix-eligibility computes eligible:true with the file list
    And the receipt's tree_hash matches the commit tree (squash-invariant)
    And the pre-push gate accepts the range without a 5-receipt envelope
    # Maps to: scripts/quick-fix-eligibility.mjs; WI-360/376 carve-out; chain-receipt-contract

  Scenario: FW04-S2 Code under an exempt path is rejected
    Given a commit adding a .js or .mjs file under docs/specs/
    When eligibility is computed
    Then eligible is false with the offending file named
    And the push requires the full envelope
    # Maps to: WI-396 exempt-code negative fixture (S1 hole, reproduced then closed)

  Scenario: FW04-S3 Exempt-class PR merges with a logged bypass, not a fake review
    Given an exempt-class PR with no G6 review (none is required)
    When the merge wrapper validates
    Then eligibility passes via a pipeline-decisions review_gate_bypass entry with pr, reasoning, approved_by
    And no review receipt claiming a review-that-never-happened is fabricated
    # Maps to: validate-review-receipt.mjs bypass path; never-fabricate rule (WI-394)

  Scenario: FW04-S4 Non-exempt squash cannot keep an exempt-claiming receipt
    Given a squash whose diff includes hook code
    When its note carries an eligible:true quick-fix entry from any earlier state
    Then check-chain-receipts rejects with "eligibility mismatch"
    And the entry must be recomputed honestly (eligible:false + envelope)
    # Maps to: WI-396 receipt-content binding; live-hit 2026-06-10 (run1 landing)
