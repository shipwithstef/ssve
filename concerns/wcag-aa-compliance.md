---
name: wcag-aa-compliance
domain: ux
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**"
  diff_keywords:
    - "aria-"
    - "role="
    - "tabIndex"
    - "alt=\s*['\"]"
  packages_imported:
    - "@axe-core/*"
    - "eslint-plugin-jsx-a11y"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-ux"]

waiver_format: |
  PR body line: "concern-waived: wcag-aa-compliance — <reason>"

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

# wcag-aa-compliance

AA is the legal floor in many jurisdictions. axe-core + manual sweep on new flows.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
