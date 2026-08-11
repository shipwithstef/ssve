---
name: terms-of-service-touch
domain: legal
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/terms*"
    - "**/ToS*"
    - "**/legal/terms*"
  diff_keywords:
    - "Terms of Service"
    - "arbitration clause"
    - "limitation of liability"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: terms-of-service-touch — <reason>"

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

# terms-of-service-touch

Material ToS changes need user notice + (sometimes) re-consent. Lawyer review for substantive changes.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
