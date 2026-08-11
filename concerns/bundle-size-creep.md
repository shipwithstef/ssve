---
name: bundle-size-creep
domain: performance
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/package.json"
  diff_keywords:
    []
  packages_imported:
    - "lodash"
    - "moment"
    - "rxjs"
    - "three"
    - "d3"
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: bundle-size-creep — <reason>"

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
  - critical-path-rendering
---

# bundle-size-creep

Large deps in client bundle = slow first paint. Tree-shake, lazy-load, swap for lighter alternatives.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
