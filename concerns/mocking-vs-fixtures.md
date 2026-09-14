---
name: mocking-vs-fixtures
domain: testing
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/__mocks__/**"
    - "**/test-utils/**"
  diff_keywords:
    - "vi\.mock"
    - "jest\.mock"
    - "sinon\.stub"
  packages_imported:
    - "msw"
    - "nock"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: mocking-vs-fixtures — <reason>"

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

# mocking-vs-fixtures

Mocked DB tests pass when prod migrations break. Use real DB for integration tests.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
