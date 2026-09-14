---
name: screen-reader-flow
domain: ux
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**"
  diff_keywords:
    - "aria-live"
    - "aria-label"
    - "aria-describedby"
    - "role=\s*['\"]alert"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-ux"]

waiver_format: |
  PR body line: "concern-waived: screen-reader-flow — <reason>"

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
  - wcag-aa-compliance
---

# screen-reader-flow

Live regions announce dynamic updates. Without them, screen reader users miss state changes.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
