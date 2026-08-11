---
name: pricing-tier-touch
domain: business
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/pricing/**"
    - "**/tiers/**"
    - "**/plans/**"
    - "**/components/**/Pricing*"
  diff_keywords:
    - "priceMonthly"
    - "tier:"
    - "plan:"
    - "pricingTier"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["pricing","manage-finops"]

waiver_format: |
  PR body line: "concern-waived: pricing-tier-touch — <reason>"

fires_on:
  - first-introduction
  - bugfix-touching-call-shape
  - new-caller
  - refactor

fires_off:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/docs/**"

related_concerns:
  - paid-payment-api
---

# pricing-tier-touch

Tier changes touch billing + entitlements + landing copy. Cross-system review.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
