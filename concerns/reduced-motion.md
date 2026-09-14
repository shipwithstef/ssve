---
name: reduced-motion
domain: ux
severity: LOW
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**"
  diff_keywords:
    - "prefers-reduced-motion"
    - "animate"
    - "motion\."
    - "framer-motion"
  packages_imported:
    - "framer-motion"
    - "motion"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-ux"]

waiver_format: |
  PR body line: "concern-waived: reduced-motion — <reason>"

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

# reduced-motion

Honor prefers-reduced-motion. Vestibular sensitivity is real.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
