---
name: number-locale
domain: i18n
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**"
  diff_keywords:
    - "toLocaleString"
    - "Intl\.NumberFormat"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: number-locale — <reason>"

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

# number-locale

1,000.00 vs 1.000,00. Intl, not hand-rolled.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
