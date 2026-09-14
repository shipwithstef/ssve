---
name: feature-validation-closeout
domain: testing
severity: HIGH
status: active
created: 2026-05-12
last_reviewed: 2026-05-12

signals:
  file_path_patterns:
    - "docs/specs/features/**"
    - "docs/specs/journeys/**"
    - "docs/specs/features/test-evidence/**"
  diff_keywords:
    - "acceptance criteria"
    - "user-facing"
    - "admin-facing"
    - "saved-state"
    - "FEATURE_VALIDATION_LEDGER"
    - "feature_validation_closeout"
  packages_imported: []
  env_vars_referenced: []

handled_by:
  required_rules: []
  required_skills: ["validate-feature", "write-spec", "review-gate", "verify-promotion"]
  optional_skills: ["audit-ac", "write-journeys", "write-e2e", "test-journeys", "track-visuals"]

waiver_format: |
  PR body line: "concern-waived: feature-validation-closeout - <reason>"

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/specs/work-items/**"
  - "**/docs/specs/features/test-evidence/*.template.md"

related_concerns:
  - e2e-test-coverage
  - journey-coverage
---

# feature-validation-closeout

User-facing and admin-facing feature work must close acceptance criteria through persona, journey, runtime, E2E/manual, visual, and saved-state evidence instead of isolated receipts.

# How to think about it

1. Determine whether the change creates or alters user/admin-visible behavior.
2. If yes, require a delivery graph with `feature_validation_closeout` and a `FEATURE_VALIDATION_LEDGER.md` closeout artifact.
3. If no, require an explicit non-user-facing rationale before waiving ledger work.

# Why it exists

This concern captures the WI-305 closeout-ledger failure class: validation fragments can exist while the feature remains unproven end to end.

# Examples

Matches: new feature specs, feature AC changes, saved-state validation claims, journey or E2E evidence updates.

Does not match: work-item bookkeeping, template-only edits, or non-user-facing infrastructure with a recorded waiver.
