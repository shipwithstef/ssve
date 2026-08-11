---
name: i18n-coverage
domain: i18n
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/locales/**"
    - "**/i18n/**"
    - "**/translations/**"
  diff_keywords:
    - "t\(\s*['\"]"
    - "i18n\."
    - "useTranslation"
  packages_imported:
    - "i18next"
    - "react-i18next"
    - "next-i18next"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: i18n-coverage — <reason>"

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

# i18n-coverage

Hardcoded English strings in new UI is the canonical drift.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
