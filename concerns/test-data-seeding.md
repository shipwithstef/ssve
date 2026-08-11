---
name: test-data-seeding
domain: testing
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/fixtures/**"
    - "**/seed*"
    - "**/test-data/**"
  diff_keywords:
    - "createSeedUser"
    - "fixtureData"
    - "fakerjs"
  packages_imported:
    - "@faker-js/faker"
  env_vars_referenced:
    []

handled_by:
  required_rules: ["helper-app-query-parity"]
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: test-data-seeding — <reason>"

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

# test-data-seeding

Helpers must mirror app queries; shared accounts must be cleaned up.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
