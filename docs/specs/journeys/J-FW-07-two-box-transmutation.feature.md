# J-FW-07: Two-Box Planning Transmutes Into A Reviewed Executable Contract

**Journey ID:** J-FW-07
**Persona:** S1 — Framework Orchestrator (headless system persona; no product UI)
**Covers:** AC01–AC18
**Priority:** Critical

## Why This Journey Matters

If Two-Box is a prompt, if conversion invents choices after review, or if new work can emit a legacy receipt, the launch narrative is false.

## Behavior Specification

# Feature: Two-Box planning and deterministic transmutation

  # Background:
  - Given public repository root 0dcd69d255642dcc78db521e95afa2b18ea1276f
  - And this WI's own plan is the inline v4 bootstrap snapshot
  - And after implementation, new work issues plan-manifest v5 (inline or dispatch) and control-plan v2

  Scenario: FW07-S1 Happy path
    Given a substantive non-eligible plan
    When Open Box runs in a facts-only directory with Codex --ephemeral --sandbox read-only --ignore-user-config
    And Contract Box runs as a separate fresh process with SSVE context
    And two scout processes inspect only the Contract original
    And the assessor winner is open_win or contract_win or combination
    Then originals and a distinct contract.revised object are stored
    And the complete v5 contract is prepared before review-plan
    And seal verifies the actual review-plan receipt
    # Maps to: AC02 AC03 AC04 AC05 AC06 AC07 AC08

  Scenario: FW07-S2 Eligibility is recomputed
    Given a caller payload with eligible true
    And the real consumer diff is not quick-fix eligible
    Then Two-Box still runs
    Given quick-fix-eligibility recomputes eligible true on the bound staged tree
    Then v5 lightweight alternative is used and control-plan v2 is not required
    # Maps to: AC02 RD05

  Scenario: FW07-S3 Isolation fail-closed
    Given Open Box would use --read-only, review-package builder, a full worktree cwd, or unproven tools
    Then the run fails before spend
    # Maps to: AC03 RD01

  Scenario: FW07-S4 Contamination and coverage
    Given Open Box cites methodology absent from facts
    Then disallowed_methodology blocks
    Given scouts cite files they were not supplied and did not observe
    Then coverage.complete is false
    # Maps to: AC03 AC04 RD07

  Scenario: FW07-S5 Winner versus disposition
    When unsupported innovation is rejected
    Then winner is still open_win or contract_win or combination and reject_innovation is a disposition
    When conflict is true
    Then conversion is blocked
    # Maps to: AC05 RD10

  Scenario: FW07-S6 Discretion
    Given a missing import of an approved dependency
    Then local repair is allowed
    Given a new dependency
    Then amendment is required
    # Maps to: AC09

  Scenario: FW07-S7 Roles
    Given no role overrides
    Then authors and assessor inherit PLAN and scouts inherit EXEC
    And recipes do not write dispatch-policy or Codex home
    # Maps to: AC10

  Scenario: FW07-S8 Research
    Given sufficient current local evidence
    Then researchDecision is resolved without network
    Given missing confidence without freshness or explicit request
    Then analysis_required
    Given stale external evidence
    Then external_research_required even if score is missing
    Given a research task completes
    Then the requesting task becomes runnable
    # Maps to: AC11 AC12 RD06

  Scenario: FW07-S9 Issuance
    Given emit-receipt after the package lands
    Then schema_version 5 is required and non-bootstrap v4/v3 are refused
    Given notes on the public root
    Then historical versions remain readable
    Given the frozen bootstrap body hash
    Then that exact v4 body remains valid
    # Maps to: AC13 RD02 RD03

  Scenario: FW07-S10 Durable identity, learning, evals, release
    Then git-common-dir objects survive worktree delete
    And learning origin may be either box with evaluate-rule promotion
    And offline tests are not called live proof
    And land/verify and nine-host setup remain the release path
    # Maps to: AC14 AC15 AC16 AC17 AC18
