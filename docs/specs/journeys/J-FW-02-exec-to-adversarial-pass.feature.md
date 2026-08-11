# J-FW-02: Exec Segment Survives The Adversarial Station

**Journey ID:** J-FW-02
**Persona:** S1 — Framework Orchestrator (spec-extracted system persona)
**Covers:** mandatory-chain seg-2-exec (execute-changeset → review-exec G6 → audit-implementation)
**Priority:** Critical

## Why This Journey Matters

The G6 gate caught real CRITICAL fail-opens in nearly every WI of the
2026-06-08/09 marathon AND in WI-399's own runs (first-check amnesty,
require-in-ESM silent fail-open, boilerplate target float). The patch loop and
the never-loosen-a-gate rule are what make those catches land as fixes instead
of waivers.

## User Motivation

The orchestrator wants the executed diff attacked by an independent reviewer
before it can land, with every finding either fixed (plus a regression
fixture) or rejected with evidence — never waved through.

## Behavior Specification

# Feature: Executed diffs pass a cross-family adversarial review with a bounded patch loop

  # Background:
  - Given an exec-record receipt exists for the frozen diff (diff_hash recorded)
  - And the reviewer pair is resolved by scripts/resolve-adversarial-reviewer.sh

  Scenario: FW02-S1 Primary reviewer quota death mid-run falls back cleanly
    Given the primary reviewer (codex) passes the availability probe
    But the review run aborts with a usage-limit error
    When the orchestrator re-dispatches the same package to the fallback (gemini)
    Then the review-exec receipt records primary_used:false with the availability log
    And the fallback's findings enter the same accept/reject loop
    # Maps to: review-exec P2/P3; availability_log field; live-hit 2026-06-10 (run1 G6)

  Scenario: FW02-S2 Findings loop — fix, fixture, re-confirm
    Given the reviewer returns findings with severity CRITICAL or HIGH
    When the orchestrator accepts a finding
    Then the fix lands together with an attack-repro fixture in tier-1
    And a round-2 review re-confirms the fixes with VERDICT PASS before landing
    And a rejected finding carries byte-level or mechanical evidence in the receipt
    # Maps to: review-exec P4 (3-patch cap); WI-399 runs 1+2 (F4 rejection w/ evidence)

  Scenario: FW02-S3 Station wave (WI-382) — lenses fan out over ONE frozen diff
    Given the parallel review station is dispatched on a Claude host
    When the lenses run as locked agents (svc-lens-correctness, svc-lens-security, svc-lens-spec-fidelity, svc-lens-perf)
    Then each returns schemas/review-lens-finding.schema.json entries
    And scripts/review-station-merge.mjs merges mechanically (dedup by file:line, keep-highest-severity)
    And receipts emit sequentially post-barrier
    And a fix re-review re-freezes the diff and re-runs ONLY the originating lens
    # Maps to: references/parallel-review-station.md; WI-399 AC-B3; validate-locked-agents.sh

  Scenario: FW02-S4 No gate loosening disguised as a fix
    Given a finding whose cheapest resolution would weaken a guard predicate
    When the fix is authored
    Then the gate's negative fixture still passes (the gate still blocks its true target)
    And any fixture whose EXPECTED behavior changed cites the superseding decision in its header
    # Maps to: WI-399 non-breaking proof obligations; WI-183↔WI-399 reconciled validator
