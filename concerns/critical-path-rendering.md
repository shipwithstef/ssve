---
name: critical-path-rendering
domain: performance
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/index.html"
    - "**/_document.tsx"
    - "**/Layout.tsx"
    - "**/Layout.jsx"
  diff_keywords:
    - "<script"
    - "<link"
    - "preload"
    - "preconnect"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: critical-path-rendering — <reason>"

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
  - bundle-size-creep
---

# critical-path-rendering

LCP, FID, CLS all driven by what blocks render. Defer non-critical, preload critical.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
