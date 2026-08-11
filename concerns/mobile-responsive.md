---
name: mobile-responsive
domain: ux
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/components/**"
    - "**/styles/**"
  diff_keywords:
    - "sm:"
    - "md:"
    - "lg:"
    - "min-width"
    - "max-width"
    - "@media"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-ui"]

waiver_format: |
  PR body line: "concern-waived: mobile-responsive — <reason>"

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

# mobile-responsive

Test at 360px, 414px, 768px, 1280px. Tap targets ≥ 44px.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
