---
name: ccpa-do-not-sell
domain: privacy
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/ccpa/**"
  diff_keywords:
    - "doNotSell"
    - "CCPA"
    - "optOutSale"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["review-security"]

waiver_format: |
  PR body line: "concern-waived: ccpa-do-not-sell — <reason>"

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
  - consent-management
  - pii-handling
---

# ccpa-do-not-sell

California users get an opt-out from data sale. Surface a clear control + honor it downstream.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
