---
name: third-party-script-impact
domain: performance
severity: MEDIUM
status: active
created: 2026-05-07
last_reviewed: 2026-05-07

signals:
  file_path_patterns:
    - "**/index.html"
    - "**/_document.tsx"
    - "**/Layout.*"
  diff_keywords:
    - "gtag"
    - "GA-"
    - "gtm\.start"
    - "fbq\("
    - "pixel"
  packages_imported:
    []
  env_vars_referenced:
    []

handled_by:
  required_rules: []
  required_skills: []
  optional_skills: ["design-tech"]

waiver_format: |
  PR body line: "concern-waived: third-party-script-impact — <reason>"

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

# third-party-script-impact

Analytics/marketing tags are the dominant TBT killer. async/defer + audit each.

# How to think about it

The handling skills/rules listed in `handled_by` provide the deeper checklist.
This concern's job is to ensure they engage when the signals match.
