---
name: privacy-policy-touch
domain: legal
severity: HIGH
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/privacy*"
    - "**/legal/privacy*"
  diff_keywords:
    - "Privacy Policy"
    - "data we collect"
    - "third-party processors"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: []

waiver_format: |
  PR body line: "concern-waived: privacy-policy-touch — <reason>"

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
  - pii-handling
---

# privacy-policy-touch

Privacy policy must reflect actual data flows. Out-of-date = regulatory risk.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
