---
name: e2e-coverage-for-flow
domain: testing
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/e2e/**"
    - "**/tests/e2e/**"
    - "**/playwright.config*"
  diff_keywords:
    - "test\("
    - "describe\("
    - "page\.goto"
  packages_imported:
    - "@playwright/test"
    - "cypress"
    - "puppeteer"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["write-e2e"]

waiver_format: |
  PR body line: "concern-waived: e2e-coverage-for-flow — <reason>"

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
  []
---

# e2e-coverage-for-flow

Critical user journey gets E2E or it doesn't ship. Smoke + journey separation.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
