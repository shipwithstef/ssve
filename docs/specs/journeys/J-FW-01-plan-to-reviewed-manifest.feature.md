# J-FW-01: Plan Segment Produces A Reviewed, Receipt-Bound Manifest

**Journey ID:** J-FW-01
**Persona:** S1 — Framework Orchestrator (spec-extracted system persona)
**Covers:** mandatory-chain seg-1-plan (plan-changeset → review-plan)
**Priority:** Critical

## Why This Journey Matters

Every non-exempt framework change starts here. If the plan segment can produce
an unreviewed or unbound manifest — or silently survive a stale AC table —
every downstream gate validates the wrong contract (the WI-381 baton staleness
class).

## User Motivation

The orchestrator wants an implementation plan whose blueprints, AC digests, and
review verdict are mechanically bound to the spec revision they were written
against, so execution can trust the baton instead of re-reading prose.

## Behavior Specification

# Feature: Plan segment emits a hash-bound, adversarially reviewed manifest

  # Background:
  - Given an active WI with a spec containing a canonical "## Acceptance Criteria" section
  - And a worktree created from fresh origin/main
  - And a fresh session-contract line appended in that worktree

  Scenario: FW01-S1 Happy path — manifest + review receipts bind to the spec
    Given plan-changeset produces docs/plans/<date>-<name>/manifest.md
    When the plan-manifest receipt is emitted via scripts/emit-receipt.mjs
    Then ac_digests.spec_ac_table_sha256 equals acTableSha256(spec) recomputed by check-chain-receipts
    And the review-plan receipt records the adversarial pair from resolve-adversarial-reviewer.sh
    And check-chain-receipts accepts the envelope members emitted so far
    # Maps to: references/chain-receipt-contract.md; scripts/check-chain-receipts.mjs baton recompute (WI-381); WI-399 AC-B4

  Scenario: FW01-S2 Stale baton — AC table revised after distillation
    Given a plan-manifest receipt whose spec_ac_table_sha256 was computed before a spec AC edit
    When check-chain-receipts recomputes the AC hash
    Then the envelope is rejected with "baton STALE ... re-distill"
    And the orchestrator routes back to plan-changeset instead of executing
    # Maps to: validate-baton-ac-binding.sh; live-hit 2026-06-10 (WI-399 run1 landing)

  Scenario: FW01-S3 Reviewer kickback — findings force a plan revision
    Given the adversarial reviewer returns CRITICAL or HIGH findings on the manifest
    When the orchestrator evaluates each finding with accept/reject + justification
    Then accepted findings produce a revised manifest before any execution dispatch
    And rejected findings carry concrete evidence in the review-plan receipt
    And no execute-changeset dispatch happens while unresolved CRITICAL/HIGH findings exist
    # Maps to: review-plan/SKILL.md iteration loop; review-exec P4 rejection protocol
